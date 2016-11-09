// @flow
import Eventable from 'common/eventable'
import { revisionData, selectionData } from 'types/data'
import { onAck, onClientLeft, onSetName, onOperation, onSelection, onReconnect, onClient } from './types'

export default class Connector extends Eventable {

  onAck (fn: onAck): void {
    this.on('ack', fn)
  }

  onClientLeft (fn: onClientLeft): void {
    this.on('client_left', fn)
  }

  onOperation (fn: onOperation): void {
    this.on('operation', fn)
  }

  onSelection (fn: onSelection): void {
    this.on('selection', fn)
  }

  onSetName (fn: onSetName): void {
    this.on('set_name', fn)
  }

  onClients (fn: onClient): void {
    this.on('clients', fn)
  }

  onReconnect (fn: onReconnect): void {
    this.on('reconnect', fn)
  }

  sendOperation (revision: revisionData, operation: Array<any>, selection: selectionData): void {
  }

  sendSelection (selection: selectionData): void {
  }
}
