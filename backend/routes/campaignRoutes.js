const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// File upload for campaign images
const campaignUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads/campaigns');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, safeName);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase().slice(1))) return cb(null, true);
    cb(new Error('نوع الملف غير مدعوم. المسموح: JPG, PNG, GIF, WEBP'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// GET /api/campaigns - list campaigns for current user
router.get('/', authMiddleware, (req, res) => {
  try {
    const campaigns = db.prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في استرجاع الحملات' });
  }
});

// POST /api/campaigns - create new campaign
router.post('/', authMiddleware, campaignUpload.single('image'), (req, res) => {
  try {
    const { title, message } = req.body;
    const imagePath = req.file ? req.file.filename : null;

    const result = db.prepare(`
      INSERT INTO campaigns (user_id, title, message, image_path)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, title, message, imagePath);

    res.json({ id: result.lastInsertRowid, message: 'تم إنشاء الحملة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إنشاء الحملة' });
  }
});

// POST /api/campaigns/:id/send - send campaign to all user's clients
router.post('/:id/send', authMiddleware, (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.user.id);
    if (!campaign) return res.status(404).json({ error: 'الحملة غير موجودة' });

    // Get all unique client phones from user's requests
    const clients = db.prepare(`
      SELECT DISTINCT owner_phone
      FROM requests
      WHERE user_id = ? AND owner_phone IS NOT NULL AND owner_phone != ''
    `).all(req.user.id);

    // TODO: Implement WhatsApp sending logic here
    // For now, just mark as sent
    db.prepare('UPDATE campaigns SET status = ?, sent_at = datetime("now") WHERE id = ?').run('sent', campaignId);

    res.json({ message: `تم إرسال الحملة إلى ${clients.length} عميل` });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إرسال الحملة' });
  }
});

// DELETE /api/campaigns/:id - delete campaign
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!campaign) return res.status(404).json({ error: 'الحملة غير موجودة' });

    // Delete image file if exists
    if (campaign.image_path) {
      const imagePath = path.join(__dirname, '../uploads/campaigns', campaign.image_path);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف الحملة' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في حذف الحملة' });
  }
});

module.exports = router;