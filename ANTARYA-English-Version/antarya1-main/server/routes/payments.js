const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/payments - List all payments with filtering
router.get('/', async (req, res) => {
  try {
    const { status, customerId, search, limit } = req.query;
    const filter = { shopId: req.shopId };

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (customerId) {
      filter.customerId = customerId;
    }
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { upiTransactionRef: { $regex: search, $options: 'i' } }
      ];
    }

    let query = db.payments.find(filter).sort({ timestamp: -1 });
    if (limit) {
      query = query.limit(Number(limit));
    }

    const payments = await query;
    res.json(payments);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

// GET /api/payments/summary - Metrics for payments & revenue reconciliation
router.get('/summary', async (req, res) => {
  try {
    const payments = await db.payments.find({ shopId: req.shopId });
    const customers = await db.customers.find({ shopId: req.shopId });
    const sales = await db.sales.find({ shopId: req.shopId });

    // Aggregate metrics
    const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.amount || 0), 0);
    const totalOrders = sales.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalSalesRevenue / totalOrders) : 0;

    // Payments breakdown
    const verifiedPaidPayments = payments.filter(p => p.status === 'Paid');
    const partiallyPaidPayments = payments.filter(p => p.status === 'Partially Paid');
    const pendingPayments = payments.filter(p => p.status === 'Pending');
    const failedPayments = payments.filter(p => p.status === 'Failed');
    const cancelledPayments = payments.filter(p => p.status === 'Cancelled');

    const totalMoneyCollected = verifiedPaidPayments.reduce((sum, p) => sum + (p.amountPaid || p.amount || 0), 0)
      + partiallyPaidPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      + partiallyPaidPayments.reduce((sum, p) => sum + (p.balanceRemaining !== undefined ? p.balanceRemaining : (p.amount - (p.amountPaid || 0))), 0);
    const totalOutstandingCustomerBalances = customers.reduce((sum, c) => sum + (c.totalCredit || 0), 0);

    res.json({
      totalSalesRevenue,
      totalMoneyCollected,
      totalPendingAmount,
      totalOutstandingCustomerBalances,
      totalOrders,
      averageOrderValue,
      counts: {
        total: payments.length,
        paid: verifiedPaidPayments.length,
        partiallyPaid: partiallyPaidPayments.length,
        pending: pendingPayments.length,
        failed: failedPayments.length,
        cancelled: cancelledPayments.length
      },
      recentPayments: payments.slice(0, 5)
    });
  } catch (err) {
    console.error('Payment summary error:', err);
    res.status(500).json({ error: 'Failed to generate payment summary' });
  }
});

// GET /api/payments/:id - Get single payment details with audit trail
router.get('/:id', async (req, res) => {
  try {
    const payment = await db.payments.findOne({
      $or: [{ id: req.params.id }, { referenceNo: req.params.id }],
      shopId: req.shopId
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    res.json(payment);
  } catch (err) {
    console.error('Get payment details error:', err);
    res.status(500).json({ error: 'Failed to retrieve payment details' });
  }
});

// POST /api/payments - Initiate / Create a payment request
router.post('/', async (req, res) => {
  try {
    const { customerId, customerName, customerPhone, amount, paymentMethod, saleId, invoiceNumber, notes } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'A valid payment amount greater than ₹0 is required' });
    }

    // Generate unique payment reference
    const timestampCode = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const referenceNo = `ANT-PAY-${timestampCode}-${randomSuffix}`;
    const paymentId = `PAY-${referenceNo}`;

    // Verify customer linkage
    let matchedCustomer = null;
    if (customerId) {
      matchedCustomer = await db.customers.findOne({ id: customerId, shopId: req.shopId });
    }
    if (!matchedCustomer && customerName) {
      matchedCustomer = await db.customers.findOne({ name: customerName, shopId: req.shopId });
    }

    const custId = matchedCustomer ? matchedCustomer.id : (customerId || `CUST-GUEST-${uuidv4().substring(0, 6)}`);
    const custName = matchedCustomer ? matchedCustomer.name : (customerName || 'Walk-in Customer');
    const custPhone = matchedCustomer ? matchedCustomer.phone : (customerPhone || '');

    const payment = new db.payments({
      id: paymentId,
      shopId: req.shopId,
      customerId: custId,
      customerName: custName,
      customerPhone: custPhone,
      amount: numAmount,
      amountPaid: 0,
      balanceRemaining: numAmount,
      paymentMethod: paymentMethod || 'upi',
      status: 'Pending',
      referenceNo,
      saleId: saleId || null,
      invoiceNumber: invoiceNumber || null,
      notes: notes || 'UPI QR Payment Request',
      auditTrail: [{
        status: 'Pending',
        updatedBy: 'Shop Owner',
        note: `Payment request created for ₹${numAmount} via UPI QR. Reference: ${referenceNo}`,
        timestamp: new Date()
      }],
      timestamp: new Date()
    });

    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Failed to create payment record' });
  }
});

// PUT /api/payments/:id/status - Update payment status (Manual verification, partial pay, cancel, fail)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, amountPaid, upiTransactionRef, note, updatedBy } = req.body;
    const validStatuses = ['Pending', 'Paid', 'Partially Paid', 'Failed', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const payment = await db.payments.findOne({
      $or: [{ id: req.params.id }, { referenceNo: req.params.id }],
      shopId: req.shopId
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const oldStatus = payment.status;
    let newAmountPaid = payment.amountPaid;
    let newBalanceRemaining = payment.balanceRemaining;
    let verifiedAt = payment.verifiedAt;

    if (status === 'Paid') {
      newAmountPaid = payment.amount;
      newBalanceRemaining = 0;
      verifiedAt = new Date();
    } else if (status === 'Partially Paid') {
      newAmountPaid = Number(amountPaid) || payment.amountPaid;
      newBalanceRemaining = Math.max(0, payment.amount - newAmountPaid);
    } else if (status === 'Failed' || status === 'Cancelled') {
      newAmountPaid = 0;
      newBalanceRemaining = payment.amount;
    }

    const auditEntry = {
      status,
      updatedBy: updatedBy || 'Shop Owner',
      note: note || `Status changed from ${oldStatus} to ${status}${upiTransactionRef ? ` (UTR: ${upiTransactionRef})` : ''}`,
      timestamp: new Date()
    };

    const updateFields = {
      status,
      amountPaid: newAmountPaid,
      balanceRemaining: newBalanceRemaining,
      verifiedAt: status === 'Paid' ? verifiedAt : payment.verifiedAt,
      $push: { auditTrail: auditEntry }
    };

    if (upiTransactionRef) {
      updateFields.upiTransactionRef = upiTransactionRef.trim();
    }

    const updatedPayment = await db.payments.findOneAndUpdate(
      { id: payment.id, shopId: req.shopId },
      updateFields,
      { new: true }
    );

    // Update customer credit & amountPaid ledger if applicable
    if (payment.customerId) {
      const customer = await db.customers.findOne({ id: payment.customerId, shopId: req.shopId });
      if (customer) {
        if (status === 'Paid' && oldStatus !== 'Paid') {
          // If this was paying an outstanding udhaar, reduce totalCredit
          const creditPayment = Math.min(customer.totalCredit || 0, payment.amount);
          const newCredit = Math.max(0, (customer.totalCredit || 0) - creditPayment);
          const newAmountPaidCust = (customer.amountPaid || 0) + payment.amount;
          const paymentStatus = newCredit === 0 ? 'Paid' : (newAmountPaidCust > 0 ? 'Partially Paid' : 'Pending');

          await db.customers.findOneAndUpdate(
            { id: customer.id, shopId: req.shopId },
            { 
              $set: { 
                totalCredit: newCredit,
                amountPaid: newAmountPaidCust,
                paymentStatus,
                lastVisit: new Date()
              } 
            }
          );
        } else if (status === 'Partially Paid') {
          const deltaPaid = Math.max(0, newAmountPaid - (payment.amountPaid || 0));
          const newCredit = Math.max(0, (customer.totalCredit || 0) - deltaPaid);
          const newAmountPaidCust = (customer.amountPaid || 0) + deltaPaid;
          const paymentStatus = newCredit === 0 ? 'Paid' : 'Partially Paid';

          await db.customers.findOneAndUpdate(
            { id: customer.id, shopId: req.shopId },
            { 
              $set: { 
                totalCredit: newCredit,
                amountPaid: newAmountPaidCust,
                paymentStatus,
                lastVisit: new Date()
              } 
            }
          );
        }
      }
    }

    res.json(updatedPayment);
  } catch (err) {
    console.error('Update payment status error:', err);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// POST /api/payments/webhook - Verified UPI / Payment Gateway Webhook
router.post('/webhook', async (req, res) => {
  try {
    const { referenceNo, upiTransactionRef, amount, status } = req.body;

    if (!referenceNo) {
      return res.status(400).json({ error: 'referenceNo is required' });
    }

    const payment = await db.payments.findOne({ referenceNo });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for provided reference' });
    }

    const newStatus = status === 'SUCCESS' || status === 'PAID' ? 'Paid' : (status === 'FAILED' ? 'Failed' : 'Pending');
    const updateFields = {
      status: newStatus,
      amountPaid: newStatus === 'Paid' ? (Number(amount) || payment.amount) : 0,
      balanceRemaining: newStatus === 'Paid' ? 0 : payment.amount,
      upiTransactionRef: upiTransactionRef || payment.upiTransactionRef,
      verifiedAt: newStatus === 'Paid' ? new Date() : null,
      $push: {
        auditTrail: {
          status: newStatus,
          updatedBy: 'Automated UPI Gateway Webhook',
          note: `Webhook confirmation: status ${newStatus}, UTR ${upiTransactionRef || 'N/A'}`,
          timestamp: new Date()
        }
      }
    };

    const updated = await db.payments.findOneAndUpdate(
      { referenceNo },
      updateFields,
      { new: true }
    );

    res.json({ success: true, payment: updated });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
