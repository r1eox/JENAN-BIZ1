const express = require('express');
const db = require('../database');
const { adminMiddleware, authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

const PRODUCT_TYPES = ['كاش', 'نقاط بيع', 'عقار', 'تمويل شخصي', 'أسطول', 'رهن', 'تمويل تجاري'];

// ===== FUNDING ENTITY CONTACTS =====

// GET all contacts (optionally filtered by entity)
router.get('/contacts', adminMiddleware, (req, res) => {
  try {
    const { entity_id } = req.query;
    let contacts;
    if (entity_id) {
      contacts = db.prepare(`
        SELECT fc.*, fe.name as entity_name
        FROM funding_entity_contacts fc
        JOIN funding_entities fe ON fc.funding_entity_id = fe.id
        WHERE fc.funding_entity_id = ?
        ORDER BY fc.name
      `).all(entity_id);
    } else {
      contacts = db.prepare(`
        SELECT fc.*, fe.name as entity_name
        FROM funding_entity_contacts fc
        JOIN funding_entities fe ON fc.funding_entity_id = fe.id
        ORDER BY fe.name, fc.name
      `).all();
    }
    res.json(contacts.map(c => ({
      ...c,
      product_types: JSON.parse(c.product_types || '[]')
    })));
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع جهات الاتصال' });
  }
});

// POST create contact
router.post('/contacts', adminMiddleware, (req, res) => {
  try {
    const { funding_entity_id, name, phone, product_types, notes } = req.body;
    if (!funding_entity_id || !name?.trim()) {
      return res.status(400).json({ error: 'الجهة التمويلية والاسم مطلوبان' });
    }
    const entity = db.prepare('SELECT id FROM funding_entities WHERE id = ?').get(funding_entity_id);
    if (!entity) return res.status(404).json({ error: 'الجهة التمويلية غير موجودة' });

    const result = db.prepare(`
      INSERT INTO funding_entity_contacts (funding_entity_id, name, phone, product_types, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      funding_entity_id,
      name.trim(),
      phone || null,
      JSON.stringify(Array.isArray(product_types) ? product_types : []),
      notes || null
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'تمت إضافة جهة الاتصال' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الإضافة' });
  }
});

// PUT update contact
router.put('/contacts/:id', adminMiddleware, (req, res) => {
  try {
    const { name, phone, product_types, notes, is_active, funding_entity_id } = req.body;
    const contact = db.prepare('SELECT * FROM funding_entity_contacts WHERE id = ?').get(req.params.id);
    if (!contact) return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });

    db.prepare(`
      UPDATE funding_entity_contacts SET
        funding_entity_id = ?, name = ?, phone = ?, product_types = ?,
        notes = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      funding_entity_id ?? contact.funding_entity_id,
      name?.trim() ?? contact.name,
      phone ?? contact.phone,
      product_types ? JSON.stringify(product_types) : contact.product_types,
      notes ?? contact.notes,
      is_active !== undefined ? (is_active ? 1 : 0) : contact.is_active,
      req.params.id
    );

    res.json({ message: 'تم التحديث' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحديث' });
  }
});

// DELETE contact
router.delete('/contacts/:id', adminMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM funding_entity_contacts WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الحذف' });
  }
});

// GET product types list
router.get('/product-types', authMiddleware, (req, res) => {
  res.json(PRODUCT_TYPES);
});

// ===== COMPANIES =====

// GET all companies
router.get('/companies', adminMiddleware, (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*, u.name as employee_name, u.phone as employee_phone,
             r.status as request_status, r.funding_entity_id,
             fe.name as funding_entity_name
      FROM companies c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN requests r ON c.request_id = r.id
      LEFT JOIN funding_entities fe ON r.funding_entity_id = fe.id
    `;
    const params = [];
    if (search) {
      query += ' WHERE c.company_name LIKE ? OR c.owner_name LIKE ? OR c.owner_phone LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY c.created_at DESC';
    const companies = db.prepare(query).all(...params);
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع المنشآت' });
  }
});

// POST create new company (manual entry by admin)
router.post('/companies', adminMiddleware, (req, res) => {
  try {
    const { company_name, owner_name, owner_phone, entity_type } = req.body;
    if (!company_name?.trim()) {
      return res.status(400).json({ error: 'اسم المنشأة مطلوب' });
    }
    const result = db.prepare(`
      INSERT INTO companies (company_name, owner_name, owner_phone, entity_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(company_name.trim(), owner_name?.trim() || null, owner_phone?.trim() || null, entity_type || 'شركة');
    res.status(201).json({ id: result.lastInsertRowid, message: 'تمت إضافة المنشأة' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إضافة المنشأة' });
  }
});

// PUT update company info
router.put('/companies/:id', adminMiddleware, (req, res) => {
  try {
    const { company_name, owner_name, owner_phone, entity_type } = req.body;
    db.prepare(`
      UPDATE companies SET
        company_name = COALESCE(?, company_name),
        owner_name = COALESCE(?, owner_name),
        owner_phone = COALESCE(?, owner_phone),
        entity_type = COALESCE(?, entity_type),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(company_name || null, owner_name || null, owner_phone || null, entity_type || null, req.params.id);
    res.json({ message: 'تم التحديث' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحديث' });
  }
});

// DELETE company — protected if added by an employee (user_id IS NOT NULL)
router.delete('/companies/:id', adminMiddleware, (req, res) => {
  try {
    const company = db.prepare('SELECT id, user_id FROM companies WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ error: 'المنشأة غير موجودة' });
    if (company.user_id) {
      return res.status(403).json({ error: 'لا يمكن حذف هذه المنشأة لأنها مضافة من قِبل موظف — يمكنك تعديل بياناتها فقط' });
    }
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الحذف' });
  }
});

// ===== EMPLOYEE STATS =====

// GET all employees with stats
router.get('/employee-stats', adminMiddleware, (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.partner_type, u.status, u.created_at
      FROM users u
      WHERE u.role != 'admin'
      ORDER BY u.name
    `).all();

    const stats = employees.map(emp => {
      const totalReqs = db.prepare('SELECT COUNT(*) as c FROM requests WHERE user_id = ?').get(emp.id).c;
      const inProgress = db.prepare(`
        SELECT COUNT(*) as c FROM requests
        WHERE user_id = ? AND status NOT IN ('fees_received','rejected','draft')
      `).get(emp.id).c;
      const completed = db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status = 'fees_received'").get(emp.id).c;
      const approved = db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status = 'approved'").get(emp.id).c;
      const rejected = db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status = 'rejected'").get(emp.id).c;
      const missing = db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status = 'missing'").get(emp.id).c;

      // Last activity date
      const lastActivity = db.prepare(`
        SELECT MAX(updated_at) as last_at FROM requests WHERE user_id = ?
      `).get(emp.id)?.last_at;

      // Active requests with funding entity
      const activeRequests = db.prepare(`
        SELECT r.id, r.company_name, r.status, r.entity_type,
               fe.name as funding_entity_name
        FROM requests r
        LEFT JOIN funding_entities fe ON r.funding_entity_id = fe.id
        WHERE r.user_id = ? AND r.status NOT IN ('fees_received','rejected','draft')
        ORDER BY r.updated_at DESC
        LIMIT 5
      `).all(emp.id);

      // Rejected with reasons
      const rejectedRequests = db.prepare(`
        SELECT r.id, r.company_name, r.rejection_reason, r.updated_at
        FROM requests r
        WHERE r.user_id = ? AND r.status = 'rejected'
        ORDER BY r.updated_at DESC
      `).all(emp.id);

      return {
        ...emp,
        stats: { totalReqs, inProgress, completed, approved, rejected, missing },
        last_activity: lastActivity || null,
        active_requests: activeRequests,
        rejected_requests: rejectedRequests
      };
    });

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في استرجاع إحصائيات الموظفين' });
  }
});

// GET team overview: employees, partners (active/inactive), funding entities distribution
router.get('/team-overview', adminMiddleware, (req, res) => {
  try {
    const INACTIVE_DAYS = 30; // number of days without activity to consider "inactive"

    // ---- Employees ----
    const employees = db.prepare(`
      SELECT
        u.id, u.name, u.email, u.phone, u.status, u.created_at,
        COUNT(r.id) as total_requests,
        MAX(r.updated_at) as last_activity
      FROM users u
      LEFT JOIN requests r ON u.id = r.user_id
      WHERE u.role = 'employee'
      GROUP BY u.id
      ORDER BY total_requests DESC, u.name
    `).all().map(e => ({
      ...e,
      in_progress: db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status NOT IN ('fees_received','rejected','draft')").get(e.id).c,
      completed: db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status IN ('fees_received','approved')").get(e.id).c,
    }));

    // ---- Partners (active vs inactive) ----
    const partners = db.prepare(`
      SELECT
        u.id, u.name, u.email, u.phone, u.partner_type, u.status, u.created_at,
        COUNT(r.id) as total_requests,
        MAX(r.updated_at) as last_activity,
        MAX(r.created_at) as last_request_created
      FROM users u
      LEFT JOIN requests r ON u.id = r.user_id
      WHERE u.role IN ('partner', 'company')
      GROUP BY u.id
      ORDER BY last_activity DESC NULLS LAST, u.name
    `).all().map(p => {
      const daysSinceActivity = p.last_activity
        ? Math.floor((Date.now() - new Date(p.last_activity).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        ...p,
        in_progress: db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status NOT IN ('fees_received','rejected','draft')").get(p.id).c,
        completed: db.prepare("SELECT COUNT(*) as c FROM requests WHERE user_id = ? AND status IN ('fees_received','approved')").get(p.id).c,
        days_since_activity: daysSinceActivity,
        is_active: daysSinceActivity !== null ? daysSinceActivity < INACTIVE_DAYS : false
      };
    });

    // ---- Funding Entities distribution ----
    const fundingEntities = db.prepare(`
      SELECT
        fe.id, fe.name, fe.priority, fe.is_active, fe.whatsapp_number,
        COUNT(r.id) as total_submitted,
        SUM(CASE WHEN r.status IN ('file_submitted','submitted','approved','transferred','fees_received') THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN r.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN r.status = 'missing' THEN 1 ELSE 0 END) as missing_count,
        MAX(r.updated_at) as last_submission
      FROM funding_entities fe
      LEFT JOIN requests r ON fe.id = r.funding_entity_id
      WHERE fe.is_active = 1
      GROUP BY fe.id
      ORDER BY total_submitted DESC, fe.priority DESC
    `).all();

    res.json({
      employees,
      partners: {
        all: partners,
        active: partners.filter(p => p.is_active),
        inactive: partners.filter(p => !p.is_active),
      },
      funding_entities: fundingEntities,
      inactive_threshold_days: INACTIVE_DAYS
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في تحميل البيانات: ' + err.message });
  }
});

module.exports = router;
