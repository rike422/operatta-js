// @flow
import Connector from './connector'
import { selectionData, revisionData } from 'types/data'
import { Emitter as Socket } from 'socket.io-client'
import EventEmitter from 'events'

export default class SocketIO extends Connector {
  socket: Socket

  constructor (socket: EventEmitter): void {
    super()
    this.socket = socket
    socket
      .on('client_left', (clientId: string): void => {
        this.trigger('client_left', clientId)
      })
      .on('set_name', (clientId: string, name: string): void => {
        this.trigger('set_name', clientId, name)
      })
      .on('ack', (): void => {
        this.trigger('ack')
      })
      .on('operation', (clientId: string, operation: Array<any>, selection: selectionData): void => {
        this.trigger('operation', operation)
        this.trigger('selection', clientId, selection)
      })
      .on('selection', (clientId: string, selection: selectionData): void => {
        this.trigger('selection', clientId, selection)
      })
      .on('reconnect', (): void => {
        this.trigger('reconnect')
      })
  }

  sendOperation (revision: revisionData, operation: Array<any>, selection: selectionData): void {
    this.socket.emit('operation', revision, operation, selection)
  }

  sendSelection (selection: selectionData): void {
    this.socket.emit('selection', selection)
  }
}
