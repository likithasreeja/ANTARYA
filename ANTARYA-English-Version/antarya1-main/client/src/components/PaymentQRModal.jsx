import { useState, useEffect } from 'react';
import { 
  X, QrCode, Download, Maximize2, Minimize2, CheckCircle2, 
  AlertCircle, Clock, ShieldCheck, Printer, RefreshCw,
  DollarSign, User, FileText, Check, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import { trackEvent } from '../utils/analytics';
import { generateInvoice } from '../utils/generateInvoice';

export default function PaymentQRModal({
  isOpen,
  onClose,
  customer = null,
  initialAmount = 0,
  suggestedAmount = null,
  customerName: propCustomerName = '',
  customerPhone: propCustomerPhone = '',
  customerId: propCustomerId = '',
  note = '',
  saleId = null,
  onSuccess = null,
  onPaymentSuccess = null,
  startFullScreen = false
}) {
  const [amount, setAmount] = useState(initialAmount || 100);
  const [customerName, setCustomerName] = useState(customer?.name || propCustomerName || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || propCustomerPhone || '');
  const [isFullScreen, setIsFullScreen] = useState(startFullScreen || false);
  const [imageError, setImageError] = useState(false);
  
  // Payment lifecycle state
  const [paymentRecord, setPaymentRecord] = useState(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('Pending'); // 'Pending' | 'Paid' | 'Partially Paid' | 'Failed' | 'Cancelled'
  const [upiRefInput, setUpiRefInput] = useState('');
  const [partialAmountInput, setPartialAmountInput] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Permanent Store UPI QR Code path
  const QR_IMAGE_PATH = '/images/payment-qr.jpeg';

  useEffect(() => {
    if (isOpen) {
      const numAmt = suggestedAmount !== null && suggestedAmount !== undefined 
        ? Number(suggestedAmount) 
        : (Number(initialAmount) || 100);
      const cName = customer?.name || propCustomerName || '';
      const cPhone = customer?.phone || propCustomerPhone || '';
      const cId = customer?.id || propCustomerId || null;

      setAmount(numAmt);
      setCustomerName(cName);
      setCustomerPhone(cPhone);
      setPaymentStatus('Pending');
      setUpiRefInput('');
      setVerificationNotes('');
      setShowPartialInput(false);
      setImageError(false);
      setIsFullScreen(startFullScreen || false);

      // Track GA4 payment QR view event (non-PII parameters only)
      trackEvent('payment_qr_viewed', {
        amount_range: getAmountRange(numAmt),
        payment_method: 'upi'
      });

      // Automatically create a payment session / reference
      createPaymentSession(numAmt, cName, cId, note);
    }
  }, [isOpen, initialAmount, suggestedAmount, customer, propCustomerName, propCustomerPhone, propCustomerId, note, startFullScreen]);

  const getAmountRange = (val) => {
    if (val <= 100) return '0-100';
    if (val <= 500) return '101-500';
    if (val <= 1000) return '501-1000';
    return '1000+';
  };

  const createPaymentSession = async (amt, custName, custId, sessionNote) => {
    setIsCreatingPayment(true);
    try {
      const record = await api.createPayment({
        amount: amt,
        customerName: custName || 'Counter Customer',
        customerId: custId,
        paymentMethod: 'upi',
        saleId,
        notes: sessionNote || 'Initiated via Antarya UPI QR Terminal'
      });
      setPaymentRecord(record);
      setPaymentStatus(record.status || 'Pending');

      trackEvent('payment_initiated', {
        payment_method: 'upi',
        amount_range: getAmountRange(amt)
      });
    } catch (err) {
      console.error('Failed to create payment session:', err);
    }
    setIsCreatingPayment(false);
  };

  const handleAmountChange = (newVal) => {
    const val = Math.max(1, Number(newVal) || 0);
    setAmount(val);
  };

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(QR_IMAGE_PATH);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `store_upi_qr_${paymentRecord?.referenceNo || 'payment'}.jpeg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      const link = document.createElement('a');
      link.href = QR_IMAGE_PATH;
      link.download = `store_upi_qr_${paymentRecord?.referenceNo || 'payment'}.jpeg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyRef = () => {
    if (paymentRecord?.referenceNo) {
      navigator.clipboard.writeText(paymentRecord.referenceNo);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleConfirmPaid = async () => {
    if (!paymentRecord) return;
    setIsProcessingStatus(true);
    try {
      const updated = await api.updatePaymentStatus(paymentRecord.id, {
        status: 'Paid',
        amountPaid: amount,
        upiTransactionRef: upiRefInput.trim(),
        note: verificationNotes.trim() || 'Verified received in UPI app / bank account by shop owner',
        updatedBy: 'Shop Owner (Manual Verification)'
      });

      setPaymentRecord(updated);
      setPaymentStatus('Paid');

      trackEvent('payment_confirmed', {
        payment_method: 'upi',
        amount_range: getAmountRange(amount)
      });

      if (onSuccess) {
        onSuccess(updated);
      }
      if (onPaymentSuccess) {
        onPaymentSuccess(updated);
      }
    } catch (err) {
      console.error('Failed to confirm payment:', err);
    }
    setIsProcessingStatus(false);
  };

  const handleConfirmPartial = async () => {
    if (!paymentRecord) return;
    const partialAmt = Number(partialAmountInput);
    if (!partialAmt || partialAmt <= 0 || partialAmt >= amount) {
      alert('Please enter a valid partial amount less than total bill.');
      return;
    }

    setIsProcessingStatus(true);
    try {
      const updated = await api.updatePaymentStatus(paymentRecord.id, {
        status: 'Partially Paid',
        amountPaid: partialAmt,
        upiTransactionRef: upiRefInput.trim(),
        note: verificationNotes.trim() || `Partial payment of ₹${partialAmt} verified by owner`,
        updatedBy: 'Shop Owner'
      });

      setPaymentRecord(updated);
      setPaymentStatus('Partially Paid');
      setShowPartialInput(false);

      if (onSuccess) {
        onSuccess(updated);
      }
      if (onPaymentSuccess) {
        onPaymentSuccess(updated);
      }
    } catch (err) {
      console.error('Failed to record partial payment:', err);
    }
    setIsProcessingStatus(false);
  };

  const handleCancelPayment = async () => {
    if (!paymentRecord) return;
    setIsProcessingStatus(true);
    try {
      const updated = await api.updatePaymentStatus(paymentRecord.id, {
        status: 'Cancelled',
        note: verificationNotes.trim() || 'Payment request cancelled by shop owner',
        updatedBy: 'Shop Owner'
      });
      setPaymentRecord(updated);
      setPaymentStatus('Cancelled');

      trackEvent('payment_failed', {
        payment_method: 'upi',
        reason: 'cancelled_by_user'
      });
    } catch (err) {
      console.error('Failed to cancel payment:', err);
    }
    setIsProcessingStatus(false);
  };

  const handlePrintReceipt = () => {
    const receiptData = {
      shop: { name: 'Antarya Store' },
      customerName: customerName || paymentRecord?.customerName || 'Customer',
      total: paymentStatus === 'Partially Paid' ? (paymentRecord?.amountPaid || amount) : amount,
      method: `UPI QR (${paymentRecord?.referenceNo || 'Direct'})`,
      items: [
        {
          name: `Bill Settlement - Ref #${paymentRecord?.referenceNo || 'UPI'}`,
          qty: 1,
          price: paymentStatus === 'Partially Paid' ? paymentRecord?.amountPaid : amount,
          unit: 'transaction'
        }
      ]
    };
    generateInvoice(receiptData);
    trackEvent('invoice_created', {
      payment_method: 'upi',
      item_count: 1
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 5, 16, 0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          style={{
            background: 'var(--card-bg, #0f172a)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
            borderRadius: isFullScreen ? '0px' : '24px',
            width: isFullScreen ? '100vw' : '100%',
            maxWidth: isFullScreen ? '100vw' : '520px',
            height: isFullScreen ? '100vh' : 'auto',
            maxHeight: isFullScreen ? '100vh' : '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <QrCode size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>
                  Pay via UPI QR
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Scan with GPay, PhonePe, Paytm or Any UPI App
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? 'Exit Full Screen' : 'Show Full Screen QR'}
                style={{ padding: 8, borderRadius: '10px', color: '#cbd5e1' }}
              >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                className="btn btn-ghost"
                onClick={onClose}
                style={{ padding: 8, borderRadius: '10px', color: '#cbd5e1' }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            {/* Amount & Reference Bar */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Amount Payable
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', fontFamily: 'var(--font-display, inherit)' }}>
                    ₹{Math.round(amount).toLocaleString('en-IN')}
                  </span>
                  {customerName && (
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px' }}>
                      for {customerName}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Payment Reference
                </div>
                <div 
                  onClick={handleCopyRef}
                  style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.85rem', 
                    color: '#38bdf8', 
                    marginTop: 4, 
                    cursor: 'pointer',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6,
                    background: 'rgba(56, 189, 248, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '8px'
                  }}
                  title="Click to copy reference"
                >
                  <span>{paymentRecord?.referenceNo || 'Generating...'}</span>
                  {copiedRef ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                </div>
              </div>
            </div>

            {/* Quick Amount Editor (if custom payment) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700 }}>
                Adjust Amount:
              </span>
              {[50, 100, 200, 500].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAmountChange(val)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: amount === val ? 'var(--accent, #ff6b35)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ₹{val}
                </button>
              ))}
              <input
                type="number"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                style={{
                  width: 85,
                  padding: '4px 8px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textAlign: 'right'
                }}
              />
            </div>

            {/* QR Code Display Container - Guaranteed Crisp & Never Stretched */}
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              position: 'relative',
              minHeight: '260px'
            }}>
              {!imageError ? (
                <img
                  src={QR_IMAGE_PATH}
                  alt="Store UPI Payment QR Code"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                  style={{
                    maxWidth: isFullScreen ? '360px' : '240px',
                    maxHeight: isFullScreen ? '360px' : '240px',
                    width: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    aspectRatio: '1 / 1',
                    borderRadius: '12px',
                    imageRendering: 'crisp-edges'
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 14px', color: '#1e293b' }}>
                  <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#991b1b', marginBottom: 6 }}>
                    Store QR Code Missing
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 12, lineHeight: 1.4 }}>
                    Unable to load store UPI QR code from <code>/images/payment-qr.jpeg</code>.<br />
                    Please ensure the QR code file exists at <code>public/images/payment-qr.jpeg</code>.
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageError(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      background: '#0f172a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={14} /> Retry Loading
                  </button>
                </div>
              )}

              {/* Supported UPI Apps Row */}
              <div style={{
                marginTop: 14,
                padding: '6px 14px',
                borderRadius: '20px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span>Google Pay</span> • <span>PhonePe</span> • <span>Paytm</span> • <span>BHIM UPI</span>
              </div>
            </div>

            {/* QR Utility Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownloadQR}
                style={{ flex: 1, padding: '10px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Download size={15} /> Download QR
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsFullScreen(!isFullScreen)}
                style={{ flex: 1, padding: '10px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                {isFullScreen ? 'Exit Full Screen' : 'Full Screen QR'}
              </button>
            </div>

            {/* Status Indicator */}
            <div style={{
              padding: '12px 16px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 
                paymentStatus === 'Paid' ? 'rgba(16, 185, 129, 0.15)' :
                paymentStatus === 'Partially Paid' ? 'rgba(56, 189, 248, 0.15)' :
                paymentStatus === 'Failed' || paymentStatus === 'Cancelled' ? 'rgba(244, 63, 94, 0.15)' :
                'rgba(251, 191, 36, 0.15)',
              border: `1px solid ${
                paymentStatus === 'Paid' ? 'rgba(16, 185, 129, 0.35)' :
                paymentStatus === 'Partially Paid' ? 'rgba(56, 189, 248, 0.35)' :
                paymentStatus === 'Failed' || paymentStatus === 'Cancelled' ? 'rgba(244, 63, 94, 0.35)' :
                'rgba(251, 191, 36, 0.35)'
              }`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {paymentStatus === 'Paid' ? (
                  <CheckCircle2 size={20} color="#34d399" />
                ) : paymentStatus === 'Failed' || paymentStatus === 'Cancelled' ? (
                  <AlertCircle size={20} color="#f43f5e" />
                ) : (
                  <Clock size={20} color="#fbbf24" className="animate-spin-slow" />
                )}
                <div>
                  <div style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: paymentStatus === 'Paid' ? '#34d399' : paymentStatus === 'Cancelled' ? '#f43f5e' : '#fbbf24'
                  }}>
                    Status: {paymentStatus}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    {paymentStatus === 'Paid' 
                      ? 'Payment confirmed by shop owner. Balance updated.'
                      : paymentStatus === 'Partially Paid'
                      ? `₹${paymentRecord?.amountPaid} received. Balance ₹${paymentRecord?.balanceRemaining} remaining.`
                      : 'Waiting for customer to scan and transfer funds.'}
                  </div>
                </div>
              </div>

              {paymentStatus === 'Paid' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handlePrintReceipt}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: 700
                  }}
                >
                  <Printer size={13} /> Print Receipt
                </button>
              )}
            </div>

            {/* Shop Owner Verification Workflow (Manual Confirmation with Audit Trail) */}
            {paymentStatus !== 'Paid' && paymentStatus !== 'Cancelled' && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="#38bdf8" /> Shop Owner Verification
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)', margin: '0 0 12px', lineHeight: 1.4 }}>
                  Check your Google Pay, PhonePe, Paytm app or bank SMS. When received, confirm below:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="UPI Reference / UTR Number (Optional)"
                    value={upiRefInput}
                    onChange={e => setUpiRefInput(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '0.82rem'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Verification Note (e.g., Confirmed in HDFC App)"
                    value={verificationNotes}
                    onChange={e => setVerificationNotes(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>

                {showPartialInput && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input
                      type="number"
                      placeholder="Enter Partial Amount Received"
                      value={partialAmountInput}
                      onChange={e => setPartialAmountInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(56,189,248,0.4)',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '0.82rem'
                      }}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={handleConfirmPartial}
                      disabled={isProcessingStatus}
                      style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 800, padding: '0 16px', borderRadius: '10px' }}
                    >
                      Save Partial
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleConfirmPaid}
                    disabled={isProcessingStatus}
                    style={{
                      flex: 2,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      fontWeight: 800,
                      padding: '12px',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <CheckCircle2 size={18} /> Mark as Verified (Paid)
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPartialInput(!showPartialInput)}
                    style={{ flex: 1, padding: '12px', borderRadius: '12px', fontSize: '0.8rem' }}
                  >
                    Partial Pay
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelPayment}
                    disabled={isProcessingStatus}
                    style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '12px', borderRadius: '12px', fontSize: '0.8rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Post-Verification Action Bar */}
            {paymentStatus === 'Paid' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePrintReceipt}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#10b981' }}
                >
                  <Printer size={18} /> Print Official Receipt
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px' }}
                >
                  Done
                </button>
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
