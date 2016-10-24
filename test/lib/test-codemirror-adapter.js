const Selection = ot.Selection;
const Range = Selection.Range;
const TextOperation = ot.TextOperation;
const CodeMirrorAdapter = ot.CodeMirrorAdapter;

function randomEdit (cm) {
  const length = cm.getValue().length;
  const start = randomInt(length);
  const startPos = cm.posFromIndex(start);
  const end = start + randomInt(Math.min(10, length - start));
  const endPos = cm.posFromIndex(end);
  const newContent = Math.random() > 0.5 ? '' : randomString(randomInt(12));
  cm.replaceRange(newContent, startPos, endPos);
}

function randomChange (cm) {
  let n = 1 + randomInt(4);
  while (n--) {
    randomEdit(cm);
  }
}

function randomOperation (cm) {
  cm.operation(() => {
    randomChange(cm);
  });
}

function getDocLength (doc) {
  return doc.indexFromPos({ line: doc.lastLine(), ch: 0 }) +
    doc.getLine(doc.lastLine()).length;
}

asyncTest("converting between CodeMirror changes and operations", () => {
  const str = 'lorem ipsum';

  const cm1 = CodeMirror(document.body, { value: str });
  cm1.on('changes', (_, changes) => {
    const pair = CodeMirrorAdapter.operationFromCodeMirrorChanges(changes, cm1);
    const operation = pair[0];
    CodeMirrorAdapter.applyOperationToCodeMirror(operation, cm2);
  });

  var cm2 = CodeMirror(document.body, { value: str });

  let n = 100;
  expect(n);

  function step () {
    while (n--) {
      randomOperation(cm1);
      const v1 = cm1.getValue();
      const v2 = cm2.getValue();
      if (v1 !== v2) {
        ok(false, "the contents of both CodeMirror instances should be equal");
        start();
        return;
      }
      ok(true, "the contents of both CodeMirror instances should be equal");

      if (n % 10 === 0) {
        setTimeout(step, 10); // give the browser a chance to repaint
        break;
      }
    }
    if (n === 0) {
      start();
    }
  }

  step();
});

function randomSelection (n) {
  if (Math.random() < 0.3) {
    return Selection.createCursor(randomInt(n));
  } else {
    const ranges = [];
    let i = randomInt(Math.ceil(n / 4));
    while (i < n) {
      const from = i;
      i += 1 + randomInt(Math.ceil(n / 8));
      const to = Math.min(i, n);
      const range = Math.random() < 0.5 ? new Range(from, to) : new Range(to, from);
      ranges.push(range);
      i += 1 + randomInt(Math.ceil(n / 4));
    }
    return new Selection(ranges);
  }
}

test("getSelection and setSelection", () => {
  const n = 200;
  const doc = randomString(n);
  const cm = CodeMirror(document.body, { value: doc });
  const cmAdapter = new CodeMirrorAdapter(cm);

  let j = 50;
  while (j--) {
    const selection = randomSelection(n);
    cmAdapter.setSelection(selection);
    ok(selection.equals(cmAdapter.getSelection()));
  }
});

test("should trigger the 'change' event when the user makes an edit", () => {
  const cm = CodeMirror(document.body, { value: "lorem ipsum" });
  const cmAdapter = new CodeMirrorAdapter(cm);
  const operations = [];
  const inverses = [];
  cmAdapter.registerCallbacks({
    change(operation, inverse) {
      operations.push(operation);
      inverses.push(inverse);
    }
  });
  const edit1 = new TextOperation().retain(11).insert(" dolor");
  CodeMirrorAdapter.applyOperationToCodeMirror(edit1, cm);
  ok(operations.shift().equals(edit1));
  ok(inverses.shift().equals(edit1.invert("lorem ipsum")));

  const edit2 = new TextOperation()['delete'](1).retain(16);
  CodeMirrorAdapter.applyOperationToCodeMirror(edit2, cm);
  ok(operations.shift().equals(edit2));
  ok(inverses.shift().equals(edit2.invert("lorem ipsum dolor")));

  ok(operations.length === 0);
  ok(inverses.length === 0);
});

test("should trigger the 'selectionChange' event when the cursor position or selection changes", () => {
  const doc = "hllo world!";
  const cm = CodeMirror(document.body, { value: doc });
  const cmAdapter = new CodeMirrorAdapter(cm);
  cm.setCursor({ line: 0, ch: 5 });

  let change = false;
  let selection = null;
  cmAdapter.registerCallbacks({
    change() {
      change = true;
    },
    selectionChange() {
      ok(change);
      selection = cm.listSelections();
    }
  });

  cm.replaceRange("e", { line: 0, ch: 1 }, { line: 0, ch: 1 });
  ok(selection.length === 1);
  deepEqual(selection[0].from(), new CodeMirror.Pos(0, 6), "the cursor should be on position 6");
  deepEqual(selection[0].to(), new CodeMirror.Pos(0, 6), "the cursor should be on position 6");

  change = true;
  const anchor = new CodeMirror.Pos(0, 12);
  const head = new CodeMirror.Pos(0, 6);
  cm.setSelection(anchor, head);
  ok(selection.length === 1);
  deepEqual(selection[0].from(), head, "the selection should start on position 0");
  deepEqual(selection[0].to(), anchor, "the selection should end on position 12");
});

test("should trigger the 'blur' event when CodeMirror loses its focus", () => {
  const cm = CodeMirror(document.body, { value: "Hallo Welt!" });
  cm.focus();
  const cmAdapter = new CodeMirrorAdapter(cm);
  let blurred = false;
  cmAdapter.registerCallbacks({
    blur() {
      blurred = true;
    }
  });

  const textField = document.createElement('input');
  textField.type = 'text';
  textField.value = "Dies ist ein Textfeld";
  document.body.appendChild(textField);
  textField.focus();
  ok(blurred);
  document.body.removeChild(textField);
});

test("applyOperation should apply the operation to CodeMirror, but not trigger an event", () => {
  const doc = "nanana";
  const cm = CodeMirror(document.body, { value: doc });
  const cmAdapter = new CodeMirrorAdapter(cm);
  cmAdapter.registerCallbacks({
    change() {
      throw new Error("change shouldn't be called!");
    }
  });
  cmAdapter.applyOperation(new TextOperation().retain(6).insert("nu"));
  ok(cm.getValue() === cmAdapter.getValue());
  ok(cmAdapter.getValue() === "nanananu");
});

test("getValue", () => {
  const doc = "guten tag";
  const cm = CodeMirror(document.body, { value: doc });
  const cmAdapter = new CodeMirrorAdapter(cm);
  CodeMirrorAdapter.applyOperationToCodeMirror(new TextOperation()['delete'](1).insert("G").retain(8), cm);
  ok(cmAdapter.getValue() === "Guten tag");
  cmAdapter.applyOperation(new TextOperation().retain(6)['delete'](1).insert("T").retain(2));
  ok(cmAdapter.getValue() === "Guten Tag");
});

test("register undo/redo", () => {
  const cm = CodeMirror(document.body, {});
  const cmAdapter = new CodeMirrorAdapter(cm);
  const undoFn = () => "undo!";
  const redoFn = () => "redo!";
  cmAdapter.registerUndo(undoFn);
  cmAdapter.registerRedo(redoFn);
  ok(cm.undo === undoFn);
  ok(cm.redo === redoFn);
});

test("detach", () => {
  const cm = CodeMirror(document.body, {});
  const cmAdapter = new CodeMirrorAdapter(cm);
  let changes = 0;
  cmAdapter.registerCallbacks({
    change() {
      changes += 1;
    }
  });
  cm.setValue("42");
  ok(changes === 1);
  cmAdapter.detach();
  cm.setValue("23");
  ok(changes === 1);
});

test("setOtherSelection", () => {
  const doc = "guten tag!\nlorem ipsum dolor";
  const cm = CodeMirror(document.body, { value: doc });
  const cmAdapter = new CodeMirrorAdapter(cm);
  const selection1 = new Selection([new Range(3, 3), new Range(9, 16)]);
  const handle1 = cmAdapter.setOtherSelection(selection1, '#ff0000', 'tim');
  deepEqual(cm.getAllMarks().map(x => x.find()), [
    new CodeMirror.Pos(0, 3),
    { from: new CodeMirror.Pos(0, 9), to: new CodeMirror.Pos(1, 5) }
  ], "the codemirror instance should contain the other user's selection as marks");
  const selection2 = new Selection([new Range(4, 6)]);
  const handle2 = cmAdapter.setOtherSelection(selection2, '#0000ff', 'tim');
  deepEqual(cm.getAllMarks().map(x => x.find()), [
    new CodeMirror.Pos(0, 3),
    { from: new CodeMirror.Pos(0, 9), to: new CodeMirror.Pos(1, 5) },
    { from: new CodeMirror.Pos(0, 4), to: new CodeMirror.Pos(0, 6) }
  ], "the codemirror instance should contain the other users' selection as marks");
  handle1.clear();
  deepEqual(cm.getAllMarks().map(x => x.find()), [
    { from: new CodeMirror.Pos(0, 4), to: new CodeMirror.Pos(0, 6) }
  ], "the codemirror instance should contain the other users' selection as marks");
  handle2.clear();
  deepEqual(cm.getAllMarks().map(x => x.find()), [],
    "the codemirror instance should contain no more marks");
});

