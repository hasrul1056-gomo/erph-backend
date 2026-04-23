require('dotenv').config();
const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Memasukkan data awal...');

    // Hash kata laluan
    const hash = async (pw) => bcrypt.hash(pw, 10);

    // Pengguna
    const pengguna = [
      { username: 'admin',      password: await hash('admin123'), nama: 'Admin Sistem',          jawatan: 'Pentadbir Sistem',  peranan: 'admin',      gpk_jenis: null,         subjek: null,            kelas: null },
      { username: 'gurubesar',  password: await hash('gb123'),    nama: 'En. Ahmad bin Abdullah', jawatan: 'Guru Besar',        peranan: 'gurubesar',  gpk_jenis: null,         subjek: null,            kelas: null },
      { username: 'gpk1',       password: await hash('gpk123'),   nama: 'Pn. Siti Aminah',       jawatan: 'GPK Kurikulum',     peranan: 'gpk',        gpk_jenis: 'kurikulum',  subjek: null,            kelas: null },
      { username: 'gpk2',       password: await hash('gpk456'),   nama: 'En. Razali Hamid',      jawatan: 'GPK HEM',           peranan: 'gpk',        gpk_jenis: 'hem',        subjek: null,            kelas: null },
      { username: 'guru1',      password: await hash('g123'),     nama: 'Cikgu Farah Nabila',    jawatan: 'Guru Matematik',    peranan: 'guru',       gpk_jenis: null,         subjek: 'Matematik',     kelas: '{\"5 Amanah\",\"5 Bestari\"}' },
      { username: 'guru2',      password: await hash('g456'),     nama: 'Cikgu Hazman Razak',    jawatan: 'Guru Bahasa Melayu',peranan: 'guru',       gpk_jenis: null,         subjek: 'Bahasa Melayu', kelas: '{\"4 Bestari\",\"4 Cekal\"}' },
      { username: 'guru3',      password: await hash('g789'),     nama: 'Cikgu Norlela Ismail',  jawatan: 'Guru Sains',        peranan: 'guru',       gpk_jenis: null,         subjek: 'Sains',         kelas: '{\"6 Cekal\",\"6 Amanah\"}' },
    ];

    const ids = {};
    for (const p of pengguna) {
      const existing = await client.query('SELECT id FROM pengguna WHERE username=$1', [p.username]);
      if (existing.rows.length > 0) {
        ids[p.username] = existing.rows[0].id;
        console.log(`  ↩ Pengguna '${p.username}' sudah wujud, skip.`);
        continue;
      }
      const res = await client.query(
        `INSERT INTO pengguna (username,password,nama,jawatan,peranan,gpk_jenis,subjek,kelas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [p.username, p.password, p.nama, p.jawatan, p.peranan, p.gpk_jenis, p.subjek, p.kelas]
      );
      ids[p.username] = res.rows[0].id;
      console.log(`  ✔ Pengguna '${p.username}' (id=${ids[p.username]})`);
    }

    // RPH demo
    const rphData = [
      {
        guru: 'guru1', subjek: 'Matematik', kelas: '5 Amanah', tarikh: '2026-04-20',
        masa: '8:00 - 9:00 pagi', tajuk: 'Pecahan Wajar dan Tak Wajar', tema: 'Nombor dan Operasi',
        standard_kandungan: '1.1 Pecahan Wajar dan Tak Wajar',
        standard_pembelajaran: '1.1.1 Mengenal pasti pecahan wajar dan tak wajar.\n1.1.2 Menukar pecahan tak wajar kepada nombor bercampur.',
        objektif: 'Pada akhir PdPc, murid dapat:\n1. Mengenal pasti 5 contoh pecahan wajar dan tak wajar.\n2. Menukar pecahan tak wajar kepada nombor bercampur dengan tepat.',
        aktiviti: 'Set Induksi (5 min): Guru tunjuk gambar pizza dibahagi.\nPerkembangan (40 min): Penerangan, contoh, latihan kumpulan.\nPenutup (15 min): Rumusan dan kuiz pendek.',
        bbm: 'Buku teks, kad manila, gambar pizza, lembaran kerja',
        penilaian: 'Pemerhatian, lembaran kerja, soal jawab lisan',
        refleksi: 'Murid dapat menguasai tajuk ini dengan baik. 28/30 murid lulus kuiz.',
        ebk: 'Kreativiti dan Inovasi, Komunikasi', nilai_murni: 'Kerjasama, Ketekunan',
        status: 'lulus', catatan_gpk: 'RPH lengkap dan tersusun. Bagus.',
        catatan_gb: 'Diluluskan. Teruskan usaha murni.',
        tarikh_hantar: '2026-04-18', tarikh_lulus: '2026-04-19',
      },
      {
        guru: 'guru2', subjek: 'Bahasa Melayu', kelas: '4 Bestari', tarikh: '2026-04-22',
        masa: '10:30 - 11:30 pagi', tajuk: 'Karangan Berformat: Surat Kiriman Tidak Rasmi', tema: 'Kekeluargaan',
        standard_kandungan: '3.2 Menulis untuk menyampaikan maklumat',
        standard_pembelajaran: '3.2.1 Menulis surat kiriman tidak rasmi mengikut format yang betul.',
        objektif: 'Pada akhir PdPc, murid dapat menulis surat kiriman tidak rasmi dengan format yang betul.',
        aktiviti: 'Set Induksi: Tunjuk contoh surat lama.\nPerkembangan: Bincang format, aktiviti berpasangan.\nPenutup: Pembentangan dan ulasan.',
        bbm: 'Contoh surat, kertas A4, sampul surat',
        penilaian: 'Hasil penulisan, rubrik', refleksi: '',
        ebk: 'Komunikasi, Nilai Murni', nilai_murni: 'Kasih sayang, Hormat-menghormati',
        status: 'semakan_gpk', catatan_gpk: '', catatan_gb: '',
        tarikh_hantar: '2026-04-21', tarikh_lulus: null,
      },
      {
        guru: 'guru3', subjek: 'Sains', kelas: '6 Cekal', tarikh: '2026-04-23',
        masa: '11:30 - 12:30 tgh', tajuk: 'Sistem Suria', tema: 'Bumi dan Alam Semesta',
        standard_kandungan: '9.1 Sistem Suria',
        standard_pembelajaran: '9.1.1 Menamakan planet dalam sistem suria mengikut urutan.',
        objektif: 'Murid dapat menamakan 8 planet dan menyusun mengikut jarak dari Matahari.',
        aktiviti: 'Set Induksi: Video pendek angkasa lepas.\nPerkembangan: Model 3D sistem suria.\nPenutup: Peta i-Think.',
        bbm: 'Model planet, video, kertas mahjong',
        penilaian: 'Kuiz, peta i-Think', refleksi: '',
        ebk: 'Sains dan Teknologi, TMK', nilai_murni: 'Bersyukur, Rasa ingin tahu',
        status: 'disahkan_gpk', catatan_gpk: 'RPH menarik. Pastikan video dipratonton dulu.', catatan_gb: '',
        tarikh_hantar: '2026-04-20', tarikh_lulus: null,
      },
      {
        guru: 'guru1', subjek: 'Matematik', kelas: '5 Amanah', tarikh: '2026-04-24',
        masa: '8:00 - 9:00 pagi', tajuk: 'Penambahan Pecahan', tema: 'Nombor dan Operasi',
        standard_kandungan: '1.2 Operasi Asas Pecahan',
        standard_pembelajaran: '1.2.1 Menambah dua pecahan dengan penyebut sama.',
        objektif: 'Murid dapat menambah pecahan dengan penyebut sama dengan tepat.',
        aktiviti: 'Set Induksi, perkembangan, penutup.',
        bbm: 'Buku teks, lembaran kerja', penilaian: 'Latihan bertulis', refleksi: '',
        ebk: 'Kreativiti', nilai_murni: 'Ketekunan',
        status: 'draf', catatan_gpk: '', catatan_gb: '',
        tarikh_hantar: null, tarikh_lulus: null,
      },
      {
        guru: 'guru2', subjek: 'Bahasa Melayu', kelas: '4 Cekal', tarikh: '2026-04-25',
        masa: '9:00 - 10:00 pagi', tajuk: 'Puisi: Pantun Empat Kerat', tema: 'Kesenian',
        standard_kandungan: '4.1 Puisi Tradisional',
        standard_pembelajaran: '4.1.2 Mencipta pantun empat kerat bertemakan alam.',
        objektif: 'Murid dapat mencipta pantun empat kerat dengan rima a-b-a-b.',
        aktiviti: 'Set Induksi: Dendang lagu rakyat.\nPerkembangan: Analisis struktur pantun.\nPenutup: Pertandingan pantun.',
        bbm: 'Kad pantun, LCD projektor',
        penilaian: 'Hasil cipta pantun, pembentangan', refleksi: '',
        ebk: 'Kreativiti, Estetika', nilai_murni: 'Cinta akan budaya',
        status: 'lulus', catatan_gpk: 'Kreativiti tinggi. Aktiviti sangat menarik.',
        catatan_gb: 'Diluluskan. Aktiviti budaya perlu digalakkan.',
        tarikh_hantar: '2026-04-23', tarikh_lulus: '2026-04-24',
      },
      {
        guru: 'guru1', subjek: 'Matematik', kelas: '5 Bestari', tarikh: '2026-04-26',
        masa: '11:00 - 12:00 tgh', tajuk: 'Perpuluhan', tema: 'Nombor dan Operasi',
        standard_kandungan: '2.1 Perpuluhan',
        standard_pembelajaran: '2.1.1 Mengenal pasti nilai tempat perpuluhan.',
        objektif: 'Murid dapat mengenal pasti nilai tempat perpuluhan hingga tiga tempat perpuluhan.',
        aktiviti: 'Set Induksi, perkembangan, latihan, penutup.',
        bbm: 'Carta nilai tempat, lembaran kerja', penilaian: 'Pemerhatian dan latihan', refleksi: '',
        ebk: 'TMK', nilai_murni: 'Ketekunan',
        status: 'dikembalikan', catatan_gpk: 'Sila tambah lebih banyak contoh harian dalam aktiviti PdPc.', catatan_gb: '',
        tarikh_hantar: '2026-04-22', tarikh_lulus: null,
      },
    ];

    const rphIds = {};
    for (const r of rphData) {
      const guruId = ids[r.guru];
      const guruNama = pengguna.find(p => p.username === r.guru)?.nama || '';
      const existing = await client.query('SELECT id FROM rph WHERE guru_id=$1 AND tajuk=$2', [guruId, r.tajuk]);
      if (existing.rows.length > 0) {
        rphIds[r.tajuk] = existing.rows[0].id;
        console.log(`  ↩ RPH '${r.tajuk}' sudah wujud, skip.`);
        continue;
      }
      const res = await client.query(
        `INSERT INTO rph (guru_id,guru_nama,subjek,kelas,tarikh,masa,tajuk,tema,
          standard_kandungan,standard_pembelajaran,objektif,aktiviti,bbm,penilaian,
          refleksi,ebk,nilai_murni,status,catatan_gpk,catatan_gb,tarikh_hantar,tarikh_lulus)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         RETURNING id`,
        [guruId, guruNama, r.subjek, r.kelas, r.tarikh, r.masa, r.tajuk, r.tema,
         r.standard_kandungan, r.standard_pembelajaran, r.objektif, r.aktiviti,
         r.bbm, r.penilaian, r.refleksi, r.ebk, r.nilai_murni, r.status,
         r.catatan_gpk, r.catatan_gb, r.tarikh_hantar, r.tarikh_lulus]
      );
      rphIds[r.tajuk] = res.rows[0].id;
      console.log(`  ✔ RPH '${r.tajuk}' (id=${rphIds[r.tajuk]})`);
    }

    // Notifikasi awal
    const notifs = [
      { untuk: 'gpk1',      jenis: 'semakan',    mesej: 'RPH baru daripada Cikgu Hazman Razak perlu disemak.',              tajuk_rph: 'Karangan Berformat: Surat Kiriman Tidak Rasmi' },
      { untuk: 'guru1',     jenis: 'dikembalikan', mesej: "RPH 'Perpuluhan' dikembalikan oleh GPK. Sila semak catatan.",     tajuk_rph: 'Perpuluhan' },
      { untuk: 'gurubesar', jenis: 'lulus',       mesej: "RPH 'Sistem Suria' menunggu kelulusan anda.",                     tajuk_rph: 'Sistem Suria' },
      { untuk: 'guru2',     jenis: 'lulus',       mesej: "Tahniah! RPH 'Pantun Empat Kerat' telah diluluskan Guru Besar.",  tajuk_rph: 'Puisi: Pantun Empat Kerat' },
    ];

    for (const n of notifs) {
      const untukId = ids[n.untuk];
      const rphId = rphIds[n.tajuk_rph];
      if (!untukId) continue;
      const existing = await client.query(
        'SELECT id FROM notifikasi WHERE untuk_id=$1 AND mesej=$2', [untukId, n.mesej]
      );
      if (existing.rows.length > 0) { console.log(`  ↩ Notif untuk '${n.untuk}' sudah wujud, skip.`); continue; }
      await client.query(
        `INSERT INTO notifikasi (untuk_id,jenis,mesej,rph_id,dibaca) VALUES ($1,$2,$3,$4,false)`,
        [untukId, n.jenis, n.mesej, rphId || null]
      );
      console.log(`  ✔ Notif untuk '${n.untuk}'`);
    }

    console.log('\n✅ Seed berjaya! Sistem sedia digunakan.');
  } catch (err) {
    console.error('❌ Seed gagal:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
