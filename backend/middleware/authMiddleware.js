const jwt = require('jsonwebtoken');
const db = require('../database');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'weseet_super_secret_jwt_key_change_in_production_2024');
    const user = db.prepare('SELECT id, name, email, role, status, phone FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
    if (user.status === 'blocked') return res.status(403).json({ error: 'تم حظر حسابك. تواصل مع الإدارة.' });
    if (user.status === 'pending') return res.status(403).json({ error: 'حسابك قيد المراجعة من الإدارة.' });

    // Load user permissions (admins have all permissions)
    if (user.role === 'admin') {
      const allPerms = db.prepare('SELECT key FROM permissions').all();
      user.permissions = allPerms.map(p => p.key);
    } else {
      const perms = db.prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?').all(user.id);
      user.permissions = perms.map(p => p.permission_key);
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'هذه الصفحة للمدير فقط' });
    }
    next();
  });
};

// Check specific permission (admin always passes)
const hasPermission = (permKey) => (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role === 'admin' || req.user.permissions.includes(permKey)) {
      return next();
    }
    return res.status(403).json({ error: 'ليس لديك صلاحية للقيام بهذه العملية' });
  });
};

module.exports = { authMiddleware, adminMiddleware, hasPermission };
