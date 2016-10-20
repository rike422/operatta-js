import { EventEmitter } from 'events';
import TextOperation from './text-operation';
import WrappedOperation from './wrapped-operation';
import Server from './server';
import Selection from './selection';
import util from 'util';

class EditorSocketIOServer extends Server {
  constructor (document, operations, docId, mayWrite) {
    EventEmitter.call(this);
    super(document, operations);
    this.users = {};
    this.docId = docId;
    this.mayWrite = mayWrite || ((_, cb) => {
        cb(true);
      });
  }

  addClient (socket) {
    const self = this;
    socket
      .join(this.docId)
      .emit('doc', {
        str: this.document,
        revision: this.operations.length,
        clients: this.users
      })
      .on('operation', (revision, operation, selection) => {
        self.mayWrite(socket, mayWrite => {
          if (!mayWrite) {
            console.log("User doesn't have the right to edit.");
            return;
          }
          self.onOperation(socket, revision, operation, selection);
        });
      })
      .on('selection', obj => {
        self.mayWrite(socket, mayWrite => {
          if (!mayWrite) {
            console.log("User doesn't have the right to edit.");
            return;
          }
          self.updateSelection(socket, obj && Selection.fromJSON(obj));
        });
      })
      .on('disconnect', () => {
        console.log("Disconnect");
        socket.leave(self.docId);
        self.onDisconnect(socket);
        if (
          (socket.manager && socket.manager.sockets.clients(self.docId).length === 0) || // socket.io <= 0.9
          (socket.ns && Object.keys(socket.ns.connected).length === 0) // socket.io >= 1.0
        ) {
          self.emit('empty-room');
        }
      });
  }

  onOperation (socket, revision, operation, selection) {
    let wrapped;
    try {
      wrapped = new WrappedOperation(
        TextOperation.fromJSON(operation),
        selection && Selection.fromJSON(selection)
      );
    } catch (exc) {
      console.error(`Invalid operation received: ${exc}`);
      return;
    }

    try {
      const clientId = socket.id;
      const wrappedPrime = this.receiveOperation(revision, wrapped);
      console.log(`new operation: ${wrapped}`);
      this.getClient(clientId).selection = wrappedPrime.meta;
      socket.emit('ack');
      socket.broadcast['in'](this.docId).emit(
        'operation', clientId,
        wrappedPrime.wrapped.toJSON(), wrappedPrime.meta
      );
    } catch (exc) {
      console.error(exc);
    }
  }

  updateSelection (socket, selection) {
    const clientId = socket.id;
    if (selection) {
      this.getClient(clientId).selection = selection;
    } else {
      delete this.getClient(clientId).selection;
    }
    socket.broadcast['in'](this.docId).emit('selection', clientId, selection);
  }

  setName (socket, name) {
    const clientId = socket.id;
    this.getClient(clientId).name = name;
    socket.broadcast['in'](this.docId).emit('set_name', clientId, name);
  }

  getClient (clientId) {
    return this.users[clientId] || (this.users[clientId] = {});
  }

  onDisconnect (socket) {
    const clientId = socket.id;
    delete this.users[clientId];
    socket.broadcast['in'](this.docId).emit('client_left', clientId);
  }
}

extend(EditorSocketIOServer.prototype, EventEmitter.prototype);

function extend (target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key];
    }
  }
}

export default EditorSocketIOServer;
