require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');

const TOKEN    = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID  = process.env.ROLE_ID;

if (!TOKEN || !GUILD_ID || !ROLE_ID) {
  console.error('❌ TOKEN, GUILD_ID, atau ROLE_ID belum diisi di file .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // WAJIB: privileged intent, aktifkan di Developer Portal
  ],
  partials: [Partials.User, Partials.GuildMember],
});

// Cek apakah user sedang memakai tag server ini
function pakaiTagServer(user) {
  const pg = user?.primaryGuild;
  return !!(pg && pg.identityEnabled && pg.identityGuildId === GUILD_ID);
}

async function syncRole(member, user) {
  if (!member) return;
  const punyaRole = member.roles.cache.has(ROLE_ID);
  const pakaiTag  = pakaiTagServer(user);

  try {
    if (pakaiTag && !punyaRole) {
      await member.roles.add(ROLE_ID);
      console.log(`[+] Role ditambahkan ke ${user.tag}`);
    } else if (!pakaiTag && punyaRole) {
      await member.roles.remove(ROLE_ID);
      console.log(`[-] Role dilepas dari ${user.tag}`);
    }
  } catch (err) {
    console.error(`Gagal update role untuk ${user.tag}:`, err.message);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot online sebagai ${c.user.tag}`);

  // Sinkronisasi awal: cek semua member saat bot baru nyala
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    console.error('❌ Bot tidak ada di server dengan GUILD_ID tersebut.');
    return;
  }

  const members = await guild.members.fetch();
  console.log(`Mengecek tag server untuk ${members.size} member...`);
  for (const member of members.values()) {
    if (member.user.bot) continue;
    await syncRole(member, member.user);
  }
  console.log('Sinkronisasi awal selesai.');
});

// Event ini terpicu saat data user berubah (termasuk pasang/lepas server tag)
client.on(Events.UserUpdate, async (oldUser, newUser) => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const member = guild.members.cache.get(newUser.id)
    || await guild.members.fetch(newUser.id).catch(() => null);

  await syncRole(member, newUser);
});

client.on(Events.Error, (err) => console.error('Client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(TOKEN);
