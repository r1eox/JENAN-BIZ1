const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'weseet.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Create tables separately to avoid parsing issues
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  partner_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'عام',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  granted_by INTEGER NOT NULL,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, permission_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS funding_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  min_pos_amount REAL DEFAULT 0,
  min_deposit_amount REAL DEFAULT 0,
  min_transfer_amount REAL DEFAULT 0,
  min_deposit_transfer_amount REAL DEFAULT 0,
  min_months INTEGER DEFAULT 6,
  product_types TEXT DEFAULT '[]',
  required_documents TEXT DEFAULT '[]',
  notes TEXT,
  whatsapp_number TEXT,
  additional_whatsapp_numbers TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS funding_entity_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funding_entity_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  product_types TEXT DEFAULT '[]',
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (funding_entity_id) REFERENCES funding_entities(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  owner_name TEXT,
  owner_phone TEXT,
  entity_type TEXT NOT NULL DEFAULT 'شركة',
  ownership_type TEXT DEFAULT 'سعودي',
  funding_type TEXT DEFAULT 'نقاط بيع',
  status TEXT NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  funding_entity_id INTEGER,
  analysis_result TEXT DEFAULT '{}',
  total_pos REAL DEFAULT 0,
  total_deposit REAL DEFAULT 0,
  total_transfer REAL DEFAULT 0,
  statement_months INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (funding_entity_id) REFERENCES funding_entities(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  entity_type TEXT DEFAULT 'شركة',
  owner_name TEXT,
  owner_phone TEXT,
  request_id INTEGER,
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)`);

db.exec(`CREATE TABLE IF NOT EXISTS bank_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  period_label TEXT DEFAULT '',
  pos_amount REAL DEFAULT 0,
  deposit_amount REAL DEFAULT 0,
  transfer_amount REAL DEFAULT 0,
  analysis_status TEXT DEFAULT 'pending',
  analysis_data TEXT DEFAULT '{}',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS account_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS tax_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  image_path TEXT,
  status TEXT DEFAULT 'draft',
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS request_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  document_name TEXT NOT NULL,
  file_path TEXT,
  file_name TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'missing',
  uploaded_at DATETIME,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS missing_items_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'employee',
  alert_type TEXT NOT NULL DEFAULT 'missing_items',
  missing_items TEXT DEFAULT '[]',
  message TEXT,
  phone_number TEXT NOT NULL,
  alert_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reminder_sent_at DATETIME,
  is_completed INTEGER DEFAULT 0,
  completed_at DATETIME,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
)`);

// Default settings
const defaultSettings = [
  ['ai_provider', 'openai'],
  ['ai_model', 'gpt-4o'],
  ['ai_api_key', ''],
  ['platform_name', 'منصة جنان بيز حلول الأعمال'],
  ['admin_whatsapp', ''],
];
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of defaultSettings) {
  insertSetting.run(key, value);
}

// Default permissions list
const defaultPermissions = [
  // الطلبات
  { key: 'view_all_requests',    label: 'عرض جميع الطلبات',          description: 'يستطيع رؤية طلبات جميع الموظفين والشركاء',       category: 'الطلبات' },
  { key: 'update_request_status',label: 'تحديث حالة الطلبات',         description: 'يستطيع تغيير حالة أي طلب',                      category: 'الطلبات' },
  { key: 'send_missing_docs',    label: 'إرسال نواقص للموظف',         description: 'يستطيع طلب مستندات ناقصة من الموظف',            category: 'الطلبات' },
  // الإرسال
  { key: 'send_to_funding',      label: 'إرسال الملف للجهة التمويلية', description: 'يظهر له زر الإرسال عبر واتساب للجهة التمويلية', category: 'الإرسال' },
  { key: 'send_to_employee',     label: 'التواصل مع الموظف بالواتساب', description: 'يستطيع الضغط على زر واتساب الموظف',            category: 'الإرسال' },
  // المستخدمون
  { key: 'approve_users',        label: 'الموافقة على المستخدمين',     description: 'يستطيع تفعيل أو حظر المستخدمين الجدد',         category: 'المستخدمون' },
  // الجهات التمويلية
  { key: 'manage_funding',       label: 'إدارة الجهات التمويلية',      description: 'يستطيع إضافة وتعديل وحذف الجهات التمويلية',    category: 'الجهات التمويلية' },
  // الإعدادات
  { key: 'manage_settings',      label: 'الوصول للإعدادات',            description: 'يستطيع تعديل إعدادات المنصة والذكاء الاصطناعي', category: 'الإعدادات' },
];

const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (key, label, description, category) VALUES (?, ?, ?, ?)');
for (const p of defaultPermissions) {
  insertPerm.run(p.key, p.label, p.description, p.category);
}

// Default admin
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const hashed = bcrypt.hashSync('Admin@12345', 12);
  db.prepare(`
    INSERT INTO users (name, email, password, role, status)
    VALUES ('المدير الرئيسي', 'admin@weseet.com', ?, 'admin', 'approved')
  `).run(hashed);
  console.log('✅ حساب الأدمن: admin@weseet.com | Admin@12345');
}

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role, partner_type, status, phone)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertUserPermission = db.prepare(`
  INSERT OR IGNORE INTO user_permissions (user_id, permission_key, granted_by)
  VALUES (?, ?, ?)
`);

function seedUser({ name, email, password, role, partnerType = null, status = 'approved', phone = null }) {
  const hashed = bcrypt.hashSync(password, 12);
  insertUser.run(name, email, hashed, role, partnerType, status, phone);
  return db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);
}

const primaryAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").get();
if (primaryAdmin) {
  seedUser({
    name: 'مدير تجريبي',
    email: 'manager@jenanbiz.com',
    password: 'Manager@12345',
    role: 'admin',
    phone: '0500000001'
  });

  const supervisor = seedUser({
    name: 'مشرف تجريبي',
    email: 'supervisor@jenanbiz.com',
    password: 'Supervisor@12345',
    role: 'employee',
    phone: '0500000002'
  });

  seedUser({
    name: 'موظف تجريبي',
    email: 'employee@jenanbiz.com',
    password: 'Employee@12345',
    role: 'employee',
    phone: '0500000003'
  });

  seedUser({
    name: 'شريك تجريبي',
    email: 'partner@jenanbiz.com',
    password: 'Partner@12345',
    role: 'partner',
    partnerType: 'وسيط',
    phone: '0500000004'
  });

  if (supervisor) {
    const supervisorPermissions = [
      'view_all_requests',
      'update_request_status',
      'send_missing_docs',
      'send_to_funding',
      'send_to_employee'
    ];
    for (const permissionKey of supervisorPermissions) {
      insertUserPermission.run(supervisor.id, permissionKey, primaryAdmin.id);
    }
  }
}

// Migrations — add new columns safely (ignored if already exist)
const migrations = [
  "ALTER TABLE requests ADD COLUMN referred_by_id INTEGER REFERENCES users(id)",
  "ALTER TABLE requests ADD COLUMN complete_file_path TEXT",
  "ALTER TABLE requests ADD COLUMN complete_file_name TEXT",
  "ALTER TABLE requests ADD COLUMN funding_type TEXT DEFAULT 'نقاط بيع'",
  "ALTER TABLE funding_entities ADD COLUMN product_types TEXT DEFAULT '[]'",
  "ALTER TABLE requests ADD COLUMN ownership_type TEXT DEFAULT 'سعودي'",
  "ALTER TABLE funding_entities ADD COLUMN min_deposit_transfer_amount REAL DEFAULT 0",
  "ALTER TABLE funding_entities ADD COLUMN additional_whatsapp_numbers TEXT DEFAULT '[]'",
  "ALTER TABLE requests ADD COLUMN owners_count TEXT DEFAULT 'شخص واحد'",
  "ALTER TABLE requests ADD COLUMN delete_reason TEXT",
  "ALTER TABLE requests ADD COLUMN consultation_contract_path TEXT",
  "ALTER TABLE requests ADD COLUMN consultation_contract_name TEXT",
  "ALTER TABLE requests ADD COLUMN funding_contract_path TEXT",
  "ALTER TABLE requests ADD COLUMN funding_contract_name TEXT"
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
}

// Default funding entities
const defaultEntities = [
  { name: 'مصرف الراجحي', priority: 1, product_types: '["نقاط بيع", "كاش", "أسطول", "إقرارات ضريبية"]', whatsapp_number: '' },
  { name: 'أمكان', priority: 2, product_types: '["نقاط بيع"]', whatsapp_number: '' },
  { name: 'شركة الأولى للتمويل', priority: 3, product_types: '["نقاط بيع", "كاش", "أسطول"]', whatsapp_number: '' },
  { name: 'شركة تأجير', priority: 4, product_types: '["كاش"]', whatsapp_number: '' },
  { name: 'بنك ساب', priority: 5, product_types: '["فواتير"]', whatsapp_number: '' },
  { name: 'شركة التنمية المالية', priority: 6, product_types: '["نقاط بيع", "فواتير"]', whatsapp_number: '' },
  { name: 'شركة كابيتال المالية', priority: 7, product_types: '["كاش", "رهن عقاري", "دعم مشاريع مطورين"]', whatsapp_number: '' }
];

// Clean up duplicates - keep only one instance per entity name
const allEntities = db.prepare('SELECT DISTINCT name FROM funding_entities').all();
for (const entity of allEntities) {
  const records = db.prepare('SELECT id FROM funding_entities WHERE name = ? ORDER BY id DESC').all(entity.name);
  // Keep the first (latest) one, delete the rest
  if (records.length > 1) {
    for (let i = 1; i < records.length; i++) {
      db.prepare('DELETE FROM funding_entities WHERE id = ?').run(records[i].id);
    }
  }
}

const insertEntity = db.prepare('INSERT OR IGNORE INTO funding_entities (name, priority, product_types, min_deposit_transfer_amount, whatsapp_number) VALUES (?, ?, ?, ?, ?)');
for (const e of defaultEntities) {
  insertEntity.run(e.name, e.priority, e.product_types, e.min_deposit_transfer_amount || 0, e.whatsapp_number);
}

// Brokers table (added by employees)
db.exec(`CREATE TABLE IF NOT EXISTS brokers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  added_by_id INTEGER NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (added_by_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// Contracts table (consultation & funding contracts per request)
db.exec(`CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'consultation',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
)`);

// جداول الإقرارات الضريبية والقوائم المالية
db.exec(`CREATE TABLE IF NOT EXISTS tax_declarations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  year_label TEXT NOT NULL DEFAULT 'السنة الأولى',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS financial_statements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  year_label TEXT NOT NULL DEFAULT 'السنة الأولى',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS submission_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL UNIQUE,
  documents_zip_path TEXT,
  statements_zip_path TEXT,
  financials_zip_path TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

// ── جداول الإقرارات الضريبية والقوائم المالية والحزم النهائية ──
db.exec(`CREATE TABLE IF NOT EXISTS tax_declarations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  year_label TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS financial_statements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  year_label TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS submission_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL UNIQUE,
  documents_zip_path TEXT,
  statements_zip_path TEXT,
  financials_zip_path TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

// جدول الرسائل بين الموظف والأدمن
db.exec(`CREATE TABLE IF NOT EXISTS request_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'employee',
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// رسائل جماعية (عروض وتحديثات عامة)
db.exec(`CREATE TABLE IF NOT EXISTS broadcast_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_audience TEXT NOT NULL DEFAULT 'all',
  title TEXT,
  message TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
)`);

// آخر وقت قراءة لرسائل الطلب لكل مستخدم
// نستخدم آخر وقت قراءة بدلاً من حالة لكل رسالة لتبسيط التخزين والحساب
db.exec(`CREATE TABLE IF NOT EXISTS request_message_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  request_id INTEGER NOT NULL,
  last_read_at DATETIME,
  UNIQUE(user_id, request_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)`);

// آخر وقت قراءة للرسائل الجماعية لكل مستخدم
db.exec(`CREATE TABLE IF NOT EXISTS broadcast_message_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  last_read_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// جدول الحضور والانصراف
db.exec(`CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  check_in DATETIME,
  check_out DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

module.exports = db;
