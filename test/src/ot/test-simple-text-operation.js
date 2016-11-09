import SimpleTextOperation from 'ot/simple-text-operation'
import h from 'test/helpers/test-helper'

const n = 500

const Insert = SimpleTextOperation.Insert
const Delete = SimpleTextOperation.Delete
const Noop = SimpleTextOperation.Noop

function randomSimpleTextOperation (doc) {
  if (Math.random() < 0.5) {
    return new Insert(
      h.randomString(1 + h.randomInt(10)),
      h.randomInt(doc.length + 1)
    )
  }

  if (doc.length === 0 || Math.random() < 0.2) {
    return new Noop()
  }

  const position = h.randomInt(doc.length)
  const count = 1 + h.randomInt(Math.min(10, doc.length - position))
  return new Delete(count, position)
}

test('Test SimpleTextOperation#apply', t => {
  t.deepEqual('Hallo Welt!', new Insert('Welt', 6).apply('Hallo !'))
  t.deepEqual('Hallo !', new Delete(4, 6).apply('Hallo Welt!'))
  t.deepEqual('Hallo Welt!', new Noop().apply('Hallo Welt!'))
})

test('Test SimpleTextOperation.transform', t => {
  return h.randomTest(n, () => {
    const doc = h.randomString(15)
    const a = randomSimpleTextOperation(doc)
    const b = randomSimpleTextOperation(doc)

    const abPrime = SimpleTextOperation.transform(a, b)
    if (abPrime[0].apply(b.apply(doc)) !== abPrime[1].apply(a.apply(doc))) {
      console.log('------------------------')
      console.log(doc)
      console.log(a.toString())
      console.log(b.toString())
      console.log(abPrime[0].toString())
      console.log(abPrime[1].toString())
    }
    t.deepEqual(abPrime[0].apply(b.apply(doc)), abPrime[1].apply(a.apply(doc)))
  })
})

test('Test SimpleTextOperation.transform when same operations', t => {
  return h.randomTest(n, () => {
    const doc = h.randomString(15)
    const a = randomSimpleTextOperation(doc)
    const b = Object.create(a)

    const abPrime = SimpleTextOperation.transform(a, b)
    if (abPrime[0].apply(b.apply(doc)) !== abPrime[1].apply(a.apply(doc))) {
      console.log('------------------------')
      console.log(doc)
      console.log(a.toString())
      console.log(b.toString())
      console.log(abPrime[0].toString())
      console.log(abPrime[1].toString())
    }
    t.deepEqual(abPrime[0].apply(b.apply(doc)), abPrime[1].apply(a.apply(doc)))
  })
})

test('Test SimpleTextOperation.fromTextOperation', t => {
  return h.randomTest(n, () => {
    let doc = h.randomString(40)
    const operation = h.randomOperation(doc)
    const doc1 = operation.apply(doc)
    const simpleOperations = SimpleTextOperation.fromTextOperation(operation)
    for (let i = 0; i < simpleOperations.length; i++) {
      doc = simpleOperations[i].apply(doc)
    }
    t.deepEqual(doc1, doc)
  })
})
