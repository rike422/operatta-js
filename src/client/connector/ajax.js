// @flow
import fetch from 'node-fetch'
import Connector from './connector'
import Selection from 'client/selection'
import { revsionData, xhrData } from 'types/data'

export default class AjaxAdapter extends Connector {
  path: string
  ownUserName: string
  majorRevision: number
  minorRevision: number

  constructor (path: string, ownUserName: string, revision: revsionData): void {
    super()
    if (path[path.length - 1] !== '/') {
      path += '/'
    }
    this.path = path
    this.ownUserName = ownUserName
    this.majorRevision = revision.major || 0
    this.minorRevision = revision.minor || 0
    this.poll()
  }

  renderRevisionPath (): string {
    return `revision/${this.majorRevision}-${this.minorRevision}`
  }

  handleResponse (data: xhrData): void {
    let i: number
    const operations: Array<any> = data.operations
    for (i = 0; i < operations.length; i++) {
      if (operations[i].user === this.ownUserName) {
        this.trigger('ack')
      } else {
        this.trigger('operation', operations[i].operation)
      }
    }

    if (operations.length > 0) {
      this.majorRevision += operations.length
      this.minorRevision = 0
    }

    const events: Array<any> = data.events
    if (events) {
      for (i = 0; i < events.length; i++) {
        const user = events[i].user
        if (user === this.ownUserName) {
          continue
        }
        switch (events[i].event) {
          case 'joined':
            this.trigger('set_name', user, user)
            break
          case 'left':
            this.trigger('client_left', user)
            break
          case 'selection':
            this.trigger('selection', user, events[i].selection)
            break
        }
      }
      this.minorRevision += events.length
    }

    const users = data.users
    if (users) {
      delete users[this.ownUserName]
      this.trigger('clients', users)
    }

    if (data.revision) {
      this.majorRevision = data.revision.major
      this.minorRevision = data.revision.minor
    }
  }

  poll (): void {
    const url: string = this.path + this.renderRevisionPath()
    fetch(url, {
      headers: {
        contentType: 'application/json'
      },
      timeout: 5000
    }).then((data): void => {
      this.handleResponse(data.json())
      this.poll()
    }).catch((e): void => {
      setTimeout((): void => {
        this.poll()
      }, 500)
    })
  }

  sendOperation (revision: number, operation: Array<any>, selection: Selection): void {
    if (revision !== this.majorRevision) {
      throw new Error('Revision numbers out of sync')
    }
    const url: string = this.path + this.renderRevisionPath()

    fetch(url, {
      method: 'POST',
      body: JSON.stringify({ operation, selection }),
      headers: {
        contentType: 'application/json'
      }
    }).catch((e): void => {
      setTimeout((): void => {
        this.sendOperation(revision, operation, selection)
      }, 500)
    })
  }

  sendSelection (obj: any): void {
    const url: string = `${this.path + this.renderRevisionPath()}/selection`
    fetch(url, {
      method: 'POST',
      body: JSON.stringify(obj),
      headers: {
        contentType: 'application/json'
      },
      timeout: 1000
    })
  }
}

