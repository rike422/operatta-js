// @flow
import type { Socket } from 'socket.io'
import Editor from 'document.js/editor-socketio-server'
import Selection from 'client/selection'
import { revisionData } from 'types/data'

export default class Link {
  socket: Socket
  document: Editor

  constructor (socket: Socket, document: Editor) {
    this.socket = socket
    socket
      .join(document.docId)
      .on('disconnect', () => {
        socket.leave(document.docId)
        this.onDisconnect(socket)
        if (socket.ns && Object.keys(socket.nsp.connected).length === 0) {
          this.emit('empty-room')
        }
      })
  }

  requestAuthenticate (link: Link): Promise<boolean> {
    const promise = new Promise((resolve, reject) => {
      this.socket.emit("request:auth", {
          link: link
        }
      )
      this.socket.on("accept:auth", (link) => {
        resolve(true)
      })
    })
    return promise
  }

  up () {
    this.socket
      .emit('doc', {
        str: this.document,
        revision: this.operations.length,
        clients: this.users
      })
      .on('operation', (revision: revisionData, operation: Array<any>, selection: Selection) => {
        this.onOperation(socket, revision, operation, selection)
      })
      .on('selection', (obj) => {
        this.updateSelection(socket, obj && Selection.fromJSON(obj))
      })
  }

  down () {
  }

}
