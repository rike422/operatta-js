import TextOperation from 'lib/text-operation'
import h from '../helpers/test-helper'

const n = 500

test('Test TextOperation.testConstructor', (t) => {
  // you should be able to call the constructor without 'new'
  const o = new TextOperation()
  t.deepEqual(o.constructor, TextOperation)
})

test('Test TextOperation.testLengths', (t) => {
  const o = new TextOperation()
  t.deepEqual(0, o.baseLength)
  t.deepEqual(0, o.targetLength)
  o.retain(5)
  t.deepEqual(5, o.baseLength)
  t.deepEqual(5, o.targetLength)
  o.insert('abc')
  t.deepEqual(5, o.baseLength)
  t.deepEqual(8, o.targetLength)
  o.retain(2)
  t.deepEqual(7, o.baseLength)
  t.deepEqual(10, o.targetLength)
  o['delete'](2)
  t.deepEqual(9, o.baseLength)
  t.deepEqual(10, o.targetLength)
})

test('Test TextOperation.testChaining', (t) => {
  const o = new TextOperation()
    .retain(5)
    .retain(0)
    .insert('lorem')
    .insert('')
    .delete('abc')
    .delete(3)
    .delete(0)
    .delete('')
  t.deepEqual(3, o.ops.length)
})

test('Test TextOperation#apply', (t) => {
  h.randomTest(n, () => {
    const str = h.randomString(50)
    const o = h.randomOperation(str)
    t.deepEqual(str.length, o.baseLength)
    t.deepEqual(o.apply(str).length, o.targetLength)
  })
})

test('Test TextOperation#invert', (t) => {
  h.randomTest(n, () => {
    const str = h.randomString(50)
    const o = h.randomOperation(str)
    const p = o.invert(str)
    t.deepEqual(o.baseLength, p.targetLength)
    t.deepEqual(o.targetLength, p.baseLength)
    t.deepEqual(p.apply(o.apply(str)), str)
  })
})

test('Test TextOperation#Empty', (t) => {
  const o = new TextOperation()
  o.retain(0)
  o.insert('')
  o['delete']('')
  t.deepEqual(0, o.ops.length)
})

test('Test TextOperation#equals', (t) => {
  const op1 = new TextOperation()['delete'](1).insert('lo').retain(2).retain(3)
  const op2 = new TextOperation()['delete'](-1).insert('l').insert('o').retain(5)
  t.ok(op1.equals(op2))
  op1['delete'](1)
  op2.retain(1)
  t.ok(!op1.equals(op2))
})

test('Test TextOperation merging', (t) => {
  function last (arr) {
    return arr[arr.length - 1]
  }

  const o = new TextOperation()
  t.deepEqual(0, o.ops.length)
  o.retain(2)
  t.deepEqual(1, o.ops.length)
  t.deepEqual(2, last(o.ops))
  o.retain(3)
  t.deepEqual(1, o.ops.length)
  t.deepEqual(5, last(o.ops))
  o.insert('abc')
  t.deepEqual(2, o.ops.length)
  t.deepEqual('abc', last(o.ops))
  o.insert('xyz')
  t.deepEqual(2, o.ops.length)
  t.deepEqual('abcxyz', last(o.ops))
  o['delete']('d')
  t.deepEqual(3, o.ops.length)
  t.deepEqual(-1, last(o.ops))
  o['delete']('d')
  t.deepEqual(3, o.ops.length)
  t.deepEqual(-2, last(o.ops))
})

test('Test TextOperation IsNoop', (t) => {
  const o = new TextOperation()
  t.ok(o.isNoop())
  o.retain(5)
  t.ok(o.isNoop())
  o.retain(3)
  t.ok(o.isNoop())
  o.insert('lorem')
  t.ok(!o.isNoop())
})

test('Test TextOperation#toString', (t) => {
  const o = new TextOperation()
  o.retain(2)
  o.insert('lorem')
  o['delete']('ipsum')
  o.retain(5)
  t.deepEqual("retain 2, insert 'lorem', delete 5, retain 5", o.toString())
})

test('Test TextOperation#IdString', (t) => {
  h.randomTest(n, () => {
    const doc = h.randomString(50)
    const operation = h.randomOperation(doc)
    t.ok(operation.equals(TextOperation.fromJSON(operation.toJSON())))
  })
})

test('Test TextOperation.fromJson', (t) => {
  const ops = [2, -1, -1, 'cde']
  const o = TextOperation.fromJSON(ops)
  t.deepEqual(3, o.ops.length)
  t.deepEqual(4, o.baseLength)
  t.deepEqual(5, o.targetLength)

  function assertIncorrectAfter (fn) {
    const ops2 = ops.slice(0)
    fn(ops2)
    t.throws(() => {
      TextOperation.fromJSON(ops2)
    })
  }

  assertIncorrectAfter(ops2 => {
    ops2.push({ insert: 'x' })
  })
  assertIncorrectAfter(ops2 => {
    ops2.push(null)
  })
})
test('Test TextOperation should be compose with', (t) => {
  function make () {
    return new TextOperation()
  }

  let a
  let b

  a = make().retain(3)
  b = make().retain(1).insert('tag').retain(2)
  t.ok(a.shouldBeComposedWith(b))
  t.ok(b.shouldBeComposedWith(a))

  a = make().retain(1).insert('a').retain(2)
  b = make().retain(2).insert('b').retain(2)
  t.ok(a.shouldBeComposedWith(b))
  a['delete'](3)
  t.ok(!a.shouldBeComposedWith(b))

  a = make().retain(1).insert('b').retain(2)
  b = make().retain(1).insert('a').retain(3)
  t.ok(!a.shouldBeComposedWith(b))

  a = make().retain(4)['delete'](3).retain(10)
  b = make().retain(2)['delete'](2).retain(10)
  t.ok(a.shouldBeComposedWith(b))
  b = make().retain(4)['delete'](7).retain(3)
  t.ok(a.shouldBeComposedWith(b))
  b = make().retain(2)['delete'](9).retain(3)
  t.ok(!a.shouldBeComposedWith(b))
})

test('Test TextOperation should be compose with inverted', (t) => {
  h.randomTest(2 * n, () => {
    // invariant: shouldBeComposedWith(a, b) = shouldBeComposedWithInverted(b^{-1}, a^{-1})
    const str = h.randomString()
    const a = h.randomOperation(str)
    const aInv = a.invert(str)
    const afterA = a.apply(str)
    const b = h.randomOperation(afterA)
    const bInv = b.invert(afterA)
    t.deepEqual(a.shouldBeComposedWith(b), bInv.shouldBeComposedWithInverted(aInv))
  })
})

test('Test TextOperation#compose', (t) => {
  h.randomTest(n, () => {
    // invariant: apply(str, compose(a, b)) === apply(apply(str, a), b)
    const str = h.randomString(20)
    const a = h.randomOperation(str)
    const afterA = a.apply(str)
    t.deepEqual(a.targetLength, afterA.length)
    const b = h.randomOperation(afterA)
    const afterB = b.apply(afterA)
    t.deepEqual(b.targetLength, afterB.length)
    const ab = a.compose(b)
    t.deepEqual(ab.meta, a.meta)
    t.deepEqual(ab.targetLength, b.targetLength)
    const afterAB = ab.apply(str)
    t.deepEqual(afterB, afterAB)
  })
})

test('Test TextOperation#transfomr', (t) => {
  h.randomTest(n, () => {
    // invariant: compose(a, b') = compose(b, a')
    // where (a', b') = transform(a, b)
    const str = h.randomString(20)
    const a = h.randomOperation(str)
    const b = h.randomOperation(str)
    const primes = TextOperation.transform(a, b)
    const aPrime = primes[0]
    const bPrime = primes[1]
    const abPrime = a.compose(bPrime)
    const baPrime = b.compose(aPrime)
    const afterAbPrime = abPrime.apply(str)
    const afterBaPrime = baPrime.apply(str)
    t.ok(abPrime.equals(baPrime))
    t.deepEqual(afterAbPrime, afterBaPrime)
  })
})

