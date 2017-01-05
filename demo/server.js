#!/usr/bin/env node

const express = require('express')
const next = require('next')
const accepts = require('accepts')
const http = require('http')
const socketIo = require('socket.io')

const { EditorSocketIOServer } = require('./lib/index')

const app = next({ dev: process.env.NODE_ENV !== 'production', dir: process.cwd() })
const handle = app.getRequestHandler()
const defaultText = `
# This is a Markdown heading

Please enter
`
const handleByNext = (req, res) => {
  return handle(req, res)
}

app.prepare().then(() => {
  const server = express()
    .get('*', handleByNext)
    .listen(process.env.PORT || 3000, (err) => {
      console.log(err)
      console.log("start 3000")
    })
  const socketIOServer = new EditorSocketIOServer(defaultText, [], 'demo', (socket, cb) => {
    console.log("connect")
    cb(!!socket.mayEdit);
  });

  const con = socketIo.listen(server)

  con.sockets.on('connection', socket => {
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

  process.on('uncaughtException', exc => {
    console.error(exc);
  });

})
