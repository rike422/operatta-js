import Operation from 'types/interfaces'

export default class Insert {
  compose (other: Operation): Operation {
  }

  equals (other: Operation): boolean {
  }

  toString (): string {
    return `insert '${this.op}'`
  }
}
