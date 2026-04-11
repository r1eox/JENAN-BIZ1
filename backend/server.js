const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

require('./database');

const app = express();

// Create upload directories
['uploads/bank-statements', 'uploads/documents', 'uploads/complete-files', 'uploads/contracts'].forEach(dir => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'طلبات كثيرة، الرجاء المحاولة بعد 15 دقيقة' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'محاولات دخول كثيرة، الرجاء الانتظار 15 دقيقة' }
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost port
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    // Allow configured frontend URLs (single FRONTEND_URL or comma-separated FRONTEND_URLS)
    const allowlist = new Set(
      [
        process.env.FRONTEND_URL,
        ...(process.env.FRONTEND_URLS || '').split(',').map(v => v.trim())
      ].filter(Boolean)
    );
    if (allowlist.has(origin)) return callback(null, true);

    // Backward-compatible default for local development
    if (origin === 'http://localhost:5173') return callback(null, true);
    callback(new Error('CORS: origin not allowed'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/requests', apiLimiter, require('./routes/requestRoutes'));
app.use('/api/admin', apiLimiter, require('./routes/adminRoutes'));
app.use('/api/admin', apiLimiter, require('./routes/companiesRoutes'));
app.use('/api/settings', apiLimiter, require('./routes/settingsRoutes'));
app.use('/api/campaigns', apiLimiter, require('./routes/campaignRoutes'));
app.use('/api/brokers', apiLimiter, require('./routes/brokerRoutes'));
app.use('/api/attendance', apiLimiter, require('./routes/attendanceRoutes'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'منصة جنان بيز حلول الأعمال', time: new Date().toISOString() });
});

// Serve built frontend in production
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 منصة جنان بيز حلول الأعمال تعمل على المنفذ ${PORT}`);
});
