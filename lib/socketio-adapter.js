/*global ot */

ot.SocketIOAdapter = ((() => {
  class SocketIOAdapter {
    constructor (socket) {
      this.socket = socket;

      const self = this;
      socket
        .on('client_left', clientId => {
          self.trigger('client_left', clientId);
        })
        .on('set_name', (clientId, name) => {
          self.trigger('set_name', clientId, name);
        })
        .on('ack', () => {
          self.trigger('ack');
        })
        .on('operation', (clientId, operation, selection) => {
          self.trigger('operation', operation);
          self.trigger('selection', clientId, selection);
        })
        .on('selection', (clientId, selection) => {
          self.trigger('selection', clientId, selection);
        })
        .on('reconnect', () => {
          self.trigger('reconnect');
        });
    }

    sendOperation (revision, operation, selection) {
      this.socket.emit('operation', revision, operation, selection);
    }

    sendSelection (selection) {
      this.socket.emit('selection', selection);
    }

    registerCallbacks (cb) {
      this.callbacks = cb;
    }

    trigger (event) {
      const args = Array.prototype.slice.call(arguments, 1);
      const action = this.callbacks && this.callbacks[event];
      if (action) {
        action.apply(this, args);
      }
    }
  }

  return SocketIOAdapter;
})());