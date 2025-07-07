const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');

// Load data sewa dari file
const SEWA_FILE = './sewa.json';
let sewaData = fs.existsSync(SEWA_FILE) ? JSON.parse(fs.readFileSync(SEWA_FILE)) : {};

// Fungsi utama
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_multi');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        start(); // Restart bot jika bukan logout
      } else {
        console.log('❌ Bot logout');
      }
    } else if (connection === 'open') {
      console.log('✅ Zayla-Bot aktif!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || '';

    // Fitur dasar
    if (text === '.ping') {
      await sock.sendMessage(from, { text: '✅ Bot aktif!' });
    } else if (text === '.quote') {
      const quotes = [
        'Jangan menyerah sebelum mencoba 💪',
        'Fokus pada tujuan 🎯',
        'Semangat terus, hari esok milikmu 🌟'
      ];
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      await sock.sendMessage(from, { text: q });
    }
  });
}

start();
