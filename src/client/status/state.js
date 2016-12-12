// @flow
import Client from 'client/client'
import Selection from 'client/selection'
import TextOperation from 'ot/text-operation'

export default class State {
  client: Client;

  constructor (client: Client) {
    this.client = client
  }

  transition (nextState: State) {
    this.client.setState(nextState)
  }

  serverAck () {
  }

  resend (client: Client) {
  }

  applyServer (operation: TextOperation) {
  }

  applyClient (operation: TextOperation) {
  }

  transformSelection (x: Selection): Selection { return x }
}

