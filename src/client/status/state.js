export default class State {
  constructor (client) {
    this.client = client
  }

  transition(state, ...args) {
    this.client.setState(new state(this.client, ...args))
  }
}
