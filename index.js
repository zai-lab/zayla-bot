const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 8080;

// Web server biar Zeabur gak auto-mati
app.get('/', (req, res) => res.send('🤖 Zayla-Bot is running'));
app.listen(PORT, () => console.log(`🌐 Server running at http://localhost:${PORT}`));

async function startZayla() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📲 Scan QR berikut untuk login (tampilan terminal):');
      qrcode.generate(qr, { small: true });

      console.log('\n🔗 Atau buka link ini di browser HP & scan pakai WhatsApp:');
      console.log(`👉 https://wa.me/scan?qr=${qr}\n`);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Bot terputus. Menghubungkan ulang:', shouldReconnect);
      if (shouldReconnect) startZayla();
    }

    if (connection === 'open') {
      console.log('✅ Zayla-Bot berhasil terhubung ke WhatsApp!');
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
      await sock.sendMessage(sender, {
        text: `📋 *Menu Zayla-Bot v1.1.0.0*\n\n1. .ping\n2. .menu\n\nPowered by ZAI ⚡\nDiawasi & dinaungi oleh Zunkee.`
      });
    }
  });
}

startZayla();
