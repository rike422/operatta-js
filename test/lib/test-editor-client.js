const EditorClient = ot.EditorClient;
const Client = ot.Client;
const Selection = ot.Selection;
const Range = Selection.Range;
const TextOperation = ot.TextOperation;

class EditorAdapterStub {
  constructor(value, selection) {
    this.value = value;
    this.selection = selection;
    this.undo = this.redo = null;
    this.lastAppliedOperation = null;
    this.otherSelections = [];
  }

  registerCallbacks(cb) {
    this.callbacks = cb;
  }

  registerUndo(undo) {
    this.undo = undo;
  }

  registerRedo(redo) {
    this.redo = redo;
  }

  trigger(event) {
    const args = Array.prototype.slice.call(arguments, 1);
    const action = this.callbacks && this.callbacks[event];
    if (action) {
      action.apply(this, args);
    }
  }

  getValue() {
    return this.value;
  }

  getSelection() {
    return this.selection;
  }

  setSelection(selection) {
    this.selection = selection;
    this.trigger('selectionChange');
  }

  blur() {
    this.selection = null;
    this.trigger('blur');
  }

  setOtherSelection(selection, color, clientId) {
    const otherSelections = this.otherSelections;
    let cleared = false;
    const selectionObj = {
      selection,
      color,
      clientId
    };
    otherSelections.push(selectionObj);
    return {
      clear() {
        if (cleared) {
          throw new Error("already cleared!");
        }
        cleared = true;
        otherSelections.splice(otherSelections.indexOf(selectionObj), 1);
      }
    };
  }

  applyOperation(operation) {
    this.lastAppliedOperation = operation;
    this.value = operation.apply(this.value);
    if (this.selection) {
      const newSelection = this.selection.transform(operation);
      if (!this.selection.equals(newSelection)) {
        this.selection = newSelection;
        this.trigger('selectionChange');
      }
    }
  }
}

class ServerAdapterStub {
  constructor() {
    this.sentOperation = this.sentSelection = null;
  }

  sendOperation(revision, operation, selection) {
    this.sentRevision = revision;
    this.sentOperation = operation;
    this.sentSelectionWithOperation = selection;
  }

  sendSelection(selection) {
    this.sentSelection = selection;
  }
}

ServerAdapterStub.prototype.registerCallbacks = EditorAdapterStub.prototype.registerCallbacks;
ServerAdapterStub.prototype.trigger = EditorAdapterStub.prototype.trigger;

let revision;
let initialDoc;
let clients;
let serverAdapter;
let editorAdapter;
let editorClient;

function setup () {
  revision = 1;
  initialDoc = "lorem dolor";
  clients = {
    'enihcam': { name: "Tim", selection: { ranges: [{ anchor: 0, head: 0 }, { anchor: 2, head: 4 }] } },
    'baia': { name: "Jan", selection: { ranges: [{ anchor: 6, head: 7 }] } }
  };
  serverAdapter = new ServerAdapterStub();
  editorAdapter = new EditorAdapterStub(initialDoc, Selection.createCursor(11));
  editorClient = new EditorClient(revision, clients, serverAdapter, editorAdapter);
}

test("register undo and redo functions", () => {
  setup();
  ok(typeof editorAdapter.undo === 'function');
  ok(typeof editorAdapter.redo === 'function');
});

test("simulated editing session", () => {
  setup();
  // Let's say, we are Nina and we're editing a document together with Tim and Jan

  // Firstly, we get informed one of them has replaced the lower case 'd' with a capital 'D'
  serverAdapter.trigger('operation', [6, -1, 'D', 4]);
  strictEqual(editorAdapter.getValue(), "lorem Dolor");
  ok(editorClient.state instanceof Client.Synchronized);
  strictEqual(editorClient.revision, 2);

  // We append a single white space to the document
  editorAdapter.value = "lorem Dolor ";
  editorAdapter.selection = Selection.createCursor(12);
  editorAdapter.trigger('change',
    new TextOperation().retain(11).insert(" "),
    new TextOperation().retain(11)['delete'](1)
  );
  editorAdapter.trigger('selectionChange');
  ok(editorClient.state instanceof Client.AwaitingConfirm);
  strictEqual(serverAdapter.sentRevision, 2);
  ok(editorClient.state.outstanding.equals(new TextOperation().retain(11).insert(" ")));
  deepEqual(serverAdapter.sentOperation, [11, " "]);
  ok(serverAdapter.sentSelectionWithOperation.equals(Selection.createCursor(12)));
  strictEqual(serverAdapter.sentSelection, null);

  // Someone inserts an extra white space between "lorem" and "Dolor"
  serverAdapter.trigger('operation', [5, " ", 6]);
  strictEqual(editorAdapter.getValue(), "lorem  Dolor ");
  strictEqual(editorClient.revision, 3);
  ok(editorClient.state instanceof Client.AwaitingConfirm);
  ok(editorClient.state.outstanding.equals(new TextOperation().retain(12).insert(" ")));

  // Our cursor moved one char to the right because of that insertion. That
  // info should have been sent.
  ok(editorAdapter.selection.equals(Selection.createCursor(13)));
  ok(serverAdapter.sentSelection.equals(Selection.createCursor(13)));

  // We append "S" at the end
  editorAdapter.value = "lorem  Dolor S";
  editorAdapter.selection = Selection.createCursor(14);
  editorAdapter.trigger('change',
    new TextOperation().retain(13).insert("S"),
    new TextOperation().retain(13)['delete'](1)
  );
  editorAdapter.trigger('selectionChange');
  // This operation should have been buffered
  ok(editorClient.state instanceof Client.AwaitingWithBuffer);
  strictEqual(serverAdapter.sentRevision, 2); // last revision
  deepEqual(serverAdapter.sentOperation, [11, " "]); // last operation
  ok(serverAdapter.sentSelection.equals(Selection.createCursor(13)));

  // We continue with the letters "it"
  editorAdapter.value = "lorem  Dolor Sit";
  editorAdapter.selection = Selection.createCursor(15);
  editorAdapter.trigger('change',
    new TextOperation().retain(14).insert("i"),
    new TextOperation().retain(14)['delete'](1)
  );
  editorAdapter.selection = Selection.createCursor(16);
  editorAdapter.trigger('selectionChange');
  editorAdapter.trigger('change',
    new TextOperation().retain(15).insert("t"),
    new TextOperation().retain(15)['delete'](1)
  );
  editorAdapter.trigger('selectionChange');
  ok(serverAdapter.sentSelection.equals(Selection.createCursor(13)));
  strictEqual(serverAdapter.sentRevision, 2); // last revision
  deepEqual(serverAdapter.sentOperation, [11, " "]); // last operation
  ok(editorClient.state.outstanding.equals(new TextOperation().retain(12).insert(" ")));
  ok(editorClient.state.buffer.equals(new TextOperation().retain(13).insert("Sit")));

  // Someone inserts "Ipsum" between "lorem" and "Dolor"
  serverAdapter.trigger('operation', [6, "Ipsum", 6]);
  strictEqual(editorClient.revision, 4);
  strictEqual(editorAdapter.getValue(), "lorem Ipsum Dolor Sit");
  ok(editorClient.state instanceof Client.AwaitingWithBuffer);
  ok(editorClient.state.outstanding.equals(new TextOperation().retain(17).insert(" ")));
  ok(editorClient.state.buffer.equals(new TextOperation().retain(18).insert("Sit")));
  // Our cursor should have been shifted by that operation to position 21
  ok(editorAdapter.selection.equals(Selection.createCursor(21)));

  // We get an acknowledgement for our first sent operation from the server!
  serverAdapter.trigger('ack');
  strictEqual(serverAdapter.sentRevision, 5);
  deepEqual(serverAdapter.sentOperation, [18, "Sit"]);
  strictEqual(editorClient.revision, 5);
  ok(editorClient.state instanceof Client.AwaitingConfirm);
  ok(editorClient.state.outstanding.equals(new TextOperation().retain(18).insert("Sit")));

  // We switch to another program. The browser window and the editor lose their
  // focus.
  editorAdapter.trigger('blur');
  strictEqual(serverAdapter.sentSelection, null);

  // The operation that was sent a few moments ago gets acknowledged right away
  serverAdapter.trigger('ack');
  strictEqual(editorClient.revision, 6);
  strictEqual(serverAdapter.sentRevision, 5);
  ok(editorClient.state instanceof Client.Synchronized);
  strictEqual(editorAdapter.getValue(), "lorem Ipsum Dolor Sit");
});

test("user handling", () => {
  setup();

  strictEqual(editorClient.clientListEl.childNodes.length, 2);
  const firstLi = editorClient.clientListEl.childNodes[0];
  const secondLi = editorClient.clientListEl.childNodes[1];
  strictEqual(firstLi.tagName.toLowerCase(), 'li');
  strictEqual(firstLi.innerHTML, "Tim");
  strictEqual(secondLi.tagName.toLowerCase(), 'li');
  strictEqual(secondLi.innerHTML, "Jan");
  notEqual(firstLi.style.color, secondLi.style.color);

  deepEqual(editorAdapter.otherSelections, [
    {
      clientId: 'enihcam',
      color: editorAdapter.otherSelections[0].color,
      selection: new Selection([new Range(0, 0), new Range(2, 4)])
    },
    {
      clientId: 'baia',
      color: editorAdapter.otherSelections[1].color,
      selection: new Selection([new Range(6, 7)])
    }
  ]);

  // We insert an extra space between "lorem" and "dolor"
  editorAdapter.value = "lorem  dolor";
  editorAdapter.selection = Selection.createCursor(6);
  editorAdapter.trigger('change',
    new TextOperation().retain(5).insert(" ").retain(6),
    new TextOperation().retain(5)['delete'](1).retain(6)
  );
  editorAdapter.trigger('selectionChange');

  // Jan selects some text that spans the position of our insertion
  serverAdapter.trigger('selection', 'baia', { ranges: [{ anchor: 4, head: 7 }] });
  deepEqual(editorAdapter.otherSelections, [
    {
      clientId: 'enihcam',
      color: editorAdapter.otherSelections[0].color,
      selection: new Selection([new Range(0, 0), new Range(2, 4)])
    },
    {
      clientId: 'baia',
      color: editorAdapter.otherSelections[1].color,
      // because of our insertion, the selection spans one more character
      selection: new Selection([new Range(4, 8)])
    }
  ]);

  // Tim's editor loses focus
  serverAdapter.trigger('selection', 'enihcam', null);
  deepEqual(editorAdapter.otherSelections, [
    {
      clientId: 'baia',
      color: editorAdapter.otherSelections[0].color,
      // because of our insertion, the selection spans one more character
      selection: new Selection([new Range(4, 8)])
    }
  ]);

  // Tim closes his browser
  strictEqual(editorClient.clientListEl.childNodes.length, 2);
  serverAdapter.trigger('client_left', 'enihcam');
  strictEqual(editorClient.clientListEl.childNodes.length, 1);
  ok(!firstLi.parentNode);
  strictEqual(secondLi.parentNode, editorClient.clientListEl);

  // A new user joins!
  serverAdapter.trigger('set_name', 'emit-remmus', "Nina");
  strictEqual(editorClient.clientListEl.childNodes.length, 2);
  strictEqual(editorClient.clientListEl.childNodes[1].innerHTML, "Nina");

  // We get an update consisting of the state of all connected users:
  // Tim rejoined, Jan left, Nina updated her cursor
  serverAdapter.trigger('clients', {
    'enihcam': { name: "Tim", selection: null },
    'emit-remmus': { name: "Nina", selection: { ranges: [{ anchor: 0, head: 0 }] } }
  });
  strictEqual(editorClient.clientListEl.childNodes.length, 2);
  strictEqual(editorClient.clientListEl.childNodes[0].innerHTML, "Nina");
  strictEqual(editorClient.clientListEl.childNodes[1].innerHTML, "Tim");
  deepEqual(editorAdapter.otherSelections, [
    {
      clientId: 'emit-remmus',
      color: editorAdapter.otherSelections[0].color,
      // because of our insertion, the selection spans one more character
      selection: Selection.createCursor(0)
    }
  ]);
});

test("undo/redo", () => {
  setup();
  editorAdapter.selection = new Selection([new Range(6, 11)]);
  editorAdapter.trigger('selectionChange');

  editorAdapter.value = "lorem s";
  editorAdapter.selection = Selection.createCursor(7);
  editorAdapter.trigger('change',
    new TextOperation().retain(6)['delete'](5).insert("s"),
    new TextOperation().retain(6)['delete'](1).insert("dolor")
  );
  editorAdapter.trigger('selectionChange');

  // Someone inserts an extra white space between "lorem" and "dolor"
  serverAdapter.trigger('operation', [5, " ", 6]);
  strictEqual(editorAdapter.getValue(), "lorem  s");

  editorClient.undo();
  strictEqual(editorAdapter.getValue(), "lorem  dolor");
  ok(editorAdapter.getSelection().equals(new Selection([new Range(7, 12)])));

  editorClient.redo();
  strictEqual(editorAdapter.getValue(), "lorem  s");
  ok(editorAdapter.getSelection().equals(Selection.createCursor(8)));
});


