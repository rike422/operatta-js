// @flow
import Connector from './connector'
import { selectionData, revisionData } from 'types/data'
import type { Emitter as Socket } from 'socket.io-client'
import EventEmitter from 'events'

export default class SocketIO extends Connector {
  socket: Socket

  constructor (socket: EventEmitter) {
    super()
    this.socket = socket
    socket
      .on('client_left', (clientId: string) => {
        this.trigger('client_left', clientId)
      })
      .on('set_name', (clientId: string, name: string) => {
        this.trigger('set_name', clientId, name)
      })
      .on('ack', () => {
        this.trigger('ack')
      })
      .on('operation', (clientId: string, operation: Array<any>, selection: selectionData) => {
        this.trigger('operation', operation)
        this.trigger('selection', clientId, selection)
      })
      .on('selection', (clientId: string, selection: selectionData) => {
        this.trigger('selection', clientId, selection)
      })
      .on('reconnect', () => {
        this.trigger('reconnect')
      })
  }

  sendOperation (revision: revisionData, operation: Array<any>, selection: selectionData) {
    this.socket.emit('operation', revision, operation, selection)
  }

  sendSelection (selection: selectionData) {
    this.socket.emit('selection', selection)
  }
}
