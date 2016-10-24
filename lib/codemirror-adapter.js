/* global ot */
import TextOperation from './text-operation'
import Selection from './selection'

export default class CodeMirrorAdapter {
  constructor (cm) {
    this.cm = cm
    this.ignoreNextChange = false
    this.changeInProgress = false
    this.selectionChanged = false

    bind(this, 'onChanges')
    bind(this, 'onChange')
    bind(this, 'onCursorActivity')
    bind(this, 'onFocus')
    bind(this, 'onBlur')

    cm.on('changes', this.onChanges)
    cm.on('change', this.onChange)
    cm.on('cursorActivity', this.onCursorActivity)
    cm.on('focus', this.onFocus)
    cm.on('blur', this.onBlur)
  }

  // Removes all event listeners from the CodeMirror instance.
  detach () {
    this.cm.off('changes', this.onChanges)
    this.cm.off('change', this.onChange)
    this.cm.off('cursorActivity', this.onCursorActivity)
    this.cm.off('focus', this.onFocus)
    this.cm.off('blur', this.onBlur)
  }

  registerCallbacks (cb) {
    this.callbacks = cb
  }

  onChange () {
    // By default, CodeMirror's event order is the following:
    // 1. 'change', 2. 'cursorActivity', 3. 'changes'.
    // We want to fire the 'selectionChange' event after the 'change' event,
    // but need the information from the 'changes' event. Therefore, we detect
    // when a change is in progress by listening to the change event, setting
    // a flag that makes this adapter defer all 'cursorActivity' events.
    this.changeInProgress = true
  }

  onChanges (_, changes) {
    if (!this.ignoreNextChange) {
      const pair = CodeMirrorAdapter.operationFromCodeMirrorChanges(changes, this.cm)
      this.trigger('change', pair[0], pair[1])
    }
    if (this.selectionChanged) {
      this.trigger('selectionChange')
    }
    this.changeInProgress = false
    this.ignoreNextChange = false
  }

  onBlur () {
    if (!this.cm.somethingSelected()) {
      this.trigger('blur')
    }
  }

  getValue () {
    return this.cm.getValue()
  }

  getSelection () {
    const cm = this.cm

    const selectionList = cm.listSelections()
    const ranges = []
    for (let i = 0; i < selectionList.length; i++) {
      ranges[i] = new Selection.Range(
        cm.indexFromPos(selectionList[i].anchor),
        cm.indexFromPos(selectionList[i].head)
      )
    }

    return new Selection(ranges)
  }

  setSelection (selection) {
    const ranges = []
    for (let i = 0; i < selection.ranges.length; i++) {
      const range = selection.ranges[i]
      ranges[i] = {
        anchor: this.cm.posFromIndex(range.anchor),
        head: this.cm.posFromIndex(range.head)
      }
    }
    this.cm.setSelections(ranges)
  }

  setOtherCursor (position, color, clientId) {
    const cursorPos = this.cm.posFromIndex(position)
    const cursorCoords = this.cm.cursorCoords(cursorPos)
    const cursorEl = document.createElement('span')
    cursorEl.className = 'other-client'
    cursorEl.style.display = 'inline-block'
    cursorEl.style.padding = '0'
    cursorEl.style.marginLeft = cursorEl.style.marginRight = '-1px'
    cursorEl.style.borderLeftWidth = '2px'
    cursorEl.style.borderLeftStyle = 'solid'
    cursorEl.style.borderLeftColor = color
    cursorEl.style.height = `${(cursorCoords.bottom - cursorCoords.top) * 0.9}px`
    cursorEl.style.zIndex = 0
    cursorEl.setAttribute('data-clientid', clientId)
    return this.cm.setBookmark(cursorPos, { widget: cursorEl, insertLeft: true })
  }

  setOtherSelectionRange (range, color, clientId) {
    const match = /^#([0-9a-fA-F]{6})$/.exec(color)
    if (!match) {
      throw new Error('only six-digit hex colors are allowed.')
    }
    const selectionClassName = `selection-${match[1]}`
    const rule = `.${selectionClassName} { background: ${color}; }`
    addStyleRule(rule)

    const anchorPos = this.cm.posFromIndex(range.anchor)
    const headPos = this.cm.posFromIndex(range.head)

    return this.cm.markText(
      minPos(anchorPos, headPos),
      maxPos(anchorPos, headPos),
      { className: selectionClassName }
    )
  }

  setOtherSelection (selection, color, clientId) {
    const selectionObjects = []
    for (let i = 0; i < selection.ranges.length; i++) {
      const range = selection.ranges[i]
      if (range.isEmpty()) {
        selectionObjects[i] = this.setOtherCursor(range.head, color, clientId)
      } else {
        selectionObjects[i] = this.setOtherSelectionRange(range, color, clientId)
      }
    }
    return {
      clear () {
        for (let i = 0; i < selectionObjects.length; i++) {
          selectionObjects[i].clear()
        }
      }
    }
  }

  trigger (event) {
    const args = Array.prototype.slice.call(arguments, 1)
    const action = this.callbacks && this.callbacks[event]
    if (action) {
      action.apply(this, args)
    }
  }

  applyOperation (operation) {
    this.ignoreNextChange = true
    CodeMirrorAdapter.applyOperationToCodeMirror(operation, this.cm)
  }

  registerUndo (undoFn) {
    this.cm.undo = undoFn
  }

  registerRedo (redoFn) {
    this.cm.redo = redoFn
  }
}

function cmpPos (a, b) {
  if (a.line < b.line) {
    return -1
  }
  if (a.line > b.line) {
    return 1
  }
  if (a.ch < b.ch) {
    return -1
  }
  if (a.ch > b.ch) {
    return 1
  }
  return 0
}

function posEq (a, b) {
  return cmpPos(a, b) === 0
}

function posLe (a, b) {
  return cmpPos(a, b) <= 0
}

function minPos (a, b) {
  return posLe(a, b) ? a : b
}

function maxPos (a, b) {
  return posLe(a, b) ? b : a
}

function codemirrorDocLength (doc) {
  return doc.indexFromPos({ line: doc.lastLine(), ch: 0 }) +
         doc.getLine(doc.lastLine()).length
}

// Converts a CodeMirror change array (as obtained from the 'changes' event
// in CodeMirror v4) or single change or linked list of changes (as returned
// by the 'change' event in CodeMirror prior to version 4) into a
// TextOperation and its inverse and returns them as a two-element array.
CodeMirrorAdapter.operationFromCodeMirrorChanges = (changes, doc) => {
  // Approach: Replay the changes, beginning with the most recent one, and
  // construct the operation and its inverse. We have to convert the position
  // in the pre-change coordinate system to an index. We have a method to
  // convert a position in the coordinate system after all changes to an index,
  // namely CodeMirror's `indexFromPos` method. We can use the information of
  // a single change object to convert a post-change coordinate system to a
  // pre-change coordinate system. We can now proceed inductively to get a
  // pre-change coordinate system for all changes in the linked list.
  // A disadvantage of this approach is its complexity `O(n^2)` in the length
  // of the linked list of changes.

  let docEndLength = codemirrorDocLength(doc)
  let operation = new TextOperation().retain(docEndLength)
  let inverse = new TextOperation().retain(docEndLength)

  let indexFromPos = pos => doc.indexFromPos(pos)

  function last (arr) {
    return arr[arr.length - 1]
  }

  function sumLengths (strArr) {
    if (strArr.length === 0) {
      return 0
    }
    let sum = 0
    for (let i = 0; i < strArr.length; i++) {
      sum += strArr[i].length
    }
    return sum + strArr.length - 1
  }

  function updateIndexFromPos (indexFromPos, change) {
    return pos => {
      if (posLe(pos, change.from)) {
        return indexFromPos(pos)
      }
      if (posLe(change.to, pos)) {
        return indexFromPos({
          line: pos.line + change.text.length - 1 - (change.to.line - change.from.line),
          ch: (change.to.line < pos.line) ?
              pos.ch :
              (change.text.length <= 1) ?
              pos.ch - (change.to.ch - change.from.ch) + sumLengths(change.text) :
              pos.ch - change.to.ch + last(change.text).length
        }) + sumLengths(change.removed) - sumLengths(change.text)
      }
      if (change.from.line === pos.line) {
        return indexFromPos(change.from) + pos.ch - change.from.ch
      }
      return indexFromPos(change.from) +
             sumLengths(change.removed.slice(0, pos.line - change.from.line)) +
             1 + pos.ch
    }
  }

  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i]
    indexFromPos = updateIndexFromPos(indexFromPos, change)

    const fromIndex = indexFromPos(change.from)
    const restLength = docEndLength - fromIndex - sumLengths(change.text)

    operation = new TextOperation()
      .retain(fromIndex)
      ['delete'](sumLengths(change.removed))
      .insert(change.text.join('\n'))
      .retain(restLength)
      .compose(operation)

    inverse = inverse.compose(new TextOperation()
      .retain(fromIndex)
      ['delete'](sumLengths(change.text))
      .insert(change.removed.join('\n'))
      .retain(restLength)
    )

    docEndLength += sumLengths(change.removed) - sumLengths(change.text)
  }

  return [operation, inverse]
}

// Singular form for backwards compatibility.
CodeMirrorAdapter.operationFromCodeMirrorChange =
  CodeMirrorAdapter.operationFromCodeMirrorChanges

// Apply an operation to a CodeMirror instance.
CodeMirrorAdapter.applyOperationToCodeMirror = (operation, cm) => {
  cm.operation(() => {
    const ops = operation.ops
    let index = 0 // holds the current index into CodeMirror's content
    for (let i = 0, l = ops.length; i < l; i++) {
      const op = ops[i]
      if (TextOperation.isRetain(op)) {
        index += op
      } else if (TextOperation.isInsert(op)) {
        cm.replaceRange(op, cm.posFromIndex(index))
        index += op.length
      } else if (TextOperation.isDelete(op)) {
        const from = cm.posFromIndex(index)
        const to = cm.posFromIndex(index - op)
        cm.replaceRange('', from, to)
      }
    }
  })
}

CodeMirrorAdapter.prototype.onCursorActivity =
  CodeMirrorAdapter.prototype.onFocus = function () {
    if (this.changeInProgress) {
      this.selectionChanged = true
    } else {
      this.trigger('selectionChange')
    }
  }

var addStyleRule = ((() => {
  const added = {}
  const styleElement = document.createElement('style')
  document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement)
  const styleSheet = styleElement.sheet

  return css => {
    if (added[css]) {
      return
    }
    added[css] = true
    styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length)
  }
})())

// Throws an error if the first argument is falsy. Useful for debugging.
function assert (b, msg) {
  if (!b) {
    throw new Error(msg || 'assertion error')
  }
}

// Bind a method to an object, so it doesn't matter whether you call
// object.method() directly or pass object.method as a reference to another
// function.
function bind (obj, method) {
  const fn = obj[method]
  obj[method] = function () {
    fn.apply(obj, arguments)
  }
}
