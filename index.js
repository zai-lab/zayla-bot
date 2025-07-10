const {
  default: makeWASocket,
  useSingleFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('baileys');
const P = require('pino');
const fs = require('fs');

// pastikan kamu sudah membuat folder `sessions/` di root
const { state, saveState } = useSingleFileAuthState('./sessions/auth_info.json');

async function startZaylaBot() {
  // ambil versi WA terbaru yang didukung
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA v${version.join('.')} (latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' }),
    browser: ['ZaylaBot', 'Chrome', '1.0']
  });

  // simpan sesi kalau berubah
  sock.ev.on('creds.update', saveState);

  // reconnect & status
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ disconnected, reconnect?', shouldReconnect);
      if (shouldReconnect) startZaylaBot();
    }
    if (connection === 'open') {
      console.log('✅ ZaylaBot is connected!');
    }
  });

  // handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    // contoh perintah dasar
    if (text === '.ping') {
      await sock.sendMessage(from, { text: '🏓 Pong dari ZaylaBot!' });
    }
    else if (text === '.menu') {
      await sock.sendMessage(from, {
        text: [
          '📋 *Menu ZaylaBot*',
          '1. .ping — Tes bot',
          '2. .menu — Tampilkan menu',
          '',
          'Bot v2.3.0 ⚡️',
          '_Powered by ZAI Lab_'
        ].join('\n')
      });
    }
    // TODO: import & call your full command handler here
  });

  // auto-block kalau ditelepon
  sock.ev.on('call', async (callEvents) => {
    const caller = callEvents[0]?.from;
    if (caller) {
      console.log(`📵 Blocking call from ${caller}`);
      await sock.updateBlockStatus(caller, 'block');

      // simpan daftar blocked jika perlu
      const dbPath = './blocked.json';
      let list = [];
      if (fs.existsSync(dbPath)) list = JSON.parse(fs.readFileSync(dbPath));
      if (!list.includes(caller)) {
        list.push(caller);
        fs.writeFileSync(dbPath, JSON.stringify(list, null, 2));
      }
    }
  });
}

startZaylaBot();
