// @flow
import { hsl2hex, hueFromName } from 'common/colors'
import Selection from 'client/selection'

class OtherMeta {
  constructor (clientId, selection) {
    this.clientId = clientId
    this.selection = selection
  }

  transform (operation) {
    return new OtherMeta(
      this.clientId,
      this.selection && this.selection.transform(operation)
    )
  }
}

OtherMeta.fromJSON = obj => new OtherMeta(
  obj.clientId,
  obj.selection && Selection.fromJSON(obj.selection)
)

export default class OtherClient {
  constructor (id, listEl, editorAdapter, name, selection) {
    this.id = id
    this.listEl = listEl
    this.editorAdapter = editorAdapter
    this.name = name

    this.li = document.createElement('li')
    if (name) {
      this.li.textContent = name
      this.listEl.appendChild(this.li)
    }

    this.setColor(name ? hueFromName(name) : Math.random())
    if (selection) {
      this.updateSelection(selection)
    }
  }

  setColor (hue) {
    this.hue = hue
    this.color = hsl2hex(hue, 0.75, 0.5)
    this.lightColor = hsl2hex(hue, 0.5, 0.9)
    if (this.li) {
      this.li.style.color = this.color
    }
  }

  setName (name) {
    if (this.name === name) {
      return
    }
    this.name = name

    this.li.textContent = name
    if (!this.li.parentNode) {
      this.listEl.appendChild(this.li)
    }

    this.setColor(hueFromName(name))
  }

  updateSelection (selection) {
    this.removeSelection()
    this.selection = selection
    this.mark = this.editorAdapter.setOtherSelection(
      selection,
      selection.position === selection.selectionEnd ? this.color : this.lightColor,
      this.id
    )
  }

  remove () {
    if (this.li) {
      removeElement(this.li)
    }
    this.removeSelection()
  }

  removeSelection () {
    if (this.mark) {
      this.mark.clear()
      this.mark = null
    }
  }
}

// Remove an element from the DOM.
function removeElement (el) {
  if (el.parentNode) {
    el.parentNode.removeChild(el)
  }
}
