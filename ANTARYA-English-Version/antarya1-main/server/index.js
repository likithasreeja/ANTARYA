// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const customerRoutes = require('./routes/customers');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const complaintRoutes = require('./routes/complaints');
const mlRoutes = require('./routes/ml');
const learningRoutes = require('./routes/learning');
const paymentRoutes = require('./routes/payments');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Larger limit for audio data

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/learning', learningRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Antarya API',
    version: '2.0.0',
    ai: {
      gemini: !!process.env.GEMINI_API_KEY,
      bhashini: !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY)
    }
  });
});

const PORT = process.env.PORT || 5001;

// Connect DB, then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🏪 ANTARYA Server running on http://localhost:${PORT}`);
    console.log(`   Dukan Ka Dimaag is ready!\n`);
    console.log(`   🧠 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Connected' : '❌ No API key (set GEMINI_API_KEY in .env)'}`);
    console.log(`   🗣️ Bhashini:  ${process.env.BHASHINI_USER_ID ? '✅ Connected' : '❌ No API key (set BHASHINI_USER_ID in .env)'}`);
    console.log('');
  });
});
