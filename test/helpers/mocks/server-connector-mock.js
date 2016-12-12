import Connector from 'client/connector/connector'
import Selection from 'client/selection'
export default class ServerConnectorMock extends Connector {
  constructor () {
    super()
    this.sentSelection = Selection.createCursor()
    this.sentOperation = undefined
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