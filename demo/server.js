#!/usr/bin/env node
const { EditorSocketIOServer } = require('./lib/index')
const port = 28000;
const socketIo = require('socket.io').listen(port, function(data) {
  console.log("listen end")
  console.log(data)
})

const str = `
# This is a Markdown heading

Please enter
`
const socketIOServer = new EditorSocketIOServer(str, [], 'demo', (socket, cb) => {
  console.log("connect")
  cb(!!socket.mayEdit);
});

socketIo.sockets.on('connection', socket => {
  console.log("add client")
  socketIOServer.addClient(socket);
  socket.on('login', obj => {
    if (typeof obj.name !== 'string') {
      console.error('obj.name is not a string');
      return
    }
    socket.mayEdit = true;
    socketIOServer.setName(socket, obj.name);
    socket.emit('logged_in', {});
  });
});


console.log("listen")
process.on('uncaughtException', exc => {
  console.error(exc);
});
