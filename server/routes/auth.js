const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const db      = require('../db');
require('dotenv').config();

// ── 发送验证码 ────────────────────────────────────────────────────
router.post('/send-sms', async (req, res) => {
  const { phone } = req.body;
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ code: 1, msg: '手机号格式错误' });
  }

  // 60 秒内不重复发送
  const [rows] = await db.query(
    'SELECT id FROM sms_codes WHERE phone=? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND) LIMIT 1',
    [phone]
  );
  if (rows.length) return res.status(429).json({ code: 1, msg: '发送太频繁，请稍后再试' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 分钟有效

  await db.query('INSERT INTO sms_codes (phone, code, expires_at) VALUES (?,?,?)', [phone, code, expires]);

  if (process.env.SMS_DEV === 'true') {
    console.log(`[DEV SMS] ${phone} → ${code}`);
    return res.json({ code: 0, msg: '验证码已发送（开发模式）' });
  }

  // 腾讯云短信
  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs-sms');
    const SmsClient = tencentcloud.sms.v20210111.Client;
    const client = new SmsClient({
      credential: { secretId: process.env.TENCENT_SECRET_ID, secretKey: process.env.TENCENT_SECRET_KEY },
      region: 'ap-guangzhou',
    });
    await client.SendSms({
      SmsSdkAppId:    process.env.SMS_SDK_APP_ID,
      SignName:       process.env.SMS_SIGN,
      TemplateId:     process.env.SMS_TEMPLATE_ID,
      TemplateParamSet: [code, '5'],
      PhoneNumberSet: [`+86${phone}`],
    });
    res.json({ code: 0, msg: '验证码已发送' });
  } catch (e) {
    console.error('SMS error', e);
    res.status(500).json({ code: 1, msg: '短信发送失败，请重试' });
  }
});

// ── 验证码登录 / 注册 ─────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ code: 1, msg: '参数缺失' });

  const [rows] = await db.query(
    'SELECT id FROM sms_codes WHERE phone=? AND code=? AND used=0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
    [phone, code]
  );
  if (!rows.length) return res.status(400).json({ code: 1, msg: '验证码错误或已过期' });

  await db.query('UPDATE sms_codes SET used=1 WHERE id=?', [rows[0].id]);

  // 查找或创建用户
  let [users] = await db.query('SELECT * FROM users WHERE phone=?', [phone]);
  let user, isNew = false;
  if (users.length) {
    user = users[0];
  } else {
    const [result] = await db.query('INSERT INTO users (phone, nickname) VALUES (?,?)', [phone, `用户${phone.slice(-4)}`]);
    user = { id: result.insertId, phone, nickname: `用户${phone.slice(-4)}` };
    isNew = true;
  }

  const token = jwt.sign({ uid: user.id, phone: user.phone }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ code: 0, token, isNew, user: { id: user.id, phone: user.phone, nickname: user.nickname, avatar_url: user.avatar_url } });
});

// ── 获取当前用户信息 ──────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  const [rows] = await db.query('SELECT id, phone, nickname, avatar_url, created_at FROM users WHERE id=?', [req.uid]);
  if (!rows.length) return res.status(404).json({ code: 1, msg: '用户不存在' });
  res.json({ code: 0, user: rows[0] });
});

// ── 修改昵称 ──────────────────────────────────────────────────────
router.put('/me', authMiddleware, async (req, res) => {
  const { nickname } = req.body;
  if (nickname) await db.query('UPDATE users SET nickname=? WHERE id=?', [nickname.slice(0, 20), req.uid]);
  res.json({ code: 0 });
});

// ── JWT 中间件（供其他路由复用）──────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return res.status(401).json({ code: 401, msg: '未登录' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.uid = payload.uid;
    next();
  } catch {
    res.status(401).json({ code: 401, msg: 'token 无效或已过期' });
  }
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
