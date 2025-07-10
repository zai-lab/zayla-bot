const {
  default: makeWASocket,
  useSingleFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const { Boom } = require('@hapi/boom');

const { handleCommand } = require('./command');
const { handleSewa, checkExpiredSewa } = require('./sewa');
const { isBlocked, blockUser } = require('./spam');

const { state, saveState } = useSingleFileAuthState('./sessions/auth_info.json');

async function startZaylaBot() {
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['ZaylaBot', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startZaylaBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Bot aktif! Siap melayani pengguna.');
      checkExpiredSewa(sock);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const isGroup = from.endsWith('@g.us');

    if (await isBlocked(sock, msg)) return;

    if (await handleSewa(sock, msg, from, sender, isGroup)) return;

    await handleCommand(sock, msg, from, sender, isGroup);
  });

  sock.ev.on('call', async (callData) => {
    const from = callData[0]?.from;
    if (from) {
      await sock.updateBlockStatus(from, 'block');
      await blockUser(from);
      console.log(`⚠️ Diblokir karena melakukan panggilan: ${from}`);
    }
  });
}

startZaylaBot();
