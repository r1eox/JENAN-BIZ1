const express = require('express');
const db = require('../database');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/attendance — أدمن: جميع السجلات | موظف: سجلاته فقط
router.get('/', authMiddleware, (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const records = db.prepare(`
        SELECT a.*, u.name as user_name, u.phone as user_phone, u.role as user_role
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.date DESC, a.check_in DESC
      `).all();
      res.json(records);
    } else {
      const records = db.prepare(`
        SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC
      `).all(req.user.id);
      res.json(records);
    }
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع سجلات الحضور' });
  }
});

// GET /api/attendance/today — حالة اليوم للمستخدم الحالي
router.get('/today', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, today);
    res.json(record || null);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع حالة الحضور' });
  }
});

// POST /api/attendance/check-in — تسجيل الحضور
router.post('/check-in', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, today);
    if (existing) return res.status(400).json({ error: 'تم تسجيل الحضور مسبقاً اليوم' });

    const now = new Date().toISOString();
    const result = db.prepare(
      'INSERT INTO attendance (user_id, date, check_in) VALUES (?, ?, ?)'
    ).run(req.user.id, today, now);

    res.status(201).json({ id: result.lastInsertRowid, check_in: now, date: today, message: 'تم تسجيل الحضور بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تسجيل الحضور' });
  }
});

// POST /api/attendance/check-out — تسجيل الانصراف
router.post('/check-out', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, today);
    if (!record) return res.status(400).json({ error: 'لم يتم تسجيل الحضور بعد' });
    if (record.check_out) return res.status(400).json({ error: 'تم تسجيل الانصراف مسبقاً' });

    const now = new Date().toISOString();
    db.prepare('UPDATE attendance SET check_out = ? WHERE id = ?').run(now, record.id);
    res.json({ check_out: now, message: 'تم تسجيل الانصراف بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تسجيل الانصراف' });
  }
});

// GET /api/attendance/summary — ملخص لكل موظف (أدمن فقط)
router.get('/summary', adminMiddleware, (req, res) => {
  try {
    const { month } = req.query;
    let where = '';
    const params = [];
    if (month) {
      where = "WHERE a.date LIKE ?";
      params.push(`${month}%`);
    }

    const summary = db.prepare(`
      SELECT u.id, u.name, u.phone, u.role,
             COUNT(a.id) as days_present,
             SUM(CASE WHEN a.check_out IS NOT NULL THEN 1 ELSE 0 END) as days_complete
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id ${where}
      WHERE u.role != 'admin'
      GROUP BY u.id
      ORDER BY u.name
    `).all(...params);

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع الملخص' });
  }
});

module.exports = router;
