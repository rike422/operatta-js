import State from './state'
import AwaitingConfirm from './awaiting-confirm'

// In the 'AwaitingWithBuffer' state, the client is waiting for an operation
// to be acknowledged by the server while buffering the edits the user makes
export default class AwaitingWithBuffer extends State {
  constructor (client, outstanding, buffer) {
    super(client)
    // Save the pending operation and the user's edits since then
    this.outstanding = outstanding
    this.buffer = buffer
  }

  applyClient (operation) {
    // Compose the user's changes onto the buffer
    const newBuffer = this.buffer.compose(operation)
    this.transition(AwaitingWithBuffer, this.outstanding, newBuffer)
  }

  applyServer (operation) {
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
    this.transition(AwaitingWithBuffer, pair1[0], pair2[0])
  }

  serverAck () {
    // The pending operation has been acknowledged
    // => send buffer
    const client = this.client
    client.sendOperation(client.revision, this.buffer)
    this.transition(AwaitingConfirm, this.buffer)
  }

  transformSelection (selection) {
    return selection.transform(this.outstanding).transform(this.buffer)
  }

  resend () {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding operation.
    this.client.sendOperation(this.client.revision, this.outstanding)
  }
}
