const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const fs = require('fs');

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Tampilkan QR di terminal
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Reconnect:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot WhatsApp Zayla telah online!');
        }
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (text.toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: '🏓 Pong dari Zayla!' });
        } else if (text.toLowerCase().startsWith('.quote')) {
            const quotes = [
                "Jangan menyerah, hal besar butuh waktu 🍃",
                "Sukses adalah hasil dari usaha yang terus-menerus 💡",
                "Hari ini sulit, tapi besok lebih cerah ☀️"
            ];
            const quote = quotes[Math.floor(Math.random() * quotes.length)];
            await sock.sendMessage(from, { text: `📜 Quote:\n${quote}` });
        }
    });
}

// Jalankan bot
startBot().catch(err => console.error('❌ Error:', err));

// Server express untuk jaga agar bot tetap hidup
app.get('/', (req, res) => res.send('🤖 Zayla-Bot aktif'));
app.listen(PORT, () => console.log(`🌐 Server berjalan di port ${PORT}`));
