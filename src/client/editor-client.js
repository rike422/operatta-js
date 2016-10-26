import Client from 'client/client'
import Selection from 'client/selection'
import UndoManager from 'client/undo-manager'
import TextOperation from 'ot/text-operation'
import WrappedOperation from 'ot/wrapped-operation'

class SelfMeta {
  constructor (selectionBefore, selectionAfter) {
    this.selectionBefore = selectionBefore
    this.selectionAfter = selectionAfter
  }

  invert () {
    return new SelfMeta(this.selectionAfter, this.selectionBefore)
  }

  compose (other) {
    return new SelfMeta(this.selectionBefore, other.selectionAfter)
  }

  transform (operation) {
    return new SelfMeta(
      this.selectionBefore.transform(operation),
      this.selectionAfter.transform(operation)
    )
  }
}

class OtherMeta {
  constructor (clientId, selection) {
    this.clientId = clientId
    this.selection = selection
  }

  transform (operation) {
    return new OtherMeta(
      this.clientId,
      this.selection && this.selection.transform(operation)
    )
  }
}

OtherMeta.fromJSON = obj => new OtherMeta(
  obj.clientId,
  obj.selection && Selection.fromJSON(obj.selection)
)

class OtherClient {
  constructor (id, listEl, editorAdapter, name, selection) {
    this.id = id
    this.listEl = listEl
    this.editorAdapter = editorAdapter
    this.name = name

    this.li = document.createElement('li')
    if (name) {
      this.li.textContent = name
      this.listEl.appendChild(this.li)
    }

    this.setColor(name ? hueFromName(name) : Math.random())
    if (selection) {
      this.updateSelection(selection)
    }
  }

  setColor (hue) {
    this.hue = hue
    this.color = hsl2hex(hue, 0.75, 0.5)
    this.lightColor = hsl2hex(hue, 0.5, 0.9)
    if (this.li) {
      this.li.style.color = this.color
    }
  }

  setName (name) {
    if (this.name === name) {
      return
    }
    this.name = name

    this.li.textContent = name
    if (!this.li.parentNode) {
      this.listEl.appendChild(this.li)
    }

    this.setColor(hueFromName(name))
  }

  updateSelection (selection) {
    this.removeSelection()
    this.selection = selection
    this.mark = this.editorAdapter.setOtherSelection(
      selection,
      selection.position === selection.selectionEnd ? this.color : this.lightColor,
      this.id
    )
  }

  remove () {
    if (this.li) {
      removeElement(this.li)
    }
    this.removeSelection()
  }

  removeSelection () {
    if (this.mark) {
      this.mark.clear()
      this.mark = null
    }
  }
}

export default class EditorClient extends Client {
  constructor (revision, clients, serverAdapter, editorAdapter) {
    super(revision)
    this.serverAdapter = serverAdapter
    this.editorAdapter = editorAdapter
    this.undoManager = new UndoManager()

    this.initializeClientList()
    this.initializeClients(clients)

    const self = this

    this.editorAdapter.registerCallbacks({
      change (operation, inverse) {
        self.onChange(operation, inverse)
      },
      selectionChange () {
        self.onSelectionChange()
      },
      blur () {
        self.onBlur()
      }
    })
    this.editorAdapter.registerUndo(() => {
      self.undo()
    })
    this.editorAdapter.registerRedo(() => {
      self.redo()
    })
    this.serverAdapter.onAck(this.serverAck.bind(this))
    this.serverAdapter.onClientLeft(this.onClientLeft.bind(this))
    this.serverAdapter.onSetName(this.onSetName.bind(this))
    this.serverAdapter.onOperation(this.onRecieveOperation.bind(this))
    this.serverAdapter.onSelection(this.onOtherClientSelectionChange.bind(this))
    this.serverAdapter.onClients(this.onUpdateClients.bind(this))
    this.serverAdapter.onReconnect(this.onReconnect.bind(this))
  }

  addClient (clientId, clientObj) {
    this.clients[clientId] = new OtherClient(
      clientId,
      this.clientListEl,
      this.editorAdapter,
      clientObj.name || clientId,
      clientObj.selection ? Selection.fromJSON(clientObj.selection) : null
    )
  }

  initializeClients (clients) {
    this.clients = {}
    for (const clientId in clients) {
      if (clients.hasOwnProperty(clientId)) {
        this.addClient(clientId, clients[clientId])
      }
    }
  }

  getClientObject (clientId) {
    const client = this.clients[clientId]
    if (client) {
      return client
    }
    const newClient = new OtherClient(
      clientId,
      this.clientListEl,
      this.editorAdapter
    )
    this.clients[clientId] = newClient
    return newClient
  }

  onClientLeft (clientId) {
    console.log(`User disconnected: ${clientId}`)
    const client = this.clients[clientId]
    if (!client) {
      return void 0
    }
    client.remove()
    delete this.clients[clientId]
  }

  initializeClientList () {
    this.clientListEl = document.createElement('ul')
  }

  applyUnredo (operation) {
    this.undoManager.add(operation.invert(this.editorAdapter.getValue()))
    this.editorAdapter.applyOperation(operation.wrapped)
    this.selection = operation.meta.selectionAfter
    this.editorAdapter.setSelection(this.selection)
    this.applyClient(operation.wrapped)
  }

  undo () {
    if (!this.undoManager.canUndo()) {
      return void 0
    }
    this.undoManager.performUndo(o => {
      this.applyUnredo(o)
    })
  }

  redo () {
    if (!this.undoManager.canRedo()) {
      return
    }
    this.undoManager.performRedo(o => {
      this.applyUnredo(o)
    })
  }

  onChange (textOperation, inverse) {
    const selectionBefore = this.selection
    this.updateSelection()
    const compose = this.undoManager.undoStack.length > 0 &&
      inverse.shouldBeComposedWithInverted(last(this.undoManager.undoStack).wrapped)
    const inverseMeta = new SelfMeta(this.selection, selectionBefore)
    this.undoManager.add(new WrappedOperation(inverse, inverseMeta), compose)
    this.applyClient(textOperation)
  }

  onSetName (clientId, name) {
    this.getClientObject(clientId).setName(name)
  }

  onRecieveOperation (operation) {
    this.applyServer(TextOperation.fromJSON(operation))
  }

  updateSelection () {
    this.selection = this.editorAdapter.getSelection()
  }

  onUpdateClients (clients) {
    let clientId
    for (clientId in this.clients) {
      if (this.clients.hasOwnProperty(clientId) && !clients.hasOwnProperty(clientId)) {
        this.onClientLeft(clientId)
      }
    }

    for (clientId in clients) {
      if (clients.hasOwnProperty(clientId)) {
        const clientObject = this.getClientObject(clientId)

        if (clients[clientId].name) {
          clientObject.setName(clients[clientId].name)
        }

        const selection = clients[clientId].selection
        if (selection) {
          this.clients[clientId].updateSelection(
            this.transformSelection(Selection.fromJSON(selection))
          )
        } else {
          this.clients[clientId].removeSelection()
        }
      }
    }
  }

  onOtherClientSelectionChange (clientId, selection) {
    if (selection) {
      this.getClientObject(clientId).updateSelection(
        this.transformSelection(Selection.fromJSON(selection))
      )
    } else {
      this.getClientObject(clientId).removeSelection()
    }
  }

  onSelectionChange () {
    const oldSelection = this.selection
    this.updateSelection()
    if (oldSelection && this.selection.equals(oldSelection)) {
      return
    }
    this.sendSelection(this.selection)
  }

  onReconnect () {
    this.serverReconnect()
  }
  onBlur () {
    this.selection = null
    this.sendSelection(null)
  }

  sendSelection (selection) {
    if (this.state instanceof Client.AwaitingWithBuffer) {
      return
    }
    this.serverAdapter.sendSelection(selection)
  }

  sendOperation (revision, operation) {
    this.serverAdapter.sendOperation(revision, operation.toJSON(), this.selection)
  }

  applyOperation (operation) {
    this.editorAdapter.applyOperation(operation)
    this.updateSelection()
    this.undoManager.transform(new WrappedOperation(operation, null))
  }
}

function rgb2hex (r, g, b) {
  function digits (n) {
    const m = Math.round(255 * n).toString(16)
    return m.length === 1 ? `0${m}` : m
  }

  return `#${digits(r)}${digits(g)}${digits(b)}`
}

function hsl2hex (h, s, l) {
  if (s === 0) {
    return rgb2hex(l, l, l)
  }
  const var2 = l < 0.5 ? l * (1 + s) : (l + s) - (s * l)
  const var1 = 2 * l - var2
  const hue2rgb = hue => {
    if (hue < 0) {
      hue += 1
    }
    if (hue > 1) {
      hue -= 1
    }
    if (6 * hue < 1) {
      return var1 + (var2 - var1) * 6 * hue
    }
    if (2 * hue < 1) {
      return var2
    }
    if (3 * hue < 2) {
      return var1 + (var2 - var1) * 6 * (2 / 3 - hue)
    }
    return var1
  }
  return rgb2hex(hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3))
}

function hueFromName (name) {
  let a = 1
  for (let i = 0; i < name.length; i++) {
    a = 17 * (a + name.charCodeAt(i)) % 360
  }
  return a / 360
}

function last (arr) {
  return arr[arr.length - 1]
}

// Remove an element from the DOM.
function removeElement (el) {
  if (el.parentNode) {
    el.parentNode.removeChild(el)
  }
}
