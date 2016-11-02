import Client from 'client/client'
import AwaitingWithBuffer from 'client/status/awaiting-with-buffer'
import OtherClient from 'client/other-client'
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

export default class EditorClient extends Client {
  constructor (revision, clients, serverAdapter, editorAdapter) {
    super(revision)
    this.serverAdapter = serverAdapter
    this.editorAdapter = editorAdapter
    this.undoManager = new UndoManager()

    this.initializeClientList()
    this.initializeClients(clients)

    const self = this
    this.editorAdapter.onChange(this.onChange.bind(this))
    this.editorAdapter.onSelectionChange(this.onSelectionChange.bind(this))
    this.editorAdapter.onBlur(this.onBlur.bind(this))

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
    const undoStack = this.undoManager.undoStack

    const compose = this.undoManager.undoStack.length > 0 &&
      inverse.shouldBeComposedWithInverted(undoStack[undoStack.length - 1].wrapped)
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
    if (this.state instanceof AwaitingWithBuffer) {
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

