import UndoManager from 'lib/undo-manager'
import TextOperation from 'lib/text-operation'
import h from '../helpers/test-helper'

class Editor {
  constructor (doc) {
    this.doc = doc
    this.undoManager = new UndoManager()
  }

  doEdit (operation, dontCompose) {
    function last (arr) {
      return arr[arr.length - 1]
    }

    const compose = !dontCompose && this.undoManager.undoStack.length > 0 &&
                  last(this.undoManager.undoStack).invert(this.doc).shouldBeComposedWith(operation)
    this.undoManager.add(operation.invert(this.doc), compose)
    this.doc = operation.apply(this.doc)
  }

  serverEdit (operation) {
    this.doc = operation.apply(this.doc)
    this.undoManager.transform(operation)
  }
}

test('Test UndoManager', (t) => {
  const editor = new Editor('Looremipsum')
  const undoManager = editor.undoManager
  editor.undo = () => {
    t.ok(!undoManager.isUndoing())
    undoManager.performUndo(operation => {
      t.ok(undoManager.isUndoing())
      editor.doEdit(operation)
    })
    t.ok(!undoManager.isUndoing())
  }
  editor.redo = () => {
    t.ok(!undoManager.isRedoing())
    undoManager.performRedo(operation => {
      t.ok(undoManager.isRedoing())
      editor.doEdit(operation)
    })
    t.ok(!undoManager.isRedoing())
  }

  t.ok(!undoManager.canUndo())
  t.ok(!undoManager.canRedo())
  editor.doEdit(new TextOperation().retain(2)['delete'](1).retain(8))
  t.deepEqual(editor.doc, 'Loremipsum')
  t.ok(undoManager.canUndo())
  t.ok(!undoManager.canRedo())
  editor.doEdit(new TextOperation().retain(5).insert(' ').retain(5))
  t.deepEqual(editor.doc, 'Lorem ipsum')
  editor.serverEdit(new TextOperation().retain(6)['delete'](1).insert('I').retain(4))
  t.deepEqual(editor.doc, 'Lorem Ipsum')
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsum')
  t.ok(undoManager.canUndo())
  t.ok(undoManager.canRedo())
  t.deepEqual(1, undoManager.undoStack.length)
  t.deepEqual(1, undoManager.redoStack.length)
  editor.undo()
  t.ok(!undoManager.canUndo())
  t.ok(undoManager.canRedo())
  t.deepEqual(editor.doc, 'LooremIpsum')
  editor.redo()
  t.deepEqual(editor.doc, 'LoremIpsum')
  editor.doEdit(new TextOperation().retain(10).insert('D'))
  t.deepEqual(editor.doc, 'LoremIpsumD')
  t.ok(!undoManager.canRedo())
  editor.doEdit(new TextOperation().retain(11).insert('o'))
  editor.doEdit(new TextOperation().retain(12).insert('l'))
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsum')
  editor.redo()
  t.deepEqual(editor.doc, 'LoremIpsumDol')
  editor.doEdit(new TextOperation().retain(13).insert('o'))
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsumDol')
  editor.doEdit(new TextOperation().retain(13).insert('o'))
  editor.doEdit(new TextOperation().retain(14).insert('r'), true)
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsumDolo')
  t.ok(undoManager.canRedo())
  editor.serverEdit(new TextOperation().retain(10)['delete'](4))
  editor.redo()
  t.deepEqual(editor.doc, 'LoremIpsumr')
  editor.undo()
  editor.undo()
  t.deepEqual(editor.doc, 'LooremIpsum')
})

test('Test UndoManager when max items', (t) => {
  let doc = h.randomString(50)
  const undoManager = new UndoManager(42)
  let operation
  for (let i = 0; i < 100; i++) {
    operation = h.randomOperation(doc)
    doc = operation.apply(doc)
    undoManager.add(operation)
  }
  t.deepEqual(undoManager.undoStack.length, 42)
})
