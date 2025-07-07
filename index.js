const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Bot berhasil tersambung ke WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    
    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (body === '!ping') {
      await sock.sendMessage(from, { text: '🏓 Pong!' });
    }

    if (body === '!menu') {
      await sock.sendMessage(from, { text: '📋 Menu Zayla-Bot\n\n1. !ping\n2. !menu\n\nKetik perintah di atas untuk mencoba.' });
    }
  });
}

startBot();

// Server web biar tetap hidup
app.get("/", (req, res) => {
  res.send("🤖 Zayla-Bot is Running!");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
