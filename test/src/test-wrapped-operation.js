import WrappedOperation from 'src/wrapped-operation'
import TextOperation from 'src/text-operation'
import Selection from 'src/selection'
import h from '../helpers/test-helper'

const n = 20

test('WrappedOperation#apply', t => {
  h.randomTest(n, () => {
    const str = h.randomString(50)
    const operation = h.randomOperation(str)
    const wrapped = new WrappedOperation(operation, { lorem: 42 })
    t.deepEqual(wrapped.meta.lorem, 42)
    t.deepEqual(wrapped.apply(str), operation.apply(str))
  })
})

test('WrappedOperation#invert', t => {
  h.randomTest(n, () => {
    const str = h.randomString(50)
    const operation = h.randomOperation(str)
    const payload = { lorem: 'ipsum' }
    const wrapped = new WrappedOperation(operation, payload)
    const wrappedInverted = wrapped.invert(str)
    t.deepEqual(wrappedInverted.meta, payload)
    t.deepEqual(str, wrappedInverted.apply(operation.apply(str)))
  })
})

test('WrappedOperation#invert', t => {
  const str = h.randomString(50)
  const operation = h.randomOperation(str)
  const meta = {
    invert (doc) {
      return doc
    }
  }
  const wrapped = new WrappedOperation(operation, meta)
  t.deepEqual(wrapped.invert(str).meta, str)
})

test('WrappedOperation#compse', t => {
  h.randomTest(n, () => {
    const str = h.randomString(50)
    const a = new WrappedOperation(h.randomOperation(str), { a: 1, b: 2 })
    const strN = a.apply(str)
    const b = new WrappedOperation(h.randomOperation(strN), { a: 3, c: 4 })
    const ab = a.compose(b)
    t.deepEqual(ab.meta.a, 3)
    t.deepEqual(ab.meta.b, 2)
    t.deepEqual(ab.meta.c, 4)
    t.deepEqual(ab.apply(str), b.apply(strN))
  })
})

test('WrappedOperation#compse', t => {
  const meta = {
    timesComposed: 0,
    compose (other) {
      return {
        timesComposed: this.timesComposed + other.timesComposed + 1,
        compose: meta.compose
      }
    }
  }
  const str = h.randomString(50)
  const a = new WrappedOperation(h.randomOperation(str), meta)
  const strN = a.apply(str)
  const b = new WrappedOperation(h.randomOperation(strN), meta)
  const ab = a.compose(b)
  t.deepEqual(ab.meta.timesComposed, 1)
})

test('WrappedOperation#transform', t => {
  h.randomTest(n, () => {
    const str = h.randomString(50)
    const metaA = {}
    const a = new WrappedOperation(h.randomOperation(str), metaA)
    const metaB = {}
    const b = new WrappedOperation(h.randomOperation(str), metaB)
    const pair = WrappedOperation.transform(a, b)
    const aPrime = pair[0]
    const bPrime = pair[1]
    t.deepEqual(aPrime.meta, metaA)
    t.deepEqual(bPrime.meta, metaB)
    t.deepEqual(aPrime.apply(b.apply(str)), bPrime.apply(a.apply(str)))
  })
})

test('WrappedOperation#transform', t => {
  const str = 'Loorem ipsum'
  const a = new WrappedOperation(
    new TextOperation().retain(1)['delete'](1).retain(10),
    Selection.createCursor(1)
  )
  const b = new WrappedOperation(
    new TextOperation().retain(7)['delete'](1).insert('I').retain(4),
    Selection.createCursor(8)
  )
  const pair = WrappedOperation.transform(a, b)
  const aPrime = pair[0]
  const bPrime = pair[1]
  t.deepEqual('Lorem Ipsum', bPrime.apply(a.apply(str)))
  t.ok(aPrime.meta.equals(Selection.createCursor(1)))
  t.ok(bPrime.meta.equals(Selection.createCursor(7)))
})
