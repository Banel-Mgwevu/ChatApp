// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const crypto = require('crypto');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);

app.use(express.static(__dirname + '/public'));


function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  const [ivString, encryptedText] = text.split(':');
  const iv = Buffer.from(ivString, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function loadChatHistory() {
  try {
    const encryptedData = fs.readFileSync('chatHistory.json', 'utf8');
    const decryptedData = decrypt(encryptedData);
    return JSON.parse(decryptedData);
  } catch (err) {
    return { messages: [], users: [] };
  }
}

function saveChatHistory(chatHistory) {
  const encryptedData = encrypt(JSON.stringify(chatHistory));
  fs.writeFileSync('chatHistory.json', encryptedData, 'utf8');
}



let chatHistory = loadChatHistory();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.emit('chat history', chatHistory.messages);
  socket.emit('userList', chatHistory.users);

  socket.on('setUsername', ({ username, icon }) => {
    socket.username = username;

    // Store username and associated icon in chat history
    chatHistory.users.push({ username, icon });

    io.emit('userJoined', `${username} joined the chat`);
    saveChatHistory(chatHistory);

    io.emit('userList', chatHistory.users);
  });

// io.on('connection', (socket) => {
//   console.log('A user connected');

//   // Sending chat history and list of users to the newly connected user
//   socket.emit('chat history', chatHistory.messages);
//   socket.emit('userList', chatHistory.users);

//   socket.on('setUsername', (username) => {
//     socket.username = username;
//     chatHistory.users.push(username);
//     io.emit('userJoined', `${username} joined the chat`);
//     saveChatHistory(chatHistory);

//     // Notify all users about the updated user list
//     io.emit('userList', chatHistory.users);
//   });

  socket.on('disconnect', () => {
    if (socket.username) {
      const index = chatHistory.users.indexOf(socket.username);
      if (index !== -1) {
        chatHistory.users.splice(index, 1);
      }
      io.emit('userLeft', `${socket.username} left the chat`);
      // Notify all users about the updated user list
      io.emit('userList', chatHistory.users);
    }
    console.log('A user disconnected');
  });

  socket.on('chat message', (msg) => {
    if (socket.username) {
      const user = chatHistory.users.find((u) => u.username === socket.username);
      const messageObject = {
        username: socket.username,
        message: msg,
        icon: user ? user.icon : '' // Associate the user's icon with the message
      };

      chatHistory.messages.push(messageObject);
      io.emit('chat message', messageObject);
      saveChatHistory(chatHistory);
    }
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
