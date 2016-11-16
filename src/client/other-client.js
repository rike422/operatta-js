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
  editorAdapter: Adapter
  hue: number
  color: string
  lightColor: string
  mark: ?{ clear: () => void }
  selection: ?Selection

  constructor (id: string, editorAdapter: Adapter, name: ?string, selection: ?Selection): void {
    this.id = id
    this.editorAdapter = editorAdapter
    this.name = name

    this.setColor(name ? hueFromName(name) : Math.random())

    if (selection) {
      this.updateSelection(selection)
    }
  }

  setColor (hue: number): void {
    this.hue = hue
    this.color = hsl2hex(hue, 0.75, 0.5)
    this.lightColor = hsl2hex(hue, 0.5, 0.9)
  }

  setName (name: string): void {
    if (this.name === name) {
      return
    }
    this.name = name
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
    this.removeSelection()
  }

  removeSelection (): void {
    if (this.mark) {
      this.mark.clear()
      this.mark = undefined
    }
  }
}
