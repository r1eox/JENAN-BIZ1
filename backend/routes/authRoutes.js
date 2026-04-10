const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, partner_type, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'جميع الحقول المطلوبة يجب ملؤها' });
    }
    if (!['employee', 'partner'].includes(role)) {
      return res.status(400).json({ error: 'نوع الحساب غير صحيح' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن لا تقل عن 8 أحرف' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صحيح' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, partner_type, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      name.trim(),
      email.toLowerCase().trim(),
      hashed,
      role,
      partner_type || null,
      phone || null
    );

    res.status(201).json({
      message: 'تم التسجيل بنجاح. سيتم مراجعة حسابك من قبل المدير قريباً.',
      userId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'خطأ في الخادم، حاول مجدداً' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    if (user.status === 'blocked') return res.status(403).json({ error: 'تم حظر حسابك. تواصل مع الإدارة.' });
    if (user.status === 'pending') return res.status(403).json({ error: 'حسابك قيد المراجعة من الإدارة.' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'weseet_super_secret_jwt_key_change_in_production_2024',
      { expiresIn: '7d' }
    );

    // Load permissions
    const permissions = user.role === 'admin'
      ? db.prepare('SELECT key FROM permissions').all().map(p => p.key)
      : db.prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?').all(user.id).map(p => p.permission_key);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, permissions }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/auth/me - with user permissions
router.get('/me', authMiddleware, (req, res) => {
  try {
    let permissions = [];
    if (req.user.role === 'admin') {
      // Admin has all permissions
      const allPerms = db.prepare('SELECT key FROM permissions').all();
      permissions = allPerms.map(p => p.key);
    } else {
      // Get user's specific permissions
      const userPerms = db.prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?').all(req.user.id);
      permissions = userPerms.map(p => p.permission_key);
    }
    res.json({ user: { ...req.user, permissions } });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع الصلاحيات' });
  }
});

module.exports = router;
