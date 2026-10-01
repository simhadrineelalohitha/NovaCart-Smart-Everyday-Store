// ════════════════════════════════════════════════════════════════
// js/auth.js — Login & Register Form Logic
// ════════════════════════════════════════════════════════════════
// ⚠️  Full auth wiring coming in Stage 2.
//
// Handles both login.html and register.html forms.
// Detects which page it's on by looking for the form IDs.

document.addEventListener('DOMContentLoaded', () => {
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm)    loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  const googleButtons = document.querySelectorAll('[data-google-login]');
  googleButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const url = `${API_BASE_URL}/auth/google`;
      try {
        const response = await fetch(url, { redirect: 'manual' });
        if (response.status === 503) {
          const errorText = await response.text();
          const payload = JSON.parse(errorText || '{}');
          setMessage(payload.message || 'Google sign-in is not configured on this server.', 'error');
          return;
        }
        const location = response.headers.get('location');
        if (location) {
          window.location.href = location;
          return;
        }
        if (response.redirected || response.ok) {
          window.location.href = url;
          return;
        }
        setMessage('Google sign-in is not configured on this server.', 'error');
      } catch {
        setMessage('Google sign-in is not configured on this server.', 'error');
      }
    });
  });

  document.querySelectorAll('[data-password-toggle]').forEach((toggleBtn) => {
    toggleBtn.addEventListener('click', () => {
      const targetId = toggleBtn.dataset.passwordToggle;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
      toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  });

  const oauthError = new URLSearchParams(window.location.search).get('oauth_error');
  if (oauthError) setMessage(decodeURIComponent(oauthError), 'error');

  // Logout button (shown in navbar when user is logged in)
  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeToken();
      window.location.href = 'index.html';
    });
    // Show/hide based on login state
    updateNavbar();
  }
});

/** Show login / logout links based on current auth state */
function updateNavbar() {
  const loggedIn    = isLoggedIn();
  const loginLink   = document.getElementById('nav-login');
  const registerLink= document.getElementById('nav-register');
  const logoutLink  = document.getElementById('nav-logout');

  if (loginLink)    loginLink.style.display    = loggedIn ? 'none' : '';
  if (registerLink) registerLink.style.display = loggedIn ? 'none' : '';
  if (logoutLink)   logoutLink.style.display   = loggedIn ? '' : 'none';
}

/** Handle login form submission */
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  setMessage('', '');
  setButtonLoading('login-btn', true);

  try {
    // Stage 2 will connect this to POST /api/auth/login
    const data = await api.post('/auth/login', { email, password });
    saveToken(data.token);
    setMessage('Login successful! Redirecting…', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    setButtonLoading('login-btn', false);
  }
}

/** Handle register form submission */
async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById('name').value.trim();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (password.length < 6) {
    setMessage('Password must be at least 6 characters.', 'error');
    return;
  }

  setMessage('', '');
  setButtonLoading('register-btn', true);

  try {
    // Stage 2 will connect this to POST /api/auth/register
    const data = await api.post('/auth/register', { name, email, password });
    saveToken(data.token);
    setMessage('Account created! Redirecting…', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    setButtonLoading('register-btn', false);
  }
}

/** Display a message in the auth message box */
function setMessage(text, type) {
  const box = document.getElementById('auth-message');
  if (!box) return;
  box.textContent = text;
  box.className   = `auth-message ${type}`;
}

/** Disable / re-enable a submit button during loading */
function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? 'Please wait…' : (btnId === 'login-btn' ? 'Log In' : 'Create Account');
}
