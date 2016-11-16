// @flow
import Client from 'client/client'
import AwaitingWithBuffer from 'client/status/awaiting-with-buffer'
import { clientData } from 'types/data'
import OtherClient from 'client/other-client'
import Selection from 'client/selection'
import UndoManager from 'client/undo-manager'
import Connector from 'client/connector/connector'
import Adapter from 'client/adapters/adapter'
import { selectionData, revisionData } from 'client/connector/types'
import TextOperation from 'ot/text-operation'
import WrappedOperation from 'ot/wrapped-operation'
import SelfMeta from 'client/self-meta'

export default class EditorClient extends Client {
  serverAdapter: Connector
  editorAdapter: Adapter
  undoManager: UndoManager
  clients: { [key: string]: clientData }
  selection: ?Selection

  constructor (revision: revisionData, clients: { [key: string]:clientData }, serverAdapter: Connector, editorAdapter: Adapter): void {
    super(revision)
    this.serverAdapter = serverAdapter
    this.editorAdapter = editorAdapter
    this.undoManager = new UndoManager()

    this.initializeClients(clients)

    const self: EditorClient = this
    this.editorAdapter.onChange(this.onChange.bind(this))
    this.editorAdapter.onSelectionChange(this.onSelectionChange.bind(this))
    this.editorAdapter.onBlur(this.onBlur.bind(this))

    this.editorAdapter.registerUndo((): void => {
      self.undo()
    })

    this.editorAdapter.registerRedo((): void => {
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

  addClient (clientId: string, clientObj: clientData): void {
    this.clients[clientId] = new OtherClient(
      clientId,
      this.editorAdapter,
      clientObj.name || clientId,
      clientObj.selection ? Selection.fromJSON(clientObj.selection) : null
    )
  }

  initializeClients (clients: { [key: string]:clientData }): void {
    this.clients = {}
    for (const clientId: string in clients) {
      if (clients.hasOwnProperty(clientId)) {
        this.addClient(clientId, clients[clientId])
      }
    }
  }

  getClientObject (clientId: string): OtherClient {
    const client = this.clients[clientId]
    if (client) {
      return client
    }

    const newClient: OtherClient = new OtherClient(
      clientId,
      this.editorAdapter
    )
    this.clients[clientId] = newClient
    return newClient
  }

  onClientLeft (clientId: string): void {
    console.log(`User disconnected: ${clientId}`)
    const client = this.clients[clientId]
    if (!client) {
      return void 0
    }
    client.remove()
    delete this.clients[clientId]
  }

  applyUnredo (operation: WrappedOperation): void {
    this.undoManager.add(operation.invert(this.editorAdapter.getValue()))
    this.editorAdapter.applyOperation(operation.wrapped)
    this.selection = operation.meta.selectionAfter
    this.editorAdapter.setSelection(this.selection)
    this.applyClient(operation.wrapped)
  }

  undo (): void {
    if (!this.undoManager.canUndo()) {
      return void 0
    }
    this.undoManager.performUndo((o): void => {
      this.applyUnredo(o)
    })
  }

  redo (): void {
    if (!this.undoManager.canRedo()) {
      return
    }
    this.undoManager.performRedo((o: WrappedOperation): void => {
      this.applyUnredo(o)
    })
  }

  onChange (textOperation: TextOperation, inverse: TextOperation): void {
    const selectionBefore = this.selection
    this.updateSelection()
    const undoStack = this.undoManager.undoStack

    const compose: boolean = this.undoManager.undoStack.length > 0 &&
      inverse.shouldBeComposedWithInverted(undoStack[undoStack.length - 1].wrapped)
    const inverseMeta: SelfMeta = new SelfMeta(this.selection, selectionBefore)
    this.undoManager.add(new WrappedOperation(inverse, inverseMeta), compose)
    this.applyClient(textOperation)
  }

  onSetName (clientId: string, name: string): void {
    this.getClientObject(clientId).setName(name)
  }

  onRecieveOperation (operation: Array<any>): void {
    this.applyServer(TextOperation.fromJSON(operation))
  }

  updateSelection (): void {
    this.selection = this.editorAdapter.getSelection()
  }

  onUpdateClients (clients: {[key: string]: clientData}): void {
    let clientId: string
    for (clientId in this.clients) {
      if (this.clients.hasOwnProperty(clientId) && !clients.hasOwnProperty(clientId)) {
        this.onClientLeft(clientId)
      }
    }

    for (clientId in clients) {
      if (clients.hasOwnProperty(clientId)) {
        const clientObject: OtherClient = this.getClientObject(clientId)

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

  onOtherClientSelectionChange (clientId: string, selection: selectionData): void {
    if (selection) {
      this.getClientObject(clientId).updateSelection(
        this.transformSelection(Selection.fromJSON(selection))
      )
    } else {
      this.getClientObject(clientId).removeSelection()
    }
  }

  onSelectionChange (): void {
    const oldSelection: ?Selection = this.selection
    this.updateSelection()
    if (oldSelection && this.selection != null && this.selection.equals(oldSelection)) {
      return
    }
    this.sendSelection(this.selection)
  }

  onReconnect (): void {
    this.serverReconnect()
  }

  onBlur (): void {
    this.selection = null
    this.sendSelection(null)
  }

  sendSelection (selection: selectionData): void {
    if (this.state instanceof AwaitingWithBuffer) {
      return
    }
    this.serverAdapter.sendSelection(selection)
  }

  sendOperation (revision: number, operation: TextOperation): void {
    this.serverAdapter.sendOperation(revision, operation.toJSON(), this.selection)
  }

  applyOperation (operation: TextOperation): void {
    this.editorAdapter.applyOperation(operation)
    this.updateSelection()
    this.undoManager.transform(new WrappedOperation(operation, null))
  }
}

