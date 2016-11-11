// @flow
import type { Editor, EditorChange, Doc } from 'codemirror'
import TextOperation from 'ot/text-operation'
import { rangeData } from 'types/data'
import Selection, { Range } from 'client/selection'
import EditorAdapter from './adapter'

type callback = () => void;
type position = { ch: number, line: number };

class EventAdaptor {
  cm: Editor
  listners: { [key: string]: callback };

  constructor (cm): void {
    this.cm = cm
    this.listners = {}
  }

  on (type: string, fn: any): void {
    this.listners[type] = fn
    this.cm.on(type, fn)
  }

  off (type: string): void {
    const fn: () => void = this.listners[type]
    this.cm.off(type, fn)
  }

  detach (): void {
    Object.keys(this.listners).forEach((key: string): void => {
      this.off(key)
    })
  }
}

// Converts a CodeMirror change array (as obtained from the 'changes' event
// in CodeMirror v4) or single change or linked list of changes (as returned
// by the 'change' event in CodeMirror prior to version 4) into a
// TextOperation and its inverse and returns them as a two-element array.
const operationFromCodeMirrorChanges = (changes: Array<EditorChange>, doc: Doc): [TextOperation, TextOperation] => {
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
  let operation: TextOperation = new TextOperation().retain(docEndLength)
  let inverse: TextOperation = new TextOperation().retain(docEndLength)

  let indexFromPos: (_: position) => number = (pos: position) => doc.indexFromPos(pos)

  function last (arr) {
    return arr[arr.length - 1]
  }

  function sumLengths (strArr): number {
    if (strArr.length === 0) {
      return 0
    }
    let sum: number = 0
    for (let i: number = 0; i < strArr.length; i++) {
      sum += strArr[i].length
    }
    return sum + strArr.length - 1
  }

  function updateIndexFromPos (indexFromPos: (_: position) => number,
                               change: EditorChange) {
    return (pos: position): number => {
      if (posLe(pos, change.from)) {
        return indexFromPos(pos)
      }
      if (posLe(change.to, pos)) {
        var ch: number
        if (change.to.line < pos.line) {
          ch = pos.ch
        } else if (change.text.length <= 1) {
          ch = pos.ch - (change.to.ch - change.from.ch) + sumLengths(change.text)
        } else {
          ch = pos.ch - change.to.ch + last(change.text).length
        }
        return indexFromPos({
          line: pos.line + change.text.length - 1 - (change.to.line - change.from.line),
          ch: ch
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

  for (let i: number = changes.length - 1; i >= 0; i--) {
    const change = changes[i]
    indexFromPos = updateIndexFromPos(indexFromPos, change)

    const fromIndex: number = indexFromPos(change.from)
    const restLength: number = docEndLength - fromIndex - sumLengths(change.text)

    operation = new TextOperation()
      .retain(fromIndex)
      .delete(sumLengths(change.removed))
      .insert(change.text.join('\n'))
      .retain(restLength)
      .compose(operation)

    inverse = inverse.compose((new TextOperation())
      .retain(fromIndex)
      .delete(sumLengths(change.text))
      .insert(change.removed.join('\n'))
      .retain(restLength)
    )

    docEndLength += sumLengths(change.removed) - sumLengths(change.text)
  }

  return [operation, inverse]
}

export default class CodeMirrorAdapter extends EditorAdapter {
  cm: Doc
  ignoreNextChange: boolean
  changeInProgress: boolean
  selectionChanged: boolean
  events: EventAdaptor

  static operationFromCodeMirrorChanges = operationFromCodeMirrorChanges

  // Apply an operation to a CodeMirror instance.
  static applyOperationToCodeMirror = (operation: TextOperation, cm: Doc): void => {
    cm.operation((): void => {
      const ops = operation.ops
      let index: number = 0 // holds the current index into CodeMirror's content
      for (let i: number = 0, l = ops.length; i < l; i++) {
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

  // Singular form for backwards compatibility.
  static operationFromCodeMirrorChange = operationFromCodeMirrorChanges

  constructor (cm: Doc): void {
    super()
    this.cm = cm
    this.ignoreNextChange = false
    this.changeInProgress = false
    this.selectionChanged = false
    const events: EventAdaptor = new EventAdaptor(cm)
    events.on('changes', this._onChanges.bind(this))
    events.on('change', this._onChange.bind(this))
    events.on('cursorActivity', this._onFocus.bind(this))
    events.on('focus', this._onFocus.bind(this))
    events.on('blur', this._onBlur.bind(this))
    this.events = events
  }

  // Removes all event listeners from the CodeMirror instance.
  detach (): void {
    this.events.detach()
  }

  getValue (): string {
    return this.cm.getValue()
  }

  getSelection (): Selection {
    const cm = this.cm

    const selectionList = cm.listSelections()
    const ranges: Array<Range> = []
    for (let i: number = 0; i < selectionList.length; i++) {
      ranges[i] = new Range(
        cm.indexFromPos(selectionList[i].anchor),
        cm.indexFromPos(selectionList[i].head)
      )
    }

    return new Selection(ranges)
  }

  setSelection (selection: Selection): void {
    const ranges = []
    for (let i: number = 0; i < selection.ranges.length; i++) {
      const range: Range = selection.ranges[i]
      ranges[i] = {
        anchor: this.cm.posFromIndex(range.anchor),
        head: this.cm.posFromIndex(range.head)
      }
    }
    this.cm.setSelections(ranges)
  }

  setOtherCursor (position: number, color: string, clientId: string) {
    const cursorPos = this.cm.posFromIndex(position)
    const cursorCoords = this.cm.cursorCoords(cursorPos)
    const cursorEl: HTMLSpanElement = document.createElement('span')
    cursorEl.className = 'other-client'
    cursorEl.style.display = 'inline-block'
    cursorEl.style.padding = '0'
    cursorEl.style.marginLeft = cursorEl.style.marginRight = '-1px'
    cursorEl.style.borderLeftWidth = '2px'
    cursorEl.style.borderLeftStyle = 'solid'
    cursorEl.style.borderLeftColor = color
    cursorEl.style.height = `${(cursorCoords.bottom - cursorCoords.top) * 0.9}px`
    cursorEl.style.zIndex = '0'
    cursorEl.setAttribute('data-clientid', clientId)
    return this.cm.setBookmark(cursorPos, { widget: cursorEl, insertLeft: true })
  }

  setOtherSelectionRange (range: rangeData, color: string, clientId: string) {
    const match = /^#([0-9a-fA-F]{6})$/.exec(color)
    if (!match) {
      throw new Error('only six-digit hex colors are allowed.')
    }
    const selectionClassName: string = `selection-${match[1]}`
    // const rule: string = `.${selectionClassName} { background: ${color}; }`
    // addStyleRule(rule)

    const anchorPos = this.cm.posFromIndex(range.anchor)
    const headPos = this.cm.posFromIndex(range.head)

    return this.cm.markText(
      minPos(anchorPos, headPos),
      maxPos(anchorPos, headPos),
      { className: selectionClassName }
    )
  }

  setOtherSelection (selection: Selection, color: string, clientId: string): { clear: () => void } {
    const selectionObjects = []
    for (let i: number = 0; i < selection.ranges.length; i++) {
      const range: Range = selection.ranges[i]
      if (range.isEmpty()) {
        selectionObjects[i] = this.setOtherCursor(range.head, color, clientId)
      } else {
        selectionObjects[i] = this.setOtherSelectionRange(range, color, clientId)
      }
    }
    return {
      clear (): void {
        for (let i: number = 0; i < selectionObjects.length; i++) {
          selectionObjects[i].clear()
        }
      }
    }
  }

  applyOperation (operation: TextOperation): void {
    if (!operation.isNoop()) {
      this.ignoreNextChange = true
    }
    CodeMirrorAdapter.applyOperationToCodeMirror(operation, this.cm)
  }

  registerUndo (undoFn: () => void): void {
    this.cm.undo = undoFn
  }

  registerRedo (redoFn: () => void): void {
    this.cm.redo = redoFn
  }

  _onBlur (): void {
    if (!this.cm.somethingSelected()) {
      this.trigger('blur')
    }
  }

  _onFocus (): void {
    if (this.changeInProgress) {
      this.selectionChanged = true
    } else {
      this.trigger('selectionChange')
    }
  }

  _onChange (): void {
    // By default, CodeMirror's event order is the following:
    // 1. 'change', 2. 'cursorActivity', 3. 'changes'.
    // We want to fire the 'selectionChange' event after the 'change' event,
    // but need the information from the 'changes' event. Therefore, we detect
    // when a change is in progress by listening to the change event, setting
    // a flag that makes this adapter defer all 'cursorActivity' events.
    this.changeInProgress = true
  }

  _onChanges (_: any, changes: Array<EditorChange>): void {
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
}

function cmpPos (a: position, b: position): number {
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

// function posEq (a, b) {
//  return cmpPos(a, b) === 0
// }

function posLe (a: position, b: position): boolean {
  return cmpPos(a, b) <= 0
}

function minPos (a: position, b: position): position {
  return posLe(a, b) ? a : b
}

function maxPos (a: position, b: position): position {
  return posLe(a, b) ? b : a
}

function codemirrorDocLength (doc: Doc): number {
  return doc.indexFromPos({ line: doc.lastLine(), ch: 0 }) +
    doc.getLine(doc.lastLine()).length
}

// var addStyleRule = ((css: string): (css: string) => void => {
//   const added: {} = {}
//   const styleElement: HTMLElement = document.createElement('style')
//   document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement)
//   const styleSheet: ?CSSStyleSheet = styleElement.sheet
//
//   return (css: string): void => {
//     if (added[css]) {
//       return
//     }
//     added[css] = true
//     styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length)
//   }
// })()

