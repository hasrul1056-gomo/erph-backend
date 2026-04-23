const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password diperlukan' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM pengguna WHERE username=$1', [username.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Nama pengguna tidak dijumpai' });
    if (!user.aktif) return res.status(403).json({ error: 'Akaun ini telah dinyahaktifkan. Hubungi admin.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Kata laluan salah' });

    const payload = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      peranan: user.peranan,
      gpk_jenis: user.gpk_jenis,
      jawatan: user.jawatan,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '8h' });

    res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,username,nama,jawatan,peranan,gpk_jenis,subjek,kelas,aktif FROM pengguna WHERE id=$1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pengguna tidak dijumpai' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// POST /api/auth/tukar-password — Tukar kata laluan sendiri
router.post('/tukar-password', auth, async (req, res) => {
  const { password_lama, password_baru } = req.body;
  if (!password_lama || !password_baru) {
    return res.status(400).json({ error: 'Kata laluan lama dan baru diperlukan' });
  }
  if (password_baru.length < 6) {
    return res.status(400).json({ error: 'Kata laluan baru mestilah sekurang-kurangnya 6 aksara' });
  }
  try {
    const result = await pool.query('SELECT * FROM pengguna WHERE id=$1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Pengguna tidak dijumpai' });

    const match = await bcrypt.compare(password_lama, user.password);
    if (!match) return res.status(401).json({ error: 'Kata laluan lama tidak tepat' });

    const hashed = await bcrypt.hash(password_baru, 10);
    await pool.query(
      'UPDATE pengguna SET password=$1, dikemaskini=NOW() WHERE id=$2',
      [hashed, req.user.id]
    );
    res.json({ message: 'Kata laluan berjaya ditukar' });
  } catch (err) {
    console.error('Tukar password error:', err);
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

module.exports = router;
