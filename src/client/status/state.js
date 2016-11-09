// @flow
import Client from 'client/client'
import Selection from 'client/selection'
import TextOperation from 'ot/text-operation'

export default class State {
  client: Client;

  constructor (client: Client): void {
    this.client = client
  }

  transition (nextState: State): void {
    this.client.setState(nextState)
  }

  serverAck (): void {
  }

  resend (client: Client): void {
  }

  applyServer (operation: TextOperation): void {
  }

  applyClient (operation: TextOperation): void {
  }

  transformSelection (x: Selection): Selection { return x }
}

