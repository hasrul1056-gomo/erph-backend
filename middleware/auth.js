const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token diperlukan' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak sah atau tamat tempoh' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.peranan)) {
    return res.status(403).json({ error: 'Akses tidak dibenarkan' });
  }
  next();
};

const requireGPKKurikulum = (req, res, next) => {
  if (req.user.peranan !== 'gpk' || req.user.gpk_jenis === 'hem') {
    return res.status(403).json({ error: 'Hanya GPK Kurikulum boleh melakukan semakan' });
  }
  next();
};

module.exports = { auth, requireRole, requireGPKKurikulum };
