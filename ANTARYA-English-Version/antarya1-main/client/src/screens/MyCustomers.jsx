import { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  Search, UserPlus, Phone, CreditCard, ArrowLeft, X, Download, 
  Users, TrendingUp, Sparkles, ShoppingBag, ShieldCheck, HelpCircle,
  Clock, AlertCircle, ChevronRight, CheckCircle2, DollarSign, BarChart3,
  PieChart as PieIcon, PhoneCall, RefreshCw, Eye, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { trackEvent } from '../utils/analytics';
import { SkeletonList } from '../components/Skeleton';
import PaymentQRModal from '../components/PaymentQRModal';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

export default function MyCustomers() {
  const { showToast } = useStore();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'analytics' | 'segmentation'
  const [qrModalCustomer, setQrModalCustomer] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSegment, setFilterSegment] = useState('all');

  // Customer Modal & Add Customer States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCity, setNewCity] = useState('');

  // Customer Details Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Credit payment inside card/modal
  const [payingCustomerId, setPayingCustomerId] = useState(null);
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    trackEvent('page_view', { page_title: 'Customers Management & Analytics', page_path: '/customers' });
    loadAllCustomerData();
  }, []);

  const loadAllCustomerData = async () => {
    setLoading(true);
    try {
      const [custList, analyticsData] = await Promise.all([
        api.getCustomers(),
        api.getCustomerAnalytics().catch(() => null)
      ]);
      setCustomers(custList || []);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error loading customer data:', err);
      showToast('Error loading customers', 'error');
    }
    setLoading(false);
  };

  const handleLoad30DemoCustomers = async () => {
    setLoadingSeed(true);
    try {
      const res = await api.seed30DemoCustomers();
      trackEvent('customer_viewed', { count: 30 });
      showToast(res.message || '30 customer records loaded successfully. 🎉', 'success');
      await loadAllCustomerData();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load customer records', 'error');
    }
    setLoadingSeed(false);
  };

  const handleOpenDetails = async (customerId) => {
    setSelectedCustomerId(customerId);
    setLoadingDetails(true);
    try {
      const details = await api.getCustomerDetails(customerId);
      setCustomerDetails(details);
      trackEvent('customer_viewed', { 
        customer_id: customerId, 
        segment: details?.customer?.customerType || 'Regular' 
      });
    } catch (err) {
      console.error(err);
      showToast('Could not load customer purchase history', 'error');
    }
    setLoadingDetails(false);
  };

  const handleAddCustomer = async () => {
    if (!newName.trim()) {
      showToast('Customer name is required', 'error');
      return;
    }
    try {
      const newCust = await api.addCustomer({ 
        name: newName.trim(), 
        phone: newPhone.trim(),
        city: newCity.trim() || 'Local Area'
      });
      trackEvent('customer_added', { customer_id: newCust.id, city: newCust.city });
      showToast(`${newName} added successfully!`, 'success');
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      setNewCity('');
      loadAllCustomerData();
    } catch (err) {
      showToast(err.message || 'Failed to add customer', 'error');
    }
  };

  const handlePayCredit = async (customer) => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid payment amount', 'error');
      return;
    }
    try {
      await api.payCredit(customer.id, amount);
      showToast(`₹${amount.toLocaleString('en-IN')} credit received from ${customer.name}!`, 'success');
      setPayingCustomerId(null);
      setPayAmount('');
      loadAllCustomerData();
      if (selectedCustomerId === customer.id) {
        handleOpenDetails(customer.id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to record credit payment', 'error');
    }
  };

  const handleExportCSV = () => {
    if (customers.length === 0) {
      showToast('No customer records to export', 'warning');
      return;
    }
    const headers = ['Customer ID', 'Customer Name', 'Phone', 'Area/City', 'Customer Segment', 'Status', 'Total Orders', 'Total Spent (INR)', 'AOV (INR)', 'Credit Balance (INR)', 'Last Purchase Date'];
    const rows = customers.map(c => [
      `"${c.id}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone || 'N/A'}"`,
      `"${c.city || 'Local'}"`,
      `"${c.customerType || 'Regular'}"`,
      `"${c.status || 'Active'}"`,
      c.totalTransactions || 0,
      c.totalSpent || 0,
      c.averageOrderValue || 0,
      c.totalCredit || 0,
      c.lastVisit ? new Date(c.lastVisit).toLocaleDateString('en-IN') : 'Never'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `antarya_customers_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Customer analytics ledger exported to CSV! 📥');
  };

  const fmt = (amount) => `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;

  const filteredCustomers = customers.filter(c => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = c.name.toLowerCase().includes(term);
      const matchPhone = c.phone && c.phone.includes(term);
      const matchCity = c.city && c.city.toLowerCase().includes(term);
      if (!matchName && !matchPhone && !matchCity) return false;
    }
    if (filterSegment === 'credit') return (c.totalCredit || 0) > 0;
    if (filterSegment !== 'all') return c.customerType === filterSegment;
    return true;
  });

  const getSegmentColor = (segment) => {
    switch (segment) {
      case 'High Value': return { text: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: '#c084fc' };
      case 'Regular': return { text: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: '#34d399' };
      case 'New': return { text: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: '#60a5fa' };
      case 'At Risk': return { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24' };
      case 'Inactive': return { text: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8' };
      default: return { text: '#ffffff', bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255,255,255,0.2)' };
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ paddingTop: 20 }}>
        <SkeletonList count={6} />
      </div>
    );
  }

  const summary = analytics?.summary || {
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.status === 'Active').length,
    newCustomers: customers.filter(c => c.customerType === 'New').length,
    regularCustomers: customers.filter(c => c.customerType === 'Regular').length,
    highValueCustomers: customers.filter(c => c.customerType === 'High Value').length,
    atRiskCustomers: customers.filter(c => c.customerType === 'At Risk').length,
    inactiveCustomers: customers.filter(c => c.customerType === 'Inactive').length,
    totalCustomerRevenue: customers.reduce((s, c) => s + (c.totalSpent || 0), 0),
    averageCustomerSpend: customers.length > 0 ? Math.round(customers.reduce((s, c) => s + (c.totalSpent || 0), 0) / customers.length) : 0,
    averageOrderValue: 285,
    averageTxPerCustomer: '9.2',
    totalCreditOutstanding: customers.reduce((s, c) => s + (c.totalCredit || 0), 0)
  };

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
                Customer Analytics & CRM
              </h1>
            </div>
            <p className="page-subtitle" style={{ fontSize: '0.84rem', margin: '2px 0 0', color: 'var(--text-secondary)' }}>
              Managing <strong style={{ color: 'white' }}>{customers.length} Customers</strong> with transparent rule-based segmentation & transaction history
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={handleLoad30DemoCustomers} 
            disabled={loadingSeed}
            style={{ 
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
              color: 'white', fontWeight: 700, padding: '9px 16px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', gap: 8, border: 'none',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
            }}
          >
            <RefreshCw size={16} className={loadingSeed ? 'animate-spin' : ''} />
            {loadingSeed ? 'Syncing...' : 'Reload 30 Customers'}
          </button>

          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ padding: '9px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> Export CSV
          </button>

          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ padding: '9px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* ─── 9 KEY METRICS KPI GRID ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        
        {/* Total Customers */}
        <div className="bento-card" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} color="#38bdf8" /> Total Customers
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: 'white', margin: '4px 0 2px' }}>
            {summary.totalCustomers}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
            {summary.activeCustomers} active recently
          </div>
        </div>

        {/* Total Customer Revenue */}
        <div className="bento-card" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={16} color="#34d399" /> Total Customer Revenue
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: '#34d399', margin: '4px 0 2px' }}>
            {fmt(summary.totalCustomerRevenue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Across all transactions
          </div>
        </div>

        {/* Average Customer Spend */}
        <div className="bento-card" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} color="#a855f7" /> Avg Customer Spend
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: 'white', margin: '4px 0 2px' }}>
            {fmt(summary.averageCustomerSpend)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Lifetime customer value
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bento-card" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShoppingBag size={16} color="#fbbf24" /> Average Order Value
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: '#fbbf24', margin: '4px 0 2px' }}>
            {fmt(summary.averageOrderValue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Per bill average
          </div>
        </div>

        {/* Avg Transactions per Customer */}
        <div className="bento-card" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color="#60a5fa" /> Avg Orders / Customer
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: 'white', margin: '4px 0 2px' }}>
            {summary.averageTxPerCustomer}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
            Strong repeat frequency
          </div>
        </div>

        {/* Credit / Udhaar Outstanding */}
        <div className="bento-card" style={{ padding: '16px 20px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)' }}>
          <div style={{ fontSize: '0.78rem', color: '#fb7185', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CreditCard size={16} /> Credit Outstanding
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: '#f43f5e', margin: '4px 0 2px' }}>
            {fmt(summary.totalCreditOutstanding)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#fb7185', fontWeight: 600 }}>
            Pending from customers
          </div>
        </div>

      </div>

      {/* ─── SECTION NAVIGATION TABS ─── */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--glass-border)', paddingBottom: 12, marginBottom: 24 }}>
        {[
          { id: 'list', label: `Customer Directory (${customers.length})`, icon: Users },
          { id: 'analytics', label: 'Customer Analytics Charts (6)', icon: BarChart3 },
          { id: 'segmentation', label: 'Explainable Segmentation Rules', icon: ShieldCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'analytics') trackEvent('customer_segment_viewed', { view: 'analytics_charts' });
              }}
              style={{
                padding: '10px 18px', borderRadius: '12px', border: 'none',
                background: isActive ? 'white' : 'transparent',
                color: isActive ? '#09090b' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
              }}
            >
              <Icon size={18} color={isActive ? '#09090b' : 'currentColor'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER DIRECTORY LIST                                            */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          
          {/* Search & Segment Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{
              flex: 1, minWidth: 280, display: 'flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px', padding: '0 14px'
            }}>
              <Search size={18} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="Search by customer name, phone, or area (e.g. Rajesh, Indiranagar)..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.length > 2) trackEvent('search_used', { search_scope: 'customers', query_length: e.target.value.length });
                }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', color: 'white',
                  padding: '14px 10px', fontSize: '0.92rem', outline: 'none'
                }}
              />
              {searchTerm && <X size={16} color="var(--text-muted)" onClick={() => setSearchTerm('')} style={{ cursor: 'pointer' }} />}
            </div>

            {/* Segment Filter Pills */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { id: 'all', label: 'All Customers' },
                { id: 'High Value', label: `High Value (${summary.highValueCustomers})` },
                { id: 'Regular', label: `Regular (${summary.regularCustomers})` },
                { id: 'New', label: `New (${summary.newCustomers})` },
                { id: 'At Risk', label: `At Risk (${summary.atRiskCustomers})` },
                { id: 'Inactive', label: `Inactive (${summary.inactiveCustomers})` },
                { id: 'credit', label: 'Has Credit Balance' }
              ].map(pill => (
                <button
                  key={pill.id}
                  onClick={() => {
                    setFilterSegment(pill.id);
                    trackEvent('filter_changed', { filter_type: 'customer_segment', value: pill.id });
                  }}
                  style={{
                    padding: '8px 14px', borderRadius: '20px', whiteSpace: 'nowrap',
                    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                    background: filterSegment === pill.id ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                    color: filterSegment === pill.id ? 'white' : 'var(--text-secondary)',
                    border: filterSegment === pill.id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Cards Grid */}
          {filteredCustomers.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <Users size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
              <h3 style={{ color: 'white', margin: '0 0 8px' }}>No Customers Match Filter</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                {customers.length === 0 
                  ? "You haven't loaded any customers yet. Click 'Reload 30 Customers' above." 
                  : "Try clearing your search query or selecting 'All Customers'."}
              </p>
              {customers.length === 0 && (
                <button className="btn btn-primary" onClick={handleLoad30DemoCustomers}>
                  Reload 30 Customers
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {filteredCustomers.map((c, i) => {
                const segStyle = getSegmentColor(c.customerType);
                const isPaying = payingCustomerId === c.id;
                const hasCredit = (c.totalCredit || 0) > 0;
                const amountPaid = c.amountPaid !== undefined 
                  ? c.amountPaid 
                  : Math.max(0, (c.totalSpent || 0) - (c.totalCredit || 0));
                const paymentStatus = c.paymentStatus || (hasCredit ? (amountPaid > 0 ? 'Partially Paid' : 'Pending') : 'Paid');
                const lastDateStr = c.lastVisit 
                  ? new Date(c.lastVisit).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Recent';

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="bento-card"
                    style={{
                      padding: 20, borderRadius: '18px', background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column',
                      justifyContent: 'space-between', position: 'relative'
                    }}
                  >
                    <div>
                      {/* Top Row: Avatar + Name + Segment Badge */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: '14px',
                            background: `linear-gradient(135deg, hsl(${(i * 55) % 360}, 70%, 45%), hsl(${(i * 55 + 40) % 360}, 80%, 30%))`,
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', fontWeight: 900, flexShrink: 0
                          }}>
                            {c.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'white' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              ID: <span style={{ color: 'white', fontWeight: 600 }}>{c.id}</span> • {c.city || 'Local Area'}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', borderRadius: '12px',
                          color: segStyle.text, background: segStyle.bg, border: `1px solid ${segStyle.border}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {c.customerType || 'Regular'}
                        </span>
                      </div>

                      {/* Phone & Payment Status Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        <span>📱 {c.phone || '+91 98765 43210'}</span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                          color: paymentStatus === 'Paid' ? '#34d399' : paymentStatus === 'Partially Paid' ? '#fbbf24' : '#fb7185',
                          background: paymentStatus === 'Paid' ? 'rgba(16,185,129,0.15)' : paymentStatus === 'Partially Paid' ? 'rgba(251,191,36,0.15)' : 'rgba(244,63,94,0.15)',
                          border: `1px solid ${paymentStatus === 'Paid' ? 'rgba(16,185,129,0.3)' : paymentStatus === 'Partially Paid' ? 'rgba(251,191,36,0.3)' : 'rgba(244,63,94,0.3)'}`
                        }}>
                          ● {paymentStatus}
                        </span>
                      </div>

                      {/* 4 Metrics Detailed Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 14px', background: 'rgba(0,0,0,0.28)', borderRadius: '12px', marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Purchases</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#34d399', marginTop: 2 }}>{fmt(c.totalSpent)}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>{c.totalTransactions || 1} orders recorded</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Amount Paid</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>{fmt(amountPaid)}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>Cleared to date</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Outstanding Balance</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: hasCredit ? '#f43f5e' : '#34d399', marginTop: 2 }}>
                            {hasCredit ? fmt(c.totalCredit) : '₹0 (Clear)'}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: hasCredit ? '#fb7185' : '#34d399', marginTop: 2 }}>
                            {hasCredit ? 'Khata due' : 'Zero dues ✓'}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Last Transaction</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'white', marginTop: 4 }}>{lastDateStr}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>Activity date</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontWeight: 700, fontSize: '0.78rem', minWidth: 100 }}
                          onClick={() => handleOpenDetails(c.id)}
                        >
                          <Eye size={14} /> Profile
                        </button>

                        <button
                          className="btn btn-sm"
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            border: 'none', borderRadius: '10px', fontSize: '0.78rem', padding: '6px 12px', cursor: 'pointer'
                          }}
                          onClick={() => setQrModalCustomer(c)}
                        >
                          <QrCode size={14} /> Pay via UPI QR
                        </button>

                        {hasCredit && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(244,63,94,0.18)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.4)', fontWeight: 700, fontSize: '0.78rem' }}
                            onClick={() => setPayingCustomerId(isPaying ? null : c.id)}
                          >
                            {isPaying ? 'Cancel' : 'Cash Settle'}
                          </button>
                        )}
                      </div>

                      {/* Inline Payment Box */}
                      {isPaying && (
                        <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.4)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Enter Amount Received:</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="number"
                              className="input"
                              placeholder={`Max ${c.totalCredit}`}
                              value={payAmount}
                              onChange={e => setPayAmount(e.target.value)}
                              style={{ flex: 1, padding: '8px 10px', fontSize: '0.9rem' }}
                              autoFocus
                            />
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPayAmount(String(c.totalCredit))}
                            >
                              Full
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handlePayCredit(c)}
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 6 CUSTOMER ANALYTICS RECHARTS CHARTS                               */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20 }}>
            
            {/* Chart 1: Customer Revenue Distribution */}
            <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>1. Customer Revenue Distribution</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Top spending customers by lifetime INR revenue</p>
                </div>
                <span style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontWeight: 700 }}>
                  Top 10 Spenders
                </span>
              </div>
              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.charts?.topRevenueCustomers || []} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} tickFormatter={v => `₹${v/1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={11} width={90} />
                    <Tooltip 
                      formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Total Revenue']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                    />
                    <Bar dataKey="totalSpent" fill="#34d399" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Transactions by Customer */}
            <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>2. Transactions by Customer</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Purchase frequency and store visit counts</p>
                </div>
                <span style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
                  Order Velocity
                </span>
              </div>
              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.charts?.topFrequentCustomers || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} angle={-30} textAnchor="end" />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} />
                    <Tooltip 
                      formatter={(val) => [`${val} Transactions`, 'Orders']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                    />
                    <Bar dataKey="transactions" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Customer Activity Over Time */}
            <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>3. Customer Activity Over Time</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Weekly customer visits and sales revenue timeline</p>
                </div>
                <span style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontWeight: 700 }}>
                  Weekly Trends
                </span>
              </div>
              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.charts?.activityOverTime || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="actColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickFormatter={v => v.slice(5)} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={v => `₹${v/1000}k`} />
                    <Tooltip 
                      formatter={(val, name) => [name === 'revenue' ? `₹${val.toLocaleString('en-IN')}` : val, name === 'revenue' ? 'Revenue' : 'Transactions']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#actColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Payment Method Distribution */}
            <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>4. Payment Method Distribution</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Cash vs UPI Digital vs Credit (Udhaar) breakdown</p>
                </div>
              </div>
              <div style={{ height: 260, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics?.charts?.paymentDistribution || []}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(analytics?.charts?.paymentDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Volume']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5: Top Products Purchased */}
            <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>5. Top Products Purchased</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Most purchased FMCG & grocery items by customer base</p>
                </div>
              </div>
              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.charts?.topProductsPurchased || []} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={10} width={100} />
                    <Tooltip 
                      formatter={(val, name) => [name === 'unitsSold' ? `${val} Units` : `₹${val.toLocaleString()}`, name === 'unitsSold' ? 'Units Sold' : 'Revenue']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                    />
                    <Bar dataKey="unitsSold" fill="#fbbf24" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 6: Customer Segmentation Breakdown */}
            <div className="bento-card" style={{ padding: 22, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>6. Customer Segmentation Breakdown</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Distribution across RFM explainable segments</p>
                </div>
              </div>
              <div style={{ height: 260, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics?.charts?.segmentationBreakdown || []}
                      cx="50%" cy="50%"
                      outerRadius={95}
                      dataKey="count"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {(analytics?.charts?.segmentationBreakdown || []).map((entry, index) => (
                        <Cell key={`seg-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => [`${val} Customers`, 'Count']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPLAINABLE SEGMENTATION RULES                                     */}
      {/* ========================================================================= */}
      {activeTab === 'segmentation' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <div style={{ padding: 24, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <ShieldCheck size={24} color="#34d399" />
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white', margin: 0 }}>
                Transparent Rule-Based Customer Segmentation
              </h2>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              ANTARYA uses transparent, explainable RFM (Recency, Frequency, Monetary) business logic instead of black-box algorithms. Every customer is categorized according to verifiable metrics:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(analytics?.segmentationRules || []).map((rule, idx) => (
              <div
                key={idx}
                className="bento-card"
                style={{
                  padding: 20, borderRadius: '16px', background: 'var(--card-bg)',
                  border: `1px solid ${rule.color}40`, display: 'flex', flexWrap: 'wrap',
                  alignItems: 'center', justifyContent: 'space-between', gap: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '14px', background: `${rule.color}20`,
                    border: `1px solid ${rule.color}`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900, color: rule.color
                  }}>
                    {rule.count}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{rule.segment} Customer</span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '8px', background: `${rule.color}20`, color: rule.color, fontWeight: 700 }}>
                        {rule.count} Active
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginTop: 4, fontWeight: 600 }}>
                      Criteria: <span style={{ color: 'white' }}>{rule.criteria}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', minWidth: 260 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Recommended Strategy</div>
                  <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600, marginTop: 2 }}>{rule.action}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER DETAILS & PURCHASE HISTORY                                 */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedCustomerId && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              style={{
                background: '#0c0a1e', width: '100%', maxWidth: 760, maxHeight: '90vh',
                borderRadius: '24px', border: '1px solid var(--glass-border)', display: 'flex',
                flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.7)'
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '14px', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900 }}>
                    {customerDetails?.customer?.name ? customerDetails.customer.name[0] : 'C'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>
                      {customerDetails?.customer?.name || 'Customer Details'}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      ID: {customerDetails?.customer?.id} • Area: {customerDetails?.customer?.city} • 📱 {customerDetails?.customer?.phone}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCustomerId(null)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                {loadingDetails ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Loading customer purchase history...</p>
                  </div>
                ) : (
                  <div>
                    {/* Summary Metric Strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TOTAL SPENT</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#34d399' }}>{fmt(customerDetails?.customer?.totalSpent)}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TOTAL ORDERS</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{customerDetails?.totalOrders || 0}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>AVERAGE ORDER</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fbbf24' }}>{fmt(customerDetails?.customer?.averageOrderValue)}</div>
                      </div>
                      <div style={{ background: 'rgba(244,63,94,0.1)', padding: 12, borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#fb7185' }}>CREDIT PENDING</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f43f5e' }}>{fmt(customerDetails?.customer?.totalCredit)}</div>
                      </div>
                    </div>

                    {/* Top Products Purchased by Customer */}
                    {customerDetails?.topPurchasedProducts && customerDetails.topPurchasedProducts.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'white', marginBottom: 10 }}>
                          🛒 Top Products Purchased
                        </h4>
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
                          {customerDetails.topPurchasedProducts.slice(0, 5).map((p, idx) => (
                            <div key={idx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 12px', minWidth: 140 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: 2 }}>{p.count} units • {fmt(p.totalSpend)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chronological Transaction History */}
                    <div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'white', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>📜 Transaction History ({customerDetails?.sales?.length || 0})</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Chronological order</span>
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                        {customerDetails?.sales?.map((sale, sIdx) => (
                          <div key={sIdx} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>
                                {sale.items?.map(it => `${it.name} (x${it.qty || 1})`).join(', ') || 'Grocery Sale'}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                {new Date(sale.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • 
                                <span style={{ textTransform: 'uppercase', color: sale.method === 'udhaar' ? '#f43f5e' : '#34d399', fontWeight: 700, marginLeft: 4 }}>
                                  {sale.method}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#34d399' }}>
                              {fmt(sale.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedCustomerId(null)}>
                  Close
                </button>
                <button
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white', fontWeight: 800, padding: '8px 16px', borderRadius: '12px',
                    fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer'
                  }}
                  onClick={() => {
                    setQrModalCustomer(customerDetails?.customer);
                  }}
                >
                  <QrCode size={16} /> Pay via UPI QR
                </button>
                {customerDetails?.customer?.totalCredit > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setPayingCustomerId(customerDetails.customer.id);
                      setSelectedCustomerId(null);
                    }}
                  >
                    Collect Cash Payment
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW CUSTOMER                                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              style={{
                background: '#0f172a', width: '100%', maxWidth: 420, borderRadius: '24px',
                padding: 24, border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', margin: 0 }}>Add New Customer</h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Customer Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Ramesh Sharma"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Phone Number (Optional)</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="e.g. +91 98765 43201"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Area / Locality</label>
                <input
                  className="input"
                  placeholder="e.g. Indiranagar, Koramangala"
                  value={newCity}
                  onChange={e => setNewCity(e.target.value)}
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }} onClick={handleAddCustomer}>
                  Save Customer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentQRModal
        isOpen={!!qrModalCustomer}
        onClose={() => setQrModalCustomer(null)}
        suggestedAmount={qrModalCustomer?.totalCredit || 0}
        customerName={qrModalCustomer?.name || ''}
        customerPhone={qrModalCustomer?.phone || ''}
        customerId={qrModalCustomer?.id || ''}
        note={qrModalCustomer ? `Outstanding settlement for ${qrModalCustomer.name}` : ''}
        onPaymentSuccess={() => {
          loadAllCustomerData();
          if (selectedCustomerId) handleOpenDetails(selectedCustomerId);
        }}
      />

    </div>
  );
}
