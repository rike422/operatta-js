// @flow
import { rangeData } from 'types/data'
import TextOperation from 'ot/text-operation'

// Range has `anchor` and `head` properties, which are zero-based indices into
// the document. The `anchor` is the side of the selection that stays fixed,
// `head` is the side of the selection where the cursor is. When both are
// equal, the range represents a cursor.
export class Range {
  anchor: number
  head: number

  static fromJSON = (obj: rangeData): Range => {
    return new Range(obj.anchor, obj.head)
  }

  constructor (anchor: number, head: number) {
    this.anchor = anchor
    this.head = head
  }

  equals (other: Range): boolean {
    return this.anchor === other.anchor && this.head === other.head
  }

  isEmpty (): boolean {
    return this.anchor === this.head
  }

  transform (other: TextOperation): Range {
    function transformIndex (index: number): number {
      let newIndex: number = index
      const ops: Array<any> = other.ops
      for (let i: number = 0, l: number = other.ops.length; i < l; i++) {
        if (TextOperation.isRetain(ops[i])) {
          index -= ops[i]
        } else if (TextOperation.isInsert(ops[i])) {
          newIndex += ops[i].length
        } else {
          newIndex -= Math.min(index, -ops[i])
          index += ops[i]
        }
        if (index < 0) {
          break
        }
      }
      return newIndex
    }

    const newAnchor: number = transformIndex(this.anchor)
    if (this.anchor === this.head) {
      return new Range(newAnchor, newAnchor)
    }
    return new Range(newAnchor, transformIndex(this.head))
  }
}

// A selection is basically an array of ranges. Every range represents a real
// selection or a cursor in the document (when the start position equals the
// end position of the range). The array must not be empty.
export default class Selection {
  position: ?number
  ranges: Array<Range>

  // Convenience method for creating selections only containing a single cursor
  // and no real selection range.
  static createCursor = (position: ?number): Selection => {
    if (position == null) {
      return new Selection([])
    }
    return new Selection([new Range(position, position)])
  }

  static fromJSON = (obj: { ranges: Array<rangeData> }): Selection => {
    const objRanges = obj.ranges || obj
    for (var i: number = 0, ranges: Array<Range> = []; i < objRanges.length; i++) {
      ranges[i] = Range.fromJSON(objRanges[i])
    }
    return new Selection(ranges)
  }

  constructor (ranges: Array<Range>) {
    this.ranges = ranges
  }

  // Return the more current selection information.
  compose (other: any) {
    return other
  }

  equals (other: Selection): boolean {
    if (this.position !== other.position) {
      return false
    }
    if (this.ranges.length !== other.ranges.length) {
      return false
    }
    // FIXME: Sort ranges before comparing them?
    for (let i: number = 0; i < this.ranges.length; i++) {
      if (!this.ranges[i].equals(other.ranges[i])) {
        return false
      }
    }
    return true
  }

  somethingSelected (): boolean {
    return this.ranges.some((range) => {
      return !range.isEmpty()
    })
  }

  // Update the selection with respect to an operation.
  transform (other: TextOperation): Selection {
    const newRanges = this.ranges.map((range: Range): Range => {
      return range.transform(other)
    })
    return new Selection(newRanges)
  }
}
