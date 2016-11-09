// @flow
import { hsl2hex, hueFromName } from 'common/colors'
import Selection from 'client/selection'
import Adapter from 'client/adapters/adapter'

// import { clientData } from 'types/data'
// class OtherMeta {
//   clientId: string
//   selection: Selection
//
//   static fromJSON = (obj: clientData): OtherMeta => {
//     return new OtherMeta(
//       obj.clientId,
//       obj.selection && Selection.fromJSON(obj.selection)
//     )
//   }
//
//   constructor (clientId: string, selection: Selection): void {
//     this.clientId = clientId
//     this.selection = selection
//   }
//
//   transform (operation): OtherMeta {
//     return new OtherMeta(
//       this.clientId,
//       this.selection && this.selection.transform(operation)
//     )
//   }
// }

export default class OtherClient {
  id: string
  name: ?string
  listEl: any
  li: any
  editorAdapter: Adapter
  hue: number
  color: string
  lightColor: string
  mark: ?{ clear: () => void }
  selection: ?Selection

  constructor (id: string, listEl: any, editorAdapter: Adapter, name: ?string, selection: ?Selection): void {
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

  setColor (hue: number): void {
    this.hue = hue
    this.color = hsl2hex(hue, 0.75, 0.5)
    this.lightColor = hsl2hex(hue, 0.5, 0.9)
    if (this.li) {
      this.li.style.color = this.color
    }
  }

  setName (name: string): void {
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

  updateSelection (selection: Selection): void {
    this.removeSelection()
    this.selection = selection
    this.mark = this.editorAdapter.setOtherSelection(
      selection,
      // selection.position === selection.selectionEnd ? this.color : this.lightColor,
      this.lightColor,
      this.id
    )
  }

  remove (): void {
    if (this.li) {
      removeElement(this.li)
    }
    this.removeSelection()
  }

  removeSelection (): void {
    if (this.mark) {
      this.mark.clear()
      this.mark = undefined
    }
  }
}

// Remove an element from the DOM.
function removeElement (el): void {
  if (el.parentNode) {
    el.parentNode.removeChild(el)
  }
}
