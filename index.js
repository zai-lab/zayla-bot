// ZAYLA-BOT v2.3.0.0 FULL SYSTEM
// Built with @whiskeysockets/baileys
// Author: Zunkee (ZAI Lab)

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore } from '@whiskeysockets/baileys';
import P from 'pino';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';

const store = makeInMemoryStore({});
store.readFromFile('./baileys_store_multi.json');
setInterval(() => {
  store.writeToFile('./baileys_store_multi.json');
}, 10000);

const startSock = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    msgRetryCounterMap: {},
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      if (store) return store.loadMessage(key.remoteJid, key.id);
      return { conversation: '⏳ Loading message...' };
    },
  });

  store.bind(sock.ev);

  sock.ev.on('creds.update', saveCreds);

  // Anti Call & Anti Spam
  sock.ev.on('call', async (json) => {
    const callerId = json[0]?.from;
    if (callerId) {
      await sock.updateBlockStatus(callerId, 'block');
      await sock.sendMessage(callerId, { text: '*[❗] Panggilan terdeteksi dan nomor Anda telah diblokir secara otomatis oleh sistem Zayla-Bot.*' });
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

      const isGroup = from.endsWith('@g.us');
      const isOwner = sender.includes('083131871328');

      const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

      // Sistem Auto-Block Spam (10 pesan berturut)
      const userPath = `./db/spam/${sender}.json`;
      let spamCount = 0;
      if (fs.existsSync(userPath)) {
        spamCount = JSON.parse(fs.readFileSync(userPath)).count;
      }
      spamCount++;
      fs.writeFileSync(userPath, JSON.stringify({ count: spamCount }));
      if (spamCount >= 10) {
        await sock.updateBlockStatus(sender, 'block');
        return;
      }

      // RESET SPAM COUNTER setelah 60 detik
      setTimeout(() => {
        if (fs.existsSync(userPath)) fs.unlinkSync(userPath);
      }, 60000);

      // Perintah .zrun
      if (body.startsWith('.zrun')) {
        const username = msg.pushName || 'Pengguna';
        const welcomeMsg = `📡 *Zayla-Bot telah aktif di ${isGroup ? 'grup' : 'chat pribadi'}!*

🤖 *Zayla-Bot*
🧠 Versi: 2.3.0.0
💻 Developer: ZAI Lab
🏢 Organisasi: Zunkee

🎯 Fungsi:
• Asisten grup
• Fitur edukasi, game, downloader, dan banyak lagi

👋 Selamat datang, ${username}!

✅ Bot aktif di: ${from}`;
        await reply(welcomeMsg);
        return;
      }

      // Menu
      if (body.startsWith('.menu')) {
        const profileMsg = `╭───❍ *👤 Profil*
├ 📛 Nama: ${msg.pushName || 'Tanpa Nama'}
├ 🔢 Nomor: ${sender.replace(/@.+/, '')}
├ 🆔 Status: [AUTO DETECT]
├ 🧠 XP: 1200
├ 🧮 Rata-rata Nilai: 88.3
├ 🏆 Level: Zenux II
├ 📅 Bergabung: [TANGGAL OTOMATIS]
╰─────────────

╭───❍ *🧩 ZHelper (Fitur Dasar)*
├ .menu
├ .profil
├ .verify [nama] [umur] [asal kota]
├ .idcek [id pelanggan]
╰─────────────

╭───❍ *🎬 ZDown (Downloader)*
├ .ytmp3 [link]
├ .ytmp4 [link]
├ .tt [link]
├ .fb [link]
├ .tw [link]
├ .pin [link]
├ .ig [link]
╰─────────────

╭───❍ *🎮 ZGame*
├ .ttschallenge
├ .tebakkata
├ .tebakgambar
╰─────────────

╭───❍ *📚 ZEducore*
├ .sd
├ .smp
├ .sma
├ .smk
├ .kuliah
╰─────────────

╭───❍ *🧑‍🌾 ZRoleplay*
├ .menanam
├ .bertani
╰─────────────

╭───❍ *💎 Zrium (Premium Only)*
├ .premfitur
╰─────────────

╭───❍ *👑 ZGroup Admin*
├ .zdown
╰─────────────

╭───❍ *🔍 ZSearch*
├ .google [query]
╰─────────────

╭───❍ *🎌 ZAnimeNews*
├ .animeinfo
├ .topanime
╰─────────────

╭───❍ *🎥 ZMovieNews*
├ .movieinfo
├ .jadwalfilm
╰─────────────

╭───❍ *💰 ZDonate*
├ .donasi
╰─────────────

*Copyright © ${new Date().getFullYear()} Zayla-Bot, all rights reserved.*
*Powered by ZAI Lab*`;

        await reply(profileMsg);
        return;
      }

      // Tambahkan fitur lainnya di sini (download, edukasi, dsb)
    }
  });
};

startSock();
      
