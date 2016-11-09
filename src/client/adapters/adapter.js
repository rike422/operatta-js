// @flow
import Eventable from 'common/eventable'
import Selection from 'client/selection'
import TextOperation from 'ot/text-operation'

export default class EditorAdaptor extends Eventable {

  applyOperation (operation: TextOperation): void {
    throw new Error('getValue must be defined in child class')
  }

  onChange (fn: (textOperation: TextOperation, inverse: TextOperation) => void): void {
    this.on('change', fn)
  }

  onSelectionChange (fn: () => void): void {
    this.on('selectionChange', fn)
  }

  onBlur (fn: () => void): void {
    this.on('blur', fn)
  }

  getValue (): string {
    throw new Error('getValue must be defined in child class')
  }

  registerUndo (undoFn: () => void): void {
    throw new Error('registerUndo must be defined in child class')
  }

  registerRedo (redoFn: () => void): void {
    throw new Error('registerRedo must be defined in child class')
  }

  getSelection (): Selection {
    throw new Error('getSelection must be defined in child class')
  }

  setSelection (selection: Selection): void {
    throw new Error('setSelection must be defined in child class')
  }

  setOtherSelection (selection: Selection, color: string, clientId: string): { clear: () => void } {
    throw new Error('setOtherSelection must be defined in child class')
  }
}
