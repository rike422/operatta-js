export default class Connector {

  constructor () {
    this.callbacks = {}
  }

  on (type, fn) {
    const callBacks = this.callbacks[type] || []
    callBacks.push(fn)
    this.callbacks[type] = callBacks
  }

  off (type, fn) {
    const callBacks = this.callbacks[type] || []
    this.callbacks[type] = callBacks.filter(_fn => fn === _fn)
  }

  onAck (fn) {
    this.on('ack', fn)
  }

  offAck (fn) {
    this.off('ack', fn)
  }

  onClientLeft (fn) {
    this.on('client_left', fn)
  }

  onOperation (fn) {
    this.on('operation', fn)
  }

  onSelection (fn) {
    this.on('selection', fn)
  }

  onSetName (fn) {
    this.on('set_name', fn)
  }

  onClients (fn) {
    this.on('clients', fn)
  }

  onReconnect (fn) {
    this.on('reconnect', fn)
  }

  trigger (type, ...args) {
    const callBacks = this.callbacks && this.callbacks[type]
    callBacks.forEach(cb => cb(...args))
  }
}
