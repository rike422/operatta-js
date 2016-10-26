export default class AjaxAdapter {
  constructor (path, ownUserName, revision) {
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
    const self = this
    $.ajax({
      url: this.path + this.renderRevisionPath(),
      type: 'GET',
      dataType: 'json',
      timeout: 5000,
      success (data) {
        self.handleResponse(data)
        self.poll()
      },
      error () {
        setTimeout(() => {
          self.poll()
        }, 500)
      }
    })
  }

  sendOperation (revision, operation, selection) {
    if (revision !== this.majorRevision) {
      throw new Error('Revision numbers out of sync')
    }
    const self = this
    $.ajax({
      url: this.path + this.renderRevisionPath(),
      type: 'POST',
      data: JSON.stringify({ operation, selection }),
      contentType: 'application/json',
      processData: false,
      success (data) {
      },
      error () {
        setTimeout(() => {
          self.sendOperation(revision, operation, selection)
        }, 500)
      }
    })
  }

  sendSelection (obj) {
    $.ajax({
      url: `${this.path + this.renderRevisionPath()}/selection`,
      type: 'POST',
      data: JSON.stringify(obj),
      contentType: 'application/json',
      processData: false,
      timeout: 1000
    })
  }

  registerCallbacks (cb) {
    this.callbacks = cb
  }

  trigger (event) {
    const args = Array.prototype.slice.call(arguments, 1)
    const action = this.callbacks && this.callbacks[event]
    if (action) {
      action.apply(this, args)
    }
  }
}

