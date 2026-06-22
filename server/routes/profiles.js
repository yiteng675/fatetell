const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { authMiddleware } = require('./auth');

// 所有接口需要登录
router.use(authMiddleware);

// ── 获取命盘列表 ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM profiles WHERE user_id=? ORDER BY sort_order ASC, created_at ASC',
    [req.uid]
  );
  res.json({ code: 0, list: rows });
});

// ── 批量同步（首次登录时把本地数据上云）────────────────────────────
router.post('/sync', async (req, res) => {
  const { profiles } = req.body;
  if (!Array.isArray(profiles)) return res.status(400).json({ code: 1, msg: '参数错误' });

  for (const p of profiles) {
    await db.query(`
      INSERT INTO profiles (id,user_id,name,gender,relation,year,month,day,hour,year_gz,month_gz,day_gz,hour_gz,day_gan,sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        name=VALUES(name), gender=VALUES(gender), relation=VALUES(relation),
        year=VALUES(year), month=VALUES(month), day=VALUES(day), hour=VALUES(hour),
        year_gz=VALUES(year_gz), month_gz=VALUES(month_gz),
        day_gz=VALUES(day_gz), hour_gz=VALUES(hour_gz),
        day_gan=VALUES(day_gan), sort_order=VALUES(sort_order)
    `, [
      p.id, req.uid, p.name, p.gender, p.relation||'本人',
      p.year, p.month, p.day, p.hour,
      p.yearGz, p.monthGz, p.dayGz, p.hourGz, p.dayGan,
      p.sort || 0
    ]);
  }
  res.json({ code: 0 });
});

// ── 新建 / 更新命盘 ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const p = req.body;
  if (!p.id) return res.status(400).json({ code: 1, msg: '缺少 id' });
  await db.query(`
    INSERT INTO profiles (id,user_id,name,gender,relation,year,month,day,hour,year_gz,month_gz,day_gz,hour_gz,day_gan,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      name=VALUES(name), gender=VALUES(gender), relation=VALUES(relation),
      year=VALUES(year), month=VALUES(month), day=VALUES(day), hour=VALUES(hour),
      year_gz=VALUES(year_gz), month_gz=VALUES(month_gz),
      day_gz=VALUES(day_gz), hour_gz=VALUES(hour_gz),
      day_gan=VALUES(day_gan), sort_order=VALUES(sort_order)
  `, [
    p.id, req.uid, p.name, p.gender, p.relation||'本人',
    p.year, p.month, p.day, p.hour,
    p.yearGz, p.monthGz, p.dayGz, p.hourGz, p.dayGan,
    p.sort || 0
  ]);
  res.json({ code: 0 });
});

// ── 删除命盘 ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM profiles WHERE id=? AND user_id=?', [req.params.id, req.uid]);
  res.json({ code: 0 });
});

module.exports = router;
