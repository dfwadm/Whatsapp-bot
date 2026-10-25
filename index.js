// WhatsApp bot - Baileys (multi-device) with pairing-code login
// Run:  PHONE_NUMBER=2348012345678 OWNER_NUMBER=2348012345678 node index.js

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const pino = require('pino');

// ---------- CONFIG ----------
const PREFIX = process.env.PREFIX || '.'; // popular choices: "." "!" "/" "#"
const BOT_NAME = process.env.BOT_NAME || 'MyBot';
const OWNER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const PHONE = (process.env.PHONE_NUMBER || '').replace(/\D/g, ''); // number to link, with country code, no +
const startedAt = Date.now();

// ---------- ON/OFF STATE (saved to disk, survives restarts) ----------
const fs = require('fs');
const STATE_FILE = 'state.json';
let enabled = true;
try {
  enabled = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).enabled !== false;
} catch {}
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify({ enabled }));

// ---------- HELPERS ----------
const num = (jid = '') => jid.split('@')[0].split(':')[0];
const isGroup = (jid) => jid.endsWith('@g.us');

function getText(m) {
  let msg = m.message;
  if (!msg) return '';
  if (msg.ephemeralMessage) msg = msg.ephemeralMessage.message;
  if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    ''
  );
}

function getQuoted(m) {
  const ctx = m.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage) return null;
  return {
    sender: ctx.participant,
    message: ctx.quotedMessage,
    key: { remoteJid: m.key.remoteJid, id: ctx.stanzaId, participant: ctx.participant },
  };
}

function mentioned(m) {
  return m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const mi = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${mi}m ${s % 60}s`;
}

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---------- COMMANDS ----------
const commands = {};
function cmd(names, category, desc, handler) {
  const list = Array.isArray(names) ? names : [names];
  list.forEach((n) => (commands[n] = { name: list[0], category, desc, handler }));
}

// ----- General -----
cmd(['menu', 'help', 'list'], 'General', 'Show all commands', async ({ reply }) => {
  const seen = new Set();
  const groups = {};
  for (const c of Object.values(commands)) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    (groups[c.category] ||= []).push(c);
  }
  let out = `╭━━━『 *${BOT_NAME}* 』━━━╮\n┃ Prefix: *${PREFIX}*\n┃ Uptime: ${formatUptime(Date.now() - startedAt)}\n╰━━━━━━━━━━━━━━━╯\n`;
  for (const [cat, list] of Object.entries(groups)) {
    out += `\n┏━『 *${cat}* 』\n`;
    out += list.map((c) => `┃ ${PREFIX}${c.name} — ${c.desc}`).join('\n');
    out += `\n┗━━━━━━━━━━━`;
  }
  await reply(out);
});

cmd('on', 'General', 'Turn the bot ON (owner only)', async ({ reply, isOwner }) => {
  if (!isOwner) return reply('Owner only.');
  enabled = true;
  saveState();
  await reply(`🟢 *${BOT_NAME}* is now ON. Use ${PREFIX}menu to see commands.`);
});

cmd('off', 'General', 'Turn the bot OFF until .on (owner only)', async ({ reply, isOwner }) => {
  if (!isOwner) return reply('Owner only.');
  enabled = false;
  saveState();
  await reply(`🔴 *${BOT_NAME}* is now OFF. It will ignore everything except ${PREFIX}on.`);
});

cmd('status', 'General', 'Show ON/OFF state', async ({ reply }) => {
  await reply(`${enabled ? '🟢 ON' : '🔴 OFF'} | Uptime: ${formatUptime(Date.now() - startedAt)}`);
});

cmd('myid', 'General', 'Show your WhatsApp ID (for OWNER_NUMBER setup)', async ({ reply, sender }) => {
  await reply(`Your ID: ${sender}\nUse digits only as OWNER_NUMBER.`);
});

cmd('ping', 'General', 'Check bot speed', async ({ sock, jid, m }) => {
  const t = Date.now();
  const sent = await sock.sendMessage(jid, { text: 'Pinging...' }, { quoted: m });
  await sock.sendMessage(jid, { text: `🏓 Pong! ${Date.now() - t}ms`, edit: sent.key });
});

cmd('alive', 'General', 'Check if bot is online', async ({ reply }) => {
  await reply(`✅ *${BOT_NAME}* is alive!\n⏱ Uptime: ${formatUptime(Date.now() - startedAt)}`);
});

cmd(['runtime', 'uptime'], 'General', 'Bot uptime', async ({ reply }) => {
  await reply(`⏱ ${formatUptime(Date.now() - startedAt)}`);
});

cmd(['owner', 'creator'], 'General', 'Contact the owner', async ({ sock, jid, m }) => {
  if (!OWNER) return sock.sendMessage(jid, { text: 'Owner not set.' }, { quoted: m });
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Owner\nTEL;type=CELL;waid=${OWNER}:+${OWNER}\nEND:VCARD`;
  await sock.sendMessage(jid, { contacts: { displayName: 'Owner', contacts: [{ vcard }] } }, { quoted: m });
});

cmd('time', 'General', 'Current server time', async ({ reply }) => {
  await reply(`🕒 ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} (WAT)`);
});

// ----- Fun -----
cmd('joke', 'Fun', 'Random joke', async ({ reply }) => {
  const j = await getJSON('https://official-joke-api.appspot.com/random_joke');
  await reply(`😂 ${j.setup}\n\n${j.punchline}`);
});

cmd('quote', 'Fun', 'Random quote', async ({ reply }) => {
  const [q] = await getJSON('https://zenquotes.io/api/random');
  await reply(`💬 _"${q.q}"_\n— *${q.a}*`);
});

cmd('fact', 'Fun', 'Random fact', async ({ reply }) => {
  const f = await getJSON('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
  await reply(`🧠 ${f.text}`);
});

cmd(['flip', 'coin'], 'Fun', 'Flip a coin', async ({ reply }) => {
  await reply(Math.random() < 0.5 ? '🪙 Heads' : '🪙 Tails');
});

cmd(['dice', 'roll'], 'Fun', 'Roll a dice', async ({ reply }) => {
  await reply(`🎲 You rolled a *${1 + Math.floor(Math.random() * 6)}*`);
});

cmd('8ball', 'Fun', 'Ask the magic 8-ball', async ({ reply, args }) => {
  if (!args.length) return reply(`Usage: ${PREFIX}8ball will I be rich?`);
  const a = ['Yes', 'No', 'Maybe', 'Definitely', 'Not a chance', 'Ask again later', 'Absolutely', 'I doubt it'];
  await reply(`🎱 ${a[Math.floor(Math.random() * a.length)]}`);
});

cmd('calc', 'Fun', 'Calculator, e.g. .calc 5*(3+2)', async ({ reply, args }) => {
  const expr = args.join(' ');
  if (!expr || !/^[0-9+\-*/().%\s^]+$/.test(expr)) return reply(`Usage: ${PREFIX}calc 5*(3+2)`);
  try {
    const result = Function(`"use strict"; return (${expr.replace(/\^/g, '**')})`)();
    await reply(`🧮 ${expr} = *${result}*`);
  } catch {
    await reply('Invalid expression.');
  }
});

// ----- Media -----
cmd(['sticker', 's'], 'Media', 'Reply to image/video to make a sticker', async ({ sock, jid, m, reply }) => {
  let Sticker, StickerTypes;
  try {
    ({ Sticker, StickerTypes } = require('wa-sticker-formatter'));
  } catch {
    return reply('Sticker module is not installed on this host.');
  }
  const q = getQuoted(m);
  const target = q
    ? { key: q.key, message: q.message }
    : m;
  const msg = target.message?.imageMessage || target.message?.videoMessage;
  if (!msg) return reply(`Reply to an image or short video with *${PREFIX}sticker*`);
  const buffer = await downloadMediaMessage(target, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
  const sticker = new Sticker(buffer, { pack: BOT_NAME, author: 'WhatsApp Bot', type: StickerTypes.FULL, quality: 60 });
  await sock.sendMessage(jid, await sticker.toMessage(), { quoted: m });
});

// ----- Group -----
const groupOnly = (fn, { admin = false, botAdmin = false } = {}) => async (ctx) => {
  const { sock, jid, m, sender, reply } = ctx;
  if (!isGroup(jid)) return reply('This command works in groups only.');
  const meta = await sock.groupMetadata(jid);
  const admins = meta.participants.filter((p) => p.admin).map((p) => num(p.id));
  const botId = num(sock.user.id);
  if (admin && !admins.includes(num(sender)) && num(sender) !== OWNER) return reply('Admins only.');
  if (botAdmin && !admins.includes(botId)) return reply('Make me an admin first.');
  return fn({ ...ctx, meta });
};

cmd(['tagall', 'everyone'], 'Group', 'Tag all members', groupOnly(async ({ sock, jid, m, meta, args }) => {
  const ids = meta.participants.map((p) => p.id);
  const text = `📢 *${args.join(' ') || 'Attention everyone!'}*\n\n` + ids.map((i) => `@${num(i)}`).join('\n');
  await sock.sendMessage(jid, { text, mentions: ids }, { quoted: m });
}, { admin: true }));

cmd(['hidetag', 'tag'], 'Group', 'Tag all silently', groupOnly(async ({ sock, jid, m, meta, args }) => {
  await sock.sendMessage(jid, { text: args.join(' ') || '​', mentions: meta.participants.map((p) => p.id) }, { quoted: m });
}, { admin: true }));

cmd('kick', 'Group', 'Remove a member (reply or @mention)', groupOnly(async ({ sock, jid, m, reply }) => {
  const targets = [...mentioned(m), getQuoted(m)?.sender].filter(Boolean);
  if (!targets.length) return reply(`Reply to or @mention the user. Usage: ${PREFIX}kick @user`);
  await sock.groupParticipantsUpdate(jid, targets, 'remove');
  await reply('👢 Removed.');
}, { admin: true, botAdmin: true }));

cmd('add', 'Group', 'Add a number, e.g. .add 2348012345678', groupOnly(async ({ sock, jid, args, reply }) => {
  const n = (args[0] || '').replace(/\D/g, '');
  if (!n) return reply(`Usage: ${PREFIX}add 2348012345678`);
  const res = await sock.groupParticipantsUpdate(jid, [`${n}@s.whatsapp.net`], 'add');
  await reply(res[0]?.status === '200' ? '✅ Added.' : `Could not add (status ${res[0]?.status}).`);
}, { admin: true, botAdmin: true }));

cmd('promote', 'Group', 'Make admin (reply or @mention)', groupOnly(async ({ sock, jid, m, reply }) => {
  const targets = [...mentioned(m), getQuoted(m)?.sender].filter(Boolean);
  if (!targets.length) return reply('Reply to or @mention the user.');
  await sock.groupParticipantsUpdate(jid, targets, 'promote');
  await reply('⬆️ Promoted.');
}, { admin: true, botAdmin: true }));

cmd('demote', 'Group', 'Remove admin (reply or @mention)', groupOnly(async ({ sock, jid, m, reply }) => {
  const targets = [...mentioned(m), getQuoted(m)?.sender].filter(Boolean);
  if (!targets.length) return reply('Reply to or @mention the user.');
  await sock.groupParticipantsUpdate(jid, targets, 'demote');
  await reply('⬇️ Demoted.');
}, { admin: true, botAdmin: true }));

cmd(['link', 'invite'], 'Group', 'Get group invite link', groupOnly(async ({ sock, jid, reply }) => {
  const code = await sock.groupInviteCode(jid);
  await reply(`🔗 https://chat.whatsapp.com/${code}`);
}, { admin: true, botAdmin: true }));

cmd(['groupinfo', 'gcinfo'], 'Group', 'Show group info', groupOnly(async ({ meta, reply }) => {
  const admins = meta.participants.filter((p) => p.admin).length;
  await reply(`*${meta.subject}*\n👥 Members: ${meta.participants.length}\n🛡 Admins: ${admins}\n📝 ${meta.desc || 'No description'}`);
}));

cmd(['mute', 'close'], 'Group', 'Only admins can send', groupOnly(async ({ sock, jid, reply }) => {
  await sock.groupSettingUpdate(jid, 'announcement');
  await reply('🔒 Group closed.');
}, { admin: true, botAdmin: true }));

cmd(['unmute', 'open'], 'Group', 'Everyone can send', groupOnly(async ({ sock, jid, reply }) => {
  await sock.groupSettingUpdate(jid, 'not_announcement');
  await reply('🔓 Group opened.');
}, { admin: true, botAdmin: true }));

// ---------- BOT ----------
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
  });

  // Link the account with a pairing code (no QR needed)
  if (!sock.authState.creds.registered) {
    if (!PHONE) {
      console.log('Set PHONE_NUMBER (country code, no +) to link, e.g. PHONE_NUMBER=2348012345678');
      process.exit(1);
    }
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE);
        console.log(`\n🔗 Pairing code: ${code.match(/.{1,4}/g).join('-')}\n`);
        console.log('WhatsApp > Settings > Linked Devices > Link a Device > "Link with phone number instead"');
      } catch (e) {
        console.error('Failed to get pairing code:', e.message);
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log(`✅ ${BOT_NAME} connected as ${num(sock.user.id)}`);
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('Logged out. Delete the "session" folder and run again.');
      } else {
        console.log('Connection closed, reconnecting...');
        start();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (!m.message || m.key.remoteJid === 'status@broadcast') continue;
        const text = getText(m).trim();
        if (!text.startsWith(PREFIX)) continue;

        const jid = m.key.remoteJid;
        const sender = m.key.fromMe ? sock.user.id : m.key.participant || jid;
        const [name, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
        const command = commands[name.toLowerCase()];
        if (!command) continue;

        const isOwner = m.key.fromMe || (OWNER && num(sender) === OWNER);
        // When OFF: stay completely silent, except the owner's .on
        if (!enabled && command.name !== 'on') continue;

        const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: m });
        await sock.sendPresenceUpdate('composing', jid);
        await command.handler({ sock, m, jid, sender, args, reply, isOwner });
      } catch (err) {
        console.error('Command error:', err.message);
        await sock.sendMessage(m.key.remoteJid, { text: '⚠️ Something went wrong running that command.' }, { quoted: m }).catch(() => {});
      }
    }
  });
}

start();
