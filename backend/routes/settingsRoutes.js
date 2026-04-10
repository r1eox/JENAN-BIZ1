const express = require('express');
const db = require('../database');
const { adminMiddleware } = require('../middleware/authMiddleware');
const { testConnection } = require('../services/aiService');

const router = express.Router();

// GET /api/settings - admin gets all settings
router.get('/', adminMiddleware, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const result = {};
    rows.forEach(r => {
      result[r.key] = r.key === 'ai_api_key' && r.value ? '••••••••' : r.value;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع الإعدادات' });
  }
});

// PUT /api/settings - update settings
router.put('/', adminMiddleware, (req, res) => {
  try {
    const updates = req.body;
    
    // Process each setting individually
    for (const [key, value] of Object.entries(updates)) {
      // Don't overwrite API key with masked value
      if (key === 'ai_api_key' && value === '••••••••') continue;
      
      // Skip undefined or null values
      if (value === undefined || value === null) continue;
      
      // Upsert the setting
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))")
        .run(key, String(value));
    }
    
    res.json({ message: 'تم حفظ الإعدادات بنجاح' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'خطأ في حفظ الإعدادات: ' + err.message });
  }
});

// GET /api/settings/ai-models
router.get('/ai-models', adminMiddleware, (req, res) => {
  res.json({
    models: [
      { id: 'gpt-4o', name: 'GPT-4o — الأدق والأفضل (موصى به)', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini — أسرع وأقل تكلفة', provider: 'openai' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
    ],
    recommended: 'gpt-4o',
    note: 'GPT-4o هو الأدق عالمياً في تحليل المستندات والكشوفات البنكية. احصل على مفتاح API من: https://platform.openai.com/api-keys'
  });
});

// POST /api/settings/test-ai
router.post('/test-ai', adminMiddleware, async (req, res) => {
  try {
    const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get();
    const apiKey = keyRow?.value;
    if (!apiKey) return res.status(400).json({ error: 'لم يتم إدخال مفتاح الذكاء الاصطناعي بعد' });

    const result = await testConnection(apiKey);
    res.json({ message: 'الاتصال بالذكاء الاصطناعي ناجح ✅', response: result });
  } catch (err) {
    res.status(400).json({ error: `فشل الاتصال: ${err.message}` });
  }
});

// GET /api/settings/public
router.get('/public', (req, res) => {
  try {
    const name = db.prepare("SELECT value FROM settings WHERE key = 'platform_name'").get();
    res.json({ platform_name: name?.value || 'منصة جنان بيز حلول الأعمال' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ' });
  }
});

module.exports = router;
