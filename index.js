if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Events,
  EmbedBuilder, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ─── ENV ────────────────────────────────────────────────────────────────────
const TOKEN    = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID  = process.env.ROLE_ID;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !GUILD_ID || !ROLE_ID || !CLIENT_ID) {
  console.error('❌ TOKEN, GUILD_ID, ROLE_ID, atau CLIENT_ID belum diisi di file .env');
  process.exit(1);
}

// ─── CONFIG DATABASE (JSON) ──────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

function getGuildConfig(guildId) {
  const config = loadConfig();
  if (!config[guildId]) {
    config[guildId] = {
      welcome: { channelId: null, warna: '#5865F2', teks: 'Selamat datang di server!' },
      goodbye: { channelId: null, warna: '#ED4245', teks: 'Sampai jumpa lagi!' },
    };
    saveConfig(config);
  }
  return config[guildId];
}

function setGuildConfig(guildId, data) {
  const config = loadConfig();
  config[guildId] = data;
  saveConfig(config);
}

// ─── CLIENT ─────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.User, Partials.GuildMember],
});

// ─── SLASH COMMANDS ──────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Atur pengaturan pesan sambutan')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Atur channel untuk pesan welcome')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Pilih channel').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('warna')
        .setDescription('Atur warna embed welcome (format hex, contoh: #ff0000)')
        .addStringOption(opt =>
          opt.setName('hex').setDescription('Kode warna hex').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('teks')
        .setDescription('Atur teks pesan welcome')
        .addStringOption(opt =>
          opt.setName('pesan').setDescription('Teks pesan (gunakan {user} untuk mention)').setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('setgoodbye')
    .setDescription('Atur pengaturan pesan perpisahan')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Atur channel untuk pesan goodbye')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Pilih channel').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('warna')
        .setDescription('Atur warna embed goodbye (format hex, contoh: #ff0000)')
        .addStringOption(opt =>
          opt.setName('hex').setDescription('Kode warna hex').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('teks')
        .setDescription('Atur teks pesan goodbye')
        .addStringOption(opt =>
          opt.setName('pesan').setDescription('Teks pesan (gunakan {user} untuk nama member)').setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('testwelcome')
    .setDescription('Preview pesan welcome')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('testgoodbye')
    .setDescription('Preview pesan goodbye')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('infosetting')
    .setDescription('Lihat pengaturan welcome & goodbye saat ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Mendaftarkan slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands.map(c => c.toJSON()),
    });
    console.log('✅ Slash commands berhasil didaftarkan!');
  } catch (err) {
    console.error('Gagal mendaftarkan slash commands:', err);
  }
}

// ─── HELPER: BUAT EMBED WELCOME ──────────────────────────────────────────────
function buatEmbedWelcome(member, cfg) {
  const teks = cfg.welcome.teks.replace('{user}', `<@${member.id}>`);
  return new EmbedBuilder()
    .setColor(cfg.welcome.warna || '#5865F2')
    .setTitle('👋 Selamat Datang!')
    .setDescription(teks)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👤 Member', value: `<@${member.id}>`, inline: true },
      { name: '📋 Username', value: member.user.tag, inline: true },
      { name: '🏠 Member Ke', value: `#${member.guild.memberCount}`, inline: true },
    )
    .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
    .setTimestamp();
}

// ─── HELPER: BUAT EMBED GOODBYE ──────────────────────────────────────────────
function buatEmbedGoodbye(member, cfg) {
  const teks = cfg.goodbye.teks.replace('{user}', member.user.tag);
  return new EmbedBuilder()
    .setColor(cfg.goodbye.warna || '#ED4245')
    .setTitle('👋 Sampai Jumpa!')
    .setDescription(teks)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👤 Member', value: member.user.tag, inline: true },
    )
    .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
    .setTimestamp();
}

// ─── SERVER TAG: CEK APAKAH PAKAI TAG SERVER INI ─────────────────────────────
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
      console.log(`[+] Role server tag ditambahkan ke ${user.tag}`);
    } else if (!pakaiTag && punyaRole) {
      await member.roles.remove(ROLE_ID);
      console.log(`[-] Role server tag dilepas dari ${user.tag}`);
    }
  } catch (err) {
    console.error(`Gagal update role untuk ${user.tag}:`, err.message);
  }
}

// ─── EVENT: BOT SIAP ─────────────────────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot online sebagai ${c.user.tag}`);
  await registerCommands();

  // Sinkronisasi server tag saat bot nyala
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) return console.error('❌ Bot tidak ada di server dengan GUILD_ID tersebut.');

  const members = await guild.members.fetch();
  console.log(`Mengecek server tag untuk ${members.size} member...`);
  for (const member of members.values()) {
    if (member.user.bot) continue;
    await syncRole(member, member.user);
  }
  console.log('✅ Sinkronisasi server tag selesai.');
});

// ─── EVENT: MEMBER JOIN ──────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  const cfg = getGuildConfig(member.guild.id);
  if (!cfg.welcome.channelId) return;

  const channel = member.guild.channels.cache.get(cfg.welcome.channelId);
  if (!channel) return;

  const embed = buatEmbedWelcome(member, cfg);
  await channel.send({ embeds: [embed] }).catch(console.error);
});

// ─── EVENT: MEMBER LEAVE ─────────────────────────────────────────────────────
client.on(Events.GuildMemberRemove, async (member) => {
  const cfg = getGuildConfig(member.guild.id);
  if (!cfg.goodbye.channelId) return;

  const channel = member.guild.channels.cache.get(cfg.goodbye.channelId);
  if (!channel) return;

  const embed = buatEmbedGoodbye(member, cfg);
  await channel.send({ embeds: [embed] }).catch(console.error);
});

// ─── EVENT: USER UPDATE (SERVER TAG) ─────────────────────────────────────────
client.on(Events.UserUpdate, async (oldUser, newUser) => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const member = guild.members.cache.get(newUser.id)
    || await guild.members.fetch(newUser.id).catch(() => null);

  await syncRole(member, newUser);
});

// ─── EVENT: SLASH COMMANDS ───────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const cfg = getGuildConfig(interaction.guildId);

  // ── /setwelcome ──────────────────────────────────────────────────────────
  if (commandName === 'setwelcome') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      cfg.welcome.channelId = channel.id;
      setGuildConfig(interaction.guildId, cfg);
      return interaction.reply({ content: `✅ Channel welcome diatur ke ${channel}`, ephemeral: true });
    }

    if (sub === 'warna') {
      const hex = interaction.options.getString('hex');
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        return interaction.reply({ content: '❌ Format warna salah! Gunakan format hex seperti `#ff0000`', ephemeral: true });
      }
      cfg.welcome.warna = hex;
      setGuildConfig(interaction.guildId, cfg);
      return interaction.reply({ content: `✅ Warna welcome diatur ke **${hex}**`, ephemeral: true });
    }

    if (sub === 'teks') {
      const pesan = interaction.options.getString('pesan');
      cfg.welcome.teks = pesan;
      setGuildConfig(interaction.guildId, cfg);
      return interaction.reply({ content: `✅ Teks welcome diatur ke:\n> ${pesan}`, ephemeral: true });
    }
  }

  // ── /setgoodbye ──────────────────────────────────────────────────────────
  if (commandName === 'setgoodbye') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      cfg.goodbye.channelId = channel.id;
      setGuildConfig(interaction.guildId, cfg);
      return interaction.reply({ content: `✅ Channel goodbye diatur ke ${channel}`, ephemeral: true });
    }

    if (sub === 'warna') {
      const hex = interaction.options.getString('hex');
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        return interaction.reply({ content: '❌ Format warna salah! Gunakan format hex seperti `#ff0000`', ephemeral: true });
      }
      cfg.goodbye.warna = hex;
      setGuildConfig(interaction.guildId, cfg);
      return interaction.reply({ content: `✅ Warna goodbye diatur ke **${hex}**`, ephemeral: true });
    }

    if (sub === 'teks') {
      const pesan = interaction.options.getString('pesan');
      cfg.goodbye.teks = pesan;
      setGuildConfig(interaction.guildId, cfg);
      return interaction.reply({ content: `✅ Teks goodbye diatur ke:\n> ${pesan}`, ephemeral: true });
    }
  }

  // ── /testwelcome ─────────────────────────────────────────────────────────
  if (commandName === 'testwelcome') {
    const embed = buatEmbedWelcome(interaction.member, cfg);
    return interaction.reply({ content: '👀 Preview welcome:', embeds: [embed], ephemeral: true });
  }

  // ── /testgoodbye ─────────────────────────────────────────────────────────
  if (commandName === 'testgoodbye') {
    const embed = buatEmbedGoodbye(interaction.member, cfg);
    return interaction.reply({ content: '👀 Preview goodbye:', embeds: [embed], ephemeral: true });
  }

  // ── /infosetting ─────────────────────────────────────────────────────────
  if (commandName === 'infosetting') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('⚙️ Pengaturan Bot')
      .addFields(
        {
          name: '👋 Welcome',
          value: [
            `Channel: ${cfg.welcome.channelId ? `<#${cfg.welcome.channelId}>` : 'Belum diatur'}`,
            `Warna: ${cfg.welcome.warna}`,
            `Teks: ${cfg.welcome.teks}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🚪 Goodbye',
          value: [
            `Channel: ${cfg.goodbye.channelId ? `<#${cfg.goodbye.channelId}>` : 'Belum diatur'}`,
            `Warna: ${cfg.goodbye.warna}`,
            `Teks: ${cfg.goodbye.teks}`,
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Gunakan /setwelcome atau /setgoodbye untuk mengubah pengaturan' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.on(Events.Error, (err) => console.error('Client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(TOKEN);
