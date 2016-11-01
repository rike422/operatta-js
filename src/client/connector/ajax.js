// @flow
import fetch from 'node-fetch'
import Connector from './connector'

export default class AjaxAdapter extends Connector {
  constructor (path, ownUserName, revision) {
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

  renderRevisionPath () {
    return `revision/${this.majorRevision}-${this.minorRevision}`
  }

  handleResponse (data) {
    let i
    const operations = data.operations
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

    const events = data.events
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

  poll () {
    const url = this.path + this.renderRevisionPath()
    fetch(url, {
      headers: {
        contentType: 'application/json'
      },
      timeout: 5000
    }).then((data) => {
      this.handleResponse(data.json())
      this.poll()
    }).catch((e) => {
      setTimeout(() => {
        this.poll()
      }, 500)
    })
  }

  sendOperation (revision, operation, selection) {
    if (revision !== this.majorRevision) {
      throw new Error('Revision numbers out of sync')
    }
    const url = this.path + this.renderRevisionPath()

    fetch(url, {
      method: 'POST',
      body: JSON.stringify({ operation, selection }),
      headers: {
        contentType: 'application/json'
      }
    }).catch((e) => {
      setTimeout(() => {
        this.sendOperation(revision, operation, selection)
      }, 500)
    })
  }

  sendSelection (obj) {
    const url = `${this.path + this.renderRevisionPath()}/selection`
    fetch(url, {
      method: 'POST',
      body: JSON.stringify(obj),
      headers: {
        contentType: 'application/json'
      },
      timeout: 1000
    })
  }

  registerCallbacks (cb) {
    this.callbacks = cb
  }
}

