const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Jalankan Express agar bot tetap hidup
app.get('/', (req, res) => res.send('🤖 Zayla-Bot is running'));
app.listen(PORT, () => console.log(`🌐 Server running at http://localhost:${PORT}`));

async function startZayla() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Bot disconnected. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startZayla();
    }

    if (connection === 'open') {
      console.log('✅ Zayla-Bot is now connected to WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const sender = msg.key.remoteJid;

    if (text.toLowerCase() === '.ping') {
      await sock.sendMessage(sender, { text: '🏓 Pong dari Zayla-Bot!' });
    }

    if (text.toLowerCase() === '.menu') {
      await sock.sendMessage(sender, { text: '📋 Menu Zayla-Bot:\n\n1. .ping\n2. .quote\n3. .menu\n\nPowered by ZAI ⚡' });
    }
  });
}

startZayla();
