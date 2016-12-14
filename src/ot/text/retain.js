import Operation from 'types/interfaces'

export default class Retain {

  compose (other: Operation): Operation {
  }

  equals (other: Operation): boolean {
  }

  toString (): string {
    return `retain ${op}`
  }
}
