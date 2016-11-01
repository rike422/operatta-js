// @flow
import Eventable from 'common/eventable'

export default class Connector extends Eventable {

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

}
