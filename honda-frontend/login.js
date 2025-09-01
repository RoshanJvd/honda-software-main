// login.js
const $ = (s, c=document) => c.querySelector(s);
const form = $('#loginForm');
const roleSel = $('#role');
const adminBlock = $('#adminBlock');
const err = $('#err');

function setError(msg='') { err.textContent = msg; }
function saveAuth({ name, role, remember }) {
  const user = { name: name || 'User', role, ts: Date.now() };
  localStorage.setItem('auth.user', JSON.stringify(user));
  localStorage.setItem('role', JSON.stringify(role)); // keep legacy compatibility
  if (!remember) sessionStorage.setItem('auth.session', '1');
}

function loadUsers() {
  try { return JSON.parse(localStorage.getItem('users') || '[]'); } catch { return []; }
}
function saveUsers(u) { localStorage.setItem('users', JSON.stringify(u)); }

// Seed admin if no users exist
if (!loadUsers().length) {
  saveUsers([{ name: 'Administrator', role: 'admin', pass: (window.ADMIN_KEY || 'yahya123') }]);
}

roleSel.addEventListener('change', () => {
  adminBlock.style.display = roleSel.value === 'admin' ? 'block' : 'none';
  setError('');
});

// demoAgent button removed

form.addEventListener('submit', (e) => {
  e.preventDefault();
  setError('');
  const name = $('#name').value.trim();
  const role = roleSel.value;
  const remember = $('#remember').value === '1';

  // Admin login via admin password
  if (role === 'admin') {
    const pass = $('#adminPass').value;
    if (!pass || pass !== (window.ADMIN_KEY || 'yahya123')) {
      return setError('Invalid admin password');
    }
    saveAuth({ name, role, remember });
    return location.href = './index.html';
  }

  // Non-admins must exist in users list and match name+role
  const users = loadUsers();
  const found = users.find((u) => u.role === role && u.name.toLowerCase() === name.toLowerCase());
  if (!found) return setError('User not found — ask admin to create your account');
  // For simplicity we don't use passwords for non-admins here (could be added)
  saveAuth({ name, role, remember });
  location.href = './index.html';
  location.href = './index.html';
});
