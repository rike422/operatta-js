export default class Eventable {

  constructor () {
    this.callbacks = {}
  }

  on (type, fn) {
    const callBacks = this.callbacks[type] || []
    callBacks.push(fn)
    this.callbacks[type] = callBacks
  }

  off (type, fn) {
    const callBacks = this.callbacks[type] || []
    this.callbacks[type] = callBacks.filter(_fn => fn === _fn)
  }

  trigger (type, ...args) {
    const callBacks = this.callbacks && this.callbacks[type]
    if (callBacks === undefined) {
      return
    }
    callBacks.forEach(cb => cb(...args))
  }
}
