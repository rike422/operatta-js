import State from './state'
import AwaitingConfirm from './awaiting-confirm'

// In the 'Synchronized' state, there is no pending operation that the client
// has sent to the server.
export default class Synchronized extends State {

  applyServer (operation) {
    // When we receive a new operation from the server, the operation can be
    // simply applied to the current document
    this.client.applyOperation(operation)
    return this
  }

  applyClient (operation) {
    // When the user makes an edit, send the operation to the server and
    // switch to the 'AwaitingConfirm' state
    const client = this.client
    client.sendOperation(client.revision, operation)
    this.transition(AwaitingConfirm, operation)
  }

  serverAck () {
    throw new Error('There is no pending operation.')
  }

  // Nothing to do because the latest server state and client state are the same.
  transformSelection (x) { return x }
}
