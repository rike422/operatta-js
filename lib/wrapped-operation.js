if (typeof ot === 'undefined') {
  // Export for browsers
  var ot = {};
}

ot.WrappedOperation = ((global => {
  // A WrappedOperation contains an operation and corresponing metadata.
  class WrappedOperation {
    constructor (operation, meta) {
      this.wrapped = operation;
      this.meta = meta;
    }

    apply () {
      return this.wrapped.apply(...arguments);
    }

    invert () {
      const meta = this.meta;
      return new WrappedOperation(
        this.wrapped.invert(...arguments),
        meta && typeof meta === 'object' && typeof meta.invert === 'function' ?
          meta.invert(...arguments) : meta
      );
    }

    compose (other) {
      return new WrappedOperation(
        this.wrapped.compose(other.wrapped),
        composeMeta(this.meta, other.meta)
      );
    }
  }

  // Copy all properties from source to target.
  function copy (source, target) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key];
      }
    }
  }

  function composeMeta (a, b) {
    if (a && typeof a === 'object') {
      if (typeof a.compose === 'function') {
        return a.compose(b);
      }
      const meta = {};
      copy(a, meta);
      copy(b, meta);
      return meta;
    }
    return b;
  }

  function transformMeta (meta, operation) {
    if (meta && typeof meta === 'object') {
      if (typeof meta.transform === 'function') {
        return meta.transform(operation);
      }
    }
    return meta;
  }

  WrappedOperation.transform = (a, b) => {
    const transform = a.wrapped.constructor.transform;
    const pair = transform(a.wrapped, b.wrapped);
    return [
      new WrappedOperation(pair[0], transformMeta(a.meta, b.wrapped)),
      new WrappedOperation(pair[1], transformMeta(b.meta, a.wrapped))
    ];
  };

  return WrappedOperation;
})(this));

// Export for CommonJS
if (typeof module === 'object') {
  module.exports = ot.WrappedOperation;
}