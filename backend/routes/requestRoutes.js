const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const db = require('../database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// File upload configs
const makeStorage = (subDir) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads', subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase().slice(1))) return cb(null, true);
  cb(new Error('نوع الملف غير مدعوم. المسموح: PDF, JPG, PNG, WEBP'));
};

const bankUpload = multer({ storage: makeStorage('bank-statements'), fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });
const docUpload = multer({ storage: makeStorage('documents'), fileFilter, limits: { fileSize: 15 * 1024 * 1024 } });
const completeUpload = multer({ storage: makeStorage('complete-files'), limits: { fileSize: 100 * 1024 * 1024 } });
const contractUpload = multer({ storage: makeStorage('contracts'), limits: { fileSize: 20 * 1024 * 1024 } });
const accountUpload = multer({ storage: makeStorage('account-statements'), fileFilter: (req, file, cb) => {
  const allowed = /xlsx|xls/;
  if (allowed.test(path.extname(file.originalname).toLowerCase().slice(1))) return cb(null, true);
  cb(new Error('نوع الملف غير مدعوم. المسموح: XLSX, XLS'));
}, limits: { fileSize: 25 * 1024 * 1024 } });
const taxUpload = multer({ storage: makeStorage('tax-documents'), fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });

// Helper: check eligibility against funding entities
function checkEligibility(totalPos, totalDeposit, totalTransfer, months, fundingType, bankName = '', recordAgeMonths = 0, ownershipType = 'سعودي', entityType = 'شركة') {
  const entities = db.prepare('SELECT * FROM funding_entities WHERE is_active = 1 ORDER BY priority DESC').all();
  let eligibleEntities = [];
  let eligibleTypes = ['نقاط بيع', 'كاش', 'إقرارات ضريبية', 'رهن', 'أسطول', 'تمويل شخصي', 'عقار', 'تمويل تجاري'];

  if (fundingType === 'نقاط بيع') {
    // Special logic for نقاط بيع
    const isRajhi = bankName && bankName.toLowerCase().includes('راجحي');
    const posLast12Months = totalPos; // Assume totalPos is for last 12 months
    const isSaudi = ownershipType === 'سعودي';
    const isIndividualOrInstitution = ['شخص واحد', 'مؤسسة'].includes(entityType);

    if (posLast12Months >= 1500000) {
      // Eligible for مصرف الراجحي regardless of bank
      eligibleEntities = entities.filter(e => e.name.toLowerCase().includes('راجحي'));
    } else if (posLast12Months >= 700000 && recordAgeMonths >= 7 && isRajhi) {
      // Eligible for أمكان or مصرف الراجحي, but أمكان only for Saudi individual/institution
      let candidates = entities.filter(e => e.name.toLowerCase().includes('راجحي'));
      if (isSaudi && isIndividualOrInstitution) {
        candidates = candidates.concat(entities.filter(e => e.name.toLowerCase().includes('أمكان')));
      }
      eligibleEntities = candidates;
    } else if (!isRajhi && posLast12Months >= 500000 && posLast12Months < 1000000 && recordAgeMonths >= 24) {
      // Eligible for شركة الأولى للتمويل
      eligibleEntities = entities.filter(e => e.name.toLowerCase().includes('الأولى'));
    } else {
      // Not eligible for نقاط بيع
      eligibleTypes = eligibleTypes.filter(t => t !== 'نقاط بيع');
      eligibleEntities = [];
    }
  } else {
    // Other funding types will be handled later via admin configuration and AI
    eligibleTypes = eligibleTypes.filter(t => t !== fundingType);
    eligibleEntities = [];
  }

  return { entities: eligibleEntities, types: eligibleTypes };
}

// Helper: check and update docs status
function checkAndUpdateDocStatus(requestId) {
  const docs = db.prepare('SELECT * FROM request_documents WHERE request_id = ?').all(requestId);
  if (docs.length === 0) return;
  const allUploaded = docs.every(d => d.file_path !== null);
  const allValid = docs.every(d => d.status === 'valid');
  if (allUploaded && allValid) {
    db.prepare("UPDATE requests SET status = 'docs_ready', updated_at = datetime('now') WHERE id = ?").run(requestId);
  }
}

// GET /api/requests/partners-list — list of approved partners (for broker dropdown)
router.get('/partners-list', authMiddleware, (req, res) => {
  try {
    const partners = db.prepare(`
      SELECT id, name, phone, partner_type FROM users
      WHERE role = 'partner' AND status = 'approved'
      ORDER BY name
    `).all();
    res.json(partners);
  } catch (err) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// GET /api/requests
router.get('/', authMiddleware, (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT r.*,
             fe.name as funding_entity_name,
             p.name as referred_by_name,
             p.phone as referred_by_phone,
             (SELECT COUNT(*) FROM request_documents rd WHERE rd.request_id = r.id) as doc_total,
             (SELECT COUNT(*) FROM request_documents rd WHERE rd.request_id = r.id AND rd.status = 'valid') as doc_valid,
             (SELECT json_group_array(json_object('id', bs.id, 'file_name', bs.file_name)) FROM bank_statements bs WHERE bs.request_id = r.id) as bank_statements,
             (SELECT json_group_array(json_object('id', acs.id, 'file_name', acs.file_name)) FROM account_statements acs WHERE acs.request_id = r.id) as account_statements,
             (SELECT json_group_array(json_object('id', td.id, 'file_name', td.file_name)) FROM tax_documents td WHERE td.request_id = r.id) as tax_documents
      FROM requests r
      LEFT JOIN funding_entities fe ON r.funding_entity_id = fe.id
      LEFT JOIN users p ON r.referred_by_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.updated_at DESC
    `).all(req.user.id);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في استرجاع الطلبات' });
  }
});

// POST /api/requests
router.post('/', authMiddleware, (req, res) => {
  try {
    const { funding_type, company_name, entity_type, ownership_type, owners_count, owner_name, owner_phone, referred_by_id } = req.body;
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ error: 'اسم الشركة / المؤسسة مطلوب' });
    }
    // Validate partner if provided
    let partnerId = null;
    if (referred_by_id) {
      const partner = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'partner' AND status = 'approved'").get(referred_by_id);
      if (partner) partnerId = partner.id;
    }
    const result = db.prepare(`
      INSERT INTO requests (user_id, funding_type, company_name, entity_type, ownership_type, owners_count, owner_name, owner_phone, referred_by_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(req.user.id, funding_type || 'نقاط بيع', company_name.trim(), entity_type || 'شركة', ownership_type || 'سعودي', owners_count || 'شخص واحد', owner_name || null, owner_phone || null, partnerId);

    const reqId = result.lastInsertRowid;

    // Auto-save to companies registry
    db.prepare(`
      INSERT INTO companies (company_name, entity_type, owner_name, owner_phone, request_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(company_name.trim(), entity_type || 'شركة', owner_name || null, owner_phone || null, reqId, req.user.id);

    const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(reqId);
    res.status(201).json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في إنشاء الطلب' });
  }
});

// GET /api/requests/unread-summary — إجمالي الرسائل غير المقروءة (للـ navbar)
router.get('/unread-summary', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    // رسائل جماعية غير مقروءة
    const broadcastRow = db.prepare('SELECT last_read_at FROM broadcast_message_reads WHERE user_id = ?').get(userId);
    const lastBroadcastRead = broadcastRow?.last_read_at || '1970-01-01T00:00:00.000Z';
    const broadcastAud = req.user.role === 'employee' ? ['all', 'employee'] : ['all', 'partner'];
    const broadcastUnread = db.prepare(
      `SELECT COUNT(*) AS c FROM broadcast_messages WHERE target_audience IN (?,?) AND created_at > ?`
    ).get(broadcastAud[0], broadcastAud[1], lastBroadcastRead).c;

    // رسائل طلبات غير مقروءة (الطرف الآخر فقط)
    const requestUnread = db.prepare(`
      SELECT COUNT(*) AS c
      FROM request_messages m
      JOIN requests r ON r.id = m.request_id
      LEFT JOIN request_message_reads rmr ON rmr.user_id = ? AND rmr.request_id = m.request_id
      WHERE r.user_id = ?
        AND m.sender_id != ?
        AND (rmr.last_read_at IS NULL OR m.created_at > rmr.last_read_at)
    `).get(userId, userId, userId).c;

    res.json({
      broadcast_unread: broadcastUnread,
      request_unread: requestUnread,
      total: broadcastUnread + requestUnread
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع الإشعارات' });
  }
});

// GET /api/requests/broadcast-messages
// رسائل جماعية موجهة للموظفين/الشركاء أو للجميع
router.get('/broadcast-messages', authMiddleware, (req, res) => {
  try {
    let query = '';
    if (req.user.role === 'employee') {
      query = `
        SELECT bm.*, u.name AS created_by_name
        FROM broadcast_messages bm
        LEFT JOIN users u ON u.id = bm.created_by
        WHERE bm.target_audience IN ('all', 'employee')
        ORDER BY bm.created_at DESC
        LIMIT 50
      `;
    } else {
      query = `
        SELECT bm.*, u.name AS created_by_name
        FROM broadcast_messages bm
        LEFT JOIN users u ON u.id = bm.created_by
        WHERE bm.target_audience IN ('all', 'partner')
        ORDER BY bm.created_at DESC
        LIMIT 50
      `;
    }
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع الرسائل الجماعية' });
  }
});

// GET /api/requests/broadcast-messages/read-state
router.get('/broadcast-messages/read-state', authMiddleware, (req, res) => {
  try {
    const row = db.prepare('SELECT last_read_at FROM broadcast_message_reads WHERE user_id = ?').get(req.user.id);
    res.json({ last_read_at: row?.last_read_at || null });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع حالة القراءة' });
  }
});

// POST /api/requests/broadcast-messages/mark-read
router.post('/broadcast-messages/mark-read', authMiddleware, (req, res) => {
  try {
    const { last_read_at } = req.body;
    const readAt = last_read_at || new Date().toISOString();
    db.prepare(`
      INSERT INTO broadcast_message_reads (user_id, last_read_at)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET last_read_at = excluded.last_read_at
    `).run(req.user.id, readAt);
    res.json({ message: 'تم تحديث قراءة الرسائل الجماعية', last_read_at: readAt });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث حالة القراءة' });
  }
});

// GET /api/requests/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const request = db.prepare(`
      SELECT r.*, fe.name as funding_entity_name, fe.whatsapp_number as fe_whatsapp,
             fe.required_documents as fe_required_docs,
             u.name as user_name, u.phone as user_phone, u.email as user_email,
             p.name as referred_by_name, p.phone as referred_by_phone, p.partner_type as referred_by_type
      FROM requests r
      LEFT JOIN funding_entities fe ON r.funding_entity_id = fe.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users p ON r.referred_by_id = p.id
      WHERE r.id = ? AND (r.user_id = ? OR ? = 'admin')
    `).get(req.params.id, req.user.id, req.user.role);

    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    const bankStatements = db.prepare('SELECT * FROM bank_statements WHERE request_id = ? ORDER BY uploaded_at').all(req.params.id);
    const accountStatements = db.prepare('SELECT * FROM account_statements WHERE request_id = ? ORDER BY uploaded_at').all(req.params.id);
    const taxDocuments = db.prepare('SELECT * FROM tax_documents WHERE request_id = ? ORDER BY uploaded_at').all(req.params.id);
    const taxDeclarations = db.prepare('SELECT * FROM tax_declarations WHERE request_id = ? ORDER BY year_label, uploaded_at').all(req.params.id);
    const financialStatements = db.prepare('SELECT * FROM financial_statements_new WHERE request_id = ? ORDER BY year_label, uploaded_at').all(req.params.id);
    const submissionPkg = db.prepare('SELECT * FROM submission_packages WHERE request_id = ?').get(req.params.id);
    const documents = db.prepare('SELECT * FROM request_documents WHERE request_id = ? ORDER BY id').all(req.params.id);
    const statusHistory = db.prepare(`
      SELECT sh.*, u.name as created_by_name
      FROM status_history sh
      LEFT JOIN users u ON sh.created_by = u.id
      WHERE sh.request_id = ? ORDER BY sh.created_at DESC
    `).all(req.params.id);

    let analysisResult = {};
    try { analysisResult = JSON.parse(request.analysis_result || '{}'); } catch (e) {}

    res.json({ ...request, analysis_result: analysisResult, bank_statements: bankStatements, account_statements: accountStatements, tax_documents: taxDocuments, tax_declarations: taxDeclarations, financial_statements: financialStatements, submission_package: submissionPkg, documents, status_history: statusHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في استرجاع الطلب' });
  }
});

// POST /api/requests/:id/bank-statements
router.post('/:id/bank-statements', authMiddleware, bankUpload.array('files', 15), async (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });

    const inserted = [];
    for (const file of req.files) {
      const r = db.prepare(`
        INSERT INTO bank_statements (request_id, file_path, file_name, analysis_status)
        VALUES (?, ?, ?, 'pending')
      `).run(req.params.id, file.path, file.originalname);
      inserted.push({ id: r.lastInsertRowid, file_name: file.originalname });
    }

    db.prepare("UPDATE requests SET status = 'bank_uploaded', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ message: `تم رفع ${req.files.length} كشف بنجاح`, statements: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في رفع الملفات' });
  }
});

// POST /api/requests/:id/account-statements
router.post('/:id/account-statements', authMiddleware, accountUpload.array('files', 15), async (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });

    const inserted = [];
    for (const file of req.files) {
      const r = db.prepare(`
        INSERT INTO account_statements (request_id, file_path, file_name)
        VALUES (?, ?, ?)
      `).run(req.params.id, file.path, file.originalname);
      inserted.push({ id: r.lastInsertRowid, file_name: file.originalname });
    }

    res.json({ message: `تم رفع ${req.files.length} كشف حساب بنجاح`, statements: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في رفع الملفات' });
  }
});

// POST /api/requests/:id/tax-documents
router.post('/:id/tax-documents', authMiddleware, taxUpload.array('files', 15), async (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });

    const inserted = [];
    for (const file of req.files) {
      const r = db.prepare(`
        INSERT INTO tax_documents (request_id, file_path, file_name)
        VALUES (?, ?, ?)
      `).run(req.params.id, file.path, file.originalname);
      inserted.push({ id: r.lastInsertRowid, file_name: file.originalname });
    }

    res.json({ message: `تم رفع ${req.files.length} وثيقة ضريبية بنجاح`, documents: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في رفع الملفات' });
  }
});

// POST /api/requests/:id/select-entity
router.post('/:id/select-entity', authMiddleware, (req, res) => {
  try {
    const { funding_entity_id } = req.body;
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    const entity = db.prepare('SELECT * FROM funding_entities WHERE id = ?').get(funding_entity_id);
    if (!entity) return res.status(404).json({ error: 'الجهة التمويلية غير موجودة' });

    const requiredDocs = JSON.parse(entity.required_documents || '[]');

    // Reset documents for new entity selection
    db.prepare('DELETE FROM request_documents WHERE request_id = ?').run(req.params.id);
    const insertDoc = db.prepare("INSERT INTO request_documents (request_id, document_name, status) VALUES (?, ?, 'missing')");
    for (const docName of requiredDocs) {
      insertDoc.run(req.params.id, docName);
    }

    db.prepare("UPDATE requests SET funding_entity_id = ?, status = 'docs_pending', updated_at = datetime('now') WHERE id = ?").run(funding_entity_id, req.params.id);

    res.json({ message: 'تم اختيار الجهة التمويلية', required_documents: requiredDocs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في اختيار الجهة' });
  }
});

// POST /api/requests/:id/documents/:docId/upload
router.post('/:id/documents/:docId/upload', authMiddleware, docUpload.single('file'), async (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    const doc = db.prepare('SELECT * FROM request_documents WHERE id = ? AND request_id = ?').get(req.params.docId, req.params.id);
    if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع الملف' });

    // حفظ الملف مباشرة — الإداري يراجع الصلاحية
    db.prepare(`
      UPDATE request_documents SET
        file_path = ?, file_name = ?, expiry_date = NULL, status = 'valid', uploaded_at = datetime('now')
      WHERE id = ?
    `).run(req.file.path, req.file.originalname, req.params.docId);

    checkAndUpdateDocStatus(req.params.id);

    res.json({ message: 'تم رفع المستند بنجاح', status: 'valid' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في رفع المستند' });
  }
});

// POST /api/requests/:id/mark-forms-sent
router.post('/:id/mark-forms-sent', authMiddleware, (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    db.prepare("UPDATE requests SET status = 'forms_sent', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ message: 'تم تأكيد رفع النماذج للجهة التمويلية' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// POST /api/requests/:id/submit-file
router.post('/:id/submit-file', authMiddleware, completeUpload.single('file'), (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.originalname : null;

    db.prepare(`
      UPDATE requests SET
        status = 'file_submitted',
        complete_file_path = ?,
        complete_file_name = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(filePath, fileName, req.params.id);

    db.prepare('INSERT INTO status_history (request_id, status, note, created_by) VALUES (?, ?, ?, ?)').run(
      req.params.id, 'file_submitted', 'تم رفع الملف الكامل من الموظف', req.user.id
    );

    res.json({ message: 'تم إرسال الملف للمدير بنجاح. سيتم مراجعته قريباً.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في إرسال الملف' });
  }
});

// POST /api/requests/:id/submit-missing
router.post('/:id/submit-missing', authMiddleware, (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    db.prepare("UPDATE requests SET status = 'missing_submitted', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO status_history (request_id, status, note, created_by) VALUES (?, ?, ?, ?)').run(
      req.params.id, 'missing_submitted', 'تم إرسال النواقص من الموظف', req.user.id
    );

    res.json({ message: 'تم إرسال النواقص للمدير بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// POST /api/requests/:id/upload-consultation-contract — employee uploads consultation contract
router.post('/:id/upload-consultation-contract', authMiddleware, contractUpload.single('file'), (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });

    // Save to contracts table
    db.prepare(
      'INSERT INTO contracts (request_id, contract_type, file_path, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, 'consultation', req.file.path, req.file.originalname, req.user.id);

    // Update request columns for quick access
    db.prepare(`
      UPDATE requests SET
        consultation_contract_path = ?,
        consultation_contract_name = ?,
        status = 'contract_submitted',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.file.path, req.file.originalname, req.params.id);

    db.prepare('INSERT INTO status_history (request_id, status, note, created_by) VALUES (?, ?, ?, ?)').run(
      req.params.id, 'contract_submitted', 'تم رفع عقد الاستشارات وإرساله للمدير', req.user.id
    );

    res.json({ message: 'تم رفع عقد الاستشارات بنجاح وإرساله للمدير' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في رفع العقد' });
  }
});

// POST /api/requests/:id/request-delete
router.post('/:id/request-delete', authMiddleware, (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (['approved', 'transferred', 'fees_received'].includes(request.status)) {
      return res.status(400).json({ error: 'لا يمكن حذف طلب تمت الموافقة عليه' });
    }
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'سبب الحذف مطلوب' });

    db.prepare(`UPDATE requests SET status = 'delete_requested', delete_reason = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(reason.trim(), req.params.id);
    db.prepare('INSERT INTO status_history (request_id, status, note, created_by) VALUES (?, ?, ?, ?)')
      .run(req.params.id, 'delete_requested', `طلب حذف - السبب: ${reason.trim()}`, req.user.id);

    res.json({ message: 'تم إرسال طلب الحذف للمدير' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إرسال طلب الحذف' });
  }
});

// GET /api/requests/clients-summary - list of companies submitted to funding
router.get('/clients-summary/all', authMiddleware, (req, res) => {
  try {
    const clients = db.prepare(`
      SELECT DISTINCT
        r.id,
        r.company_name,
        r.owner_name,
        r.owner_phone,
        r.entity_type,
        r.created_at,
        r.total_deposit,
        r.total_transfer,
        r.funding_entity_id,
        fe.name as funding_entity_name,
        r.status
      FROM requests r
      LEFT JOIN funding_entities fe ON r.funding_entity_id = fe.id
      WHERE r.user_id = ? AND r.status = 'submitted' OR r.status = 'approved' OR r.status = 'transferred' OR r.status = 'fees_received'
      ORDER BY r.created_at DESC
    `).all(req.user.id);
    
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في استرجاع البيانات' });
  }
});

// ─── رفع إقرار ضريبي بسنة محددة ─────────────────────────────────────────────
const taxDeclUpload = multer({ storage: makeStorage('tax-declarations'), fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });
router.post('/:id/tax-declarations', authMiddleware, taxDeclUpload.single('file'), (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    const yearLabel = req.body.year_label || 'السنة الأولى';

    // حذف الإقرار القديم لنفس السنة إن وجد
    const old = db.prepare('SELECT * FROM tax_declarations WHERE request_id = ? AND year_label = ?').get(req.params.id, yearLabel);
    if (old && old.file_path && fs.existsSync(old.file_path)) { try { fs.unlinkSync(old.file_path); } catch (_) {} }
    db.prepare('DELETE FROM tax_declarations WHERE request_id = ? AND year_label = ?').run(req.params.id, yearLabel);

    const r = db.prepare('INSERT INTO tax_declarations (request_id, file_path, file_name, year_label) VALUES (?, ?, ?, ?)').run(req.params.id, req.file.path, req.file.originalname, yearLabel);
    res.json({ id: r.lastInsertRowid, file_name: req.file.originalname, year_label: yearLabel, message: `تم رفع ${yearLabel} بنجاح` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الرفع' });
  }
});

// ─── رفع قائمة مالية بسنة محددة ──────────────────────────────────────────────
const finStmtUpload = multer({ storage: makeStorage('financial-statements'), fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });
router.post('/:id/financial-statements', authMiddleware, finStmtUpload.single('file'), (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    const yearLabel = req.body.year_label || 'السنة الأولى';

    const old = db.prepare('SELECT * FROM financial_statements_new WHERE request_id = ? AND year_label = ?').get(req.params.id, yearLabel);
    if (old && old.file_path && fs.existsSync(old.file_path)) { try { fs.unlinkSync(old.file_path); } catch (_) {} }
    db.prepare('DELETE FROM financial_statements_new WHERE request_id = ? AND year_label = ?').run(req.params.id, yearLabel);

    const r = db.prepare('INSERT INTO financial_statements_new (request_id, file_path, file_name, year_label) VALUES (?, ?, ?, ?)').run(req.params.id, req.file.path, req.file.originalname, yearLabel);
    res.json({ id: r.lastInsertRowid, file_name: req.file.originalname, year_label: yearLabel, message: `تم رفع ${yearLabel} بنجاح` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الرفع' });
  }
});

// ─── تجميع وإرسال التقديم النهائي (3 ملفات ZIP) ─────────────────────────────
router.post('/:id/finalize-submission', authMiddleware, async (req, res) => {
  try {
    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    const submissionsDir = path.join(__dirname, '../uploads/submissions', String(req.params.id));
    if (!fs.existsSync(submissionsDir)) fs.mkdirSync(submissionsDir, { recursive: true });

    // دالة مساعدة لإنشاء ZIP
    const createZip = (zipPath, fileEntries) => new Promise((resolve, reject) => {
      if (!fileEntries || fileEntries.length === 0) { resolve(null); return; }
      const output = fs.createWriteStream(zipPath);
      const arc = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve(zipPath));
      arc.on('error', reject);
      arc.pipe(output);
      for (const entry of fileEntries) {
        if (entry.file_path && fs.existsSync(entry.file_path)) {
          arc.file(entry.file_path, { name: entry.file_name || path.basename(entry.file_path) });
        }
      }
      arc.finalize();
    });

    // ملف 1: المستندات
    const docs = db.prepare('SELECT * FROM request_documents WHERE request_id = ? AND file_path IS NOT NULL').all(req.params.id);
    const docsZipPath = path.join(submissionsDir, 'المستندات.zip');
    const docsZip = await createZip(docsZipPath, docs).catch(() => null);

    // ملف 2: الكشوفات (بنكية + حساب)
    const bankStmts = db.prepare('SELECT * FROM bank_statements WHERE request_id = ?').all(req.params.id);
    const accStmts = db.prepare('SELECT * FROM account_statements WHERE request_id = ?').all(req.params.id);
    const statementsAll = [...bankStmts, ...accStmts];
    const stmtsZipPath = path.join(submissionsDir, 'الكشوفات.zip');
    const stmtsZip = await createZip(stmtsZipPath, statementsAll).catch(() => null);

    // ملف 3: الإقرارات الضريبية + القوائم المالية
    const taxDecls = db.prepare('SELECT * FROM tax_declarations WHERE request_id = ?').all(req.params.id);
    const finStmts = db.prepare('SELECT * FROM financial_statements_new WHERE request_id = ?').all(req.params.id);
    const financialsAll = [...taxDecls, ...finStmts];
    const finZipPath = path.join(submissionsDir, 'القوائم_والاقرارات.zip');
    const finZip = await createZip(finZipPath, financialsAll).catch(() => null);

    // حفظ مسارات الملفات
    db.prepare(`
      INSERT INTO submission_packages (request_id, documents_zip_path, statements_zip_path, financials_zip_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        documents_zip_path = excluded.documents_zip_path,
        statements_zip_path = excluded.statements_zip_path,
        financials_zip_path = excluded.financials_zip_path,
        submitted_at = datetime('now')
    `).run(req.params.id, docsZip, stmtsZip, finZip);

    // تحديث حالة الطلب
    db.prepare("UPDATE requests SET status = 'file_submitted', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO status_history (request_id, status, note, created_by) VALUES (?, ?, ?, ?)').run(
      req.params.id, 'file_submitted', 'تم إرسال ملف التقديم الكامل (3 ملفات) للمدير', req.user.id
    );

    res.json({ message: 'تم إرسال الطلب للمدير بنجاح كـ 3 ملفات', docs_zip: !!docsZip, statements_zip: !!stmtsZip, financials_zip: !!finZip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في إنشاء ملفات التقديم' });
  }
});

// ─── الرسائل بين الموظف والأدمن ─────────────────────────────────────────────
// GET /:id/messages — عرض رسائل الطلب
router.get('/:id/messages', authMiddleware, (req, res) => {
  try {
    const request = db.prepare('SELECT id FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    const messages = db.prepare(
      'SELECT m.id, m.message, m.sender_role, m.created_at, u.name AS sender_name FROM request_messages m JOIN users u ON u.id = m.sender_id WHERE m.request_id = ? ORDER BY m.created_at ASC'
    ).all(req.params.id);
    res.json(messages);
  } catch (err) { res.status(500).json({ error: 'خطأ في استرجاع الرسائل' }); }
});

// POST /:id/messages — إرسال رسالة من الموظف
router.post('/:id/messages', authMiddleware, (req, res) => {
  try {
    const request = db.prepare('SELECT id FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'الرسالة فارغة' });
    const senderRole = (req.user.role === 'partner' || req.user.role === 'company') ? 'partner' : 'employee';
    const r = db.prepare('INSERT INTO request_messages (request_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)').run(req.params.id, req.user.id, senderRole, message.trim());
    const msg = db.prepare('SELECT m.id, m.message, m.sender_role, m.created_at, u.name AS sender_name FROM request_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?').get(r.lastInsertRowid);
    res.status(201).json(msg);
  } catch (err) { res.status(500).json({ error: 'خطأ في الإرسال' }); }
});

// GET /:id/messages/read-state
router.get('/:id/messages/read-state', authMiddleware, (req, res) => {
  try {
    const request = db.prepare('SELECT id FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    const row = db.prepare('SELECT last_read_at FROM request_message_reads WHERE user_id = ? AND request_id = ?').get(req.user.id, req.params.id);
    res.json({ last_read_at: row?.last_read_at || null });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع حالة القراءة' });
  }
});

// POST /:id/messages/mark-read
router.post('/:id/messages/mark-read', authMiddleware, (req, res) => {
  try {
    const request = db.prepare('SELECT id FROM requests WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
    const { last_read_at } = req.body;
    const readAt = last_read_at || new Date().toISOString();
    db.prepare(`
      INSERT INTO request_message_reads (user_id, request_id, last_read_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, request_id) DO UPDATE SET last_read_at = excluded.last_read_at
    `).run(req.user.id, req.params.id, readAt);
    res.json({ message: 'تم تحديث قراءة المحادثة', last_read_at: readAt });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث حالة القراءة' });
  }
});

module.exports = router;
