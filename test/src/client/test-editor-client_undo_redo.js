require('test/helpers/test-helper')
import Selection, { Range } from 'client/selection'
import EditorAdapterMock from 'test/helpers/mocks/editor-adapter-mock'
import ServerConnectorMock from 'test/helpers/mocks/server-connector-mock'
import EditorClient from 'client/editor-client'
import TextOperation from 'ot/text-operation'

let _t

const setSelection = (str) => {
  _t.context.editorAdapter.value = str
  _t.context.editorAdapter.selection = Selection.createCursor(str.length)
}

test.beforeEach(t => {
  t.context.revision = 1
  t.context.initialDoc = 'lorem dolor'
  t.context.serverAdapter = new ServerConnectorMock()
  t.context.editorAdapter = new EditorAdapterMock(t.context.initialDoc, Selection.createCursor(11))
  t.context.editorClient = new EditorClient(t.context.revision, {}, t.context.serverAdapter, t.context.editorAdapter)
  _t = t
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
