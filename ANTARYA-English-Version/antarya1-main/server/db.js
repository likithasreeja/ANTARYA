const mongoose = require('mongoose');

const connectDB = async () => {
  console.log('--- Startup Diagnostics ---');
  console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
  console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('PORT:', process.env.PORT || 5001);
  console.log('---------------------------');

  if (process.env.MONGO_URI) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, { family: 4 });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB Connection Error (${process.env.MONGO_URI}): ${error.message}`);
    }
  }

  // Fallback to in-memory DB so dev/local server runs smoothly without requiring Atlas setup
  console.log(`\n⚠️  STARTING LOCAL IN-MEMORY MONGODB FOR DEVELOPMENT...`);
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create({
      instance: { storageEngine: 'wiredTiger' },
      binary: { downloadDir: require('path').join(__dirname, '.cache', 'mongodb-binaries') }
    });
    const memUri = mongoServer.getUri();
    const conn = await mongoose.connect(memUri);
    console.log(`✅ In-Memory MongoDB Connected successfully! (${memUri})`);
  } catch (fallbackError) {
    console.error(`❌ In-Memory MongoDB fallback failed: ${fallbackError.message}`);
    // Try local standard mongodb://127.0.0.1:27017/antarya as secondary fallback
    try {
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/antarya');
      console.log(`✅ Connected to local MongoDB daemon: ${conn.connection.host}`);
    } catch (localErr) {
      console.error(`❌ Fatal: Could not connect to any MongoDB instance.`);
      process.exit(1);
    }
  }
};

const shopSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // keeping id for backward compatibility
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  ownerName: { type: String, required: true },
  city: { type: String },
  setupComplete: { type: Boolean, default: false }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  name: { type: String, required: true },
  nameHindi: { type: String },
  emoji: { type: String, default: '📦' },
  sellingPrice: { type: Number, required: true },
  costPrice: { type: Number, required: true },
  unit: { type: String, default: 'pc' },
  category: { type: String, default: 'General' },
  quantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 5 },
  isDemo: { type: Boolean, default: false }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  city: { type: String, default: 'Local Area' },
  totalSpent: { type: Number, default: 0 },
  totalCredit: { type: Number, default: 0 }, // positive means they owe money (udhaar)
  totalTransactions: { type: Number, default: 0 },
  averageOrderValue: { type: Number, default: 0 },
  customerType: { 
    type: String, 
    enum: ['New', 'Regular', 'High Value', 'At Risk', 'Inactive'], 
    default: 'New' 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  },
  amountPaid: { type: Number, default: 0 },
  paymentStatus: { 
    type: String, 
    enum: ['Paid', 'Pending', 'Partially Paid', 'Up-to-date', 'Overdue'], 
    default: 'Up-to-date' 
  },
  lastVisit: { type: Date },
  isDemo: { type: Boolean, default: false }
}, { timestamps: true });

const saleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'upi', 'udhaar'], required: true },
  items: [{
    productId: { type: String },
    name: { type: String },
    qty: { type: Number },
    price: { type: Number },
    costPrice: { type: Number },
    category: { type: String }
  }],
  customerId: { type: String }, // optional, for customer linkage
  customerName: { type: String },
  timestamp: { type: Date, default: Date.now },
  isDemo: { type: Boolean, default: false }
});

const expenseSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  note: { type: String },
  month: { type: String }, // e.g. "April 2026"
  date: { type: String }, // e.g. "2026-04-18"
  timestamp: { type: Date, default: Date.now },
  isDemo: { type: Boolean, default: false }
});

const complaintSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  customer: { type: String, required: true },
  issue: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  suggestedReply: { type: String },
  replySent: { type: String },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  timestamp: { type: Date, default: Date.now }
});

const predictionLogSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  predictedDemand: { type: Number, required: true },
  confidence: { type: Number },
  modelVersion: { type: String, required: true },
  modelType: { type: String, enum: ['foundation', 'hybrid', 'local'], default: 'foundation' },
  timestamp: { type: Date, default: Date.now }
});

const actualLogSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  actualSales: { type: Number, required: true },
  predictionLogId: { type: String }, // Links to the prediction
  absoluteError: { type: Number },
  percentageError: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

const modelRegistrySchema = new mongoose.Schema({
  shopId: { type: String, required: true }, // "global" for foundation model
  version: { type: String, required: true },
  type: { type: String, enum: ['foundation', 'hybrid', 'local'], required: true },
  trainedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'staged', 'retired'], default: 'active' },
  trainingRows: { type: Number }
});

const paymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  shopId: { type: String, required: true },
  customerId: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String },
  amount: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  balanceRemaining: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['upi', 'cash', 'card', 'bank_transfer'], default: 'upi' },
  status: { 
    type: String, 
    enum: ['Pending', 'Paid', 'Partially Paid', 'Failed', 'Cancelled'], 
    default: 'Pending' 
  },
  referenceNo: { type: String, required: true, unique: true },
  upiTransactionRef: { type: String },
  saleId: { type: String },
  invoiceNumber: { type: String },
  notes: { type: String },
  auditTrail: [{
    status: { type: String },
    updatedBy: { type: String, default: 'Shop Owner' },
    note: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  verifiedAt: { type: Date },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const Shop = mongoose.model('Shop', shopSchema);
const Product = mongoose.model('Product', productSchema);
const Customer = mongoose.model('Customer', customerSchema);
const Sale = mongoose.model('Sale', saleSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);
const PredictionLog = mongoose.model('PredictionLog', predictionLogSchema);
const ActualLog = mongoose.model('ActualLog', actualLogSchema);
const ModelRegistry = mongoose.model('ModelRegistry', modelRegistrySchema);

module.exports = {
  db: {
    shops: Shop,
    products: Product,
    customers: Customer,
    sales: Sale,
    payments: Payment,
    expenses: Expense,
    complaints: Complaint,
    predictionLogs: PredictionLog,
    actualLogs: ActualLog,
    modelRegistry: ModelRegistry
  },
  connectDB
};
