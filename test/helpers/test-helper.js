import test, { describe } from 'ava-spec'
import sinon from 'sinon'
import TextOperation from 'lib/text-operation'

global.assert = require('power-assert')
global.document = require('jsdom').jsdom('<body></body>')
global.window = document.defaultView
global.navigator = window.navigator
global.WebSocket = require('mock-socket').WebSocket
global.test = test
global.describe = describe

document.createRange = function() {
  return {
    selectNode () {},
    setEnd () {
    },
    setStart () {
    },
    getBoundingClientRect () {
      return { right: 0 };
    },
    getClientRects () {
      return { right: 0 };
    },
    createContextualFragment (html) { return jsdom.jsdom(html); }
  }
}

test.beforeEach(() => {
  global.sinon = sinon.sandbox.create()
})

test.afterEach(() => {
    global.sinon.restore()
  }
)

export default  {
  triggerEvent  (el, event) {
    const ev = new window.Event(event)
    el.dispatchEvent(ev)
  },

  randomInt (n) {
    return Math.floor(Math.random() * n);
  },

  randomString (n) {
    let str = '';
    while (n--) {
      if (Math.random() < 0.15) {
        str += '\n';
      } else {
        const chr = this.randomInt(26) + 97;
        str += String.fromCharCode(chr);
      }
    }
    return str;
  },

  randomOperation (str) {
    const operation = new TextOperation();
    let left;
    while (true) {
      left = str.length - operation.baseLength;
      if (left === 0) {
        break;
      }
      const r = Math.random();
      const l = 1 + this.randomInt(Math.min(left - 1, 20));
      if (r < 0.2) {
        operation.insert(this.randomString(l));
      } else if (r < 0.4) {
        operation['delete'](l);
      } else {
        operation.retain(l);
      }
    }
    if (Math.random() < 0.3) {
      operation.insert(1 + this.randomString(10));
    }
    return operation;
  },
  randomElement (arr) {
    return arr[this.randomInt(arr.length)];
  },
  // A random test generates random data to check some invariants. To increase
  // confidence in a random test, it is run repeatedly.
  randomTest (n, fun) {
    return test => {
      while (n--) {
        fun(test);
      }
      test.done();
    };
  }
}
