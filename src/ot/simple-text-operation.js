// @flow

import TextOperation from './text-operation'

// Insert the string `str` at the zero-based `position` in the document.
class Insert {
  str: string
  position: number

  constructor (str: string, position: number): void {
    this.str = str
    this.position = position
  }

  toString (): string {
    return `Insert(${JSON.stringify(this.str)}, ${this.position})`
  }

  equals (other: Insert): boolean {
    return other instanceof Insert &&
      this.str === other.str &&
      this.position === other.position
  }

  apply (doc: string): string {
    return doc.slice(0, this.position) + this.str + doc.slice(this.position)
  }
}

// Delete `count` many characters at the zero-based `position` in the document.
class Delete {
  count: number
  position: number

  constructor (count: number, position: number): void {
    this.count = count
    this.position = position
  }

  toString (): string {
    return `Delete(${this.count}, ${this.position})`
  }

  equals (other: Delete): boolean {
    return other instanceof Delete &&
      this.count === other.count &&
      this.position === other.position
  }

  apply (doc: string): string {
    return doc.slice(0, this.position) + doc.slice(this.position + this.count)
  }
}

// An operation that does nothing. This is needed for the result of the
// transformation of two deletions of the same character.
class Noop {
  toString (): string {
    return 'Noop()'
  }

  equals (other): boolean {
    return other instanceof Noop
  }

  apply (doc): string {
    return doc
  }
}

const noop: Noop = new Noop()

export default class SimpleTextOperation {

  static Insert = Insert
  static Delete = Delete
  static Noop = Noop
  static transform = (a, b): [$Either<Insert, Noop, Delete>, $Either<Insert, Noop, Delete>] => {
    if (a instanceof Noop || b instanceof Noop) {
      return [a, b]
    }

    if (a instanceof Insert && b instanceof Insert) {
      if (a.position < b.position || (a.position === b.position && a.str < b.str)) {
        return [a, new Insert(b.str, b.position + a.str.length)]
      }
      if (a.position > b.position || (a.position === b.position && a.str > b.str)) {
        return [new Insert(a.str, a.position + b.str.length), b]
      }
      return [noop, noop]
    }

    if (a instanceof Insert && b instanceof Delete) {
      if (a.position <= b.position) {
        return [a, new Delete(b.count, b.position + a.str.length)]
      }
      if (a.position >= b.position + b.count) {
        return [new Insert(a.str, a.position - b.count), b]
      }
      // Here, we have to delete the inserted string of operation a.
      // That doesn't preserve the intention of operation a, but it's the only
      // thing we can do to get a valid transform function.
      return [noop, new Delete(b.count + a.str.length, b.position)]
    }

    if (a instanceof Delete && b instanceof Insert) {
      if (a.position >= b.position) {
        return [new Delete(a.count, a.position + b.str.length), b]
      }
      if (a.position + a.count <= b.position) {
        return [a, new Insert(b.str, b.position - a.count)]
      }
      // Same problem as above. We have to delete the string that was inserted
      // in operation b.
      return [new Delete(a.count + b.str.length, a.position), noop]
    }

    if (a instanceof Delete && b instanceof Delete) {
      if (a.position === b.position) {
        if (a.count === b.count) {
          return [noop, noop]
        } else if (a.count < b.count) {
          return [noop, new Delete(b.count - a.count, b.position)]
        }
        return [new Delete(a.count - b.count, a.position), noop]
      }

      if (a.position < b.position) {
        if (a.position + a.count <= b.position) {
          return [a, new Delete(b.count, b.position - a.count)]
        }
        if (a.position + a.count >= b.position + b.count) {
          return [new Delete(a.count - b.count, a.position), noop]
        }
        return [
          new Delete(b.position - a.position, a.position),
          new Delete(b.position + b.count - (a.position + a.count), a.position)
        ]
      }

      if (a.position > b.position) {
        if (a.position >= b.position + b.count) {
          return [new Delete(a.count, a.position - b.count), b]
        }
        if (a.position + a.count <= b.position + b.count) {
          return [noop, new Delete(b.count - a.count, b.position)]
        }
        return [
          new Delete(a.position + a.count - (b.position + b.count), b.position),
          new Delete(a.position - b.position, b.position)
        ]
      }
    }
    return [a, b]
  }

  // Convert a normal, composable `TextOperation` into an array of
  // `SimpleTextOperation`s.
  static fromTextOperation = (operation: TextOperation): Array<any> => {
    const simpleOperations = []
    let index: number = 0
    for (let i: number = 0; i < operation.ops.length; i++) {
      const op = operation.ops[i]
      if (TextOperation.isRetain(op)) {
        index += op
      } else if (TextOperation.isInsert(op)) {
        simpleOperations.push(new Insert(op, index))
        index += op.length
      } else {
        simpleOperations.push(new Delete(Math.abs(op), index))
      }
    }
    return simpleOperations
  }
}
