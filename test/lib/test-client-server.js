import Client from '../../lib/client';
import Server from '../../lib/server';
import h from '../helpers';

function inherit (Const, Super) {
  function F () {
  }

  F.prototype = Super.prototype;
  Const.prototype = new F();
  Const.prototype.constructor = Const;
}

class MyClient {
  constructor (userId, document, revision, channel) {
    Client.call(this, revision);
    this.userId = userId;
    this.document = document;
    this.channel = channel;
  }

  sendOperation (revision, operation) {
    this.channel.write({
      userId: this.userId,
      revision,
      operation
    });
  }

  applyOperation (operation) {
    this.document = operation.apply(this.document);
  }

  performOperation () {
    var operation = h.randomOperation(this.document);
    this.document = operation.apply(this.document);
    this.applyClient(operation);
  }
}

inherit(MyClient, Client);

class NetworkChannel {
  constructor (onReceive) {
    this.buffer = [];
    this.onReceive = onReceive;
  }

  isEmpty () {
    return this.buffer.length === 0;
  }

  write (val) {
    this.buffer.push(val);
  }

  read () {
    return this.buffer.shift();
  }

  receive () {
    this.onReceive.call(null, this.read());
  }
}

export var testClientServerInteraction = h.randomTest(50, test => {
  var document = h.randomString();
  var userId;
  var server = new Server(document);

  function serverReceive (msg) {
    userId = msg.userId;
    var operationP = server.receiveOperation(msg.revision, msg.operation);
    var broadcast = { userId, operation: operationP };
    client1ReceiveChannel.write(broadcast);
    client2ReceiveChannel.write(broadcast);
  }

  function clientReceive (client) {
    return obj => {
      if (obj.userId === client.userId) {
        client.serverAck();
      } else {
        client.applyServer(obj.operation);
      }
    };
  }

  var client1SendChannel = new NetworkChannel(serverReceive);
  var client1 = new MyClient('alice', document, 0, client1SendChannel);
  var client1ReceiveChannel = new NetworkChannel(clientReceive(client1));

  var client2SendChannel = new NetworkChannel(serverReceive);
  var client2 = new MyClient('bob', document, 0, client2SendChannel);
  var client2ReceiveChannel = new NetworkChannel(clientReceive(client2));

  var channels = [client1SendChannel, client1ReceiveChannel, client2SendChannel, client2ReceiveChannel];

  function canReceive () {
    for (var i = 0; i < channels.length; i++) {
      if (!channels[i].isEmpty()) {
        return true;
      }
    }
    return false;
  }

  function receiveRandom () {
    var channel = h.randomElement(channels.filter(c => !c.isEmpty()));
    channel.receive();
  }

  var n = 50;
  while (n--) {
    if (!canReceive() || Math.random() < 0.75) {
      var client = Math.random() < 0.5 ? client1 : client2;
      client.performOperation();
    } else {
      receiveRandom();
    }
  }

  while (canReceive()) {
    receiveRandom();
  }

  test.strictEqual(server.document, client1.document);
  test.strictEqual(client1.document, client2.document);
});
