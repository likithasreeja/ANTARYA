import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './context/StoreContext';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Landing from './screens/Landing';
import Onboarding from './screens/Onboarding';
import Dashboard from './screens/Dashboard';
import ProductAnalytics from './screens/ProductAnalytics';
import AnalyticsSetup from './screens/AnalyticsSetup';
import QuickSale from './screens/QuickSale';
import DecisionCenter from './screens/DecisionCenter';
import LearningEngine from './screens/LearningEngine';
import AddStock from './screens/AddStock';
import MyStock from './screens/MyStock';
import MyMoney from './screens/MyMoney';
import MyCustomers from './screens/MyCustomers';
import SmartSuggestion from './screens/SmartSuggestion';
import AskAnything from './screens/AskAnything';
import GrowShop from './screens/GrowShop';
import Complaints from './screens/Complaints';
import PaymentManager from './screens/PaymentManager';
import ErrorBoundary from './components/ErrorBoundary';
import { initGA, trackPageView } from './utils/analytics';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useStore();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your shop...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export default function App() {
  const { isAuthenticated, loading, shop } = useStore();
  const location = useLocation();
  const hideNav = location.pathname === '/' || location.pathname === '/onboarding';
  const showNav = !hideNav && isAuthenticated && shop?.setupComplete;

  // Initialize GA4 once on application start
  useEffect(() => {
    initGA();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    trackPageView(document.title || location.pathname, location.pathname);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading ANTARYA...</p>
      </div>
    );
  }

  return (
    <div className="app-container app-layout">
      {showNav && <Sidebar />}

      <div className="main-content-area">
        {showNav && <Header />}

        <ErrorBoundary>
          <Routes>
            <Route
              path="/onboarding"
              element={
                isAuthenticated && shop?.setupComplete
                  ? <Navigate to="/dashboard" replace />
                  : <Onboarding />
              }
            />
            <Route
              path="/"
              element={
                isAuthenticated && shop?.setupComplete
                  ? <Navigate to="/dashboard" replace />
                  : <Landing />
              }
            />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/product-analytics" element={<ProtectedRoute><ProductAnalytics /></ProtectedRoute>} />
            <Route path="/analytics-setup" element={<ProtectedRoute><AnalyticsSetup /></ProtectedRoute>} />
            <Route path="/decision-center" element={<ProtectedRoute><DecisionCenter /></ProtectedRoute>} />
            <Route path="/learning-engine" element={<ProtectedRoute><LearningEngine /></ProtectedRoute>} />
            <Route path="/sale" element={<ProtectedRoute><QuickSale /></ProtectedRoute>} />
            <Route path="/add-stock" element={<ProtectedRoute><AddStock /></ProtectedRoute>} />
            <Route path="/stock" element={<ProtectedRoute><MyStock /></ProtectedRoute>} />
            <Route path="/money" element={<ProtectedRoute><MyMoney /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><MyCustomers /></ProtectedRoute>} />
            <Route path="/suggestions" element={<ProtectedRoute><SmartSuggestion /></ProtectedRoute>} />
            <Route path="/ask" element={<ProtectedRoute><AskAnything /></ProtectedRoute>} />
            <Route path="/grow" element={<ProtectedRoute><GrowShop /></ProtectedRoute>} />
            <Route path="/complaints" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PaymentManager /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>

        {showNav && <BottomNav />}
      </div>
    </div>
  );
}
