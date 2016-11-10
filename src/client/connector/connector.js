// @flow
import Eventable from 'common/eventable'
import { revisionData, selectionData } from 'types/data'
import { onAck, onClientLeft, onSetName, onOperation, onSelection, onReconnect, onClient } from './types'

export default class Connector extends Eventable {

  onAck (fn: onAck) {
    this.on('ack', fn)
  }

  onClientLeft (fn: onClientLeft) {
    this.on('client_left', fn)
  }

  onOperation (fn: onOperation) {
    this.on('operation', fn)
  }

  onSelection (fn: onSelection) {
    this.on('selection', fn)
  }

  onSetName (fn: onSetName) {
    this.on('set_name', fn)
  }

  onClients (fn: onClient) {
    this.on('clients', fn)
  }

  onReconnect (fn: onReconnect) {
    this.on('reconnect', fn)
  }

  sendOperation (revision: revisionData, operation: Array<any>, selection: selectionData) {
  }

  sendSelection (selection: selectionData) {
  }
}
