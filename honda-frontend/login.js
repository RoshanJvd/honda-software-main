// login.js
const $ = (s, c=document) => c.querySelector(s);
const form = $('#loginForm');
const roleSel = $('#role');
const err = $('#err');

function setError(msg='') { err.textContent = msg; }
function saveAuth({ name, role, userId }) {
  const user = { name: name || 'User', role, id: userId, ts: Date.now() };
  localStorage.setItem('auth.user', JSON.stringify(user));
  localStorage.setItem('role', JSON.stringify(role)); // keep legacy compatibility
}

// API base URL - should match the backend
const API_BASE = window.__API_BASE || "http://localhost:4000/api";

// Authenticate user against backend
async function authenticateUser(name, role, password) {
  try {
    const response = await fetch(`${API_BASE}/users/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, role, password })
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'User not found - ask admin to create your account' };
      }
      if (response.status === 401) {
        return { success: false, error: 'Invalid password' };
      }
      return { success: false, error: 'Unable to connect to server' };
    }

    const data = await response.json();

    if (data.success) {
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.message || 'Authentication failed' };
    }

  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Connection error - please try again' };
  }
}

// demoAgent button removed

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  const name = $('#name').value.trim();
  const role = roleSel.value;
  const password = $('#password')?.value || '';

  if (!name) {
    return setError('Please enter your name');
  }

  // Only require password for admin users
  if (role === 'admin' && !password) {
    return setError('Please enter your password');
  }

  // Show loading state
  const submitBtn = $('#loginBtn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Signing in...';
  submitBtn.disabled = true;

  try {
    // Authenticate user
    const result = await authenticateUser(name, role, password);

    if (result.success) {
      // Save authentication data
      saveAuth({
        name: result.user.name,
        role: result.user.role,
        userId: result.user._id
      });

      // Redirect to main app
      location.href = './index.html';
    } else {
      setError(result.error);
    }
  } catch (error) {
    console.error('Login error:', error);
    setError('Connection error - please try again');
  } finally {
    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});
