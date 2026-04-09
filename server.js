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
  phase: 'idle', // idle | collecting | results | ended
  queue: [],
  currentIndex: -1,
  current: null,
  participantCount: 0,
};
let participantCount = 0;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

wss.on('connection', (ws, req) => {
  const qs = req.url.split('?')[1] || '';
  const isPresenter = qs.includes('presenter=1');
  const isDisplay = qs.includes('display=1');

  if (!isPresenter && !isDisplay) {
    participantCount++;
    state.participantCount = participantCount;
    broadcast({ type: 'state', state });
  }

  ws.send(JSON.stringify({ type: 'state', state }));

  ws.on('close', () => {
    if (!isPresenter && !isDisplay) {
      participantCount = Math.max(0, participantCount - 1);
      state.participantCount = participantCount;
      broadcast({ type: 'state', state });
    }
  });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // --- PARTICIPANT: vote ---
    if (msg.type === 'vote') {
      if (state.phase === 'collecting' && state.current && state.current.type === 'poll') {
        const indices = Array.isArray(msg.options) ? msg.options : (msg.option !== undefined ? [msg.option] : []);
        if (indices.length > 0) {
          indices.forEach(idx => {
            const i = parseInt(idx);
            if (!isNaN(i) && i >= 0 && i < state.current.options.length) {
              state.current.votes[i] = (state.current.votes[i] || 0) + 1;
            }
          });
          state.current.totalVoters = (state.current.totalVoters || 0) + 1;
          broadcast({ type: 'state', state });
        }
      }
    }

    // --- PARTICIPANT: word cloud ---
    if (msg.type === 'word') {
      if (state.phase === 'collecting' && state.current && state.current.type === 'wordcloud' && msg.text) {
        const text = msg.text.trim().toLowerCase().slice(0, 40);
        if (text) {
          const ex = state.current.words.find(w => w.text === text);
          if (ex) ex.count++;
          else state.current.words.push({ text, count: 1 });
          broadcast({ type: 'state', state });
        }
      }
    }

    // --- PRESENTER actions ---
    if (msg.type === 'presenter') {

      // Load question queue
      if (msg.action === 'set_queue') {
        state.queue = msg.queue || [];
        state.currentIndex = -1;
        state.current = null;
        state.phase = 'idle';
        broadcast({ type: 'state', state });
      }

      // Open a specific question
      if (msg.action === 'open_question') {
        const idx = parseInt(msg.index);
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

      // Close collecting, show results
      if (msg.action === 'show_results') {
        if (state.phase === 'collecting') {
          state.phase = 'results';
          broadcast({ type: 'state', state });
        }
      }

      // Between questions
      if (msg.action === 'close') {
        state.phase = 'idle';
        broadcast({ type: 'state', state });
      }

      // END SESSION: show Thank You, keep queue
      if (msg.action === 'end_session') {
        state.phase = 'ended';
        state.current = null;
        broadcast({ type: 'state', state });
      }

      // RESTART: fresh answers, back to Q1, keep queue
      if (msg.action === 'restart') {
        state.phase = 'idle';
        state.currentIndex = -1;
        state.current = null;
        broadcast({ type: 'state', state });
      }

      // FULL RESET: clear everything
      if (msg.action === 'reset') {
        participantCount = 0;
        state = { phase: 'idle', queue: [], currentIndex: -1, current: null, participantCount: 0 };
        broadcast({ type: 'state', state });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Townhall running on http://localhost:${PORT}`));
