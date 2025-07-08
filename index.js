const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

let currentQR = ''; // Untuk menyimpan QR terbaru

// Halaman utama
app.get('/', (req, res) => {
  res.send(`
    <h2>🤖 Zayla-Bot Aktif</h2>
    <p>Scan QR di: <a href="/qr" target="_blank">Klik di sini untuk scan QR</a></p>
  `);
});

// Halaman QR
app.get('/qr', (req, res) => {
  if (!currentQR) {
    return res.send('<h2>⏳ QR belum tersedia. Tunggu beberapa detik...</h2>');
  }

  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(currentQR)}&size=300x300`;

  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h2>📲 Scan QR WhatsApp</h2>
        <img src="${qrImg}" alt="QR Code WhatsApp" />
        <p>⏱ QR berlaku singkat. Refresh halaman ini jika expired.</p>
      </body>
    </html>
  `);
});

// Jalankan web server
app.listen(PORT, () => {
  console.log(`🌐 Server aktif di http://localhost:${PORT}`);
});

async function startZayla() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log('📲 QR baru tersedia! Scan di /qr');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Terputus. Coba koneksi ulang:', shouldReconnect);
      if (shouldReconnect) startZayla();
    }

    if (connection === 'open') {
      currentQR = ''; // kosongkan QR setelah login
      console.log('✅ Zayla-Bot berhasil tersambung!');
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
