const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = './session'; // Untuk menyimpan data autentikasi WA
const BLOCKED_USERS_FILE = './database/blocked.json';

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: { headless: true }
});

// Cek dan buat file block jika belum ada
if (!fs.existsSync(BLOCKED_USERS_FILE)) {
    fs.writeFileSync(BLOCKED_USERS_FILE, JSON.stringify([]));
}

let blockedUsers = JSON.parse(fs.readFileSync(BLOCKED_USERS_FILE));

// 🟢 Ketika bot sudah aktif
client.on('ready', () => {
    console.log('✅ Zayla-Bot sudah aktif!');
});

// ❌ Auto blokir yang spam dan telepon
client.on('call', async call => {
    const number = call.from;
    if (!blockedUsers.includes(number)) {
        blockedUsers.push(number);
        fs.writeFileSync(BLOCKED_USERS_FILE, JSON.stringify(blockedUsers));
        await client.sendMessage(number, '*❌ Anda diblokir karena mencoba menelepon bot.*');
        await client.blockContact(number);
    }
});

client.on('message_create', async msg => {
    const number = msg.from;

    // Auto blokir spam pribadi
    if (!msg.from.includes('@g.us') && !msg.fromMe) {
        const chat = await msg.getChat();
        if (chat.unreadCount >= 10) {
            if (!blockedUsers.includes(number)) {
                blockedUsers.push(number);
                fs.writeFileSync(BLOCKED_USERS_FILE, JSON.stringify(blockedUsers));
                await client.sendMessage(number, '*❌ Anda diblokir karena spam ke bot.*');
                await client.blockContact(number);
            }
        }
    }
});

// 🧠 Tangkap perintah dan jalankan handler
client.on('message', async message => {
    const prefix = '.';
    if (!message.body.startsWith(prefix)) return;

    const args = message.body.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Path handler berdasarkan perintah
    const commandPath = path.join(__dirname, 'handlers', `${command}.js`);

    // Jika handler tersedia, jalankan
    if (fs.existsSync(commandPath)) {
        try {
            const handler = require(commandPath);
            await handler(client, message, args);
        } catch (err) {
            console.error(`❌ Error handler ${command}:`, err);
            await message.reply('⚠️ Maaf, terjadi kesalahan saat memproses perintah.');
        }
    } else {
        await message.reply(`❌ Perintah *.${command}* tidak ditemukan.`);
    }
});

client.initialize();
