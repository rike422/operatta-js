import h from 'test/helpers/test-helper'
import Client from 'client/client'
import Document from 'server/document'

class MyClient extends Client {
  constructor (userId, document, revision, channel) {
    super(revision)
    this.userId = userId
    this.document = document
    this.channel = channel
  }

  sendOperation (revision, operation) {
    this.channel.write({
      userId: this.userId,
      revision,
      operation
    })
  }

  applyOperation (operation) {
    this.document = operation.apply(this.document)
  }

  performOperation () {
    const operation = h.randomOperation(this.document)
    this.document = operation.apply(this.document)
    this.applyClient(operation)
  }
}

class NetworkChannel {
  constructor (onReceive) {
    this.buffer = []
    this.onReceive = onReceive
  }

  isEmpty () {
    return this.buffer.length === 0
  }

  write (val) {
    this.buffer.push(val)
  }

  read () {
    return this.buffer.shift()
  }

  receive () {
    this.onReceive.call(null, this.read())
  }
}

test('Test lientServerInteraction', (t) => {
  h.randomTest(50, () => {
    const document = h.randomString()
    let userId
    const server = new Document(document)

    function serverReceive (msg) {
      userId = msg.userId
      const operationP = server.receiveOperation(msg.revision, msg.operation)
      const broadcast = { userId, operation: operationP }
      client1ReceiveChannel.write(broadcast)
      client2ReceiveChannel.write(broadcast)
    }

    function clientReceive (client) {
      return obj => {
        if (obj.userId === client.userId) {
          client.serverAck()
        } else {
          client.applyServer(obj.operation)
        }
      }
    }

    const client1SendChannel = new NetworkChannel(serverReceive)
    const client1 = new MyClient('alice', document, 0, client1SendChannel)
    var client1ReceiveChannel = new NetworkChannel(clientReceive(client1))

    const client2SendChannel = new NetworkChannel(serverReceive)
    const client2 = new MyClient('bob', document, 0, client2SendChannel)
    var client2ReceiveChannel = new NetworkChannel(clientReceive(client2))

    const channels = [client1SendChannel, client1ReceiveChannel, client2SendChannel, client2ReceiveChannel]

    function canReceive () {
      for (let i = 0; i < channels.length; i++) {
        if (!channels[i].isEmpty()) {
          return true
        }
      }
      return false
    }

    function receiveRandom () {
      const channel = h.randomElement(channels.filter(c => !c.isEmpty()))
      channel.receive()
    }

    let n = 50
    while (n--) {
      if (!canReceive() || Math.random() < 0.75) {
        const client = Math.random() < 0.5 ? client1 : client2
        client.performOperation()
      } else {
        receiveRandom()
      }
    }

    while (canReceive()) {
      receiveRandom()
    }

    t.deepEqual(server.content, client1.document)
    t.deepEqual(client1.document, client2.document)
  })
})
