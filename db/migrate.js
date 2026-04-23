require('dotenv').config();
const pool = require('./pool');

ssl:{
rejectUnauthorized:false
}

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Menjalankan migrasi...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS pengguna (
        id           SERIAL PRIMARY KEY,
        username     VARCHAR(50) UNIQUE NOT NULL,
        password     VARCHAR(255) NOT NULL,
        nama         VARCHAR(150) NOT NULL,
        jawatan      VARCHAR(100),
        peranan      VARCHAR(20) NOT NULL CHECK (peranan IN ('admin','gurubesar','gpk','guru')),
        gpk_jenis    VARCHAR(20) CHECK (gpk_jenis IN ('kurikulum','hem')),
        subjek       VARCHAR(100),
        kelas        TEXT[],
        aktif        BOOLEAN DEFAULT true,
        dibuat_pada  TIMESTAMPTZ DEFAULT NOW(),
        dikemaskini  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✔ jadual pengguna');

    await client.query(`
      CREATE TABLE IF NOT EXISTS rph (
        id                   SERIAL PRIMARY KEY,
        guru_id              INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
        guru_nama            VARCHAR(150),
        subjek               VARCHAR(100),
        kelas                VARCHAR(50),
        tarikh               DATE,
        masa                 VARCHAR(50),
        tajuk                VARCHAR(255),
        tema                 VARCHAR(150),
        standard_kandungan   TEXT,
        standard_pembelajaran TEXT,
        objektif             TEXT,
        aktiviti             TEXT,
        pak21                TEXT,
        kbat                 TEXT,
        bbm                  TEXT,
        penilaian            TEXT,
        refleksi             TEXT,
        ebk                  VARCHAR(200),
        nilai_murni          VARCHAR(200),
        tahap_penguasaan     VARCHAR(100),
        nombor_ayat          VARCHAR(50),
        nilai_kaffah         VARCHAR(200),
        status               VARCHAR(20) DEFAULT 'draf'
                             CHECK (status IN ('draf','semakan_gpk','disahkan_gpk','dikembalikan','lulus')),
        catatan_gpk          TEXT,
        catatan_gb           TEXT,
        tarikh_hantar        TIMESTAMPTZ,
        tarikh_lulus         TIMESTAMPTZ,
        dibuat_pada          TIMESTAMPTZ DEFAULT NOW(),
        dikemaskini          TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✔ jadual rph');

    // Tambah kolum baru jika belum ada (untuk upgrade dari versi lama)
    const newCols = [
      ['pak21', 'TEXT'],
      ['kbat', 'TEXT'],
      ['tahap_penguasaan', 'VARCHAR(100)'],
      ['nombor_ayat', 'VARCHAR(50)'],
      ['nilai_kaffah', 'VARCHAR(200)'],
    ];
    for (const [col, type] of newCols) {
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE rph ADD COLUMN IF NOT EXISTS ${col} ${type};
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    }
    console.log('  ✔ kolum baru ditambah');

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifikasi (
        id           SERIAL PRIMARY KEY,
        untuk_id     INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
        jenis        VARCHAR(30) NOT NULL,
        mesej        TEXT NOT NULL,
        rph_id       INTEGER REFERENCES rph(id) ON DELETE SET NULL,
        dibaca       BOOLEAN DEFAULT false,
        dibuat_pada  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✔ jadual notifikasi');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rph_guru_id ON rph(guru_id);
      CREATE INDEX IF NOT EXISTS idx_rph_status ON rph(status);
      CREATE INDEX IF NOT EXISTS idx_rph_tarikh ON rph(tarikh);
      CREATE INDEX IF NOT EXISTS idx_notif_untuk ON notifikasi(untuk_id);
      CREATE INDEX IF NOT EXISTS idx_notif_dibaca ON notifikasi(dibaca);
    `);
    console.log('  ✔ index dibina');

    console.log('\n✅ Migrasi berjaya!');
  } catch (err) {
    console.error('❌ Migrasi gagal:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
