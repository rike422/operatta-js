// @flow
import type { Socket } from 'socket.io'
import TextOperation from 'ot/text-operation'
import WrappedOperation from 'ot/wrapped-operation'
import Server from './server'
import { revisionData } from 'types/data'
import Selection from 'client/selection'

type mayWriteCb = ((socket: Socket, cb: (mayWrite: boolean) => void) => void);

class EditorSocketIOServer extends Server {
  users: {}
  docId: string
  mayWrite: mayWriteCb

  constructor (document: string, operations: Array<any>, docId: string, mayWrite: mayWriteCb) {
    super(document, operations)
    this.users = {}
    this.docId = docId
    this.mayWrite = mayWrite || ((_: any, cb) => {
        cb(true)
      })
  }

  addClient (socket: Socket) {
    const self: EditorSocketIOServer = this
    socket
      .join(this.docId)
      .emit('doc', {
        str: this.document,
        revision: this.operations.length,
        clients: this.users
      })
      .on('operation', (revision: revisionData, operation: Array<any>, selection: Selection) => {
        self.mayWrite(socket, (mayWrite: boolean) => {
          // if (!mayWrite) {
          //   console.log("User doesn't have the right to edit.")
          //   return
          // }
          self.onOperation(socket, revision, operation, selection)
        })
      })
      .on('selection', (obj) => {
        self.mayWrite(socket, (mayWrite: boolean) => {
          // if (!mayWrite) {
          //   console.log("User doesn't have the right to edit.")
          //   return
          // }
          self.updateSelection(socket, obj && Selection.fromJSON(obj))
        })
      })
      .on('disconnect', () => {
        console.log('Disconnect')
        socket.leave(self.docId)
        self.onDisconnect(socket)
        if (
          (socket.ns && Object.keys(socket.nsp.connected).length === 0)
        ) {
          self.emit('empty-room')
        }
      })
  }

  onOperation (socket: Socket, revision: revisionData, operation: Array<any>, selection: Selection) {
    let wrapped
    try {
      wrapped = new WrappedOperation(
        TextOperation.fromJSON(operation),
        selection && Selection.fromJSON(selection)
      )
    } catch (exc) {
      console.error(`Invalid operation received: ${exc}`)
      return
    }

    try {
      const clientId = socket.id
      const wrappedPrime = this.receiveOperation(revision, wrapped)
      console.log(`new operation: ${wrapped.toString()}`)
      this.getClient(clientId).selection = wrappedPrime.meta
      socket.emit('ack')
      socket.broadcast.in(this.docId).emit(
        'operation', clientId,
        wrappedPrime.wrapped.toJSON(), wrappedPrime.meta
      )
    } catch (exc) {
      console.error(exc)
    }
  }

  updateSelection (socket: Socket, selection: Selection) {
    const clientId = socket.id
    if (selection) {
      this.getClient(clientId).selection = selection
    } else {
      delete this.getClient(clientId).selection
    }
    socket.broadcast.in(this.docId).emit('selection', clientId, selection)
  }

  setName (socket: Socket, name: string) {
    const clientId = socket.id
    this.getClient(clientId).name = name
    socket.broadcast.in(this.docId).emit('set_name', clientId, name)
  }

  getClient (clientId: string) {
    return this.users[clientId] || (this.users[clientId] = {})
  }

  onDisconnect (socket: Socket) {
    const clientId = socket.id
    delete this.users[clientId]
    socket.broadcast.in(this.docId).emit('client_left', clientId)
  }
}

export default EditorSocketIOServer
