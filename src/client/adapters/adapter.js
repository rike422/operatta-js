import Eventable from 'common/eventable'
export default class EditorAdaptor extends Eventable {

  onChange (fn) {
    this.on('change', fn)
  }

  onSelectionChange (fn) {
    this.on('selectionChange', fn)
  }

  onBlur (fn) {
    this.on('blur', fn)
  }
}
