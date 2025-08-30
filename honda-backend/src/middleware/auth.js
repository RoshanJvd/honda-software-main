// src/middleware/auth.js
export function requireRole(roles = []) {
  return (req, res, next) => {
    const role = (req.headers['x-role'] || 'agent').toString();
    req.userRole = role; // optional: handy for logging

    // ⬇︎ Admin can do everything
    if (role === 'admin') return next();

    if (roles.length && !roles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}
