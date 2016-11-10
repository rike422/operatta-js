// @flow

import TextOperation from './text-operation'
import SelfMeta from 'client/self-meta'

export default class WrappedOperation {

  wrapped: TextOperation
  meta: ?SelfMeta

  static transform = (a: WrappedOperation, b: WrappedOperation): [WrappedOperation, WrappedOperation] => {
    const transform = a.wrapped.constructor.transform
    const pair = transform(a.wrapped, b.wrapped)
    return [
      new WrappedOperation(pair[0], transformMeta(a.meta, b.wrapped)),
      new WrappedOperation(pair[1], transformMeta(b.meta, a.wrapped))
    ]
  }

  constructor (operation: TextOperation, meta: ?SelfMeta) {
    this.wrapped = operation
    this.meta = meta
  }

  apply (): string {
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

function composeMeta (a: SelfMeta, b: SelfMeta): {} {
  if (a && typeof a === 'object') {
    if (typeof a.compose === 'function') {
      return a.compose(b)
    }
    return Object.assign({}, a, b)
  }
  return b
}

function transformMeta (meta: ?SelfMeta, operation: TextOperation): SelfMeta {
  if (meta && typeof meta === 'object') {
    if (typeof meta.transform === 'function') {
      return meta.transform(operation)
    }
  }
  return meta
}
