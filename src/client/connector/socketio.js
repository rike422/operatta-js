// @flow
import Connector from './connector'
export default class SocketIO extends Connector {
  constructor (socket) {
    super()
    this.socket = socket
    socket
      .on('client_left', clientId => {
        this.trigger('client_left', clientId)
      })
      .on('set_name', (clientId, name) => {
        this.trigger('set_name', clientId, name)
      })
      .on('ack', () => {
        this.trigger('ack')
      })
      .on('operation', (clientId, operation, selection) => {
        this.trigger('operation', operation)
        this.trigger('selection', clientId, selection)
      })
      .on('selection', (clientId, selection) => {
        this.trigger('selection', clientId, selection)
      })
      .on('reconnect', () => {
        this.trigger('reconnect')
      })
  }

  sendOperation (revision, operation, selection) {
    this.socket.emit('operation', revision, operation, selection)
  }

  sendSelection (selection) {
    this.socket.emit('selection', selection)
  }

  registerCallbacks (cb) {
    this.callbacks = cb
  }
}
