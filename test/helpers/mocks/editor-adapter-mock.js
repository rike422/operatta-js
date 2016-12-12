import EditorAdapter from 'client/adapters/adapter'

export default class EditorAdapterMock extends EditorAdapter {
  constructor (value, selection) {
    super()
    this.value = value
    this.selection = selection
    this.undo = this.redo = null
    this.lastAppliedOperation = null
    this.otherSelections = []
  }

  registerCallbacks (cb) {
    this.callbacks = cb
  }

  registerUndo (undo) {
    this.undo = undo
  }

  registerRedo (redo) {
    this.redo = redo
  }

  getValue () {
    return this.value
  }

  getSelection () {
    return this.selection
  }

  setSelection (selection) {
    this.selection = selection
    this.trigger('selectionChange')
  }

  blur () {
    this.selection = null
    this.trigger('blur')
  }

  setOtherSelection (selection, color, clientId) {
    const otherSelections = this.otherSelections
    let cleared = false
    const selectionObj = {
      selection,
      color,
      clientId
    }
    otherSelections.push(selectionObj)
    return {
      clear () {
        if (cleared) {
          throw new Error('already cleared!')
        }
        cleared = true
        otherSelections.splice(otherSelections.indexOf(selectionObj), 1)
      }
    }
  }

  applyOperation (operation) {
    this.lastAppliedOperation = operation
    this.value = operation.apply(this.value)
    if (this.selection.ranges.length != 0) {
      const newSelection = this.selection.transform(operation)
      if (!this.selection.equals(newSelection)) {
        this.selection = newSelection
        this.trigger('selectionChange')
      }
    }
  }
}
