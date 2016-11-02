// translation of https://github.com/djspiewak/cccp/blob/master/agent/src/main/scala/com/codecommit/cccp/agent/state.scala
import Synchronized from './status/synchronized'
import State from './status/state'

export default class Client {


  constructor (revision) {
    this.revision = revision // the next expected revision number
    this.state = new Synchronized(this) // start state
  }

  setState (state) {
    this.state = state
  }

  // Call this method when the user changes the document.
  applyClient (operation) {
    this.state.applyClient(operation)
  }

  // Call this method with a new operation from the server
  applyServer (operation) {
    this.revision++
    this.state.applyServer(operation)
  }

  serverAck () {
    this.revision++
    this.state.serverAck()
  }

  serverReconnect () {
    if (typeof this.state.resend === 'function') {
      this.state.resend()
    }
  }

  // Override this method.
  applyOperation (operation) {
    throw new Error('applyOperation must be defined in child class')
  }

  // Override this method.
  sendOperation (revision, operation) {
    throw new Error('sendOperation must be defined in child class')
  }

  // Transforms a selection from the latest known server state to the current
  // client state. For example, if we get from the server the information that
  // another user's cursor is at position 3, but the server hasn't yet received
  // our newest operation, an insertion of 5 characters at the beginning of the
  // document, the correct position of the other user's cursor in our current
  // document is 8.
  transformSelection (selection) {
    return this.state.transformSelection(selection)
  }
}
