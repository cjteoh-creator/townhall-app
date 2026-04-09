const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- State ---
let state = {
  mode: 'idle', // idle | poll | wordcloud
  poll: {
    question: '',
    options: [],
    votes: {}, // { optionIndex: count }
  },
  wordcloud: {
    question: '',
    words: [], // [{ text, count }]
  },
};

// --- Broadcast to all clients ---
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// --- WebSocket ---
wss.on('connection', (ws) => {
  // Send current state to new connection
  ws.send(JSON.stringify({ type: 'state', state }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'vote') {
      // Participant votes on poll
      const idx = msg.option;
      if (state.mode === 'poll' && idx >= 0 && idx < state.poll.options.length) {
        state.poll.votes[idx] = (state.poll.votes[idx] || 0) + 1;
        broadcast({ type: 'state', state });
      }
    }

    if (msg.type === 'word') {
      // Participant submits word
      if (state.mode === 'wordcloud' && msg.text) {
        const text = msg.text.trim().toLowerCase().slice(0, 40);
        if (!text) return;
        const existing = state.wordcloud.words.find(w => w.text === text);
        if (existing) {
          existing.count++;
        } else {
          state.wordcloud.words.push({ text, count: 1 });
        }
        broadcast({ type: 'state', state });
      }
    }

    if (msg.type === 'presenter') {
      // Presenter control actions
      if (msg.action === 'start_poll') {
        state.mode = 'poll';
        state.poll.question = msg.question || 'Poll';
        state.poll.options = msg.options || [];
        state.poll.votes = {};
        broadcast({ type: 'state', state });
      }
      if (msg.action === 'start_wordcloud') {
        state.mode = 'wordcloud';
        state.wordcloud.question = msg.question || 'Word Cloud';
        state.wordcloud.words = [];
        broadcast({ type: 'state', state });
      }
      if (msg.action === 'stop') {
        state.mode = 'idle';
        broadcast({ type: 'state', state });
      }
      if (msg.action === 'reset') {
        state = {
          mode: 'idle',
          poll: { question: '', options: [], votes: {} },
          wordcloud: { question: '', words: [] },
        };
        broadcast({ type: 'state', state });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Townhall app running on http://localhost:${PORT}`);
});
