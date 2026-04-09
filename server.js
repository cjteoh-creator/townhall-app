const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let state = {
  phase: 'idle',
  queue: [],
  currentIndex: -1,
  current: null,
  participantCount: 0,
};

// Tag each WebSocket connection with its role
const clientRoles = new WeakMap(); // ws -> 'participant' | 'presenter' | 'display'

function getParticipantCount() {
  let count = 0;
  wss.clients.forEach(c => {
    if (c.readyState === 1 && clientRoles.get(c) === 'participant') count++;
  });
  return count;
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(msg);
  });
}

function broadcastCount() {
  state.participantCount = getParticipantCount();
  broadcast({ type: 'state', state });
}

wss.on('connection', (ws, req) => {
  const qs = req.url.split('?')[1] || '';
  const role = qs.includes('presenter=1') ? 'presenter' : qs.includes('display=1') ? 'display' : 'participant';
  clientRoles.set(ws, role);

  // Mark as alive for heartbeat
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Count after a short delay to ensure ws is fully registered in wss.clients
  setTimeout(() => {
    state.participantCount = getParticipantCount();
    broadcast({ type: 'state', state });
  }, 50);

  // Send current state to new connection immediately
  ws.send(JSON.stringify({ type: 'state', state }));

  ws.on('close', () => {
    state.participantCount = getParticipantCount();
    broadcast({ type: 'state', state });
  });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Participant: vote on poll
    if (msg.type === 'vote') {
      if (state.phase === 'collecting' && state.current && state.current.type === 'poll') {
        const rawOpts = msg.options !== undefined ? msg.options : (msg.option !== undefined ? msg.option : null);
        const indices = Array.isArray(rawOpts) ? rawOpts : (rawOpts !== null ? [rawOpts] : []);
        if (indices.length > 0) {
          indices.forEach(idx => {
            const i = Number(idx);
            if (!isNaN(i) && i >= 0 && i < state.current.options.length) {
              state.current.votes[i] = (state.current.votes[i] || 0) + 1;
            }
          });
          state.current.totalVoters = (state.current.totalVoters || 0) + 1;
          broadcast({ type: 'state', state });
        }
      }
      return;
    }

    // Participant: word cloud
    if (msg.type === 'word') {
      if (state.phase === 'collecting' && state.current && state.current.type === 'wordcloud' && msg.text) {
        const text = String(msg.text).trim().toLowerCase().slice(0, 40);
        if (!text) return;
        const ex = state.current.words.find(w => w.text === text);
        if (ex) ex.count++;
        else state.current.words.push({ text, count: 1 });
        broadcast({ type: 'state', state });
      }
      return;
    }

    // Presenter commands
    if (msg.type === 'presenter') {
      const action = msg.action;

      if (action === 'set_queue') {
        state.queue = Array.isArray(msg.queue) ? msg.queue : [];
        state.currentIndex = -1;
        state.current = null;
        state.phase = 'idle';
        console.log(`Queue set: ${state.queue.length} questions`);
        broadcast({ type: 'state', state });
      }

      else if (action === 'open_question') {
        const idx = Number(msg.index);
        if (isNaN(idx) || idx < 0 || idx >= state.queue.length) return;
        const q = state.queue[idx];
        state.currentIndex = idx;
        state.phase = 'collecting';
        state.current = {
          type: q.type,
          question: q.question,
          options: q.options || [],
          multiSelect: q.multiSelect || false,
          votes: {},
          totalVoters: 0,
          words: [],
        };
        broadcast({ type: 'state', state });
      }

      else if (action === 'show_results') {
        if (state.phase === 'collecting') {
          state.phase = 'results';
          broadcast({ type: 'state', state });
        }
      }

      else if (action === 'close') {
        state.phase = 'idle';
        broadcast({ type: 'state', state });
      }

      else if (action === 'end_session') {
        state.phase = 'ended';
        state.current = null;
        broadcast({ type: 'state', state });
      }

      else if (action === 'restart') {
        state.phase = 'idle';
        state.currentIndex = -1;
        state.current = null;
        broadcast({ type: 'state', state });
      }

      else if (action === 'reset') {
        state = { phase: 'idle', queue: [], currentIndex: -1, current: null, participantCount: 0 };
        broadcast({ type: 'state', state });
      }
    }
  });
});

// Heartbeat: ping all clients every 30s, terminate unresponsive ones
setInterval(() => {
  wss.clients.forEach(c => {
    if (c.isAlive === false) return c.terminate();
    c.isAlive = false;
    if (c.readyState === 1) c.ping();
  });
  // Recount after clearing dead clients
  setTimeout(() => {
    state.participantCount = getParticipantCount();
    broadcast({ type: 'state', state });
  }, 1000);
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Townhall running on port ${PORT}`));

// Debug endpoint — visit /debug to see live server state
app.get('/debug', (req, res) => {
  const clients = [];
  wss.clients.forEach(c => {
    clients.push({ role: clientRoles.get(c), readyState: c.readyState });
  });
  res.json({
    phase: state.phase,
    queueLength: state.queue.length,
    participantCount: state.participantCount,
    currentIndex: state.currentIndex,
    liveClients: clients,
    totalWsClients: wss.clients.size,
  });
});
