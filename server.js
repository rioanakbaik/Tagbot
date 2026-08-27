require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIG ─────────────────────────────────────────────────────────────────
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
      welcome: { channelId: null, warna: '#F59E0B', teks: 'Selamat datang {user} di server METAVERSE!' },
      goodbye: { channelId: null, warna: '#ED4245', teks: 'Sampai jumpa {user}, semoga ketemu lagi!' },
    };
    saveConfig(config);
  }
  return config[guildId];
}

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'metaverse_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 hari
}));

// ─── PASSPORT ────────────────────────────────────────────────────────────────
passport.use(new Strategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  scope: ['identify', 'guilds'],
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());

// ─── MIDDLEWARE AUTH ──────────────────────────────────────────────────────────
function isAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

function isAdmin(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/');
  const guild = req.user.guilds?.find(g => g.id === process.env.GUILD_ID);
  if (!guild) return res.redirect('/dashboard?error=not_in_guild');
  const hasPerms = (BigInt(guild.permissions) & BigInt(0x20)) === BigInt(0x20);
  if (!hasPerms) return res.redirect('/dashboard?error=no_permission');
  next();
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Halaman utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Login Discord
app.get('/auth/discord', passport.authenticate('discord'));

// Callback setelah login
app.get('/auth/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
);

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// Halaman dashboard
app.get('/dashboard', isAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// ─── API ──────────────────────────────────────────────────────────────────────

// Get user info
app.get('/api/user', isAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    avatar: req.user.avatar
      ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`,
    guilds: req.user.guilds,
  });
});

// Get config
app.get('/api/config', isAdmin, (req, res) => {
  const cfg = getGuildConfig(process.env.GUILD_ID);
  res.json(cfg);
});

// Save welcome config
app.post('/api/config/welcome', isAdmin, (req, res) => {
  const { channelId, warna, teks } = req.body;
  const config = loadConfig();
  const cfg = getGuildConfig(process.env.GUILD_ID);

  if (channelId !== undefined) cfg.welcome.channelId = channelId || null;
  if (warna) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(warna)) {
      return res.status(400).json({ error: 'Format warna salah!' });
    }
    cfg.welcome.warna = warna;
  }
  if (teks) cfg.welcome.teks = teks;

  config[process.env.GUILD_ID] = cfg;
  saveConfig(config);
  res.json({ success: true, cfg });
});

// Save goodbye config
app.post('/api/config/goodbye', isAdmin, (req, res) => {
  const { channelId, warna, teks } = req.body;
  const config = loadConfig();
  const cfg = getGuildConfig(process.env.GUILD_ID);

  if (channelId !== undefined) cfg.goodbye.channelId = channelId || null;
  if (warna) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(warna)) {
      return res.status(400).json({ error: 'Format warna salah!' });
    }
    cfg.goodbye.warna = warna;
  }
  if (teks) cfg.goodbye.teks = teks;

  config[process.env.GUILD_ID] = cfg;
  saveConfig(config);
  res.json({ success: true, cfg });
});

// Reset welcome
app.post('/api/config/welcome/reset', isAdmin, (req, res) => {
  const config = loadConfig();
  const cfg = getGuildConfig(process.env.GUILD_ID);
  cfg.welcome = { channelId: null, warna: '#F59E0B', teks: 'Selamat datang {user} di server METAVERSE!' };
  config[process.env.GUILD_ID] = cfg;
  saveConfig(config);
  res.json({ success: true, cfg });
});

// Reset goodbye
app.post('/api/config/goodbye/reset', isAdmin, (req, res) => {
  const config = loadConfig();
  const cfg = getGuildConfig(process.env.GUILD_ID);
  cfg.goodbye = { channelId: null, warna: '#ED4245', teks: 'Sampai jumpa {user}, semoga ketemu lagi!' };
  config[process.env.GUILD_ID] = cfg;
  saveConfig(config);
  res.json({ success: true, cfg });
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌐 Dashboard berjalan di http://localhost:${PORT}`);
});
