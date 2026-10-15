/**
 * Theme Manager (Dark / White / System mode)
 * Handles theme initialization, localStorage persistence, and system preference detection.
 */
export function initTheme() {
  const storageKey = 'portfolio_theme';
  const themeToggleBtn = document.getElementById('theme-toggle');

  function getPreferredTheme() {
    const saved = localStorage.getItem(storageKey);
    // Default is strictly white/light unless explicitly set to dark
    return saved === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // Set initial theme
  const current = getPreferredTheme();
  applyTheme(current);

  // Toggle button handler
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    });
  }
}
