const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const fs = require('fs')
const P = require('pino')
const express = require('express')
const path = require('path')
const app = express()

// Import fitur bot
const { handleCommand } = require('./command')
const { handleSewa, checkExpiredSewa, checkSpamCall } = require('./sewa')

// Session Auth
const { state, saveState } = useSingleFileAuthState('./sessions/auth_info.json')

// WA Init
async function startBot() {
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['ZaylaBot', 'Chrome', '1.0']
  })

  sock.ev.on('creds.update', saveState)

  // Tampilkan QR via Web Zeabur
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) qrCode = qr // Simpan QR di variable global
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot()
    } else if (connection === 'open') {
      console.log('✅ Bot connected to WhatsApp')
      checkExpiredSewa(sock)
    }
  })

  // Handle pesan masuk
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key?.remoteJid === 'status@broadcast') return
    const from = msg.key.remoteJid
    const sender = msg.key.participant || from
    const isGroup = from.endsWith('@g.us')

    await checkSpamCall(sock, msg)
    if (await handleSewa(sock, msg, from, sender, isGroup)) return
    await handleCommand(sock, msg, from, sender, isGroup)
  })

  // Auto block call
  sock.ev.on('call', async (call) => {
    const caller = call[0]?.from
    console.log('⚠️ Blocked call from:', caller)
    await sock.updateBlockStatus(caller, 'block')
  })
}

startBot()

// Web QR Code Viewer (diakses dari Zeabur domain)
let qrCode = ''
app.get('/', (req, res) => {
  if (!qrCode) return res.send('✅ Bot sudah login!')
  res.send(`<pre style="font-size:20px;">${qrCode}</pre>`)
})
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🌐 QR diakses: http://localhost:${PORT}`))
