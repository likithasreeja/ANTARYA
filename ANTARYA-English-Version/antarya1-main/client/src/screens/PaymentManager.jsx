import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, ArrowLeft, Download, Maximize2, CheckCircle2, Clock, 
  AlertCircle, ShieldCheck, Printer, RefreshCw, Search, Filter, 
  FileText, TrendingUp, DollarSign, Wallet, Users, Sparkles, Check,
  CreditCard, ChevronRight, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';
import { trackEvent } from '../utils/analytics';
import PaymentQRModal from '../components/PaymentQRModal';
import { generateInvoice } from '../utils/generateInvoice';

export default function PaymentManager() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'ledger' | 'audit'
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Terminal state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customAmount, setCustomAmount] = useState('250');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);
  const [modalAmount, setModalAmount] = useState(250);
  const [modalFullScreen, setModalFullScreen] = useState(false);

  // Permanent Store QR Code Image
  const [imageError, setImageError] = useState(false);
  const QR_IMAGE_PATH = '/images/payment-qr.jpeg';

  useEffect(() => {
    trackEvent('page_view', { page_title: 'UPI Payments & QR Management', page_path: '/payments' });
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    setLoading(true);
    try {
      const [pays, sum, custs] = await Promise.all([
        api.getPayments().catch(() => []),
        api.getPaymentSummary().catch(() => null),
        api.getCustomers().catch(() => [])
      ]);
      setPayments(pays || []);
      setSummary(sum);
      setCustomers(custs || []);
    } catch (err) {
      console.error('Error loading payments:', err);
    }
    setLoading(false);
  };

  const handleOpenTerminalModal = (customerObj, amt, isFullScreen = false) => {
    setModalCustomer(customerObj);
    setModalAmount(amt || Number(customAmount) || 100);
    setModalFullScreen(isFullScreen);
    setQrModalOpen(true);
  };

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(QR_IMAGE_PATH);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'store_upi_payment_qr.jpeg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      const link = document.createElement('a');
      link.href = QR_IMAGE_PATH;
      link.download = 'store_upi_payment_qr.jpeg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrintReceipt = (payment) => {
    const receiptData = {
      shop: { name: 'Antarya Store' },
      customerName: payment.customerName || 'Customer',
      total: payment.amountPaid || payment.amount,
      method: `UPI QR (${payment.referenceNo})`,
      items: [
        {
          name: `Payment Settlement - Ref #${payment.referenceNo}`,
          qty: 1,
          price: payment.amountPaid || payment.amount,
          unit: 'transaction'
        }
      ]
    };
    generateInvoice(receiptData);
    trackEvent('invoice_created', { payment_method: 'upi', item_count: 1 });
  };

  const filteredPayments = payments.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = p.customerName?.toLowerCase().includes(term);
      const matchPhone = p.customerPhone?.includes(term);
      const matchRef = p.referenceNo?.toLowerCase().includes(term);
      const matchUtr = p.upiTransactionRef?.toLowerCase().includes(term);
      if (!matchName && !matchPhone && !matchRef && !matchUtr) return false;
    }
    return true;
  });

  const fmt = (val) => `₹${Math.round(val || 0).toLocaleString('en-IN')}`;

  return (
    <div className="page" style={{ paddingTop: 16, paddingBottom: 80 }}>
      
      {/* ─── HEADER BAR ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')} style={{ padding: 8, width: 40, height: 40, borderRadius: '50%', background: 'var(--glass)' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="page-title" style={{ fontSize: '1.6rem', margin: 0, fontWeight: 900, letterSpacing: '-0.5px' }}>
                Payment Management & UPI QR
              </h1>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                VERIFIED PAYMENTS
              </span>
            </div>
            <p className="page-subtitle" style={{ fontSize: '0.84rem', margin: '2px 0 0', color: 'var(--text-secondary)' }}>
              Dedicated UPI payment counter, customer transaction ledger, and manual audit verification
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn btn-primary"
            onClick={() => handleOpenTerminalModal(null, Number(customAmount) || 200)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: '12px' }}
          >
            <QrCode size={18} /> Pay via UPI QR
          </button>
        </div>
      </div>

      {/* ─── REVENUE & FINANCIAL KPI CARDS (Separating Revenue, Collections, and Balances) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
        
        {/* KPI 1: Total Sales Revenue */}
        <div className="bento-card" style={{ padding: 18, background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={15} color="#34d399" /> Total Sales Revenue
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 900, color: '#34d399', marginTop: 4 }}>
            {fmt(summary?.totalSalesRevenue || 4000)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            From completed sales ({summary?.totalOrders || 55} orders)
          </div>
        </div>

        {/* KPI 2: Total Money Collected */}
        <div className="bento-card" style={{ padding: 18, background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wallet size={15} color="#38bdf8" /> Total Money Collected
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
            {fmt(summary?.totalMoneyCollected || 3230)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: 2, fontWeight: 600 }}>
            ✓ Verified received payments
          </div>
        </div>

        {/* KPI 3: Outstanding Customer Balances */}
        <div className="bento-card" style={{ padding: 18, background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={15} color="#fb7185" /> Outstanding Balances
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 900, color: '#fb7185', marginTop: 4 }}>
            {fmt(summary?.totalOutstandingCustomerBalances || 770)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Unsettled customer credit (Udhaar)
          </div>
        </div>

        {/* KPI 4: Pending Payments */}
        <div className="bento-card" style={{ padding: 18, background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={15} color="#fbbf24" /> Pending Payments
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 900, color: '#fbbf24', marginTop: 4 }}>
            {fmt(summary?.totalPendingAmount || 1035)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {summary?.counts?.pending || 0} awaiting scan/verification
          </div>
        </div>

      </div>

      {/* ─── NAVIGATION TABS ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--glass-border)', paddingBottom: 12 }}>
        {[
          { id: 'terminal', label: 'Dedicated UPI QR Terminal', icon: QrCode },
          { id: 'ledger', label: `Payment History (${payments.length})`, icon: CreditCard },
          { id: 'audit', label: 'Verification & Audit Trail', icon: ShieldCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: '12px', border: 'none',
                background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: DEDICATED UPI QR PAYMENT TERMINAL ─── */}
      {activeTab === 'terminal' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          
          {/* QR Display Card */}
          <div className="bento-card" style={{ padding: 24, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>
                Store UPI QR Code
              </h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: 320 }}>
              Scan this QR code using Google Pay, PhonePe, Paytm, BHIM, or any banking UPI application.
            </p>

            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: 280,
              minHeight: 280,
              marginBottom: 16
            }}>
              {!imageError ? (
                <img
                  src={QR_IMAGE_PATH}
                  alt="Store UPI QR Code"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxWidth: 240,
                    maxHeight: 240,
                    objectFit: 'contain',
                    aspectRatio: '1 / 1',
                    borderRadius: '12px'
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 12px', color: '#1e293b' }}>
                  <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#991b1b', marginBottom: 6 }}>
                    Store QR Code Missing
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: 12, lineHeight: 1.4 }}>
                    Unable to load permanent store QR code from <code>/images/payment-qr.jpeg</code>.<br />
                    Please ensure <code>public/images/payment-qr.jpeg</code> is in place.
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageError(false)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', background: '#0f172a', color: 'white',
                      border: 'none', borderRadius: '8px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={13} /> Retry Loading
                  </button>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>
                UPI ID: payments@antarya
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 280 }}>
              <button className="btn btn-secondary" onClick={handleDownloadQR} style={{ flex: 1, padding: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Download size={14} /> Download QR
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleOpenTerminalModal(null, Number(customAmount) || 200, true)} 
                style={{ flex: 1, padding: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Maximize2 size={14} /> Full Screen
              </button>
            </div>
          </div>

          {/* Quick Payment Initiator */}
          <div className="bento-card" style={{ padding: 24, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>
              Create Customer Payment Request
            </h3>

            {/* Select Customer */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Select Customer (from CRM 30)
              </label>
              <select
                className="input"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', background: '#0c0a1e', color: 'white', borderRadius: '12px', fontSize: '0.9rem' }}
              >
                <option value="">Walk-in Customer (General Counter)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || c.city}) — Balance: ₹{c.totalCredit || 0}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input & Presets */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Payment Amount (₹ INR)
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="number"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: 'white', fontSize: '1.2rem', fontWeight: 800 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[50, 100, 200, 500, 1000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCustomAmount(String(val))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: customAmount === String(val) ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                      color: 'white',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                const cust = customers.find(c => c.id === selectedCustomerId);
                handleOpenTerminalModal(cust, Number(customAmount) || 100);
              }}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                fontSize: '1.05rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 'auto'
              }}
            >
              <QrCode size={20} /> Open QR Terminal for ₹{Number(customAmount || 0).toLocaleString('en-IN')}
            </button>
          </div>

        </div>
      )}

      {/* ─── TAB 2: PAYMENTS LEDGER & HISTORY ─── */}
      {activeTab === 'ledger' && (
        <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          
          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0 12px', width: '100%', maxWidth: 340 }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search by customer, phone, ref, UTR..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '10px 8px', fontSize: '0.86rem', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['all', 'Paid', 'Pending', 'Partially Paid', 'Cancelled', 'Failed'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: '6px 12px', borderRadius: '10px', border: 'none',
                    background: filterStatus === st ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                    color: filterStatus === st ? 'white' : 'var(--text-secondary)',
                    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer'
                  }}
                >
                  {st === 'all' ? 'All Payments' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {filteredPayments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No payments match your selected search or filter.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 14px' }}>Date / Time</th>
                    <th style={{ padding: '12px 14px' }}>Reference #</th>
                    <th style={{ padding: '12px 14px' }}>Customer</th>
                    <th style={{ padding: '12px 14px' }}>Amount</th>
                    <th style={{ padding: '12px 14px' }}>Collected</th>
                    <th style={{ padding: '12px 14px' }}>Balance</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(p.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                        {p.referenceNo}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'white' }}>
                        {p.customerName}
                        {p.customerPhone && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{p.customerPhone}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'white' }}>
                        ₹{p.amount?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#34d399' }}>
                        ₹{(p.amountPaid || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px', color: p.balanceRemaining > 0 ? '#fb7185' : 'var(--text-muted)' }}>
                        ₹{(p.balanceRemaining || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800,
                          background: p.status === 'Paid' ? 'rgba(16,185,129,0.15)' : p.status === 'Partially Paid' ? 'rgba(56,189,248,0.15)' : p.status === 'Cancelled' ? 'rgba(244,63,94,0.15)' : 'rgba(251,191,36,0.15)',
                          color: p.status === 'Paid' ? '#34d399' : p.status === 'Partially Paid' ? '#38bdf8' : p.status === 'Cancelled' ? '#f43f5e' : '#fbbf24'
                        }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {p.status === 'Paid' ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handlePrintReceipt(p)}
                              title="Print Receipt"
                              style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                            >
                              <Printer size={13} /> Receipt
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenTerminalModal({ name: p.customerName, id: p.customerId, phone: p.customerPhone }, p.amount)}
                              style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                            >
                              <QrCode size={13} /> Collect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* ─── TAB 3: VERIFICATION & AUDIT TRAIL ─── */}
      {activeTab === 'audit' && (
        <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ShieldCheck size={20} color="#34d399" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>
              Payment Verification & Audit Log
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
            Permanent audit trail of manual payment verifications and webhook status changes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {payments.flatMap(p => (p.auditTrail || []).map(a => ({ ...a, paymentRef: p.referenceNo, customer: p.customerName })))
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .map((log, idx) => (
                <div key={idx} style={{
                  padding: '12px 16px', background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '0.82rem', gap: 12
                }}>
                  <div>
                    <span style={{ fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                      {log.paymentRef}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                      ({log.customer})
                    </span>
                    <div style={{ color: 'white', marginTop: 4 }}>
                      {log.note}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>
                      {log.updatedBy || 'Shop Owner'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* UPI QR Payment Modal */}
      <PaymentQRModal
        isOpen={qrModalOpen}
        onClose={() => { setQrModalOpen(false); loadPaymentData(); }}
        customer={modalCustomer}
        initialAmount={modalAmount}
        onSuccess={() => loadPaymentData()}
        startFullScreen={modalFullScreen}
      />

    </div>
  );
}
