import Connector from 'client/connector/connector'
export default class ServerConnectorMock extends Connector {
  constructor () {
    super()
    this.sentOperation = this.sentSelection = null
  }

  sendOperation (revision, operation, selection) {
    this.sentRevision = revision
    this.sentOperation = operation
    this.sentSelectionWithOperation = selection
  }

  sendSelection (selection) {
    this.sentSelection = selection
  }
}