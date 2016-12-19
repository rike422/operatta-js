// @flow
import Client from 'client/client'
import AwaitingWithBuffer from 'client/status/awaiting-with-buffer'
import { clientData } from 'types/data'
import OtherClient from 'client/other-client'
import Selection from 'client/selection'
import UndoManager from 'client/undo-manager'
import Connector from 'client/connectors/connector'
import Adapter from 'client/adapters/adapter'
import { selectionData, revisionData } from 'client/connectors/types'
import TextOperation from 'ot/text-operation'
import WrappedOperation from 'ot/wrapped-operation'
import SelfMeta from 'client/self-meta'

export default class EditorClient extends Client {
  serverAdapter: Connector
  editorAdapter: Adapter
  undoManager: UndoManager
  clients: { [key: string]: clientData }
  selection: Selection

  constructor (revision: revisionData, clients: { [key: string]: clientData }, serverAdapter: Connector, editorAdapter: Adapter) {
    super(revision)
    this.serverAdapter = serverAdapter
    this.editorAdapter = editorAdapter
    this.undoManager = new UndoManager()
    this.selection = Selection.createCursor()

    this.initializeClients(clients)

    this.editorAdapter.onChange(this.onChange.bind(this))
    this.editorAdapter.onSelectionChange(this.onSelectionChange.bind(this))
    this.editorAdapter.onBlur(this.onBlur.bind(this))

    this.editorAdapter.registerUndo(() => this.undo())
    this.editorAdapter.registerRedo(() => this.redo())

    this.serverAdapter.onAck(this.serverAck.bind(this))
    this.serverAdapter.onClientLeft(this.onClientLeft.bind(this))
    this.serverAdapter.onSetName(this.onSetName.bind(this))
    this.serverAdapter.onOperation(this.onRecieveOperation.bind(this))
    this.serverAdapter.onSelection(this.onOtherClientSelectionChange.bind(this))
    this.serverAdapter.onClients(this.onUpdateClients.bind(this))
    this.serverAdapter.onReconnect(this.onReconnect.bind(this))
  }

  addClient (clientId: string, clientObj: clientData) {
    this.clients[clientId] = new OtherClient(
      clientId,
      this.editorAdapter,
      clientObj.name || clientId,
      clientObj.selection ? Selection.fromJSON(clientObj.selection) : null
    )
  }

  initializeClients (clients: { [key: string]: clientData }) {
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

  onClientLeft (clientId: string) {
    console.log(`User disconnected: ${clientId}`)
    const client = this.clients[clientId]
    if (!client) {
      return void 0
    }
    client.remove()
    delete this.clients[clientId]
  }

  applyUnredo (operation: WrappedOperation) {
    this.undoManager.add(operation.invert(this.editorAdapter.getValue()))
    this.editorAdapter.applyOperation(operation.wrapped)
    if (operation.meta != null) {
      this.selection = operation.meta.selectionAfter
    }
    this.editorAdapter.setSelection(this.selection)
    this.applyClient(operation.wrapped)
  }

  undo () {
    if (!this.undoManager.canUndo()) {
      return void 0
    }
    this.undoManager.performUndo((o) => {
      this.applyUnredo(o)
    })
  }

  redo () {
    if (!this.undoManager.canRedo()) {
      return
    }
    this.undoManager.performRedo((o: WrappedOperation) => {
      this.applyUnredo(o)
    })
  }

  onChange (textOperation: TextOperation, inverse: TextOperation) {
    const selectionBefore = this.selection
    this.updateSelection()
    const undoStack = this.undoManager.undoStack

    const compose: boolean = this.undoManager.undoStack.length > 0 &&
      inverse.shouldBeComposedWithInverted(undoStack[undoStack.length - 1].wrapped)
    const inverseMeta: SelfMeta = new SelfMeta(this.selection, selectionBefore)
    this.undoManager.add(new WrappedOperation(inverse, inverseMeta), compose)
    this.applyClient(textOperation)
  }

  onSetName (clientId: string, name: string) {
    this.getClientObject(clientId).setName(name)
  }

  onRecieveOperation (operation: Array<any>) {
    this.applyServer(TextOperation.fromJSON(operation))
  }

  updateSelection () {
    this.selection = this.editorAdapter.getSelection()
  }

  onUpdateClients (clients: {[key: string]: clientData}) {
    let clientId: string
    for (clientId in this.clients) {
      if (this.clients.hasOwnProperty(clientId) && !clients.hasOwnProperty(clientId)) {
        this.onClientLeft(clientId)
      }
    }

    Object.keys(clients).forEach((clientId) => {
      if (clients.hasOwnProperty(clientId)) {
        const client = clients[clientId]
        const clientObject: OtherClient = this.getClientObject(clientId)
        if (client.name) {
          clientObject.setName(client.name)
        }

        const selection = client.selection

        if (selection) {
          this.clients[clientId].updateSelection(
            this.transformSelection(Selection.fromJSON(selection))
          )
        } else {
          this.clients[clientId].removeSelection()
        }
      }
    })
  }

  onOtherClientSelectionChange (clientId: string, selection: selectionData) {
    if (selection) {
      this.getClientObject(clientId).updateSelection(
        this.transformSelection(Selection.fromJSON(selection))
      )
    } else {
      this.getClientObject(clientId).removeSelection()
    }
  }

  onSelectionChange () {
    const oldSelection: Selection = this.selection
    this.updateSelection()
    if (this.selection.equals(oldSelection)) {
      return
    }
    this.sendSelection(this.selection)
  }

  onReconnect () {
    this.serverReconnect()
  }

  onBlur () {
    this.selection = Selection.createCursor()
    this.sendSelection(Selection.createCursor())
  }

  sendSelection (selection: selectionData) {
    if (this.state instanceof AwaitingWithBuffer) {
      return
    }
    this.serverAdapter.sendSelection(selection)
  }

  sendOperation (revision: number, operation: TextOperation) {
    this.serverAdapter.sendOperation(revision, operation.toJSON(), this.selection)
  }

  applyOperation (operation: TextOperation) {
    this.editorAdapter.applyOperation(operation)
    this.updateSelection()
    this.undoManager.transform(new WrappedOperation(operation, undefined))
  }
}

