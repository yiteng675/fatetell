'use strict';
require('dotenv').config();
const express = require('express');
const jwt     = require('jsonwebtoken');
const fs      = require('fs');
const path    = require('path');
const tencentcloud = require('tencentcloud-sdk-nodejs');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fatetell_jwt_secret_change_me';
const DATA_DIR   = path.join(__dirname, 'data');

// ── 确保 data 目录存在 ────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── 简单 JSON 文件数据库 ──────────────────────────────────────────────
function readDb(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeDb(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

// ── CORS ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

// ── SMS codes (in-memory, 5 min TTL) ─────────────────────────────────
const smsCodes = new Map();

// ── Tencent Cloud SMS ─────────────────────────────────────────────────
const SmsClient = tencentcloud.sms.v20210111.Client;
const smsClient = new SmsClient({
  credential: {
    secretId:  process.env.TX_SECRET_ID  || '',
    secretKey: process.env.TX_SECRET_KEY || '',
  },
  region: 'ap-guangzhou',
});

// ── Auth middleware ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.json({ code: 401, msg: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.json({ code: 401, msg: 'token已过期，请重新登录' });
  }
}

// ── 用户辅助函数 ──────────────────────────────────────────────────────
function getUsers()  { return readDb('users'); }
function saveUsers(u){ writeDb('users', u); }
function findUserByPhone(phone) { return getUsers().find(u => u.phone === phone); }
function findUserById(id)       { return getUsers().find(u => u.id === id); }

function getProfiles(userId) {
  return readDb('profiles').filter(p => p.userId === userId);
}

// ══════════════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════════════

// POST /api/auth/send-sms
app.post('/api/auth/send-sms', async (req, res) => {
  const { phone } = req.body || {};
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.json({ code: 1, msg: '手机号格式不正确' });
  }
  const existing = smsCodes.get(phone);
  if (existing && Date.now() < existing.expiry - 4 * 60 * 1000) {
    return res.json({ code: 1, msg: '请60秒后再重新获取' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  smsCodes.set(phone, { code, expiry: Date.now() + 5 * 60 * 1000 });

  // Dev mode: 未配置短信凭证时直接返回验证码（开发调试用）
  if (!process.env.TX_SECRET_ID || process.env.TX_SECRET_ID === 'your_secret_id') {
    console.log(`[DEV] SMS code for ${phone}: ${code}`);
    return res.json({ code: 0, msg: '验证码已发送', _dev_code: code });
  }

  try {
    await smsClient.SendSms({
      SmsSdkAppId:      process.env.TX_SDK_APP_ID,
      SignName:         process.env.TX_SIGN_NAME,
      TemplateId:       process.env.TX_TEMPLATE_ID,
      TemplateParamSet: [code, '5'],
      PhoneNumberSet:   [`+86${phone}`],
    });
    res.json({ code: 0, msg: '验证码已发送' });
  } catch (e) {
    console.error('SMS error:', e.message);
    smsCodes.delete(phone);
    res.json({ code: 1, msg: '短信发送失败，请稍后重试' });
  }
});

// POST /api/auth/verify
app.post('/api/auth/verify', (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) return res.json({ code: 1, msg: '参数缺失' });

  const record = smsCodes.get(phone);
  if (!record || Date.now() > record.expiry) {
    return res.json({ code: 1, msg: '验证码已过期，请重新获取' });
  }
  if (record.code !== String(code)) {
    return res.json({ code: 1, msg: '验证码错误' });
  }
  smsCodes.delete(phone);

  const users = getUsers();
  let user = users.find(u => u.phone === phone);
  const isNew = !user;
  if (!user) {
    user = {
      id:        Date.now(),
      phone,
      nickname:  `用户${phone.slice(-4)}`,
      createdAt: Date.now(),
    };
    users.push(user);
    saveUsers(users);
  }

  const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ code: 0, token, user: { id: user.id, phone: user.phone, nickname: user.nickname }, isNew });
});

// PUT /api/auth/me
app.put('/api/auth/me', requireAuth, (req, res) => {
  const { nickname } = req.body || {};
  if (!nickname || nickname.trim().length === 0 || nickname.length > 10) {
    return res.json({ code: 1, msg: '昵称长度1-10字' });
  }
  const users = getUsers();
  const idx   = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.json({ code: 1, msg: '用户不存在' });
  users[idx].nickname = nickname.trim();
  saveUsers(users);
  res.json({ code: 0 });
});

// POST /api/profiles/sync  (本地 → 云端)
app.post('/api/profiles/sync', requireAuth, (req, res) => {
  const { profiles } = req.body || {};
  if (!Array.isArray(profiles)) return res.json({ code: 1, msg: '数据格式错误' });

  const all = readDb('profiles').filter(p => p.userId !== req.user.id);
  const now = Date.now();
  const merged = profiles.map(p => ({ ...p, userId: req.user.id, updatedAt: now }));
  writeDb('profiles', [...all, ...merged]);
  res.json({ code: 0, msg: '同步成功' });
});

// GET /api/profiles  (云端 → 本地)
app.get('/api/profiles', requireAuth, (req, res) => {
  const list = readDb('profiles')
    .filter(p => p.userId === req.user.id)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  res.json({ code: 0, list });
});

// ── Admin middleware ──────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'fatetell2024admin';
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (req.headers['x-admin'] !== '1' || token !== ADMIN_TOKEN) {
    return res.json({ code: 403, msg: '无权访问' });
  }
  next();
}

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const users    = readDb('users');
  const profiles = readDb('profiles');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const ts = todayStart.getTime();
  res.json({
    code: 0,
    data: {
      totalUsers:    users.length,
      todayUsers:    users.filter(u => (u.createdAt || 0) >= ts).length,
      totalProfiles: profiles.length,
      todayActive:   profiles.filter(p => (p.updatedAt || 0) >= ts).length,
      recentUsers:   users.slice(-5).reverse().map(u => ({
        id: u.id, phone: u.phone, nickname: u.nickname, createdAt: u.createdAt
      })),
    }
  });
});

// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users    = readDb('users');
  const profiles = readDb('profiles');
  const list = users.map(u => ({
    id: u.id, phone: u.phone, nickname: u.nickname, createdAt: u.createdAt,
    profileCount: profiles.filter(p => p.userId === u.id).length,
  })).reverse();
  res.json({ code: 0, list });
});

// GET /api/admin/profiles
app.get('/api/admin/profiles', requireAdmin, (req, res) => {
  const profiles = readDb('profiles').reverse();
  res.json({ code: 0, list: profiles });
});

// ── Health check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ code: 0, msg: 'ok' }));

app.listen(PORT, () => {
  console.log(`Yior API listening on port ${PORT}`);
});
