// @flow
import State from './state'
import Synchronized from './synchronized'
import AwaitingWithBuffer from './awaiting-with-buffer'
import Client from 'client/client'
import Selection from 'client/selection'
import TextOperation from 'ot/text-operation'

// In the 'AwaitingConfirm' state, there's one operation the client has sent
// to the server and is still waiting for an acknowledgement.
export default class AwaitingConfirm extends State {
  outstanding: any

  constructor (client: Client, outstanding: any) {
    super(client)
    // Save the pending operation
    this.outstanding = outstanding
  }

  applyClient (operation: TextOperation) {
    // When the user makes an edit, don't send the operation immediately,
    // instead switch to 'AwaitingWithBuffer' state
    this.transition(new AwaitingWithBuffer(this.client, this.outstanding, operation))
  }

  applyServer (operation: TextOperation) {
    // This is another client's operation. Visualization:
    //
    //                   /\
    // this.outstanding /  \ operation
    //                 /    \
    //                 \    /
    //  pair[1]         \  / pair[0] (new outstanding)
    //  (can be applied  \/
    //  to the client's
    //  current document)
    const pair = operation.constructor.transform(this.outstanding, operation)
    this.client.applyOperation(pair[1])
    this.transition(new AwaitingConfirm(this.client, pair[0]))
  }

  transformSelection (selection: Selection): Selection {
    return selection.transform(this.outstanding)
  }

  resend (client: Client) {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding operation.
    client.sendOperation(client.revision, this.outstanding)
  }

  serverAck () {
    // The client's operation has been acknowledged
    // => switch to synchronized state
    this.transition(new Synchronized(this.client))
  }
}
