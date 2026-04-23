const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/users — Senarai semua pengguna (admin sahaja)
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,username,nama,jawatan,peranan,gpk_jenis,subjek,kelas,aktif,dibuat_pada
       FROM pengguna ORDER BY peranan, nama`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// POST /api/users — Tambah pengguna baru
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { username, password, nama, jawatan, peranan, gpk_jenis, subjek, kelas } = req.body;
  if (!username || !password || !nama || !peranan) {
    return res.status(400).json({ error: 'Medan wajib: username, password, nama, peranan' });
  }
  const validRoles = ['admin', 'gurubesar', 'gpk', 'guru'];
  if (!validRoles.includes(peranan)) {
    return res.status(400).json({ error: 'Peranan tidak sah' });
  }
  try {
    const exists = await pool.query('SELECT id FROM pengguna WHERE username=$1', [username.toLowerCase()]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Nama pengguna sudah wujud' });
    }

    // Convert kelas string → array
    let kelasArr = null;
    if (kelas) {
      if (Array.isArray(kelas)) {
        kelasArr = kelas;
      } else if (typeof kelas === 'string' && kelas.trim()) {
        kelasArr = kelas.split(',').map(k => k.trim()).filter(k => k);
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO pengguna (username,password,nama,jawatan,peranan,gpk_jenis,subjek,kelas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,username,nama,jawatan,peranan,gpk_jenis,subjek,kelas,aktif`,
      [username.toLowerCase(), hashed, nama, jawatan || null,
       peranan, (peranan === 'gpk' ? gpk_jenis || 'kurikulum' : null),
       subjek || null, kelasArr]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /users error:', err.message);
    res.status(500).json({ error: 'Ralat pelayan: ' + err.message });
  }
});

// PATCH /api/users/:id — Kemaskini pengguna
router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { password, nama, jawatan, peranan, gpk_jenis, subjek, kelas, aktif } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM pengguna WHERE id=$1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Pengguna tidak dijumpai' });

    const u = existing.rows[0];
    const hashed = password ? await bcrypt.hash(password, 10) : u.password;
    const newPeranan = peranan || u.peranan;

    // Convert kelas: string "5 Amanah, 5 Bestari" → array ["5 Amanah","5 Bestari"]
    let kelasArr = u.kelas; // guna nilai lama sebagai default
    if (kelas !== undefined && kelas !== null) {
      if (Array.isArray(kelas)) {
        kelasArr = kelas;
      } else if (typeof kelas === 'string') {
        kelasArr = kelas.trim() === '' ? [] : kelas.split(',').map(k => k.trim()).filter(k => k);
      }
    }

    const result = await pool.query(
      `UPDATE pengguna SET
        password=$1, nama=$2, jawatan=$3, peranan=$4, gpk_jenis=$5,
        subjek=$6, kelas=$7, aktif=$8, dikemaskini=NOW()
       WHERE id=$9
       RETURNING id,username,nama,jawatan,peranan,gpk_jenis,subjek,kelas,aktif`,
      [
        hashed,
        nama ?? u.nama,
        jawatan ?? u.jawatan,
        newPeranan,
        newPeranan === 'gpk' ? (gpk_jenis || u.gpk_jenis || 'kurikulum') : null,
        subjek !== undefined ? (subjek || null) : u.subjek,
        kelasArr,
        aktif !== undefined ? aktif : u.aktif,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /users/:id error:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Ralat pelayan: ' + err.message });
  }
});

// DELETE /api/users/:id — Padam pengguna
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT username FROM pengguna WHERE id=$1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Pengguna tidak dijumpai' });
    if (existing.rows[0].username === 'admin') {
      return res.status(403).json({ error: 'Akaun admin tidak boleh dipadam' });
    }
    await pool.query('DELETE FROM pengguna WHERE id=$1', [id]);
    res.json({ message: 'Pengguna dipadam' });
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

module.exports = router;
