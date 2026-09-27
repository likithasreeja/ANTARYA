/**
 * ANTARYA Google Analytics 4 (GA4) Integration Utility
 * ====================================================
 * Configured via Vite environment variable: `VITE_GA_MEASUREMENT_ID`
 * 
 * Complies with strict privacy standards:
 * - Never sends passwords, full phone numbers, or private PII
 * - Sends anonymized IDs, business event parameters, and page views
 * - Maintains an in-memory event bus for live UI debugging and MSE presentations
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

// In-memory debug log for real-time verification in the UI
const eventDebugLog = [];
const eventListeners = new Set();

export function subscribeToEvents(callback) {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

function notifyListeners(eventEntry) {
  eventListeners.forEach(listener => {
    try {
      listener(eventEntry, [...eventDebugLog]);
    } catch (e) {
      console.error('Analytics listener error:', e);
    }
  });
}

/**
 * Initialize GA4 by injecting gtag.js script if a measurement ID is configured.
 */
export function initGA() {
  if (typeof window === 'undefined') return;

  if (GA_MEASUREMENT_ID && GA_MEASUREMENT_ID.startsWith('G-')) {
    if (!document.getElementById('ga-gtag-script')) {
      const script = document.createElement('script');
      script.id = 'ga-gtag-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID, {
        send_page_view: false // We trigger manual page_views on route change
      });

      console.log(`📊 [GA4] Initialized with Measurement ID: ${GA_MEASUREMENT_ID}`);
    }
  } else {
    // Development / Demo Mode Mock
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      console.log('📊 [GA4 Debug Mode] No VITE_GA_MEASUREMENT_ID set. Events are logged locally for UI verification.');
    }
  }
}

/**
 * Sanitize event parameters to strip sensitive personal data.
 */
function sanitizeParams(params = {}) {
  const sanitized = { ...params };

  // Strip phone numbers, passwords, personal secrets
  ['password', 'phone', 'fullPhone', 'userPassword', 'secret'].forEach(key => {
    if (sanitized[key]) {
      delete sanitized[key];
    }
  });

  // Ensure numeric values are properly formatted
  if (sanitized.amount !== undefined) sanitized.amount = Number(sanitized.amount);
  if (sanitized.quantity !== undefined) sanitized.quantity = Number(sanitized.quantity);

  return sanitized;
}

/**
 * Track page views
 */
export function trackPageView(pageName, pagePath) {
  const path = pagePath || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const title = pageName || document.title || path;

  const eventEntry = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    eventName: 'page_view',
    params: {
      page_title: title,
      page_location: typeof window !== 'undefined' ? window.location.href : '',
      page_path: path
    },
    timestamp: new Date().toISOString(),
    isSentToGA: !!(GA_MEASUREMENT_ID && window.gtag)
  };

  eventDebugLog.unshift(eventEntry);
  if (eventDebugLog.length > 100) eventDebugLog.pop();
  notifyListeners(eventEntry);

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', eventEntry.params);
  }
}

/**
 * Track custom user behavior events.
 */
export function trackEvent(eventName, params = {}) {
  const cleanParams = sanitizeParams(params);

  const eventEntry = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    eventName,
    params: cleanParams,
    timestamp: new Date().toISOString(),
    isSentToGA: !!(GA_MEASUREMENT_ID && window.gtag)
  };

  eventDebugLog.unshift(eventEntry);
  if (eventDebugLog.length > 100) eventDebugLog.pop();
  notifyListeners(eventEntry);

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, cleanParams);
  }

  // Also log to console in dev mode
  if (import.meta.env.DEV) {
    console.log(`📊 [GA4 Event] ${eventName}`, cleanParams);
  }
}

/**
 * Get current Google Analytics status information.
 */
export function getGAStatus() {
  const isConfigured = Boolean(GA_MEASUREMENT_ID && GA_MEASUREMENT_ID.startsWith('G-'));
  const maskedId = isConfigured
    ? `${GA_MEASUREMENT_ID.substring(0, 4)}••••${GA_MEASUREMENT_ID.substring(GA_MEASUREMENT_ID.length - 2)}`
    : 'Not Configured';

  return {
    isConfigured,
    measurementId: GA_MEASUREMENT_ID,
    maskedId,
    eventCount: eventDebugLog.length,
    recentEvents: [...eventDebugLog]
  };
}

/**
 * Standard Events Catalog supported by ANTARYA
 */
export const TRACKED_EVENTS_CATALOG = [
  { name: 'page_view', desc: 'Triggered automatically when the user navigates to any screen', params: ['page_title', 'page_path'] },
  { name: 'onboarding_started', desc: 'Fired when a new shop owner begins the registration walkthrough', params: ['source'] },
  { name: 'shop_registered', desc: 'Fired when the store profile is successfully created', params: ['shop_id', 'city'] },
  { name: 'login_completed', desc: 'Fired upon successful authentication', params: ['method'] },
  { name: 'customer_added', desc: 'Fired when a single new customer is added manually', params: ['customer_id', 'city'] },
  { name: 'customer_viewed', desc: 'Fired when customer details profile modal is opened', params: ['customer_id', 'segment'] },
  { name: 'customer_segment_viewed', desc: 'Fired when filtering customers by segment', params: ['segment'] },
  { name: 'product_added', desc: 'Fired when an inventory item SKU is registered', params: ['product_id', 'category', 'price'] },
  { name: 'stock_added', desc: 'Fired when stock quantity is replenished', params: ['product_id', 'quantity', 'cost'] },
  { name: 'sale_created', desc: 'Fired when a customer bill is finalized (Cash / UPI / Udhaar)', params: ['sale_id', 'amount', 'payment_method', 'item_count'] },
  { name: 'voice_sale_started', desc: 'Fired when the user activates the voice microphone for speech billing', params: ['language'] },
  { name: 'dashboard_viewed', desc: 'Fired when viewing the main store dashboard', params: ['time_of_day'] },
  { name: 'analytics_dashboard_viewed', desc: 'Fired when opening the Product Analytics KPI center', params: ['date_range'] },
  { name: 'filter_changed', desc: 'Fired when toggling date range or category filters', params: ['filter_type', 'value'] },
  { name: 'search_used', desc: 'Fired when using customer or product search bars', params: ['search_scope', 'query_length'] },
  { name: 'payment_qr_viewed', desc: 'Fired when UPI QR payment terminal or modal is opened', params: ['amount_range', 'payment_method'] },
  { name: 'payment_initiated', desc: 'Fired when a customer UPI QR payment session is created', params: ['payment_method', 'amount_range'] },
  { name: 'payment_confirmed', desc: 'Fired when shopkeeper verifies payment receipt', params: ['payment_method', 'amount_range'] },
  { name: 'payment_failed', desc: 'Fired when a payment attempt fails or is marked as unreceived', params: ['payment_method', 'reason'] },
  { name: 'invoice_created', desc: 'Fired when a printable GST/Kirana invoice or receipt is generated', params: ['payment_method', 'item_count'] },
  { name: 'checkout_started', desc: 'Fired when checkout order screen or voice cart is reviewed', params: ['item_count', 'amount_range'] },
  { name: 'prediction_viewed', desc: 'Fired when reviewing the Two-Stage CatBoost demand prediction', params: ['product_name', 'predicted_demand'] },
  { name: 'recommendation_viewed', desc: 'Fired when opening the AI Reorder & Smart Suggestion card', params: ['recommendation_type'] }
];

export default {
  initGA,
  trackPageView,
  trackEvent,
  getGAStatus,
  subscribeToEvents,
  TRACKED_EVENTS_CATALOG
};
