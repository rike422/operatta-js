// @flow weak
export default class State {
  constructor (client) {
    this.client = client
  }

  transition (State, ...args) {
    this.client.setState(new State(this.client, ...args))
  }
}
