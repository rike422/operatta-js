// @flow
import State from './state'
import AwaitingConfirm from './awaiting-confirm'
import Client from 'client/client'
import Selection from 'client/selection'
import TextOperation from 'ot/text-operation'

// In the 'AwaitingWithBuffer' state, the client is waiting for an operation
// to be acknowledged by the server while buffering the edits the user makes
export default class AwaitingWithBuffer extends State {
  outstanding: TextOperation;
  buffer: TextOperation;
  client: Client;

  constructor (client: Client, outstanding: TextOperation, buffer: TextOperation) {
    super(client)
    // Save the pending operation and the user's edits since then
    this.outstanding = outstanding
    this.buffer = buffer
  }

  applyClient (operation: TextOperation) {
    // Compose the user's changes onto the buffer
    const newBuffer = this.buffer.compose(operation)
    this.transition(new AwaitingWithBuffer(this.client, this.outstanding, newBuffer))
  }

  applyServer (operation: TextOperation) {
    // Operation comes from another client
    //
    //                       /\
    //     this.outstanding /  \ operation
    //                     /    \
    //                    /\    /
    //       this.buffer /  \* / pair1[0] (new outstanding)
    //                  /    \/
    //                  \    /
    //          pair2[1] \  / pair2[0] (new buffer)
    // the transformed    \/
    // operation -- can
    // be applied to the
    // client's current
    // document
    //
    // * pair1[1]
    const transform = operation.constructor.transform
    const pair1 = transform(this.outstanding, operation)
    const pair2 = transform(this.buffer, pair1[1])
    this.client.applyOperation(pair2[1])
    this.transition(new AwaitingWithBuffer(this.client, pair1[0], pair2[0]))
  }

  serverAck () {
    // The pending operation has been acknowledged
    // => send buffer
    const client = this.client
    client.sendOperation(client.revision, this.buffer)
    this.transition(new AwaitingConfirm(this.client, this.buffer))
  }

  transformSelection (selection: Selection): Selection {
    return selection.transform(this.outstanding).transform(this.buffer)
  }

  resend () {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding operation.
    this.client.sendOperation(this.client.revision, this.outstanding)
  }
}
