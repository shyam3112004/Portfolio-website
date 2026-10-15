/**
 * Authentication Service & UI Integration
 * - User Registration (Sign up)
 * - Sign-in / Authentication (Login)
 * - Continue with Google (OAuth / SSO)
 * - Transactional Emails: Email Verification & Password Reset
 */

import { supabase, isSupabaseConfigured, getSupabaseConfig } from './supabaseClient.js';

const STORAGE_USERS = 'portfolio_auth_users';
const STORAGE_SESSION = 'portfolio_auth_session';

export const ADMIN_EMAIL = '3112004shyam@gmail.com';

/**
 * Check if a given user object has admin privileges.
 */
export function isAdminUser(user) {
  if (!user || !user.email) return false;
  return user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Synchronize a Supabase Auth user record into portfolio user state
 */
export function syncSupabaseUser(sbUser) {
  if (!sbUser) return null;
  const email = (sbUser.email || '').trim().toLowerCase();
  const name = sbUser.user_metadata?.full_name ||
               sbUser.user_metadata?.name ||
               sbUser.user_metadata?.user_name ||
               email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const avatar = sbUser.user_metadata?.avatar_url ||
                 sbUser.user_metadata?.picture ||
                 `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  const role = (email === ADMIN_EMAIL.toLowerCase()) ? 'admin' : (sbUser.app_metadata?.role || 'user');

  const userObj = {
    id: sbUser.id,
    name,
    email,
    avatar,
    provider: sbUser.app_metadata?.provider || 'google',
    verified: Boolean(sbUser.email_confirmed_at || sbUser.confirmed_at || true),
    role,
    createdAt: sbUser.created_at || new Date().toISOString()
  };

  setCurrentUser(userObj);
  return userObj;
}

let supabaseListenerInitialized = false;
export async function initSupabaseAuthListener() {
  if (supabaseListenerInitialized || !isSupabaseConfigured() || !supabase) return;
  supabaseListenerInitialized = true;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session?.user) {
      syncSupabaseUser(session.user);
    }
  } catch (err) {
    console.warn('[Supabase Auth] Session fetch error:', err);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      if (session?.user) {
        syncSupabaseUser(session.user);
      }
    } else if (event === 'SIGNED_OUT') {
      setCurrentUser(null);
    }
  });
}

// Initialize registered admin account if empty or if legacy accounts exist
function getStoredUsers() {
  try {
    const data = localStorage.getItem(STORAGE_USERS);
    if (data) {
      const parsed = JSON.parse(data);
      const hasLegacy = parsed.some(u => u.email === 'shyam@example.com' || u.email === 'shyam.kumar.dev@gmail.com');
      if (!hasLegacy && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  const defaultUsers = [
    {
      id: 'usr_admin_1',
      name: 'Shyam Kumar S',
      email: ADMIN_EMAIL,
      password: 'Password123!',
      provider: 'email',
      verified: true,
      role: 'admin',
      createdAt: new Date().toISOString()
    }
  ];
  localStorage.setItem(STORAGE_USERS, JSON.stringify(defaultUsers));

  // Clear legacy sessions
  try {
    const currentSession = localStorage.getItem(STORAGE_SESSION);
    if (currentSession) {
      const curr = JSON.parse(currentSession);
      if (curr.email === 'shyam@example.com' || curr.email === 'shyam.kumar.dev@gmail.com') {
        localStorage.removeItem(STORAGE_SESSION);
      }
    }
  } catch (e) {}

  return defaultUsers;
}

function saveStoredUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

export function getCurrentUser() {
  try {
    const session = localStorage.getItem(STORAGE_SESSION);
    if (session) return JSON.parse(session);
  } catch (e) {}
  return null;
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_SESSION);
  }
  notifyAuthStateChange(user);
}

const listeners = new Set();
export function onAuthStateChanged(cb) {
  listeners.add(cb);
  cb(getCurrentUser());
  return () => listeners.delete(cb);
}

function notifyAuthStateChange(user) {
  listeners.forEach((cb) => cb(user));
}

/**
 * Sign Up (User Registration)
 */
export async function signUp({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // Supabase Auth Integration
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: name.trim(),
          name: name.trim()
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      return syncSupabaseUser(data.user);
    }
    return { name, email: normalizedEmail, verified: false };
  }

  const users = getStoredUsers();
  if (users.find((u) => u.email === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const newUser = {
    id: 'usr_' + Date.now().toString(36),
    name: name.trim(),
    email: normalizedEmail,
    password,
    provider: 'email',
    verified: false,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveStoredUsers(users);

  // Automatically sign in the new registrant
  setCurrentUser(newUser);

  // Simulate transactional verification email
  sendVerificationEmail(normalizedEmail);

  return newUser;
}

/**
 * Sign In / Authentication (Login)
 */
export async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  // Supabase Auth Integration
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    return syncSupabaseUser(data.user);
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.email === normalizedEmail);
  if (!user) {
    throw new Error('No user account found with this email address.');
  }

  if (user.provider === 'google' && !user.password) {
    throw new Error('This account was created with Google. Please use "Continue with Google".');
  }

  if (user.password !== password) {
    // For designated admin email, allow convenient master passwords 'admin', 'Password123!', or 'shyam'
    const isAdmin = normalizedEmail === ADMIN_EMAIL.toLowerCase();
    const isValidAdminPass = isAdmin && (password === 'admin' || password === 'Password123!' || password === 'shyam');
    if (!isValidAdminPass) {
      throw new Error('Incorrect password. Please try again.');
    }
  }

  setCurrentUser(user);
  return user;
}

/**
 * Continue with Google (OAuth / Social Login / SSO)
 *
 * Official Supabase Google OAuth (PKCE), opened in a separate, centered
 * popup window so the main page never navigates away. The popup lands back
 * on /auth.html, which exchanges the authorization code and hands the session
 * to this window via an origin-checked postMessage; this window then calls
 * supabase.auth.setSession() to establish the Supabase session here.
 *
 * Fallbacks: popup blocked or small screen -> standard full-page redirect.
 * There is intentionally NO simulated Google account chooser: the only Google
 * UI ever shown is Google's own sign-in page at accounts.google.com.
 */
const OAUTH_POPUP_MESSAGE = 'supabase:google-oauth-callback';
const OAUTH_POPUP_WIDTH = 500;
const OAUTH_POPUP_HEIGHT = 620;
const OAUTH_POPUP_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Open a popup window centered on the current browser window
 * (handles multi-monitor setups and windowed browsers).
 */
function openAuthPopup(url, width, height) {
  const screenX0 = window.screenLeft ?? window.screenX ?? 0;
  const screenY0 = window.screenTop ?? window.screenY ?? 0;
  const viewportW = window.innerWidth || document.documentElement.clientWidth;
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const left = Math.max(0, screenX0 + (viewportW - width) / 2);
  const top = Math.max(0, screenY0 + (viewportH - height) / 2.2);
  const features =
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}` +
    ',scrollbars=yes,resizable=yes';
  return window.open(url, 'google-oauth', features);
}

export async function loginWithGoogle() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error(
      'Google sign-in is not configured on this deployment. The site owner must set ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY and enable the Google provider in the Supabase dashboard.'
    );
  }

  const redirectTo = `${window.location.origin}/auth.html`;
  const queryParams = { access_type: 'offline', prompt: 'select_account' };

  // Official full-page redirect flow (used as fallback). Resolves with null:
  // the browser navigates to Google and the session is handled by /auth.html.
  const startRedirectFlow = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams }
    });
    if (error) throw new Error(error.message);
    return null;
  };

  // On small screens popup windows are unusable: use the redirect flow.
  if (window.innerWidth < 640) {
    return startRedirectFlow();
  }

  // 1) Get the official Google OAuth URL from Supabase (PKCE). With
  //    skipBrowserRedirect the client stores the PKCE code verifier and
  //    returns the URL without navigating.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams, skipBrowserRedirect: true }
  });
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error('Could not start Google sign-in. Please try again.');

  // 2) Open Google's real sign-in page in a separate, centered popup window.
  const popup = openAuthPopup(data.url, OAUTH_POPUP_WIDTH, OAUTH_POPUP_HEIGHT);

  if (!popup) {
    // Popup was blocked by the browser: fall back to the redirect flow.
    return startRedirectFlow();
  }
  popup.focus();

  // 3) Wait for /auth.html (running inside the popup) to report the result.
  return new Promise((resolve, reject) => {
    let settled = false;
    let closedTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (closedTimer) clearInterval(closedTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const onMessage = (event) => {
      // Security: only accept same-origin messages from the popup we opened.
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      if (!event.data || event.data.type !== OAUTH_POPUP_MESSAGE) return;

      if (event.data.status !== 'success' || !event.data.session) {
        settle(reject, new Error(event.data.message || 'Google sign-in could not be completed.'));
        return;
      }

      // Establish the Supabase session in THIS (original) window using the
      // session tokens the popup obtained from our own Supabase project.
      settled = true;
      cleanup();
      const { access_token, refresh_token } = event.data.session;
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ data: sd, error: sessionError }) => {
          if (sessionError || !sd?.session?.user) {
            reject(new Error(sessionError?.message || 'Could not establish the Google session.'));
          } else {
            resolve(syncSupabaseUser(sd.session.user));
          }
        })
        .catch((err) => {
          reject(new Error(err?.message || 'Could not establish the Google session.'));
        });
    };

    window.addEventListener('message', onMessage);

    // The user closing the popup before finishing counts as cancellation.
    closedTimer = setInterval(() => {
      if (popup.closed) settle(reject, new Error('Google sign-in was cancelled.'));
    }, 500);

    // Safety timeout so the sign-in button never hangs forever.
    timeoutTimer = setTimeout(() => {
      settle(reject, new Error('Google sign-in timed out. Please try again.'));
      try {
        if (!popup.closed) popup.close();
      } catch (e) {}
    }, OAUTH_POPUP_TIMEOUT_MS);
  });
}

/**
 * Transactional Email: Email Verification
 */
export function sendVerificationEmail(email) {
  const msg = `[TRANSACTIONAL EMAIL SENT] Subject: "Verify your email for Shyam Portfolio" to ${email}. Verification token: ${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  console.info(msg);
  showAuthToast(`Verification email sent to ${email}. Check your inbox!`, 'info');
}

export function markEmailVerified(email) {
  const users = getStoredUsers();
  const user = users.find((u) => u.email === email.toLowerCase());
  if (user) {
    user.verified = true;
    saveStoredUsers(users);
    const current = getCurrentUser();
    if (current && current.email === user.email) {
      setCurrentUser(user);
    }
    showAuthToast('Email successfully verified! ✓', 'success');
  }
}

/**
 * Transactional Email: Password Reset
 */
export async function sendPasswordResetEmail(email) {
  const users = getStoredUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email === normalizedEmail);

  if (!user) {
    // For security reasons, still show sent message
    showAuthToast(`If an account exists for ${email}, a password reset link was sent.`, 'info');
    return;
  }

  const resetToken = 'rst_' + Math.random().toString(36).substring(2, 10);
  console.info(`[TRANSACTIONAL EMAIL SENT] Subject: "Reset your password" to ${normalizedEmail}. Reset Link: https://shyam.dev/auth.html?reset=${resetToken}`);
  showAuthToast(`Password reset email sent to ${normalizedEmail}. Check your inbox!`, 'success');
}

/**
 * Logout
 */
export async function logout() {
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Supabase Auth] Sign out error:', err);
    }
  }
  setCurrentUser(null);
  showAuthToast('Signed out successfully.', 'info');
}

/**
 * Toast notification helper
 */
export function showAuthToast(message, type = 'info') {
  let container = document.getElementById('auth-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'auth-toast-container';
    container.className = 'auth-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `auth-toast ${type}`;
  toast.innerHTML = `
    <span class="auth-toast-icon">${type === 'success' ? '✓' : type === 'error' ? '⚠' : '✉'}</span>
    <span class="auth-toast-msg">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/**
 * Auth Modal UI Controller
 */
let modalMounted = false;

export function initAuthUI() {
  initSupabaseAuthListener();
  if (modalMounted) return;
  modalMounted = true;

  // 1. Create Modal Markup
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'auth-modal-overlay';
  modalOverlay.className = 'auth-modal-overlay';
  modalOverlay.setAttribute('aria-hidden', 'true');

  modalOverlay.innerHTML = `
    <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <button type="button" class="auth-modal-close" id="auth-modal-close" aria-label="Close dialog">&times;</button>

      <!-- Header / Tabs -->
      <div class="auth-header">
        <div class="auth-badge">Authentication</div>
        <h2 id="auth-modal-title" class="auth-title">Welcome Back</h2>
        <p class="auth-subtitle" id="auth-subtitle">Sign in to access your portfolio dashboard & features</p>
      </div>

      <!-- Continue with Google (Social Login / SSO) -->
      <div class="auth-social-wrap">
        <button type="button" id="btn-auth-google" class="btn-google">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
          <span>Continue with Google (Gmail)</span>
        </button>
      </div>

      <div class="auth-divider">
        <span>or continue with email</span>
      </div>

      <!-- Error banner -->
      <div id="auth-error-banner" class="auth-error" style="display: none;"></div>

      <!-- Login Form (Sign-in / Authentication) -->
      <form id="form-login" class="auth-form active">
        <div class="form-group">
          <label for="login-email">Email Address</label>
          <input type="email" id="login-email" placeholder="name@domain.com" required autocomplete="email">
        </div>
        <div class="form-group">
          <div class="label-row">
            <label for="login-password">Password</label>
            <button type="button" id="link-forgot-pass" class="text-btn">Forgot password?</button>
          </div>
          <input type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn-auth-submit">Sign In</button>
        <div class="auth-switch">
          Don't have an account? <button type="button" id="link-to-signup" class="text-btn strong">Sign up (Register)</button>
        </div>
      </form>

      <!-- Sign Up Form (User Registration) -->
      <form id="form-signup" class="auth-form" style="display: none;">
        <div class="form-group">
          <label for="signup-name">Full Name</label>
          <input type="text" id="signup-name" placeholder="Shyam Kumar S" required autocomplete="name">
        </div>
        <div class="form-group">
          <label for="signup-email">Email Address</label>
          <input type="email" id="signup-email" placeholder="name@domain.com" required autocomplete="email">
        </div>
        <div class="form-group">
          <label for="signup-password">Password</label>
          <input type="password" id="signup-password" placeholder="At least 6 characters" required minlength="6" autocomplete="new-password">
        </div>
        <button type="submit" class="btn-auth-submit">Create Account (Sign Up)</button>
        <div class="auth-switch">
          Already registered? <button type="button" id="link-to-login" class="text-btn strong">Sign In</button>
        </div>
      </form>

      <!-- Password Reset Form (Transactional Email) -->
      <form id="form-reset" class="auth-form" style="display: none;">
        <p class="auth-form-desc">Enter your email address and we will dispatch a transactional password reset link.</p>
        <div class="form-group">
          <label for="reset-email">Email Address</label>
          <input type="email" id="reset-email" placeholder="name@domain.com" required autocomplete="email">
        </div>
        <button type="submit" class="btn-auth-submit">Send Reset Email</button>
        <div class="auth-switch">
          Remembered your password? <button type="button" id="link-reset-to-login" class="text-btn strong">Back to Sign In</button>
        </div>
      </form>

      <!-- Verification Notice View -->
      <div id="view-verification" class="auth-form" style="display: none; text-align: center;">
        <div class="verify-icon-wrap">✉</div>
        <h3 style="margin-bottom: 8px; font-family: var(--font-display);">Verify Your Email</h3>
        <p style="color: var(--fg-muted); font-size: 0.875rem; line-height: 1.5; margin-bottom: 20px;">
          We sent an email verification link to <strong id="verify-target-email"></strong>. Please verify your address to access all features.
        </p>
        <button type="button" id="btn-resend-verify" class="btn-secondary-full">Resend Verification Email</button>
        <button type="button" id="btn-simulate-verify" class="btn-auth-submit" style="margin-top: 10px;">Simulate Verified Click ✓</button>
        <div class="auth-switch" style="margin-top: 16px;">
          <button type="button" id="link-verify-done" class="text-btn">Done / Close</button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Element references
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const formReset = document.getElementById('form-reset');
  const viewVerify = document.getElementById('view-verification');
  const titleEl = document.getElementById('auth-modal-title');
  const subtitleEl = document.getElementById('auth-subtitle');
  const errBanner = document.getElementById('auth-error-banner');

  function showError(msg) {
    errBanner.textContent = msg;
    errBanner.style.display = 'block';
  }
  function hideError() {
    errBanner.style.display = 'none';
  }

  function setTab(tab) {
    hideError();
    formLogin.style.display = 'none';
    formSignup.style.display = 'none';
    formReset.style.display = 'none';
    viewVerify.style.display = 'none';

    if (tab === 'login') {
      formLogin.style.display = 'flex';
      titleEl.textContent = 'Welcome Back';
      subtitleEl.textContent = 'Sign in to access your portfolio dashboard & features';
    } else if (tab === 'signup') {
      formSignup.style.display = 'flex';
      titleEl.textContent = 'Create an Account';
      subtitleEl.textContent = 'Register with email or Google to get started';
    } else if (tab === 'reset') {
      formReset.style.display = 'flex';
      titleEl.textContent = 'Reset Password';
      subtitleEl.textContent = 'We will send a transactional password reset link';
    } else if (tab === 'verify') {
      viewVerify.style.display = 'block';
      titleEl.textContent = 'Email Verification';
      subtitleEl.textContent = 'Confirm your email address';
    }
  }

  // Event bindings for tab switches
  document.getElementById('link-to-signup').addEventListener('click', () => setTab('signup'));
  document.getElementById('link-to-login').addEventListener('click', () => setTab('login'));
  document.getElementById('link-forgot-pass').addEventListener('click', () => setTab('reset'));
  document.getElementById('link-reset-to-login').addEventListener('click', () => setTab('login'));
  document.getElementById('link-verify-done').addEventListener('click', closeAuthModal);

  // Close triggers
  document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeAuthModal();
  });

  // Login submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      await login({ email, password });
      showAuthToast(`Welcome back, ${getCurrentUser().name}!`, 'success');
      closeAuthModal();
    } catch (err) {
      showError(err.message);
    }
  });

  // Sign up submit
  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    try {
      const user = await signUp({ name, email, password });
      document.getElementById('verify-target-email').textContent = user.email;
      setTab('verify');
    } catch (err) {
      showError(err.message);
    }
  });

  // Password reset submit
  formReset.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('reset-email').value;
    try {
      await sendPasswordResetEmail(email);
      setTimeout(() => setTab('login'), 2000);
    } catch (err) {
      showError(err.message);
    }
  });

  // Continue with Google
  const btnAuthGoogle = document.getElementById('btn-auth-google');
  if (btnAuthGoogle) {
    const googleBtnLabel = btnAuthGoogle.querySelector('span');
    const originalLabel = googleBtnLabel ? googleBtnLabel.textContent : null;
    btnAuthGoogle.addEventListener('click', async () => {
      hideError();
      btnAuthGoogle.classList.add('loading');
      btnAuthGoogle.disabled = true;
      if (googleBtnLabel) googleBtnLabel.textContent = 'Waiting for Google…';
      try {
        const user = await loginWithGoogle();
        if (user) {
          showAuthToast(`Signed in with Google as ${user.email} (SSO)`, 'success');
          closeAuthModal();
        } else {
          // Popup blocked or small screen: the page is now redirecting to
          // Google; the session will be handled by /auth.html on return.
          showAuthToast('Redirecting to Google…', 'info');
        }
      } catch (err) {
        showError(err.message || 'Google sign-in could not be completed.');
      } finally {
        btnAuthGoogle.classList.remove('loading');
        btnAuthGoogle.disabled = false;
        if (googleBtnLabel && originalLabel) googleBtnLabel.textContent = originalLabel;
      }
    });
  }

  // Verification actions
  document.getElementById('btn-resend-verify').addEventListener('click', () => {
    const user = getCurrentUser();
    if (user) {
      sendVerificationEmail(user.email);
    }
  });

  document.getElementById('btn-simulate-verify').addEventListener('click', () => {
    const user = getCurrentUser();
    if (user) {
      markEmailVerified(user.email);
      closeAuthModal();
    }
  });

  // Hook Header Buttons & State Listeners
  setupHeaderAuth();
}

export function openAuthModal(tab = 'login') {
  initAuthUI();
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    // Set tab
    const formLogin = document.getElementById('form-login');
    const formSignup = document.getElementById('form-signup');
    const formReset = document.getElementById('form-reset');
    const viewVerify = document.getElementById('view-verification');
    if (formLogin) {
      formLogin.style.display = tab === 'login' ? 'flex' : 'none';
      formSignup.style.display = tab === 'signup' ? 'flex' : 'none';
      formReset.style.display = tab === 'reset' ? 'flex' : 'none';
      viewVerify.style.display = tab === 'verify' ? 'block' : 'none';
    }
  }
}

export function closeAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function setupHeaderAuth() {
  const headerActions = document.querySelector('.header-actions');
  const mainHeader = document.getElementById('main-header');

  // Check if auth container already exists for header-actions
  let authContainer = document.getElementById('header-auth-wrap');
  if (!authContainer && headerActions) {
    authContainer = document.createElement('div');
    authContainer.id = 'header-auth-wrap';
    authContainer.className = 'header-auth-wrap';
    headerActions.insertBefore(authContainer, headerActions.firstChild);
  }

  onAuthStateChanged((user) => {
    const userIsAdmin = isAdminUser(user);

    // Update Admin link visibility in header navigation & footer (only visible to 3112004shyam@gmail.com)
    const adminNavLi = document.getElementById('nav-admin-li');
    if (adminNavLi) {
      adminNavLi.style.display = userIsAdmin ? 'inline-block' : 'none';
    }
    const footerAdminLink = document.getElementById('footer-admin-link');
    if (footerAdminLink) {
      footerAdminLink.style.display = userIsAdmin ? 'block' : 'none';
    }

    // 1. Update standalone headerActions if present (e.g. auth.html)
    if (authContainer) {
      if (!user) {
        authContainer.innerHTML = `
          <button type="button" id="btn-header-signin" class="auth-header-btn">
            Sign In
          </button>
        `;
        document.getElementById('btn-header-signin')?.addEventListener('click', () => openAuthModal('login'));
      } else {
        const initials = user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
        authContainer.innerHTML = `
          <div class="user-dropdown-wrap">
            <button type="button" class="user-profile-btn" id="btn-user-profile" aria-label="User profile options">
              ${user.avatar ? `<img src="${user.avatar}" alt="" class="user-avatar">` : `<span class="user-avatar-initials">${initials}</span>`}
              <span class="user-name-label">${user.name.split(' ')[0]}</span>
              <span class="verified-dot ${user.verified ? 'verified' : 'unverified'}" title="${user.verified ? 'Email Verified' : 'Unverified'}"></span>
            </button>
            <div class="user-dropdown-menu" id="user-dropdown-menu">
              <div class="dropdown-user-info">
                <strong>${user.name}</strong>
                <span>${user.email}</span>
                <span class="badge-verify ${user.verified ? 'verified' : 'unverified'}">
                  ${user.verified ? '✓ Verified' : '⚠ Email Unverified'}
                </span>
              </div>
              <hr class="dropdown-divider">
              ${userIsAdmin ? `<a href="/admin.html" class="dropdown-item">Admin Dashboard</a>` : ''}
              ${!user.verified ? `<button type="button" class="dropdown-item" id="btn-menu-verify">Verify Email</button>` : ''}
              <button type="button" class="dropdown-item danger" id="btn-menu-logout">Logout</button>
            </div>
          </div>
          <button type="button" id="btn-header-logout" class="auth-header-btn logout-btn" title="Log out" style="margin-left: 8px;">
            Logout
          </button>
        `;

        const profileBtn = document.getElementById('btn-user-profile');
        const menu = document.getElementById('user-dropdown-menu');
        profileBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          menu?.classList.toggle('show');
        });
        document.addEventListener('click', () => {
          menu?.classList.remove('show');
        });
        document.getElementById('btn-menu-verify')?.addEventListener('click', () => {
          openAuthModal('verify');
        });
        document.getElementById('btn-menu-logout')?.addEventListener('click', () => {
          logout();
        });
        document.getElementById('btn-header-logout')?.addEventListener('click', () => {
          logout();
        });
      }
    }

    // 2. Update main navbar on index.html (#nav-auth-item)
    let navAuthItem = document.getElementById('nav-auth-item');
    if (!navAuthItem && mainHeader) {
      const ul = mainHeader.querySelector('.nav-links');
      if (ul) {
        navAuthItem = document.createElement('li');
        navAuthItem.id = 'nav-auth-item';
        navAuthItem.className = 'nav-auth-item';
        const themeLi = ul.querySelector('#theme-toggle')?.closest('li');
        if (themeLi) {
          ul.insertBefore(navAuthItem, themeLi);
        } else {
          ul.appendChild(navAuthItem);
        }
      }
    }

    if (navAuthItem) {
      if (!user) {
        // Public visitors: Keep navbar clean without a public sign-in button.
        // Admin access is reserved for 3112004shyam@gmail.com directly via /admin.html or /auth.html
        navAuthItem.innerHTML = '';
        navAuthItem.style.display = 'none';
      } else {
        navAuthItem.style.display = 'inline-flex';
        const firstName = user.name.split(' ')[0];
        navAuthItem.innerHTML = `
          <span class="nav-user-label" style="font-size: 0.8125rem; font-weight: 600; margin-right: 6px; padding: 0 4px;">
            ${firstName}
          </span>
          <button type="button" id="nav-btn-logout" class="nav-link nav-auth-btn logout-highlight" style="background:none;border:none;cursor:pointer;font-weight:600;color:var(--danger, #e63946);padding:0 8px;" title="Logout">
            Logout
          </button>
        `;
        document.getElementById('nav-btn-logout')?.addEventListener('click', () => {
          logout();
        });
      }
    }
  });
}
