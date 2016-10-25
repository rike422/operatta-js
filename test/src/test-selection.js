require('../helpers/test-helper')
import Selection from 'editor/selection'
const Range = Selection.Range
import TextOperation from 'ot/text-operation'

test('Test Selection.testCreateCursor', t => {
  t.ok(Selection.createCursor(5).equals(new Selection([new Range(5, 5)])))
})

test('Test Selection.fromJSON', t => {
  const selection = Selection.fromJSON({ ranges: [{ anchor: 3, head: 5 }, { anchor: 11, head: 23 }] })
  t.ok(selection instanceof Selection)
  t.deepEqual(selection.ranges.length, 2)
  t.ok(selection.ranges[0].equals(new Range(3, 5)))
  t.ok(selection.ranges[1].equals(new Range(11, 23)))
})

test('Test Selection#somethingSelected', t => {
  let selection = new Selection([new Range(7, 7), new Range(10, 10)])
  t.ok(!selection.somethingSelected())
  selection = new Selection([new Range(7, 10)])
  t.ok(selection.somethingSelected())
})

test('Test Selection#transform', t => {
  const selection = new Selection([new Range(3, 7), new Range(19, 21)])
  t.ok(selection
    .transform(new TextOperation().retain(3).insert('lorem')['delete'](2).retain(42))
    .equals(new Selection([new Range(8, 10), new Range(22, 24)])))
  t.ok(selection
    .transform(new TextOperation()['delete'](45))
    .equals(new Selection([new Range(0, 0), new Range(0, 0)])))
})

test('Test Selection#compose', t => {
  const a = new Selection([new Range(3, 7)])
  const b = Selection.createCursor(4)
  t.deepEqual(a.compose(b), b)
})

