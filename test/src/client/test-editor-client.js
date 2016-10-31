require('test/helpers/test-helper')
import Selection, { Range } from 'client/selection'
import EditorAdapter from 'client/adapters/adapter'
import EditorClient from 'client/editor-client'
import TextOperation from 'ot/text-operation'
import Connector from 'client/connector/connector'
import Client from 'client/client'

class EditorAdapterStub extends EditorAdapter {
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
    if (this.selection) {
      const newSelection = this.selection.transform(operation)
      if (!this.selection.equals(newSelection)) {
        this.selection = newSelection
        this.trigger('selectionChange')
      }
    }
  }
}

class ServerConnectorStub extends Connector {
  constructor () {
    super()
    this.sentOperation = this.sentSelection = null
  }

  sendOperation (revision, operation, selection) {
    this.sentRevision = revision
    this.sentOperation = operation
    this.sentSelectionWithOperation = selection
  }

  sendSelection (selection) {
    this.sentSelection = selection
  }
}
let _t

test.beforeEach(t => {
  t.context.revision = 1
  t.context.initialDoc = 'lorem dolor'
  t.context.clients = {
    'enihcam': { name: 'Tim', selection: { ranges: [{ anchor: 0, head: 0 }, { anchor: 2, head: 4 }] } },
    'baia': { name: 'Jan', selection: { ranges: [{ anchor: 6, head: 7 }] } }
  }
  t.context.serverAdapter = new ServerConnectorStub()
  t.context.editorAdapter = new EditorAdapterStub(t.context.initialDoc, Selection.createCursor(11))
  t.context.editorClient = new EditorClient(t.context.revision, t.context.clients, t.context.serverAdapter, t.context.editorAdapter)
  _t = t
})

const setSelection = (str) => {
  _t.context.editorAdapter.value = str
  _t.context.editorAdapter.selection = Selection.createCursor(str.length)
}

const insertAndDelete = (str, retain = _t.context.editorAdapter.getValue().length - 1) => {
  _t.context.editorAdapter.trigger('change',
    new TextOperation().retain(retain).insert(str),
    new TextOperation().retain(retain).delete(str.length)
  )
}

test('register undo and redo functions', (t) => {
  const editorAdapter = t.context.editorAdapter
  t.truthy(typeof editorAdapter.undo === 'function')
  t.truthy(typeof editorAdapter.redo === 'function')
})

test('simulated editing session', (t) => {
  // Let's say, we are Nina and we're editing a document together with Tim and Jan

  // Firstly, we get informed one of them has replaced the lower case 'd' with a capital 'D'

  const serverAdapter = t.context.serverAdapter
  const editorAdapter = t.context.editorAdapter
  const editorClient = t.context.editorClient

  serverAdapter.trigger('operation', [6, -1, 'D', 4])

  t.deepEqual(editorAdapter.getValue(), 'lorem Dolor')
  t.truthy(editorClient.state instanceof Client.Synchronized)
  t.deepEqual(editorClient.revision, 2)

  // We append a single white space to the document
  setSelection('lorem Dolor ')
  insertAndDelete(' ')

  editorAdapter.trigger('selectionChange')
  t.truthy(editorClient.state instanceof Client.AwaitingConfirm)
  t.deepEqual(serverAdapter.sentRevision, 2)
  t.truthy(editorClient.state.outstanding.equals(new TextOperation().retain(11).insert(' ')))
  t.deepEqual(serverAdapter.sentOperation, [11, ' '])
  t.truthy(serverAdapter.sentSelectionWithOperation.equals(Selection.createCursor(12)))
  t.deepEqual(serverAdapter.sentSelection, null)

  // Someone inserts an extra white space between "lorem" and "Dolor"
  serverAdapter.trigger('operation', [5, ' ', 6])
  t.deepEqual(editorAdapter.getValue(), 'lorem  Dolor ')
  t.deepEqual(editorClient.revision, 3)
  t.truthy(editorClient.state instanceof Client.AwaitingConfirm)
  t.truthy(editorClient.state.outstanding.equals(new TextOperation().retain(12).insert(' ')))

  // Our cursor moved one char to the right because of that insertion. That
  // info should have been sent.
  t.truthy(editorAdapter.selection.equals(Selection.createCursor(13)))
  t.truthy(serverAdapter.sentSelection.equals(Selection.createCursor(13)))

  // We append "S" at the end
  setSelection('lorem  Dolor S')
  insertAndDelete('S')

  editorAdapter.trigger('selectionChange')
  // This operation should have been buffered
  t.truthy(editorClient.state instanceof Client.AwaitingWithBuffer)
  t.deepEqual(serverAdapter.sentRevision, 2) // last revision
  t.deepEqual(serverAdapter.sentOperation, [11, ' ']) // last operation
  t.truthy(serverAdapter.sentSelection.equals(Selection.createCursor(13)))

  // We continue with the letters "it"
  setSelection('lorem  Dolor Sit')
  insertAndDelete('i', 14)
  editorAdapter.selection = Selection.createCursor(16)
  editorAdapter.trigger('selectionChange')
  insertAndDelete('t', 15)
  editorAdapter.trigger('selectionChange')

  t.truthy(serverAdapter.sentSelection.equals(Selection.createCursor(13)))
  t.deepEqual(serverAdapter.sentRevision, 2) // last revision
  t.deepEqual(serverAdapter.sentOperation, [11, ' ']) // last operation
  t.truthy(editorClient.state.outstanding.equals(new TextOperation().retain(12).insert(' ')))
  t.truthy(editorClient.state.buffer.equals(new TextOperation().retain(13).insert('Sit')))

  // Someone inserts "Ipsum" between "lorem" and "Dolor"
  serverAdapter.trigger('operation', [6, 'Ipsum', 6])
  t.deepEqual(editorClient.revision, 4)
  t.deepEqual(editorAdapter.getValue(), 'lorem Ipsum Dolor Sit')
  t.truthy(editorClient.state instanceof Client.AwaitingWithBuffer)
  t.truthy(editorClient.state.outstanding.equals(new TextOperation().retain(17).insert(' ')))
  t.truthy(editorClient.state.buffer.equals(new TextOperation().retain(18).insert('Sit')))
  // Our cursor should have been shifted by that operation to position 21
  t.truthy(editorAdapter.selection.equals(Selection.createCursor(21)))

  // We get an acknowledgement for our first sent operation from the server!
  serverAdapter.trigger('ack')
  t.deepEqual(serverAdapter.sentRevision, 5)
  t.deepEqual(serverAdapter.sentOperation, [18, 'Sit'])
  t.deepEqual(editorClient.revision, 5)
  t.truthy(editorClient.state instanceof Client.AwaitingConfirm)
  t.truthy(editorClient.state.outstanding.equals(new TextOperation().retain(18).insert('Sit')))

  // We switch to another program. The browser window and the editor lose their
  // focus.
  editorAdapter.trigger('blur')
  t.deepEqual(serverAdapter.sentSelection, null)

  // The operation that was sent a few moments ago gets acknowledged right away
  serverAdapter.trigger('ack')
  t.deepEqual(editorClient.revision, 6)
  t.deepEqual(serverAdapter.sentRevision, 5)
  t.truthy(editorClient.state instanceof Client.Synchronized)
  t.deepEqual(editorAdapter.getValue(), 'lorem Ipsum Dolor Sit')
})

test('user handling', (t) => {
  const editorClient = t.context.editorClient
  const clientListEl = editorClient.clientListEl
  const editorAdapter = t.context.editorAdapter
  const serverAdapter = t.context.serverAdapter

  t.deepEqual(clientListEl.childNodes.length, 2)
  const firstLi = clientListEl.childNodes[0]
  const secondLi = clientListEl.childNodes[1]
  t.deepEqual(firstLi.tagName.toLowerCase(), 'li')
  t.deepEqual(firstLi.innerHTML, 'Tim')
  t.deepEqual(secondLi.tagName.toLowerCase(), 'li')
  t.deepEqual(secondLi.innerHTML, 'Jan')
  t.notDeepEqual(firstLi.style.color, secondLi.style.color)

  t.deepEqual(editorAdapter.otherSelections, [
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
  ])

  // We insert an extra space between "lorem" and "dolor"
  setSelection('lorem  dolor')

  editorAdapter.trigger('change',
    new TextOperation().retain(5).insert(' ').retain(6),
    new TextOperation().retain(5)['delete'](1).retain(6)
  )
  editorAdapter.trigger('selectionChange')

  // Jan selects some text that spans the position of our insertion
  serverAdapter.trigger('selection', 'baia', { ranges: [{ anchor: 4, head: 7 }] })
  t.deepEqual(editorAdapter.otherSelections, [
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
  ])

  // Tim's editor loses focus
  serverAdapter.trigger('selection', 'enihcam', null)
  t.deepEqual(editorAdapter.otherSelections, [
    {
      clientId: 'baia',
      color: editorAdapter.otherSelections[0].color,
      // because of our insertion, the selection spans one more character
      selection: new Selection([new Range(4, 8)])
    }
  ])

  // Tim closes his browser
  t.deepEqual(clientListEl.childNodes.length, 2)
  serverAdapter.trigger('client_left', 'enihcam')
  t.deepEqual(clientListEl.childNodes.length, 1)
  t.truthy(!firstLi.parentNode)
  t.deepEqual(secondLi.parentNode, clientListEl)

  // A new user joins!
  serverAdapter.trigger('set_name', 'emit-remmus', 'Nina')
  t.deepEqual(clientListEl.childNodes.length, 2)
  t.deepEqual(clientListEl.childNodes[1].innerHTML, 'Nina')

  // We get an update consisting of the state of all connected users:
  // Tim rejoined, Jan left, Nina updated her cursor
  serverAdapter.trigger('clients', {
    'enihcam': { name: 'Tim', selection: null },
    'emit-remmus': { name: 'Nina', selection: { ranges: [{ anchor: 0, head: 0 }] } }
  })
  t.deepEqual(clientListEl.childNodes.length, 2)
  t.deepEqual(clientListEl.childNodes[0].innerHTML, 'Nina')
  t.deepEqual(clientListEl.childNodes[1].innerHTML, 'Tim')
  t.deepEqual(editorAdapter.otherSelections, [
    {
      clientId: 'emit-remmus',
      color: editorAdapter.otherSelections[0].color,
      // because of our insertion, the selection spans one more character
      selection: Selection.createCursor(0)
    }
  ])
})

test('undo/redo', (t) => {
  const editorAdapter = t.context.editorAdapter
  const serverAdapter = t.context.serverAdapter
  const editorClient = t.context.editorClient

  editorAdapter.selection = new Selection([new Range(6, 11)])
  editorAdapter.trigger('selectionChange')

  setSelection('lorem s')
  editorAdapter.trigger('change',
    new TextOperation().retain(6)['delete'](5).insert('s'),
    new TextOperation().retain(6)['delete'](1).insert('dolor')
  )
  editorAdapter.trigger('selectionChange')

  // Someone inserts an extra white space between "lorem" and "dolor"
  serverAdapter.trigger('operation', [5, ' ', 6])
  t.deepEqual(editorAdapter.getValue(), 'lorem  s')

  editorClient.undo()
  t.deepEqual(editorAdapter.getValue(), 'lorem  dolor')
  t.truthy(editorAdapter.getSelection().equals(new Selection([new Range(7, 12)])))

  editorClient.redo()
  t.deepEqual(editorAdapter.getValue(), 'lorem  s')
  t.truthy(editorAdapter.getSelection().equals(Selection.createCursor(8)))
})

