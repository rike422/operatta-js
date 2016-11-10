import Selection from 'client/selection'
import TextOperation from 'ot/text-operation'

export default class SelfMeta {
  selectionBefore: Selection
  selectionAfter: Selection

  constructor (selectionBefore: Selection, selectionAfter: Selection) {
    this.selectionBefore = selectionBefore
    this.selectionAfter = selectionAfter
  }

  invert (): SelfMeta {
    return new SelfMeta(this.selectionAfter, this.selectionBefore)
  }

  compose (other: SelfMeta): SelfMeta {
    return new SelfMeta(this.selectionBefore, other.selectionAfter)
  }

  transform (operation: TextOperation): SelfMeta {
    return new SelfMeta(
      this.selectionBefore.transform(operation),
      this.selectionAfter.transform(operation)
    )
  }
}
