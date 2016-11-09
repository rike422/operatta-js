// @flow
import TextOperation from './text-operation'
import SelfMeta from 'client/self-meta'

export default class WrappedOperation {

  wrapped: TextOperation
  meta: SelfMeta

  static transform = (a, b): [WrappedOperation, WrappedOperation] => {
    const transform = a.wrapped.constructor.transform
    const pair = transform(a.wrapped, b.wrapped)
    return [
      new WrappedOperation(pair[0], transformMeta(a.meta, b.wrapped)),
      new WrappedOperation(pair[1], transformMeta(b.meta, a.wrapped))
    ]
  }

  constructor (operation: TextOperation, meta: SelfMeta): void {
    this.wrapped = operation
    this.meta = meta
  }

  apply () {
    return this.wrapped.apply(...arguments)
  }

  invert (): WrappedOperation {
    const meta = this.meta
    const invertMeta = meta && typeof meta === 'object' && typeof meta.invert === 'function'
      ? meta.invert(...arguments) : meta
    return new WrappedOperation(
      this.wrapped.invert(...arguments),
      invertMeta
    )
  }

  compose (other: WrappedOperation): WrappedOperation {
    return new WrappedOperation(
      this.wrapped.compose(other.wrapped),
      composeMeta(this.meta, other.meta)
    )
  }
}

// Copy all properties from source to target.
function copy (source, target: {}): void {
  for (const key: string in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key]
    }
  }
}

function composeMeta (a, b): {} {
  if (a && typeof a === 'object') {
    if (typeof a.compose === 'function') {
      return a.compose(b)
    }
    const meta: {} = {}
    copy(a, meta)
    copy(b, meta)
    return meta
  }
  return b
}

function transformMeta (meta, operation) {
  if (meta && typeof meta === 'object') {
    if (typeof meta.transform === 'function') {
      return meta.transform(operation)
    }
  }
  return meta
}
