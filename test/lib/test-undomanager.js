import UndoManager from '../../lib/undo-manager';
import TextOperation from '../../lib/text-operation';
import h from '../helpers';

class Editor {
  constructor (doc) {
    this.doc = doc;
    this.undoManager = new UndoManager();
  }

  doEdit (operation, dontCompose) {
    function last (arr) {
      return arr[arr.length - 1];
    }

    var compose = !dontCompose && this.undoManager.undoStack.length > 0 &&
                  last(this.undoManager.undoStack).invert(this.doc).shouldBeComposedWith(operation);
    this.undoManager.add(operation.invert(this.doc), compose);
    this.doc = operation.apply(this.doc);
  }

  serverEdit (operation) {
    this.doc = operation.apply(this.doc);
    this.undoManager.transform(operation);
  }
}

export function testUndoManager (test) {
  var editor = new Editor("Looremipsum");
  var undoManager = editor.undoManager;
  editor.undo = () => {
    test.ok(!undoManager.isUndoing());
    undoManager.performUndo(operation => {
      test.ok(undoManager.isUndoing());
      editor.doEdit(operation);
    });
    test.ok(!undoManager.isUndoing());
  };
  editor.redo = () => {
    test.ok(!undoManager.isRedoing());
    undoManager.performRedo(operation => {
      test.ok(undoManager.isRedoing());
      editor.doEdit(operation);
    });
    test.ok(!undoManager.isRedoing());
  };

  test.ok(!undoManager.canUndo());
  test.ok(!undoManager.canRedo());
  editor.doEdit(new TextOperation().retain(2)['delete'](1).retain(8));
  test.strictEqual(editor.doc, "Loremipsum");
  test.ok(undoManager.canUndo());
  test.ok(!undoManager.canRedo());
  editor.doEdit(new TextOperation().retain(5).insert(" ").retain(5));
  test.strictEqual(editor.doc, "Lorem ipsum");
  editor.serverEdit(new TextOperation().retain(6)['delete'](1).insert("I").retain(4));
  test.strictEqual(editor.doc, "Lorem Ipsum");
  editor.undo();
  test.strictEqual(editor.doc, "LoremIpsum");
  test.ok(undoManager.canUndo());
  test.ok(undoManager.canRedo());
  test.strictEqual(1, undoManager.undoStack.length);
  test.strictEqual(1, undoManager.redoStack.length);
  editor.undo();
  test.ok(!undoManager.canUndo());
  test.ok(undoManager.canRedo());
  test.strictEqual(editor.doc, "LooremIpsum");
  editor.redo();
  test.strictEqual(editor.doc, "LoremIpsum");
  editor.doEdit(new TextOperation().retain(10).insert("D"));
  test.strictEqual(editor.doc, "LoremIpsumD");
  test.ok(!undoManager.canRedo());
  editor.doEdit(new TextOperation().retain(11).insert("o"));
  editor.doEdit(new TextOperation().retain(12).insert("l"));
  editor.undo();
  test.strictEqual(editor.doc, "LoremIpsum");
  editor.redo();
  test.strictEqual(editor.doc, "LoremIpsumDol");
  editor.doEdit(new TextOperation().retain(13).insert("o"));
  editor.undo();
  test.strictEqual(editor.doc, "LoremIpsumDol");
  editor.doEdit(new TextOperation().retain(13).insert("o"));
  editor.doEdit(new TextOperation().retain(14).insert("r"), true);
  editor.undo();
  test.strictEqual(editor.doc, "LoremIpsumDolo");
  test.ok(undoManager.canRedo());
  editor.serverEdit(new TextOperation().retain(10)['delete'](4));
  editor.redo();
  test.strictEqual(editor.doc, "LoremIpsumr");
  editor.undo();
  editor.undo();
  test.strictEqual(editor.doc, "LooremIpsum");
  test.done();
}

export function testUndoManagerMaxItems (test) {
  var doc = h.randomString(50);
  var undoManager = new UndoManager(42);
  var operation;
  for (var i = 0; i < 100; i++) {
    operation = h.randomOperation(doc);
    doc = operation.apply(doc);
    undoManager.add(operation);
  }
  test.strictEqual(undoManager.undoStack.length, 42);
  test.done();
}