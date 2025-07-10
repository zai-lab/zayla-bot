// index.js (main file) const express = require('express'); const makeWASocket = require('@whiskeysockets/baileys').default; const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys'); const P = require('pino'); const fs = require('fs'); const path = require('path');

const { handleCommand } = require('./command'); const { handleSewa, checkExpiredSewa, checkSpamCall } = require('./sewa');

const app = express(); const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('ZaylaBot is online.')); app.listen(PORT, () => console.log(🌐 Web server running at http://localhost:${PORT}));

async function startZaylaBot() { const { state, saveCreds } = await useMultiFileAuthState('./sessions'); const { version } = await fetchLatestBaileysVersion();

const sock = makeWASocket({ version, auth: state, printQRInTerminal: true, logger: P({ level: 'silent' }), browser: ['ZaylaBot', 'Chrome', '1.0'], shouldIgnoreJid: (jid) => jid === 'status@broadcast' });

sock.ev.on('creds.update', saveCreds);

sock.ev.on('connection.update', (update) => { const { connection, lastDisconnect, qr } = update; if (qr) { console.log(📸 Scan QR: https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=250x250); } if (connection === 'close') { const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut); if (shouldReconnect) { startZaylaBot(); } } else if (connection === 'open') { console.log('✅ ZaylaBot connected.'); checkExpiredSewa(sock); } });

sock.ev.on('messages.upsert', async ({ messages, type }) => { if (type !== 'notify') return; const msg = messages[0]; if (!msg.message || msg.key?.remoteJid === 'status@broadcast') return;

const from = msg.key.remoteJid;
const sender = msg.key.participant || from;
const isGroup = from.endsWith('@g.us');

const blocked = JSON.parse(fs.readFileSync('./database/blocked.json'));
if (blocked.includes(sender)) return;

await checkSpamCall(sock, msg);

const handledSewa = await handleSewa(sock, msg, from, sender, isGroup);
if (!handledSewa) {
  await handleCommand(sock, msg, from, sender, isGroup);
}

});

sock.ev.on('call', async (call) => { const from = call[0].from; console.log(📵 Blocked call from: ${from}); await sock.updateBlockStatus(from, 'block'); let blocked = JSON.parse(fs.readFileSync('./database/blocked.json')); if (!blocked.includes(from)) { blocked.push(from); fs.writeFileSync('./database/blocked.json', JSON.stringify(blocked)); } }); }

startZaylaBot();

                                                                                                                       
