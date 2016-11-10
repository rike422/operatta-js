// @flow

type callback = (...args: Array<any>) => void;

export default class Eventable {
  callbacks: { [key: string]: callback };

  constructor () {
    this.callbacks = {}
  }

  on (type: string, fn: callback) {
    const callBacks: () => void = this.callbacks[type] || []
    callBacks.push(fn)
    this.callbacks[type] = callBacks
  }

  off (type: string, fn: callback) {
    const callBacks: () => void = this.callbacks[type] || []
    this.callbacks[type] = callBacks.filter((_fn): boolean => _fn !== fn)
  }

  trigger (type: string, ...args: Array<any>) {
    const callBacks: () => void = this.callbacks && this.callbacks[type]
    if (callBacks === undefined) {
      return
    }
    callBacks.forEach(cb => cb(...args))
  }
}
