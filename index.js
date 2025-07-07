const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Lokasi file auth
const { state, saveState } = useSingleFileAuthState('./session.json');

async function startZaylaBot() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // ini dimatikan karena kita handle sendiri QR-nya
    });

    // Menyimpan sesi
    sock.ev.on('creds.update', saveState);

    // Tampilkan QR code
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('[🤖] Scan QR di bawah ini untuk login:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Reconnect?', shouldReconnect);
            if (shouldReconnect) {
                startZaylaBot();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot berhasil terhubung ke WhatsApp!');
        }
    });

    // Respon pesan
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text === '!ping') {
            await sock.sendMessage(from, { text: '🏓 Pong!' });
        }
    });
}

startZaylaBot();
