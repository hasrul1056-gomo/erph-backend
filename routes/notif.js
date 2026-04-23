const router = require('express').Router();
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');

// GET /api/notif — Notifikasi untuk pengguna semasa
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, r.tajuk as rph_tajuk
       FROM notifikasi n
       LEFT JOIN rph r ON n.rph_id = r.id
       WHERE n.untuk_id = $1
       ORDER BY n.dibuat_pada DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// GET /api/notif/count — Kiraan notif belum dibaca
router.get('/count', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as bilangan FROM notifikasi WHERE untuk_id=$1 AND dibaca=false',
      [req.user.id]
    );
    res.json({ bilangan: parseInt(result.rows[0].bilangan) });
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// PATCH /api/notif/:id/baca — Tandakan satu sebagai dibaca
router.patch('/:id/baca', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifikasi SET dibaca=true WHERE id=$1 AND untuk_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// PATCH /api/notif/baca-semua — Tandakan semua sebagai dibaca
router.patch('/baca-semua', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifikasi SET dibaca=true WHERE untuk_id=$1 AND dibaca=false',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

module.exports = router;
