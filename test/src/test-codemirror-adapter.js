import h from 'test/helpers/test-helper'
import CodeMirror from 'codemirror'
import Selection, { Range } from 'client/selection'
import CodeMirrorAdapter from 'client/adapters/codemirror-adapter'
import TextOperation from 'ot/text-operation'

function randomEdit (cm) {
  const length = cm.getValue().length
  const start = h.randomInt(length)
  const startPos = cm.posFromIndex(start)
  const end = start + h.randomInt(Math.min(10, length - start))
  const endPos = cm.posFromIndex(end)
  const newContent = Math.random() > 0.5 ? '' : h.randomString(h.randomInt(12))
  cm.replaceRange(newContent, startPos, endPos)
}

function randomChange (cm) {
  let n = 1 + h.randomInt(4)
  while (n--) {
    randomEdit(cm)
  }
}

function randomOperation (cm) {
  cm.operation(() => {
    randomChange(cm)
  })
}

test('converting between CodeMirror changes and operations', (t) => {
  const str = 'lorem ipsum'

  const cm1 = CodeMirror(document.body, { value: str })
  cm1.on('changes', (_, changes) => {
    const pair = CodeMirrorAdapter.operationFromCodeMirrorChanges(changes, cm1)
    const operation = pair[0]
    CodeMirrorAdapter.applyOperationToCodeMirror(operation, cm2)
  })

  var cm2 = CodeMirror(document.body, { value: str })

  let n = 100

  function step () {
    while (n--) {
      randomOperation(cm1)
      const v1 = cm1.getValue()
      const v2 = cm2.getValue()
      if (v1 !== v2) {
        t.ok(false, 'the contents of both CodeMirror instances should be equal')
        return
      }
      t.ok(true, 'the contents of both CodeMirror instances should be equal')

      if (n % 10 === 0) {
        setTimeout(step, 10) // give the browser a chance to repaint
        break
      }
    }
    if (n === 0) {
      t.end()
    }
  }

  step()
})

function randomSelection (n) {
  if (Math.random() < 0.3) {
    return Selection.createCursor(h.randomInt(n))
  } else {
    const ranges = []
    let i = h.randomInt(Math.ceil(n / 4))
    while (i < n) {
      const from = i
      i += 1 + h.randomInt(Math.ceil(n / 8))
      const to = Math.min(i, n)
      const range = Math.random() < 0.5 ? new Range(from, to) : new Range(to, from)
      ranges.push(range)
      i += 1 + h.randomInt(Math.ceil(n / 4))
    }
    return new Selection(ranges)
  }
}

test('getSelection and setSelection', (t) => {
  const n = 200
  const doc = h.randomString(n)
  const cm = CodeMirror(document.body, { value: doc })
  const cmAdapter = new CodeMirrorAdapter(cm)

  let j = 50
  while (j--) {
    const selection = randomSelection(n)
    cmAdapter.setSelection(selection)
    t.ok(selection.equals(cmAdapter.getSelection()))
  }
})

test("should trigger the 'change' event when the user makes an edit", (t) => {
  const cm = CodeMirror(document.body, { value: 'lorem ipsum' })
  const cmAdapter = new CodeMirrorAdapter(cm)
  const operations = []
  const inverses = []
  cmAdapter.registerCallbacks({
    change (operation, inverse) {
      operations.push(operation)
      inverses.push(inverse)
    }
  })
  const edit1 = new TextOperation().retain(11).insert(' dolor')
  CodeMirrorAdapter.applyOperationToCodeMirror(edit1, cm)
  t.ok(operations.shift().equals(edit1))
  t.ok(inverses.shift().equals(edit1.invert('lorem ipsum')))

  const edit2 = new TextOperation()['delete'](1).retain(16)
  CodeMirrorAdapter.applyOperationToCodeMirror(edit2, cm)
  t.ok(operations.shift().equals(edit2))
  t.ok(inverses.shift().equals(edit2.invert('lorem ipsum dolor')))

  t.ok(operations.length === 0)
  t.ok(inverses.length === 0)
})

test("should trigger the 'selectionChange' event when the cursor position or selection changes", (t) => {
  const doc = 'hllo world!'
  const cm = CodeMirror(document.body, { value: doc })
  const cmAdapter = new CodeMirrorAdapter(cm)
  cm.setCursor({ line: 0, ch: 5 })

  let change = false
  let selection = null
  cmAdapter.registerCallbacks({
    change () {
      change = true
    },
    selectionChange () {
      t.ok(change)
      selection = cm.listSelections()
    }
  })

  cm.replaceRange('e', { line: 0, ch: 1 }, { line: 0, ch: 1 })
  t.ok(selection.length === 1)
  t.deepEqual(selection[0].from(), new CodeMirror.Pos(0, 6), 'the cursor should be on position 6')
  t.deepEqual(selection[0].to(), new CodeMirror.Pos(0, 6), 'the cursor should be on position 6')

  change = true
  const anchor = new CodeMirror.Pos(0, 12)
  const head = new CodeMirror.Pos(0, 6)
  cm.setSelection(anchor, head)
  t.ok(selection.length === 1)
  t.deepEqual(selection[0].from(), head, 'the selection should start on position 0')
  t.deepEqual(selection[0].to(), anchor, 'the selection should end on position 12')
})

test("should trigger the 'blur' event when CodeMirror loses its focus", (t) => {
  const cm = CodeMirror(document.body, { value: 'Hallo Welt!' })
  cm.focus()
  const cmAdapter = new CodeMirrorAdapter(cm)
  let blurred = false
  cmAdapter.registerCallbacks({
    blur () {
      blurred = true
    }
  })

  const textField = document.createElement('input')
  textField.type = 'text'
  textField.value = 'Dies ist ein Textfeld'
  document.body.appendChild(textField)
  textField.focus()
  t.ok(blurred)
  document.body.removeChild(textField)
})

test('applyOperation should apply the operation to CodeMirror, but not trigger an event', (t) => {
  const doc = 'nanana'
  const cm = CodeMirror(document.body, { value: doc })
  const cmAdapter = new CodeMirrorAdapter(cm)
  cmAdapter.registerCallbacks({
    change () {
      throw new Error("change shouldn't be called!")
    }
  })
  cmAdapter.applyOperation(new TextOperation().retain(6).insert('nu'))
  t.ok(cm.getValue() === cmAdapter.getValue())
  t.ok(cmAdapter.getValue() === 'nanananu')
})

test('getValue', (t) => {
  const doc = 'guten tag'
  const cm = CodeMirror(document.body, { value: doc })
  const cmAdapter = new CodeMirrorAdapter(cm)
  CodeMirrorAdapter.applyOperationToCodeMirror(new TextOperation()['delete'](1).insert('G').retain(8), cm)
  t.ok(cmAdapter.getValue() === 'Guten tag')
  cmAdapter.applyOperation(new TextOperation().retain(6)['delete'](1).insert('T').retain(2))
  t.ok(cmAdapter.getValue() === 'Guten Tag')
})

test('register undo/redo', (t) => {
  const cm = CodeMirror(document.body, {})
  const cmAdapter = new CodeMirrorAdapter(cm)
  const undoFn = () => 'undo!'
  const redoFn = () => 'redo!'
  cmAdapter.registerUndo(undoFn)
  cmAdapter.registerRedo(redoFn)
  t.ok(cm.undo === undoFn)
  t.ok(cm.redo === redoFn)
})

test('detach', (t) => {
  const cm = CodeMirror(document.body, {})
  const cmAdapter = new CodeMirrorAdapter(cm)
  let changes = 0
  cmAdapter.registerCallbacks({
    change () {
      changes += 1
    }
  })
  cm.setValue('42')
  t.ok(changes === 1)
  cmAdapter.detach()
  cm.setValue('23')
  t.ok(changes === 1)
})

test('setOtherSelection', (t) => {
  const doc = 'guten tag!\nlorem ipsum dolor'
  const cm = CodeMirror(document.body, { value: doc })
  const cmAdapter = new CodeMirrorAdapter(cm)
  const selection1 = new Selection([new Range(3, 3), new Range(9, 16)])
  const handle1 = cmAdapter.setOtherSelection(selection1, '#ff0000', 'tim')
  t.deepEqual(cm.getAllMarks().map(x => x.find()), [
    new CodeMirror.Pos(0, 3),
    { from: new CodeMirror.Pos(0, 9), to: new CodeMirror.Pos(1, 5) }
  ], "the codemirror instance should contain the other user's selection as marks")
  const selection2 = new Selection([new Range(4, 6)])
  const handle2 = cmAdapter.setOtherSelection(selection2, '#0000ff', 'tim')
  t.deepEqual(cm.getAllMarks().map(x => x.find()), [
    new CodeMirror.Pos(0, 3),
    { from: new CodeMirror.Pos(0, 9), to: new CodeMirror.Pos(1, 5) },
    { from: new CodeMirror.Pos(0, 4), to: new CodeMirror.Pos(0, 6) }
  ], "the codemirror instance should contain the other users' selection as marks")
  handle1.clear()
  t.deepEqual(cm.getAllMarks().map(x => x.find()), [
    { from: new CodeMirror.Pos(0, 4), to: new CodeMirror.Pos(0, 6) }
  ], "the codemirror instance should contain the other users' selection as marks")
  handle2.clear()
  t.deepEqual(cm.getAllMarks().map(x => x.find()), [],
    'the codemirror instance should contain no more marks')
})

