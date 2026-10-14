/**
 * Lightweight privacy-friendly analytics client.
 * Matches FR-15 and TRD §3.
 */
let sessionId = null;
try {
  sessionId = sessionStorage.getItem('portfolio_session');
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substring(2, 12);
    sessionStorage.setItem('portfolio_session', sessionId);
  }
} catch {
  sessionId = 's_local';
}

export function track(name, props = {}) {
  const payload = {
    pageSlug: 'home',
    sessionId,
    device: window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop',
    events: [{ name, props, timestamp: Date.now() }],
  };

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/events', blob);
    } else {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silent fallback
  }
}
