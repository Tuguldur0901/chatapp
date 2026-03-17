(() => {
  const socket = io();

  // ── State ──
  let myName = '';
  let myColor = '';
  let myRoom = 'general';
  let selectedRoom = 'general';
  let typingTimer = null;
  let isTyping = false;
  const typingUsers = {};  // { name: timeoutId }

  // ── DOM refs ──
  const joinScreen   = document.getElementById('joinScreen');
  const chatScreen   = document.getElementById('chatScreen');
  const nameInput    = document.getElementById('nameInput');
  const roomPicker   = document.getElementById('roomPicker');
  const joinBtn      = document.getElementById('joinBtn');
  const joinError    = document.getElementById('joinError');

  const messagesEl   = document.getElementById('messages');
  const msgInput     = document.getElementById('msgInput');
  const sendBtn      = document.getElementById('sendBtn');
  const typingBar    = document.getElementById('typingBar');
  const roomListEl   = document.getElementById('roomList');
  const userListEl   = document.getElementById('userList');
  const onlineCount  = document.getElementById('onlineCount');
  const currentRoom  = document.getElementById('currentRoom');
  const myAvatar     = document.getElementById('myAvatar');
  const myNameEl     = document.getElementById('myName');
  const leaveBtn     = document.getElementById('leaveBtn');

  const ROOMS = ['general', 'tech', 'random', 'design'];

  // ── Room picker (join screen) ──
  roomPicker.querySelectorAll('.room-option').forEach(el => {
    el.addEventListener('click', () => {
      roomPicker.querySelectorAll('.room-option').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      selectedRoom = el.dataset.room;
    });
  });

  // ── Join ──
  function doJoin() {
    const name = nameInput.value.trim();
    if (!name) { joinError.textContent = 'Нэрээ оруулна уу!'; return; }
    if (name.length < 2) { joinError.textContent = 'Нэр хэтэрхий богино байна'; return; }
    joinError.textContent = '';
    joinBtn.disabled = true;
    joinBtn.textContent = 'Холбогдож байна...';
    socket.emit('join', { name, room: selectedRoom });
  }

  joinBtn.addEventListener('click', doJoin);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

  // ── Joined ──
  socket.on('joined', ({ room, color, users }) => {
    myName  = nameInput.value.trim();
    myColor = color;
    myRoom  = room;

    myAvatar.textContent = initials(myName);
    myAvatar.style.background = color;
    myNameEl.textContent = myName;

    joinScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');

    currentRoom.textContent = room;
    renderRooms(room);
    renderUsers(users);
    msgInput.focus();
  });

  // ── Send message ──
  function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;
    socket.emit('message', { text });
    msgInput.value = '';
    stopTyping();
  }

  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { sendMessage(); return; }
  });

  // ── Typing ──
  msgInput.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      socket.emit('typing', true);
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1800);
  });

  function stopTyping() {
    if (isTyping) {
      isTyping = false;
      socket.emit('typing', false);
    }
    clearTimeout(typingTimer);
  }

  // ── Receive message ──
  socket.on('message', (msg) => {
    const isMe = msg.user.name === myName;
    appendMessage(msg, isMe);
  });

  // ── System message ──
  socket.on('system', ({ text }) => {
    appendSystem(text);
  });

  // ── Typing indicator ──
  socket.on('typing', ({ name, isTyping: t }) => {
    if (t) {
      typingUsers[name] = true;
    } else {
      delete typingUsers[name];
    }
    renderTyping();
  });

  function renderTyping() {
    const names = Object.keys(typingUsers);
    if (names.length === 0) {
      typingBar.innerHTML = '';
      return;
    }
    const label = names.length === 1
      ? `${names[0]} бичиж байна`
      : `${names.join(', ')} бичиж байна`;
    typingBar.innerHTML = `
      ${label}
      <div class="typing-dots"><span></span><span></span><span></span></div>
    `;
  }

  // ── Room users ──
  socket.on('room_users', (users) => {
    renderUsers(users);
  });

  // ── Switch room ──
  socket.on('switched', ({ room, users }) => {
    myRoom = room;
    currentRoom.textContent = room;
    messagesEl.innerHTML = '';
    renderRooms(room);
    renderUsers(users);
    Object.keys(typingUsers).forEach(k => delete typingUsers[k]);
    renderTyping();
    msgInput.focus();
  });

  // ── Leave ──
  leaveBtn.addEventListener('click', () => {
    if (confirm('Чатаас гарах уу?')) {
      socket.disconnect();
      chatScreen.classList.add('hidden');
      joinScreen.classList.remove('hidden');
      messagesEl.innerHTML = '';
      nameInput.value = '';
      joinBtn.disabled = false;
      joinBtn.textContent = 'Чатад нэгдэх →';
    }
  });

  // ── Render helpers ──

  function renderRooms(active) {
    roomListEl.innerHTML = ROOMS.map(r => `
      <div class="room-item ${r === active ? 'active' : ''}" data-room="${r}">
        # ${r}
      </div>
    `).join('');
    roomListEl.querySelectorAll('.room-item').forEach(el => {
      el.addEventListener('click', () => {
        const r = el.dataset.room;
        if (r !== myRoom) socket.emit('switch_room', r);
      });
    });
  }

  function renderUsers(users) {
    onlineCount.textContent = users.length;
    userListEl.innerHTML = users.map(u => `
      <div class="user-item">
        <div class="user-dot" style="background:${u.color};box-shadow:0 0 5px ${u.color}"></div>
        <span class="user-name-label">${esc(u.name)}${u.name === myName ? ' (та)' : ''}</span>
      </div>
    `).join('');
  }

  function appendMessage(msg, isMe) {
    const div = document.createElement('div');
    div.className = `msg-group ${isMe ? 'me' : 'other'}`;
    div.innerHTML = `
      <div class="msg-meta">
        <div class="msg-avatar" style="background:${msg.user.color}">${initials(msg.user.name)}</div>
        <span class="msg-sender" style="color:${msg.user.color}">${esc(msg.user.name)}</span>
        <span class="msg-time">${msg.time}</span>
      </div>
      <div class="msg-bubble">${esc(msg.text)}</div>
    `;
    messagesEl.appendChild(div);
    scrollBottom();
  }

  function appendSystem(text) {
    const div = document.createElement('div');
    div.className = 'msg-group system';
    div.innerHTML = `<div class="msg-system">${esc(text)}</div>`;
    messagesEl.appendChild(div);
    scrollBottom();
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function initials(name) {
    return name.slice(0, 2).toUpperCase();
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
