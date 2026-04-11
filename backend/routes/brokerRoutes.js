const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/brokers — الأدمن يرى الكل، الموظف/الشريك يرى وسطاءه فقط
router.get('/', authMiddleware, (req, res) => {
  try {
    let brokers;
    if (req.user.role === 'admin') {
      brokers = db.prepare(`
        SELECT b.*, u.name as added_by_name
        FROM brokers b
        LEFT JOIN users u ON b.added_by_id = u.id
        ORDER BY b.created_at DESC
      `).all();
    } else {
      brokers = db.prepare(`
        SELECT b.*, u.name as added_by_name
        FROM brokers b
        LEFT JOIN users u ON b.added_by_id = u.id
        WHERE b.added_by_id = ?
        ORDER BY b.created_at DESC
      `).all(req.user.id);
    }
    res.json(brokers);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع الوسطاء' });
  }
});

// POST /api/brokers — employee adds a broker
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'اسم الوسيط مطلوب' });
    if (!phone || !phone.trim()) return res.status(400).json({ error: 'رقم الجوال مطلوب' });

    const result = db.prepare(
      'INSERT INTO brokers (name, phone, added_by_id, notes) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), phone.trim(), req.user.id, notes?.trim() || null);

    const broker = db.prepare('SELECT b.*, u.name as added_by_name FROM brokers b LEFT JOIN users u ON b.added_by_id = u.id WHERE b.id = ?').get(result.lastInsertRowid);
    res.status(201).json(broker);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إضافة الوسيط' });
  }
});

// DELETE /api/brokers/:id — added_by or admin can delete
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const broker = db.prepare('SELECT * FROM brokers WHERE id = ?').get(req.params.id);
    if (!broker) return res.status(404).json({ error: 'الوسيط غير موجود' });
    if (req.user.role !== 'admin' && broker.added_by_id !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    db.prepare('DELETE FROM brokers WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف الوسيط' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الحذف' });
  }
});

module.exports = router;
