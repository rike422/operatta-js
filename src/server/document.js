// @flow
import { revisionData } from 'types/data'
import EventEmitter from 'events'
import WrappedOperation from 'ot/wrapped-operation'

// Constructor. Takes the current content as a string and optionally the array
// of all operations.
export default class Document extends EventEmitter {
  operations: Array<any>
  content: string
  constructor (content: string, operations: Array<any>) {
    super()
    this.content = content
    this.operations = operations || []
  }

  // Call this method whenever you receive an operation from a client.
  receiveOperation (revision: revisionData, operation: WrappedOperation) {
    if (revision < 0 || this.operations.length < revision) {
      throw new Error('operation revision not in history')
    }
    // Find all operations that the client didn't know of when it sent the
    // operation ...
    const concurrentOperations = this.operations.slice(revision)

    // ... and transform the operation against all these operations ...
    const transform = operation.constructor.transform
    for (let i: number = 0; i < concurrentOperations.length; i++) {
      operation = transform(operation, concurrentOperations[i])[0]
    }

    // ... and apply that on the content.
    this.content = operation.apply(this.content)
    // Store operation in history.
    this.operations.push(operation)

    // It's the caller's responsibility to send the operation to all connected
    // clients and an acknowledgement to the creator.
    return operation
  }
}
