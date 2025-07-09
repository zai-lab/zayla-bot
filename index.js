const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');

const { handleCommand } = require('./command');
const { handleSewa, checkExpiredSewa, checkSpamCall } = require('./sewa');

const { state, saveState } = useSingleFileAuthState('./session/auth_info.json');

if (!fs.existsSync('./session')) fs.mkdirSync('./session');
if (!fs.existsSync('./database')) fs.mkdirSync('./database');

async function startZaylaBot() {
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['ZaylaBot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startZaylaBot();
      }
    } else if (connection === 'open') {
      console.log('✅ ZaylaBot is connected!');
      checkExpiredSewa(sock);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key?.remoteJid === 'status@broadcast') return;

    const sender = msg.key.participant || msg.key.remoteJid;
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    await checkSpamCall(sock, msg);

    const handledSewa = await handleSewa(sock, msg, from, sender, isGroup);
    if (handledSewa) return;

    await handleCommand(sock, msg, from, sender, isGroup);
  });

  sock.ev.on('call', async (call) => {
    const from = call[0].from;
    console.log(`⚠️ Blocked call from: ${from}`);
    await sock.updateBlockStatus(from, 'block');

    let blocked = [];
    if (fs.existsSync('./database/blocked.json')) {
      blocked = JSON.parse(fs.readFileSync('./database/blocked.json'));
    }
    if (!blocked.includes(from)) {
      blocked.push(from);
      fs.writeFileSync('./database/blocked.json', JSON.stringify(blocked));
    }
  });
}

startZaylaBot();
