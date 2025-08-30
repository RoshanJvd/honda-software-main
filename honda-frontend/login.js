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

roleSel.addEventListener('change', () => {
  adminBlock.style.display = roleSel.value === 'admin' ? 'block' : 'none';
  setError('');
});

$('#demoAgent').onclick = () => {
  saveAuth({ name: 'Demo Agent', role: 'agent', remember: 1 });
  location.href = './index.html';
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  setError('');
  const name = $('#name').value.trim();
  const role = roleSel.value;
  const remember = $('#remember').value === '1';

  if (role === 'admin') {
    const pass = $('#adminPass').value;
    if (!pass || pass !== (window.ADMIN_KEY || 'yahya123')) {
      return setError('Invalid admin password');
    }
  }

  saveAuth({ name, role, remember });
  location.href = './index.html';
});
