const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Track connected users: { socketId: { name, room, color } }
const users = {};

// Available rooms
const rooms = ['general', 'tech', 'random', 'design'];

// Color palette for users
const colors = [
  '#7864ff', '#00e5b0', '#ff6b9d', '#ffb347',
  '#4fc3f7', '#a5d6a7', '#ef9a9a', '#ce93d8'
];
let colorIdx = 0;
function nextColor() {
  const c = colors[colorIdx % colors.length];
  colorIdx++;
  return c;
}

function getRoomUsers(room) {
  return Object.values(users).filter(u => u.room === room);
}

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // User joins with a name
  socket.on('join', ({ name, room }) => {
    // Validate
    if (!name || !room) return;

    const color = nextColor();
    users[socket.id] = { name, room, color, id: socket.id };

    socket.join(room);

    // Notify room
    io.to(room).emit('system', {
      text: `${name} чатад нэгдлээ 👋`,
      time: getTime()
    });

    // Send room user list to everyone in room
    io.to(room).emit('room_users', getRoomUsers(room));

    // Send chat history / welcome
    socket.emit('joined', {
      room,
      color,
      users: getRoomUsers(room),
      rooms
    });

    console.log(`${name} joined #${room}`);
  });

  // User switches room
  socket.on('switch_room', (newRoom) => {
    const user = users[socket.id];
    if (!user) return;

    const oldRoom = user.room;

    // Leave old room
    socket.leave(oldRoom);
    io.to(oldRoom).emit('system', {
      text: `${user.name} өрөөнөөс гарлаа`,
      time: getTime()
    });
    io.to(oldRoom).emit('room_users', getRoomUsers(oldRoom));

    // Join new room
    user.room = newRoom;
    socket.join(newRoom);

    io.to(newRoom).emit('system', {
      text: `${user.name} #${newRoom} өрөөнд нэгдлээ 👋`,
      time: getTime()
    });
    io.to(newRoom).emit('room_users', getRoomUsers(newRoom));

    socket.emit('switched', {
      room: newRoom,
      users: getRoomUsers(newRoom)
    });
  });

  // User sends a message
  socket.on('message', ({ text }) => {
    const user = users[socket.id];
    if (!user || !text || !text.trim()) return;

    const msg = {
      id: Date.now(),
      user: { name: user.name, color: user.color, id: user.id },
      text: text.trim(),
      time: getTime()
    };

    io.to(user.room).emit('message', msg);
  });

  // Typing indicator
  socket.on('typing', (isTyping) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(user.room).emit('typing', {
      name: user.name,
      isTyping
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      const room = user.room;
      delete users[socket.id];
      io.to(room).emit('system', {
        text: `${user.name} гарлаа`,
        time: getTime()
      });
      io.to(room).emit('room_users', getRoomUsers(room));
      console.log(`${user.name} disconnected`);
    }
  });
});

function getTime() {
  return new Date().toLocaleTimeString('mn-MN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Chat server running at http://localhost:${PORT}\n`);
});
