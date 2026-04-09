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
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'vote' && state.phase === 'collecting' && state.current?.type === 'poll') {
      const indices = Array.isArray(msg.options) ? msg.options : [msg.option];
      indices.forEach(idx => {
        if (idx >= 0 && idx < state.current.options.length)
          state.current.votes[idx] = (state.current.votes[idx] || 0) + 1;
      });
      state.current.totalVoters = (state.current.totalVoters || 0) + 1;
      broadcast({ type: 'state', state });
    }

    if (msg.type === 'word' && state.phase === 'collecting' && state.current?.type === 'wordcloud' && msg.text) {
      const text = msg.text.trim().toLowerCase().slice(0, 40);
      if (!text) return;
      const ex = state.current.words.find(w => w.text === text);
      if (ex) ex.count++; else state.current.words.push({ text, count: 1 });
      broadcast({ type: 'state', state });
    }

    if (msg.type === 'presenter') {
      if (msg.action === 'set_queue') {
        state.queue = msg.queue || [];
        state.currentIndex = -1; state.current = null; state.phase = 'idle';
        broadcast({ type: 'state', state });
      }
      if (msg.action === 'open_question') {
        const idx = msg.index;
        if (idx < 0 || idx >= state.queue.length) return;
        const q = state.queue[idx];
        state.currentIndex = idx; state.phase = 'collecting';
        state.current = { type: q.type, question: q.question, options: q.options || [], multiSelect: q.multiSelect || false, votes: {}, totalVoters: 0, words: [] };
        broadcast({ type: 'state', state });
      }
      if (msg.action === 'show_results') { if (state.phase === 'collecting') { state.phase = 'results'; broadcast({ type: 'state', state }); } }
      if (msg.action === 'close') { state.phase = 'idle'; broadcast({ type: 'state', state }); }
      if (msg.action === 'end_session') { state.phase = 'ended'; broadcast({ type: 'state', state }); }
      if (msg.action === 'reset') {
        participantCount = 0;
        state = { phase: 'idle', queue: [], currentIndex: -1, current: null, participantCount: 0 };
        broadcast({ type: 'state', state });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
