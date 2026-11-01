// 浑水摸鱼 联机服务器：静态文件 + 房间广播（WebSocket，零依赖）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MAX_ROOM = 10;           // 每个房间最多几个人（6 人上场 + 观战）
const MAX_MSG = 64 * 1024;     // 单条消息上限
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

/* ---------- 静态文件 ---------- */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz'){ res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  let file = path.normalize(path.join(PUB, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUB)){ res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()){ res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800' });
    fs.createReadStream(file).pipe(res);
  });
});

/* ---------- 极简 WebSocket（RFC 6455，仅文本帧） ---------- */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function send(sock, obj){
  if (sock.destroyed) return;
  const data = Buffer.from(JSON.stringify(obj));
  let head;
  if (data.length < 126) head = Buffer.from([0x81, data.length]);
  else if (data.length < 65536){ head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
  sock.write(Buffer.concat([head, data]));
}
function control(sock, op, payload = Buffer.alloc(0)){ if (!sock.destroyed) sock.write(Buffer.concat([Buffer.from([0x80 | op, payload.length]), payload])); }

server.on('upgrade', (req, sock) => {
  if ((req.url || '').split('?')[0] !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket'){ sock.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key){ sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const client = { id: crypto.randomBytes(6).toString('hex'), sock, room: null, presence: {}, alive: Date.now(), buf: Buffer.alloc(0), frag: [] };
  sock.on('data', chunk => {
    client.buf = Buffer.concat([client.buf, chunk]);
    while (client.buf.length >= 2){
      const b0 = client.buf[0], b1 = client.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126){ if (client.buf.length < 4) return; len = client.buf.readUInt16BE(2); off = 4; }
      else if (len === 127){ if (client.buf.length < 10) return; len = Number(client.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG){ sock.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (client.buf.length < need) return;
      let payload = client.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked){ const m = client.buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      client.buf = client.buf.subarray(need);
      client.alive = Date.now();
      if (op === 0x8){ control(sock, 0x8); sock.end(); return; }
      if (op === 0x9){ control(sock, 0xA, payload); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x0){
        client.frag.push(payload);
        if (!fin) continue;
        const text = Buffer.concat(client.frag).toString('utf8'); client.frag = [];
        let msg; try { msg = JSON.parse(text); } catch (e){ continue; }
        onMessage(client, msg);
      }
    }
  });
  sock.on('close', () => leave(client));
  sock.on('error', () => leave(client));
});

/* ---------- 房间 ---------- */
const rooms = new Map(); // 房间名 -> Map(id -> client)
function broadcast(room, obj, exceptId){ const r = rooms.get(room); if (!r) return; for (const c of r.values()) if (c.id !== exceptId) send(c.sock, obj); }
function onMessage(c, m){
  if (!m || typeof m !== 'object') return;
  if (m.t === 'join'){
    if (c.room || typeof m.room !== 'string' || !/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(m.room)) return;
    const r = rooms.get(m.room) || new Map();
    if (r.size >= MAX_ROOM){ send(c.sock, { t: 'full' }); return; }
    rooms.set(m.room, r);
    c.room = m.room; c.presence = (m.presence && typeof m.presence === 'object') ? m.presence : {};
    send(c.sock, { t: 'welcome', you: c.id, peers: [...r.values()].map(o => ({ id: o.id, presence: o.presence })) });
    r.set(c.id, c);
    broadcast(c.room, { t: 'p', id: c.id, presence: c.presence }, c.id);
  } else if (m.t === 'p' && c.room){
    if (!m.presence || typeof m.presence !== 'object') return;
    c.presence = m.presence;
    broadcast(c.room, { t: 'p', id: c.id, presence: c.presence }, c.id);
  }
}
function leave(c){
  if (!c.room) return;
  const r = rooms.get(c.room); const room = c.room; c.room = null;
  if (r){ r.delete(c.id); if (r.size === 0) rooms.delete(room); else broadcast(room, { t: 'leave', id: c.id }); }
}
// 心跳：清理掉线的连接
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) for (const c of r.values()){
    if (now - c.alive > 60000){ c.sock.destroy(); leave(c); }
    else control(c.sock, 0x9);
  }
}, 25000);

server.listen(PORT, () => console.log('浑水摸鱼 running on port ' + PORT));
