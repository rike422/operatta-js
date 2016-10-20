import WrappedOperation from '../../lib/wrapped-operation';
import TextOperation from '../../lib/text-operation';
import Selection from '../../lib/selection';
import h from '../helpers';

var n = 20;

export var testApply = h.randomTest(n, test => {
  var str = h.randomString(50);
  var operation = h.randomOperation(str);
  var wrapped = new WrappedOperation(operation, { lorem: 42 });
  test.strictEqual(wrapped.meta.lorem, 42);
  test.strictEqual(wrapped.apply(str), operation.apply(str));
});

export var testInvert = h.randomTest(n, test => {
  var str = h.randomString(50);
  var operation = h.randomOperation(str);
  var payload = { lorem: 'ipsum' };
  var wrapped = new WrappedOperation(operation, payload);
  var wrappedInverted = wrapped.invert(str);
  test.strictEqual(wrappedInverted.meta, payload);
  test.strictEqual(str, wrappedInverted.apply(operation.apply(str)));
});

export function testInvertMethod (test) {
  var str = h.randomString(50);
  var operation = h.randomOperation(str);
  var meta = {
    invert(doc) {
      return doc;
    }
  };
  var wrapped = new WrappedOperation(operation, meta);
  test.strictEqual(wrapped.invert(str).meta, str);
  test.done();
}

export var testCompose = h.randomTest(n, test => {
  var str = h.randomString(50);
  var a = new WrappedOperation(h.randomOperation(str), { a: 1, b: 2 });
  var strN = a.apply(str);
  var b = new WrappedOperation(h.randomOperation(strN), { a: 3, c: 4 });
  var ab = a.compose(b);
  test.strictEqual(ab.meta.a, 3);
  test.strictEqual(ab.meta.b, 2);
  test.strictEqual(ab.meta.c, 4);
  test.strictEqual(ab.apply(str), b.apply(strN));
});

export function testComposeMethod (test) {
  var meta = {
    timesComposed: 0,
    compose(other) {
      return {
        timesComposed: this.timesComposed + other.timesComposed + 1,
        compose: meta.compose
      };
    }
  };
  var str = h.randomString(50);
  var a = new WrappedOperation(h.randomOperation(str), meta);
  var strN = a.apply(str);
  var b = new WrappedOperation(h.randomOperation(strN), meta);
  var ab = a.compose(b);
  test.strictEqual(ab.meta.timesComposed, 1);
  test.done();
}

export var testTransform = h.randomTest(n, test => {
  var str = h.randomString(50);
  var metaA = {};
  var a = new WrappedOperation(h.randomOperation(str), metaA);
  var metaB = {};
  var b = new WrappedOperation(h.randomOperation(str), metaB);
  var pair = WrappedOperation.transform(a, b);
  var aPrime = pair[0];
  var bPrime = pair[1];
  test.strictEqual(aPrime.meta, metaA);
  test.strictEqual(bPrime.meta, metaB);
  test.strictEqual(aPrime.apply(b.apply(str)), bPrime.apply(a.apply(str)));
});

export function testTransformMethod (test) {
  var str = 'Loorem ipsum';
  var a = new WrappedOperation(
    new TextOperation().retain(1)['delete'](1).retain(10),
    Selection.createCursor(1)
  );
  var b = new WrappedOperation(
    new TextOperation().retain(7)['delete'](1).insert("I").retain(4),
    Selection.createCursor(8)
  );
  var pair = WrappedOperation.transform(a, b);
  var aPrime = pair[0];
  var bPrime = pair[1];
  test.strictEqual("Lorem Ipsum", bPrime.apply(a.apply(str)));
  test.ok(aPrime.meta.equals(Selection.createCursor(1)));
  test.ok(bPrime.meta.equals(Selection.createCursor(7)));
  test.done();
}