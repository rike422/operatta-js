// @flow
import type { Socket } from 'socket.io'
import TextOperation from 'ot/text-operation'
import WrappedOperation from 'ot/wrapped-operation'
import Server from './document'
import Link from './link'

type mayWriteCb = ((socket: Socket, cb: (mayWrite: boolean) => void) => void);

class ConnectableDocument extends Server {
  users: {}
  docId: string
  authers: Array<Link>
  pendings: Array<Link>

  constructor (document: string, operations: Array<any>, docId: string, authers: Array<Link>) {
    super(document, operations)
    this.users = {}
    this.docId = docId
    this.authers = authers
    this.pendings = []
  }

  addClient (link: Link) {
    this.pendings.push(pending)
    const requests = this.authers.map((link: Link): Array<Promise<boolean>> => {
      return link.requestAuthenticate(pending)
    })
    Promise.race(requests).then(() => {
      link.on()
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

export default ConnectableDocument
