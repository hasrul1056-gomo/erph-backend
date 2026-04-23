const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole, requireGPKKurikulum } = require('../middleware/auth');

// Helper: cipta notifikasi
async function cipta_notif(client, untuk_id, jenis, mesej, rph_id = null) {
  await client.query(
    'INSERT INTO notifikasi (untuk_id,jenis,mesej,rph_id) VALUES ($1,$2,$3,$4)',
    [untuk_id, jenis, mesej, rph_id]
  );
}

// GET /api/rph — Senarai RPH (ikut peranan)
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];
    const { bulan, tahun, status } = req.query;

    let where = [];
    let idx = 1;

    if (req.user.peranan === 'guru') {
      where.push(`r.guru_id = $${idx++}`);
      params.push(req.user.id);
    }
    if (status) {
      where.push(`r.status = $${idx++}`);
      params.push(status);
    }
    if (bulan && tahun) {
      where.push(`EXTRACT(MONTH FROM r.tarikh) = $${idx++} AND EXTRACT(YEAR FROM r.tarikh) = $${idx++}`);
      params.push(parseInt(bulan), parseInt(tahun));
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    query = `SELECT r.*,
               p.username as guru_username,
               p.subjek as guru_subjek
             FROM rph r
             JOIN pengguna p ON r.guru_id = p.id
             ${whereClause}
             ORDER BY r.tarikh DESC, r.dibuat_pada DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// GET /api/rph/stats — Statistik prestasi (GB + GPK Kurikulum)
router.get('/stats', auth, requireRole('gurubesar', 'gpk', 'admin'), async (req, res) => {
  try {
    // Jika GPK HEM, tolak
    if (req.user.peranan === 'gpk' && req.user.gpk_jenis === 'hem') {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    const result = await pool.query(`
      SELECT
        p.id, p.username, p.nama, p.subjek,
        COUNT(r.id) as total,
        COUNT(r.id) FILTER (WHERE r.status='lulus') as lulus,
        COUNT(r.id) FILTER (WHERE r.status='semakan_gpk') as semakan,
        COUNT(r.id) FILTER (WHERE r.status='disahkan_gpk') as disahkan,
        COUNT(r.id) FILTER (WHERE r.status='dikembalikan') as dikembalikan,
        COUNT(r.id) FILTER (WHERE r.status='draf') as draf
      FROM pengguna p
      LEFT JOIN rph r ON r.guru_id = p.id
      WHERE p.peranan = 'guru' AND p.aktif = true
      GROUP BY p.id, p.username, p.nama, p.subjek
      ORDER BY p.nama
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// GET /api/rph/:id — Detail satu RPH
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.username as guru_username
       FROM rph r JOIN pengguna p ON r.guru_id = p.id
       WHERE r.id=$1`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'RPH tidak dijumpai' });

    // Guru hanya boleh lihat RPH sendiri
    if (req.user.peranan === 'guru' && result.rows[0].guru_id !== req.user.id) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

// POST /api/rph — Buat RPH baru (guru sahaja)
router.post('/', auth, requireRole('guru'), async (req, res) => {
  const {
    subjek, kelas, tarikh, masa, tajuk, tema,
    standard_kandungan, standard_pembelajaran, objektif,
    aktiviti, pak21, kbat, bbm, penilaian, refleksi, ebk, nilai_murni,
    tahap_penguasaan, nombor_ayat, nilai_kaffah, hantar
  } = req.body;

  if (!tajuk) return res.status(400).json({ error: 'Tajuk diperlukan' });

  const status = hantar ? 'semakan_gpk' : 'draf';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO rph
         (guru_id,guru_nama,subjek,kelas,tarikh,masa,tajuk,tema,
          standard_kandungan,standard_pembelajaran,objektif,aktiviti,
          pak21,kbat,bbm,penilaian,refleksi,ebk,nilai_murni,
          tahap_penguasaan,nombor_ayat,nilai_kaffah,status,tarikh_hantar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [req.user.id, req.user.nama, subjek, kelas, tarikh || null, masa,
       tajuk, tema, standard_kandungan, standard_pembelajaran, objektif,
       aktiviti, pak21, kbat, bbm, penilaian, refleksi, ebk, nilai_murni,
       tahap_penguasaan, nombor_ayat, nilai_kaffah, status,
       hantar ? new Date() : null]
    );
    const rph = result.rows[0];

    // Jika hantar, notif ke GPK Kurikulum
    if (hantar) {
      const gpkKurikulum = await client.query(
        `SELECT id FROM pengguna WHERE peranan='gpk' AND gpk_jenis='kurikulum' AND aktif=true`
      );
      for (const gpk of gpkKurikulum.rows) {
        await cipta_notif(client, gpk.id, 'semakan',
          `RPH baru daripada ${req.user.nama} perlu disemak: "${tajuk}"`, rph.id);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(rph);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ralat pelayan' });
  } finally {
    client.release();
  }
});

// PATCH /api/rph/:id — Kemaskini RPH
router.patch('/:id', auth, requireRole('guru'), async (req, res) => {
  const { id } = req.params;
  const { hantar, ...fields } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM rph WHERE id=$1', [id]);
    const rph = existing.rows[0];
    if (!rph) return res.status(404).json({ error: 'RPH tidak dijumpai' });
    if (rph.guru_id !== req.user.id) return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    if (!['draf', 'dikembalikan'].includes(rph.status)) {
      return res.status(400).json({ error: 'RPH tidak boleh diedit dalam status semasa' });
    }

    const newStatus = hantar ? 'semakan_gpk' : rph.status;
    const cols = ['subjek','kelas','tarikh','masa','tajuk','tema','standard_kandungan',
                  'standard_pembelajaran','objektif','aktiviti','pak21','kbat','bbm','penilaian',
                  'refleksi','ebk','nilai_murni','tahap_penguasaan','nombor_ayat','nilai_kaffah'];
    const updates = [];
    const vals = [];
    let i = 1;
    for (const col of cols) {
      if (fields[col] !== undefined) {
        updates.push(`${col}=$${i++}`);
        vals.push(fields[col]);
      }
    }
    updates.push(`status=$${i++}`, `dikemaskini=NOW()`);
    vals.push(newStatus);
    if (hantar) { updates.push(`tarikh_hantar=$${i++}`); vals.push(new Date()); }
    vals.push(id);

    const result = await client.query(
      `UPDATE rph SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals
    );

    if (hantar) {
      const gpkKurikulum = await client.query(
        `SELECT id FROM pengguna WHERE peranan='gpk' AND gpk_jenis='kurikulum' AND aktif=true`
      );
      for (const gpk of gpkKurikulum.rows) {
        await cipta_notif(client, gpk.id, 'semakan',
          `RPH dikemaskini oleh ${req.user.nama} perlu disemak: "${rph.tajuk}"`, parseInt(id));
      }
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ralat pelayan' });
  } finally {
    client.release();
  }
});

// POST /api/rph/:id/semak — GPK Kurikulum semak RPH
router.post('/:id/semak', auth, requireGPKKurikulum, async (req, res) => {
  const { id } = req.params;
  const { tindakan, catatan } = req.body; // tindakan: 'sahkan' | 'kembalikan'
  if (!['sahkan', 'kembalikan'].includes(tindakan)) {
    return res.status(400).json({ error: 'Tindakan mesti sahkan atau kembalikan' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM rph WHERE id=$1', [id]);
    const rph = existing.rows[0];
    if (!rph) return res.status(404).json({ error: 'RPH tidak dijumpai' });
    if (rph.status !== 'semakan_gpk') {
      return res.status(400).json({ error: 'RPH tidak dalam status semakan GPK' });
    }

    const newStatus = tindakan === 'sahkan' ? 'disahkan_gpk' : 'dikembalikan';
    const result = await client.query(
      `UPDATE rph SET status=$1, catatan_gpk=$2, dikemaskini=NOW()
       WHERE id=$3 RETURNING *`,
      [newStatus, catatan || (tindakan === 'sahkan' ? 'Disahkan oleh GPK.' : 'Dikembalikan untuk pindaan.'), id]
    );

    if (tindakan === 'sahkan') {
      // Notif ke Guru Besar
      const gb = await client.query(`SELECT id FROM pengguna WHERE peranan='gurubesar' AND aktif=true`);
      for (const g of gb.rows) {
        await cipta_notif(client, g.id, 'lulus',
          `RPH "${rph.tajuk}" daripada ${rph.guru_nama} telah disahkan GPK dan menunggu kelulusan anda.`, parseInt(id));
      }
    } else {
      // Notif balik ke Guru
      await cipta_notif(client, rph.guru_id, 'dikembalikan',
        `RPH "${rph.tajuk}" telah dikembalikan oleh GPK. Sila semak catatan.`, parseInt(id));
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ralat pelayan' });
  } finally {
    client.release();
  }
});

// POST /api/rph/:id/lulus — Guru Besar lulus/kembalikan RPH
router.post('/:id/lulus', auth, requireRole('gurubesar'), async (req, res) => {
  const { id } = req.params;
  const { tindakan, catatan } = req.body;
  if (!['lulus', 'kembalikan'].includes(tindakan)) {
    return res.status(400).json({ error: 'Tindakan mesti lulus atau kembalikan' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM rph WHERE id=$1', [id]);
    const rph = existing.rows[0];
    if (!rph) return res.status(404).json({ error: 'RPH tidak dijumpai' });
    if (rph.status !== 'disahkan_gpk') {
      return res.status(400).json({ error: 'RPH belum disahkan GPK' });
    }

    const newStatus = tindakan === 'lulus' ? 'lulus' : 'dikembalikan';
    const result = await client.query(
      `UPDATE rph SET status=$1, catatan_gb=$2,
         tarikh_lulus=${tindakan === 'lulus' ? 'NOW()' : 'NULL'},
         dikemaskini=NOW()
       WHERE id=$3 RETURNING *`,
      [newStatus, catatan || (tindakan === 'lulus' ? 'Diluluskan.' : 'Dikembalikan untuk pindaan.'), id]
    );

    const msg = tindakan === 'lulus'
      ? `Tahniah! RPH "${rph.tajuk}" telah diluluskan oleh Guru Besar.`
      : `RPH "${rph.tajuk}" telah dikembalikan oleh Guru Besar. Sila semak catatan.`;
    await cipta_notif(client, rph.guru_id, tindakan === 'lulus' ? 'lulus' : 'dikembalikan', msg, parseInt(id));

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ralat pelayan' });
  } finally {
    client.release();
  }
});

// DELETE /api/rph/:id — Padam RPH (draf sahaja)
router.delete('/:id', auth, requireRole('guru', 'admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM rph WHERE id=$1', [req.params.id]);
    const rph = existing.rows[0];
    if (!rph) return res.status(404).json({ error: 'RPH tidak dijumpai' });
    if (req.user.peranan === 'guru') {
      if (rph.guru_id !== req.user.id) return res.status(403).json({ error: 'Akses tidak dibenarkan' });
      if (rph.status !== 'draf') return res.status(400).json({ error: 'Hanya draf boleh dipadam' });
    }
    await pool.query('DELETE FROM rph WHERE id=$1', [req.params.id]);
    res.json({ message: 'RPH dipadam' });
  } catch (err) {
    res.status(500).json({ error: 'Ralat pelayan' });
  }
});

module.exports = router;
