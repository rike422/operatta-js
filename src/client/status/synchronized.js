// @flow
import State from './state'
import AwaitingConfirm from './awaiting-confirm'
import Client from 'client/client'
import Selection from 'client/selection'
import TextOperation from 'ot/text-operation'

// In the 'Synchronized' state, there is no pending operation that the client
// has sent to the server.
export default class Synchronized extends State {
  client: Client

  applyServer (operation: TextOperation) {
    // When we receive a new operation from the server, the operation can be
    // simply applied to the current document
    this.client.applyOperation(operation)
  }

  applyClient (operation: TextOperation) {
    // When the user makes an edit, send the operation to the server and
    // switch to the 'AwaitingConfirm' state
    const client = this.client
    client.sendOperation(client.revision, operation)
    this.transition(new AwaitingConfirm(this.client, operation))
  }

  serverAck () {
    throw new Error('There is no pending operation.')
  }

  // Nothing to do because the latest server state and client state are the same.
  transformSelection (x: Selection): Selection { return x }
}
