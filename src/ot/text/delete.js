import Operation from 'types/interfaces'

export default class Delete {
  compose (other: Operation): Operation {
  }

  equals (other: Operation): boolean {
  }

  toString (): string {
    return `delete ${-this.op}`
  }
}
