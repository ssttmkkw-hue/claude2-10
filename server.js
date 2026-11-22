/* 皇家竞技场 · 联机服务器
 * - 提供 public/ 下的静态文件
 * - /ws：WebSocket 自动匹配 + 服务器权威的对战模拟（20 帧/秒）
 * 部署到 Render：Web Service，Start Command = npm start
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const Core = require('./public/core.js');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const TICK = 1 / 20;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

// ---------------- 静态文件 ----------------
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  if (url === '/stats') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ online: wss.clients.size, queue: queue.length, rooms: rooms.size })); return; }
  let file = path.normalize(path.join(PUB, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUB)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------- 匹配 & 房间 ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
let queue = [];
const rooms = new Set();

function send(ws, o) { if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
function cleanName(n) { n = String(n || '').replace(/[<>\n\r\t]/g, '').trim().slice(0, 12); return n || '玩家'; }
function removeFromQueue(ws) { queue = queue.filter(q => q !== ws); }
function broadcastOnline() { const m = JSON.stringify({ t: 'online', online: wss.clients.size }); for (const q of queue) send(q, m); }

function tryMatch() {
  queue = queue.filter(q => q.readyState === 1 && !q.room);
  while (queue.length >= 2) {
    const a = queue.shift(), b = queue.shift();
    createRoom(Math.random() < 0.5 ? [a, b] : [b, a]);
  }
}

function createRoom(players) {
  const g = Core.newGame('normal', players[0].deck, players[1].deck, { pvp: true });
  const room = { g, players, sounds: [], endT: 0, id: Math.random().toString(36).slice(2, 8) };
  players.forEach((ws, team) => {
    ws.room = room; ws.team = team; ws.deployT = [];
    send(ws, { t: 'start', team, opp: players[1 - team].name, hand: g.hand[team], next: g.queue[team][0] });
  });
  rooms.add(room);
  console.log(`[room ${room.id}] ${players[0].name} vs ${players[1].name}`);
}

function closeRoom(room) {
  rooms.delete(room);
  for (const ws of room.players) if (ws && ws.room === room) ws.room = null;
}

function leaveRoom(ws, reason) {
  const room = ws.room; if (!room) return;
  ws.room = null;
  const g = room.g;
  if (g.state !== 'end' && g.state !== 'ending') {
    const other = 1 - ws.team;
    Core.setG(g);
    g.crowns[other] = 3;
    Core.endGame(other);
    send(room.players[other], { t: 'oppLeft' });
    console.log(`[room ${room.id}] ${ws.name} left (${reason})`);
  }
  room.players[ws.team] = null;
  if (!room.players[0] && !room.players[1]) closeRoom(room);
}

function handleDeploy(ws, m) {
  const room = ws.room; if (!room) return;
  const g = room.g; if (g.state !== 'play') return;
  const now = Date.now();
  ws.deployT = ws.deployT.filter(t => now - t < 1000);
  if (ws.deployT.length >= 6) return;               // 防刷
  ws.deployT.push(now);
  const i = m.i | 0, team = ws.team;
  if (i < 0 || i > 3 || g.hand[team][i] !== m.cid) return;
  const x = Number(m.x), y = Number(m.y);
  if (!isFinite(x) || !isFinite(y)) return;
  Core.setG(g);
  const pos = Core.adjustPlace(team, m.cid, x, y);
  if (!pos) return;
  Core.deploy(team, i, pos.x, pos.y);
}

wss.on('connection', ws => {
  ws.isAlive = true; ws.room = null; ws.name = '玩家';
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'queue':
        if (ws.room) leaveRoom(ws, 'requeue');
        if (!Core.validDeck(m.deck)) { send(ws, { t: 'error', msg: '卡组无效' }); return; }
        ws.name = cleanName(m.name); ws.deck = m.deck.slice();
        removeFromQueue(ws); queue.push(ws);
        send(ws, { t: 'queued', online: wss.clients.size });
        broadcastOnline();
        tryMatch();
        break;
      case 'cancel': removeFromQueue(ws); break;
      case 'leave': removeFromQueue(ws); leaveRoom(ws, 'leave'); break;
      case 'deploy': handleDeploy(ws, m); break;
    }
  });
  ws.on('close', () => { removeFromQueue(ws); leaveRoom(ws, 'disconnect'); });
});

// 心跳：清理掉线连接
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; try { ws.ping(); } catch (e) {}
  }
}, 25000);

// ---------------- 主循环 ----------------
Core.hooks.sfx = n => { if (curRoom) curRoom.sounds.push(n); };
let curRoom = null;
setInterval(() => {
  for (const room of rooms) {
    const g = room.g;
    curRoom = room; Core.setG(g);
    try { Core.update(TICK); } catch (e) { console.error(`[room ${room.id}]`, e); }
    curRoom = null;
    const snap = Core.snapshot(g, [...new Set(room.sounds)]);
    room.sounds.length = 0;
    room.players.forEach((ws, team) => {
      if (!ws) return;
      snap.h = g.hand[team]; snap.q = g.queue[team][0];
      send(ws, JSON.stringify(snap));
    });
    if (g.state === 'end') { room.endT += TICK; if (room.endT > 1.5) closeRoom(room); }
  }
}, TICK * 1000);

server.listen(PORT, () => console.log(`Royal Arena server on :${PORT}`));
