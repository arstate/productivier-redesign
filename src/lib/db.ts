import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = path.join(process.cwd(), 'productivier.db');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): { valid: boolean; needsRehash: boolean } {
  if (!stored) return { valid: false, needsRehash: false };

  if (stored.startsWith('scrypt:')) {
    const parts = stored.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const keyHex = parts[2];
      try {
        const keyBuffer = Buffer.from(keyHex, 'hex');
        const derivedKey = crypto.scryptSync(password, salt, 64);
        const valid = crypto.timingSafeEqual(keyBuffer, derivedKey);
        return { valid, needsRehash: false };
      } catch {
        return { valid: false, needsRehash: false };
      }
    }
  }

  // Plaintext fallback (for seamless migration without lockout)
  if (stored === password) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}

declare global {
  var __productivierDb: DatabaseSync | undefined;
}

function initDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -16000;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nama TEXT NOT NULL,
      divisi TEXT NOT NULL DEFAULT 'Umum',
      role TEXT NOT NULL DEFAULT 'karyawan',
      avatar_url TEXT DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'male',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_proyek TEXT NOT NULL,
      pic_id INTEGER,
      divisi TEXT NOT NULL DEFAULT 'Umum',
      target_total REAL NOT NULL DEFAULT 100,
      satuan TEXT NOT NULL DEFAULT 'Tugas',
      status TEXT NOT NULL DEFAULT 'aktif',
      deadline TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pic_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS realisasi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      user_id INTEGER,
      nama TEXT NOT NULL,
      divisi TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      aktivitas TEXT NOT NULL,
      target REAL NOT NULL,
      realisasi REAL NOT NULL,
      satuan TEXT NOT NULL,
      persentase REAL NOT NULL,
      status TEXT NOT NULL,
      kendala TEXT DEFAULT '',
      solusi TEXT DEFAULT '',
      bukti_foto_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '',
      pinned INTEGER DEFAULT 0,
      color TEXT DEFAULT '#FFFFFF',
      project_id INTEGER,
      checklist TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      start_time TEXT DEFAULT '09:00',
      end_time TEXT DEFAULT '10:00',
      category TEXT DEFAULT 'activity',
      color TEXT DEFAULT '#D2F27C',
      project_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      project_id INTEGER,
      created_by INTEGER NOT NULL,
      ai_name TEXT DEFAULT 'Miu',
      ai_model TEXT DEFAULT 'nvidia/nemotron-3.5-super-vl:free',
      ai_thinking_mode TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chat_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_group_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(group_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      is_ai INTEGER DEFAULT 0,
      reply_to_id INTEGER DEFAULT NULL,
      reasoning_text TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS project_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'other',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_client_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL DEFAULT 'client',
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'feedback',
      status TEXT NOT NULL DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      action_url TEXT DEFAULT '',
      payload_json TEXT DEFAULT '{}',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_action_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS personal_todos (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      tag TEXT DEFAULT 'Umum',
      time TEXT DEFAULT '',
      done INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_realisasi_user_project ON realisasi(user_id, project_id, tanggal);
    CREATE INDEX IF NOT EXISTS idx_personal_todos_user_done ON personal_todos(user_id, done);
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);
    CREATE INDEX IF NOT EXISTS idx_project_members_proj_user ON project_members(project_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_actions_status_created ON ai_action_requests(status, created_at DESC);
  `);

  try {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '';`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT 'male';`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE chat_groups ADD COLUMN ai_name TEXT DEFAULT 'Miu';`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE chat_groups ADD COLUMN ai_model TEXT DEFAULT 'nvidia/nemotron-3.5-super-vl:free';`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE chat_groups ADD COLUMN ai_thinking_mode TEXT DEFAULT 'medium';`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE chat_messages ADD COLUMN reply_to_id INTEGER DEFAULT NULL;`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE chat_messages ADD COLUMN reasoning_text TEXT DEFAULT '';`);
  } catch {
    // Column already exists
  }

  try {
    db.prepare("UPDATE chat_groups SET ai_name = 'Miu' WHERE ai_name = 'Intellecta AI' OR ai_name = 'Productivier AI' OR ai_name IS NULL OR ai_name = ''").run();
    db.prepare("UPDATE chat_messages SET sender_name = 'Miu' WHERE is_ai = 1").run();
    db.exec(`UPDATE chat_groups SET ai_model = 'nvidia/nemotron-3.5-super-vl:free' WHERE ai_model IS NULL OR ai_model = '';`);
    db.exec(`UPDATE chat_groups SET ai_thinking_mode = 'medium' WHERE ai_thinking_mode IS NULL OR ai_thinking_mode = '';`);
  } catch {
    // Column update error ignored
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_group_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(group_id, project_id)
      );
    `);
    // Migrate legacy project_id from chat_groups to chat_group_projects
    db.exec(`
      INSERT OR IGNORE INTO chat_group_projects (group_id, project_id)
      SELECT id, project_id FROM chat_groups WHERE project_id IS NOT NULL;
    `);
  } catch {
    // Migration error ignored
  }

  // Realisasi delegation columns
  try {
    db.exec(`ALTER TABLE realisasi ADD COLUMN assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE realisasi ADD COLUMN assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE realisasi ADD COLUMN deadline TEXT DEFAULT '';`);
  } catch {
    // Column already exists
  }

  // Backfill assigned_to_user_id for existing tasks
  try {
    db.exec(`UPDATE realisasi SET assigned_to_user_id = user_id WHERE assigned_to_user_id IS NULL;`);
  } catch {
    // Backfill error ignored
  }

  const fifaExists = db.prepare('SELECT id FROM users WHERE username = ?').get('fifa') as { id: number } | undefined;
  if (!fifaExists) {
    db.prepare('INSERT INTO users (username, password, nama, divisi, role, gender) VALUES (?, ?, ?, ?, ?, ?)').run(
      'fifa', hashPassword('cewekalay'), 'Fifa (Leader)', 'Management', 'admin', 'female'
    );
  } else {
    db.prepare('UPDATE users SET role = ?, gender = ? WHERE username = ?').run('admin', 'female', 'fifa');
  }

  const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (totalUsers <= 1) {
    const ins = db.prepare('INSERT OR IGNORE INTO users (username, password, nama, divisi, role, gender) VALUES (?, ?, ?, ?, ?, ?)');
    ins.run('tim1', hashPassword('tim123'), 'Anggota Tim 1', 'Operasional', 'karyawan', 'male');
    ins.run('tim2', hashPassword('tim123'), 'Anggota Tim 2', 'Kreatif', 'karyawan', 'male');
  }

  const fifaUser = db.prepare('SELECT id FROM users WHERE username = ?').get('fifa') as { id: number } | undefined;
  const fifaId = fifaUser ? fifaUser.id : 1;
  const tim1User = db.prepare('SELECT id FROM users WHERE username = ?').get('tim1') as { id: number } | undefined;
  const tim1Id = tim1User ? tim1User.id : 2;
  const tim2User = db.prepare('SELECT id FROM users WHERE username = ?').get('tim2') as { id: number } | undefined;
  const tim2Id = tim2User ? tim2User.id : (tim1Id || fifaId);

  // Ensure standard projects exist
  const p1 = db.prepare('SELECT id FROM projects WHERE id = 1').get();
  if (!p1) {
    db.prepare('INSERT INTO projects (id, nama_proyek, pic_id, divisi, target_total, satuan, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      1, 'Operasional & Konten Harian', fifaId, 'Operasional', 100, 'Tugas', 'aktif', '2026-12-31'
    );
  }
  const p2 = db.prepare('SELECT id FROM projects WHERE id = 2').get();
  if (!p2) {
    db.prepare('INSERT INTO projects (id, nama_proyek, pic_id, divisi, target_total, satuan, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      2, 'Redesign UI Productivier Clean Slate', fifaId, 'Kreatif', 50, 'Modul', 'aktif', '2026-11-30'
    );
  }

  // Ensure project_members are populated for all projects
  try {
    db.exec(`
      INSERT OR IGNORE INTO project_members (project_id, user_id, role)
      SELECT id, pic_id, 'leader' FROM projects WHERE pic_id IS NOT NULL;
    `);
    if (tim1Id) {
      db.prepare(`INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (1, ?, 'member')`).run(tim1Id);
    }
    if (tim2Id) {
      db.prepare(`INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (2, ?, 'member')`).run(tim2Id);
    }
  } catch {
    // Project members migration error ignored
  }

  // Seed Realisasi (Tugas) if empty
  const totalRealisasi = (db.prepare('SELECT COUNT(*) as count FROM realisasi').get() as { count: number }).count;
  if (totalRealisasi === 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const insReal = db.prepare(`
      INSERT INTO realisasi (project_id, user_id, nama, divisi, tanggal, aktivitas, target, realisasi, satuan, persentase, status, kendala, solusi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insReal.run(1, fifaId, 'Fifa (Leader)', 'Management', todayStr, 'Review Sprint & Alokasi Target Harian', 5, 5, 'Modul', 100, 'Tercapai', '', '');
    insReal.run(1, tim1Id, 'Anggota Tim 1', 'Operasional', todayStr, 'Produksi 3 Konten Video Reels 9:16', 3, 2, 'Video', 67, 'Hampir', 'Proses render sempat tertunda', 'Optimasi bitrate video');
    insReal.run(p2 ? 2 : 1, tim2Id, 'Anggota Tim 2', 'Kreatif', todayStr, 'Finalisasi Desain Sprint Feed 3:4', 4, 4, 'Desain', 100, 'Tercapai', '', '');
  }

  // Seed Notes if empty
  const totalNotes = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }).count;
  if (totalNotes === 0) {
    const insNote = db.prepare(`
      INSERT INTO notes (user_id, title, content, tags, pinned, color, project_id, checklist)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insNote.run(
      fifaId,
      'SOP Brief Desain Feed 3:4 & Story',
      'Pastikan rasio gambar 3:4 (1080x1440), tipografi berani & elegan, kontras teks tinggi, dan tidak ada elemen penting di safe zone atas/bawah.',
      JSON.stringify(['desain', 'sop', 'penting']),
      1,
      '#D2F27C',
      1,
      JSON.stringify([
        { id: '1', text: 'Cek grid & margin safe area 120px', done: true },
        { id: '2', text: 'Validasi kontras warna teks OKLCH >= 50%', done: true },
        { id: '3', text: 'Export format WebP / PNG tajam', done: false }
      ])
    );

    insNote.run(
      fifaId,
      'Catatan Rapat Strategi Q4 2026',
      'Target mingguan: 23 konten campuran, monitoring Advantage+ CBO harian, dan sprint review setiap Jumat pukul 16:00 WIB.',
      JSON.stringify(['rapat', 'strategi', 'q4']),
      1,
      '#DCD4FB',
      1,
      JSON.stringify([
        { id: '1', text: 'Review performa kampanye minggu lalu', done: true },
        { id: '2', text: 'Finalisasi mockup landing page baru', done: false },
        { id: '3', text: 'Alokasi budget testing CBO Rp 50rb/hari', done: false }
      ])
    );

    insNote.run(
      fifaId,
      'Ide Fitur Asisten AI Productivier',
      'Integrasi model OpenRouter Nemotron 3.5 Super VL untuk auto-input realisasi, rekomendasi produktivitas cerdas, dan pencatatan to-do otomatis dari chat.',
      JSON.stringify(['ai', 'inovasi']),
      0,
      '#CBD5E1',
      null,
      JSON.stringify([
        { id: '1', text: 'Connect OpenRouter API key', done: true },
        { id: '2', text: 'Implementasi tool calling / skills', done: true },
        { id: '3', text: 'Tes prompt natural voice & text', done: false }
      ])
    );
  }

  // Seed Calendar Events if empty
  const totalEvents = (db.prepare('SELECT COUNT(*) as count FROM calendar_events').get() as { count: number }).count;
  if (totalEvents === 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 172800000).toISOString().slice(0, 10);

    const insEvent = db.prepare(`
      INSERT INTO calendar_events (user_id, title, description, date, start_time, end_time, category, color, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insEvent.run(
      fifaId,
      'Project Onboarding & Kickoff Meeting',
      'Sinkronisasi alur kerja sprint baru dengan seluruh tim via Google Meet.',
      todayStr,
      '09:00',
      '10:30',
      'meeting',
      '#D2F27C',
      1
    );

    insEvent.run(
      fifaId,
      'Design Research & Wireframing',
      'Eksplorasi tata letak dashboard dan micro-interactions di Figma.',
      todayStr,
      '11:00',
      '12:30',
      'activity',
      '#CBD5E1',
      p2 ? 2 : 1
    );

    insEvent.run(
      fifaId,
      'Sprint Review & Demo Progres',
      'Evaluasi capaian realisasi mingguan dan testing fitur interaktif.',
      tomorrow,
      '14:00',
      '15:30',
      'milestone',
      '#DCD4FB',
      1
    );

    insEvent.run(
      fifaId,
      'Deadline Final UI Redesign',
      'Peluncuran update UI Intellecta Clean Slate ke server produksi.',
      dayAfter,
      '17:00',
      '18:00',
      'deadline',
      '#F87171',
      p2 ? 2 : 1
    );
  }

  // Seed Chat Groups if empty
  const totalGroups = (db.prepare('SELECT COUNT(*) as count FROM chat_groups').get() as { count: number }).count;
  if (totalGroups === 0) {
    const insGroup = db.prepare(`
      INSERT INTO chat_groups (id, name, description, project_id, created_by, ai_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insGroup.run(1, 'Koordinasi Tim Operasional', 'Ruang diskusi sprint harian dan kendala kerja tim operasional', 1, fifaId, 'Miu');
    insGroup.run(2, 'Sprint Tim Kreatif & Desain', 'Review visual feed, reels 9:16, dan feedback layout', p2 ? 2 : 1, fifaId, 'Miu');
    insGroup.run(3, 'Diskusi Umum & Asisten AI', 'Brainstorming ide, pengumuman kantor, dan tanya jawab dengan Asisten AI', null, fifaId, 'Miu');

    const insMsg = db.prepare(`
      INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
      VALUES (?, ?, ?, ?, ?)
    `);

    insMsg.run(1, fifaId, 'Fifa (Leader)', 'Halo tim! Jangan lupa update realisasi harian dan kendala sebelum jam 17:00 ya.', 0);
    insMsg.run(1, tim1Id, 'Anggota Tim 1', 'Siap Mbak Fifa, 3 konten video sudah masuk tahap render.', 0);
    insMsg.run(1, null, 'Miu', 'Selamat pagi tim Operasional! Performa kemarin mencapai efisiensi 67%. Butuh bantuan rekap atau pembuatan tugas?', 1);

    insMsg.run(2, fifaId, 'Fifa (Leader)', 'Mockup Clean Slate sudah disesuaikan dengan GSM v2.5. Tolong cek kontrasnya ya.', 0);
    insMsg.run(2, tim2Id, 'Anggota Tim 2', 'Aman Mbak, kontras teks OKLCH sudah di atas 55% dan safe area terjaga.', 0);
  }

  // Seed Chat Group Members if empty
  const totalMembers = (db.prepare('SELECT COUNT(*) as count FROM chat_group_members').get() as { count: number }).count;
  if (totalMembers === 0) {
    const insMember = db.prepare(`
      INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role)
      VALUES (?, ?, ?)
    `);

    // Group 1: Koordinasi Tim Operasional
    insMember.run(1, fifaId, 'admin');
    insMember.run(1, tim1Id, 'member');
    insMember.run(1, tim2Id, 'member');

    // Group 2: Sprint Tim Kreatif & Desain
    insMember.run(2, fifaId, 'admin');
    insMember.run(2, tim2Id, 'admin');
    insMember.run(2, tim1Id, 'member');

    // Group 3: Diskusi Umum & Asisten AI
    insMember.run(3, fifaId, 'admin');
    insMember.run(3, tim1Id, 'member');
    insMember.run(3, tim2Id, 'member');
  }

  // Seed Project Links if empty
  const totalLinks = (db.prepare('SELECT COUNT(*) as count FROM project_links').get() as { count: number }).count;
  if (totalLinks === 0) {
    const insLink = db.prepare(`
      INSERT INTO project_links (project_id, title, url, platform)
      VALUES (?, ?, ?, ?)
    `);

    insLink.run(1, 'Aset Desain & Footage Video', 'https://drive.google.com/drive/folders/sample-brand-assets', 'drive');
    insLink.run(1, 'SOP & Workspace Dokumen', 'https://notion.so/workspace/operasional-sop', 'notion');
    insLink.run(2, 'Master Canvas Figma GSM v2.5', 'https://figma.com/file/sample-productivier-workspace', 'figma');
    insLink.run(2, 'Staging Live Preview', 'http://localhost:3007', 'github');
    insLink.run(2, 'Spreadsheet Rekap Konten', 'https://docs.google.com/spreadsheets/sample-data', 'sheets');
  }

  // Seed Project Client Notes if empty
  const totalClientNotes = (db.prepare('SELECT COUNT(*) as count FROM project_client_notes').get() as { count: number }).count;
  if (totalClientNotes === 0) {
    const insClientNote = db.prepare(`
      INSERT INTO project_client_notes (project_id, author_name, author_role, message, category, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insClientNote.run(
      1,
      'Pak Budi Santoso (Klien)',
      'client',
      'Konten carousel feed untuk promo weekend mohon ditambahkan slide harga paket bundling ya tim.',
      'revisi',
      'in_progress',
      new Date(Date.now() - 3600000 * 5).toISOString()
    );

    insClientNote.run(
      1,
      'Fifa (Leader)',
      'team',
      'Siap Pak Budi, slide bundling sudah kami update di Google Drive draft revisi.',
      'feedback',
      'resolved',
      new Date(Date.now() - 3600000 * 3).toISOString()
    );

    insClientNote.run(
      1,
      'Ibu Jessica (Marketing)',
      'client',
      'Tone warna feed Instagram sudah pas banget dengan GSM brand kami! Terima kasih.',
      'apresiasi',
      'resolved',
      new Date(Date.now() - 3600000 * 24).toISOString()
    );

    insClientNote.run(
      2,
      'Mas Hendra (Product Manager)',
      'client',
      'Apakah font heading di dashboard bisa diganti dengan Inter Display agar lebih konsisten dengan web utama?',
      'pertanyaan',
      'open',
      new Date(Date.now() - 3600000 * 2).toISOString()
    );

    insClientNote.run(
      2,
      'Fadhil (Design Lead)',
      'team',
      'Bisa Mas Hendra, sedang kami siapkan opsi preview token typography-nya di Figma.',
      'feedback',
      'in_progress',
      new Date(Date.now() - 3600000 * 1).toISOString()
    );
  }

  // Seed AI Action Requests if empty
  const totalActionRequests = (db.prepare('SELECT COUNT(*) as count FROM ai_action_requests').get() as { count: number }).count;
  if (totalActionRequests === 0) {
    const insActionReq = db.prepare(`
      INSERT INTO ai_action_requests (id, user_id, action_type, description, payload_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insActionReq.run(
      1,
      fifaId,
      'create_task',
      'Buat tugas "Finalisasi Desain Sprint Feed 3:4" (Target: 3 Desain)',
      JSON.stringify({
        project_id: 1,
        aktivitas: 'Finalisasi Desain Sprint Feed 3:4',
        target: 3,
        realisasi: 3,
        satuan: 'Desain',
        tanggal: new Date().toISOString().slice(0, 10),
      }),
      'pending',
      new Date(Date.now() - 3600000 * 2).toISOString()
    );

    insActionReq.run(
      2,
      fifaId,
      'create_note',
      'Buat catatan memo "Rangkuman Diskusi AI & Feedback Klien"',
      JSON.stringify({
        title: 'Rangkuman Diskusi AI & Feedback Klien',
        content: 'Fokus pengerjaan revisi slide promo bundling dan penyesuaian font Inter Display di dashboard sesuai masukan Mas Hendra.',
        tags: ['ai', 'klien', 'revisi'],
        color: '#DCD4FB',
      }),
      'pending',
      new Date(Date.now() - 3600000 * 1).toISOString()
    );
  }

  // Seed Notifications if empty
  const totalNotifications = (db.prepare('SELECT COUNT(*) as count FROM notifications').get() as { count: number }).count;
  if (totalNotifications === 0) {
    const insNotif = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insNotif.run(
      fifaId,
      'Permintaan Izin Asisten AI',
      'Miu ingin membuat tugas baru: "Finalisasi Desain Sprint Feed 3:4" (Target: 3 Desain).',
      'ai_permission',
      '/api/ai/actions',
      JSON.stringify({ action_request_id: 1, action_type: 'create_task' }),
      0,
      new Date(Date.now() - 3600000 * 2).toISOString()
    );

    insNotif.run(
      fifaId,
      'Pesan Baru di Koordinasi Tim Operasional',
      'Anggota Tim 1: "Siap Mbak Fifa, 3 konten video sudah masuk tahap render."',
      'chat',
      '/?tab=chat&group=1',
      JSON.stringify({ group_id: 1, sender: 'Anggota Tim 1' }),
      0,
      new Date(Date.now() - 3600000 * 1.5).toISOString()
    );

    insNotif.run(
      fifaId,
      'Pengingat Deadline Tugas',
      'Deadline proyek "Redesign UI Productivier Clean Slate" mendekati tanggal 30 Nov 2026.',
      'task',
      '/?tab=projects',
      JSON.stringify({ project_id: 2, deadline: '2026-11-30' }),
      0,
      new Date(Date.now() - 3600000 * 4).toISOString()
    );

    insNotif.run(
      fifaId,
      'Catatan Baru dari Klien',
      'Pak Budi Santoso (Klien) memberikan catatan revisi pada proyek Operasional & Konten Harian.',
      'client',
      '/?tab=projects&project_id=1',
      JSON.stringify({ project_id: 1, author: 'Pak Budi Santoso' }),
      0,
      new Date(Date.now() - 3600000 * 5).toISOString()
    );
  }

  // Update phone numbers if empty
  try {
    db.prepare("UPDATE users SET phone = '6285196598881' WHERE username = 'fifa' AND (phone IS NULL OR phone = '')").run();
    db.prepare("UPDATE users SET phone = '6281234567890' WHERE username = 'tim1' AND (phone IS NULL OR phone = '')").run();
    db.prepare("UPDATE users SET phone = '6289876543210' WHERE username = 'tim2' AND (phone IS NULL OR phone = '')").run();
  } catch {
    // ignore
  }

  // Seed Personal Todos if empty
  try {
    const totalPersonalTodos = (db.prepare('SELECT COUNT(*) as count FROM personal_todos').get() as { count: number }).count;
    if (totalPersonalTodos === 0) {
      const insTodo = db.prepare(`
        INSERT INTO personal_todos (id, user_id, title, tag, time, done)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insTodo.run('1', fifaId, 'Review feedback desain banner iklan Meta Ads', 'Desain', '09:30', 1);
      insTodo.run('2', fifaId, 'Finalisasi briefing copywriting konten video reels', 'Konten', '11:00', 0);
      insTodo.run('3', fifaId, 'Monitoring CPA & CPR Advantage+ CBO harian', 'Ads', '14:00', 0);
    }
  } catch {
    // ignore
  }

  // Client portal share_token column & backfill
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN share_token TEXT DEFAULT '';`);
  } catch {
    // Column already exists
  }
  try {
    const missingTokenProjects = db
      .prepare("SELECT id FROM projects WHERE share_token IS NULL OR TRIM(share_token) = ''")
      .all() as Array<{ id: number }>;
    const updToken = db.prepare('UPDATE projects SET share_token = ? WHERE id = ?');
    for (const row of missingTokenProjects) {
      updToken.run(crypto.randomBytes(12).toString('hex'), row.id);
    }
  } catch {
    // ignore
  }

  // One-time data hygiene, role normalization, branding purge, and legacy project->chat group backfill
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations (key TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    const alreadyMigrated = db.prepare('SELECT key FROM _migrations WHERE key = ?').get('hygiene_and_backfill_v2');
    if (!alreadyMigrated) {
      // 1. Normalize invalid user roles (e.g. 'Lead Developer' -> 'karyawan')
      db.prepare("UPDATE users SET role = 'karyawan' WHERE role NOT IN ('admin', 'karyawan')").run();

      // 2. Rename legacy branding in existing rows
      db.prepare("UPDATE projects SET nama_proyek = REPLACE(nama_proyek, 'Intellecta', 'Productivier') WHERE nama_proyek LIKE '%Intellecta%'").run();
      db.prepare("UPDATE notifications SET message = REPLACE(message, 'Intellecta', 'Productivier') WHERE message LIKE '%Intellecta%'").run();
      db.prepare("UPDATE chat_groups SET name = REPLACE(name, 'Intellecta', 'Productivier') WHERE name LIKE '%Intellecta%'").run();
      db.prepare("UPDATE project_links SET url = REPLACE(url, 'intellecta', 'productivier') WHERE LOWER(url) LIKE '%intellecta%'").run();
      db.prepare("UPDATE calendar_events SET description = REPLACE(description, 'Bento grid', 'tata letak dashboard') WHERE description LIKE '%Bento grid%'").run();

      // 3. Remove dirty placeholder/test realisasi rows ('-' / empty) & junk notes/chat
      db.prepare("DELETE FROM realisasi WHERE TRIM(aktivitas) IN ('', '-')").run();
      db.prepare("DELETE FROM notes WHERE LOWER(TRIM(title)) IN ('tes', 'test', 'wawawaw', 'cok')").run();
      db.prepare("DELETE FROM chat_messages WHERE LOWER(message) LIKE '%jancok%'").run();

      // 4. Remove junk 'QWQW' project and duplicate empty 'Redesign Landing Page MVP' if empty
      const junkProjects = db.prepare("SELECT id FROM projects WHERE UPPER(TRIM(nama_proyek)) = 'QWQW'").all() as Array<{ id: number }>;
      for (const jp of junkProjects) {
        db.prepare('DELETE FROM project_members WHERE project_id = ?').run(jp.id);
        db.prepare('DELETE FROM chat_group_projects WHERE project_id = ?').run(jp.id);
        db.prepare('DELETE FROM projects WHERE id = ?').run(jp.id);
      }

      const dupLanding = db
        .prepare("SELECT id FROM projects WHERE nama_proyek = 'Redesign Landing Page MVP' ORDER BY id ASC")
        .all() as Array<{ id: number }>;
      if (dupLanding.length > 1) {
        for (const dup of dupLanding.slice(1)) {
          const hasWork = (db.prepare('SELECT COUNT(*) as c FROM realisasi WHERE project_id = ?').get(dup.id) as { c: number }).c;
          const hasLinks = (db.prepare('SELECT COUNT(*) as c FROM project_links WHERE project_id = ?').get(dup.id) as { c: number }).c;
          if (hasWork === 0 && hasLinks === 0) {
            db.prepare('DELETE FROM project_members WHERE project_id = ?').run(dup.id);
            db.prepare('DELETE FROM chat_group_projects WHERE project_id = ?').run(dup.id);
            db.prepare('DELETE FROM projects WHERE id = ?').run(dup.id);
          }
        }
      }

      // 5. Backfill project_members & auto-create chat groups for every existing project lacking one
      const remainingProjects = db.prepare('SELECT id, nama_proyek, pic_id FROM projects ORDER BY id ASC').all() as Array<{
        id: number;
        nama_proyek: string;
        pic_id: number | null;
      }>;

      for (const proj of remainingProjects) {
        const leaderId = proj.pic_id || fifaId;
        db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'leader')").run(proj.id, leaderId);

        const linked = db.prepare('SELECT group_id FROM chat_group_projects WHERE project_id = ? LIMIT 1').get(proj.id) as { group_id: number } | undefined;
        if (!linked) {
          const insGrp = db
            .prepare(
              "INSERT INTO chat_groups (name, description, project_id, created_by, ai_name, ai_model, ai_thinking_mode) VALUES (?, ?, ?, ?, 'Miu', 'nvidia/nemotron-3.5-super-vl:free', 'medium')"
            )
            .run(`${proj.nama_proyek} 🚀`, `Ruang koordinasi resmi tim untuk proyek ${proj.nama_proyek}`, proj.id, leaderId);
          const grpId = Number(insGrp.lastInsertRowid);
          db.prepare('INSERT OR IGNORE INTO chat_group_projects (group_id, project_id) VALUES (?, ?)').run(grpId, proj.id);

          const pMembers = db.prepare('SELECT user_id, role FROM project_members WHERE project_id = ?').all(proj.id) as Array<{
            user_id: number;
            role: string;
          }>;
          for (const pm of pMembers) {
            db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
              grpId,
              pm.user_id,
              pm.role === 'leader' ? 'admin' : 'member'
            );
          }
          db.prepare('INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai) VALUES (?, NULL, ?, ?, 1)').run(
            grpId,
            'Miu',
            `Ruang diskusi untuk proyek **${proj.nama_proyek}** telah terhubung otomatis. Ketik \`@Miu\` untuk bantuan koordinasi tim!`
          );
        }
      }

      db.prepare('INSERT OR IGNORE INTO _migrations (key) VALUES (?)').run('hygiene_and_backfill_v2');
    }

    const migratedV3 = db.prepare('SELECT key FROM _migrations WHERE key = ?').get('hygiene_and_backfill_v3');
    if (!migratedV3) {
      db.prepare("UPDATE notes SET title = REPLACE(REPLACE(title, 'Intellecta', 'Productivier'), 'Bento', 'Dashboard'), content = REPLACE(REPLACE(content, 'Intellecta', 'Productivier'), 'Bento', 'Dashboard') WHERE title LIKE '%Intellecta%' OR content LIKE '%Intellecta%' OR title LIKE '%Bento%' OR content LIKE '%Bento%'").run();
      db.prepare("DELETE FROM chat_messages WHERE LOWER(TRIM(message)) IN ('cok', 'jancok', 'tes', 'test', 'wawawaw') OR LOWER(message) LIKE '%jancok%' OR LOWER(message) LIKE '%@miu halo cok%' OR LOWER(message) LIKE '%bilango jancok%'").run();
      db.prepare("UPDATE chat_messages SET message = REPLACE(REPLACE(REPLACE(message, '[Intellecta AI]:', ''), '[Intellecta]:', ''), 'Intellecta', 'Productivier') WHERE message LIKE '%Intellecta%'").run();
      db.prepare("UPDATE chat_messages SET message = REPLACE(message, 'Nama gw **Jarvis**', 'Nama gw **Miu**') WHERE message LIKE '%Jarvis%'").run();
      db.prepare("UPDATE calendar_events SET title = REPLACE(REPLACE(title, 'Intellecta', 'Productivier'), 'Bento', 'Dashboard'), description = REPLACE(REPLACE(description, 'Intellecta', 'Productivier'), 'Bento', 'Dashboard') WHERE title LIKE '%Intellecta%' OR description LIKE '%Intellecta%' OR title LIKE '%Bento%' OR description LIKE '%Bento%'").run();
      db.prepare("DELETE FROM notifications WHERE LOWER(message) LIKE '%jancok%' OR LOWER(message) LIKE '%\"cok\"%' OR LOWER(message) LIKE '%halo cok%'").run();
      db.prepare("UPDATE notifications SET title = REPLACE(REPLACE(title, 'Intellecta', 'Productivier'), 'Bento', 'Dashboard'), message = REPLACE(REPLACE(message, 'Intellecta', 'Productivier'), 'Bento', 'Dashboard') WHERE title LIKE '%Intellecta%' OR message LIKE '%Intellecta%' OR title LIKE '%Bento%' OR message LIKE '%Bento%'").run();
      db.prepare("UPDATE projects SET nama_proyek = REPLACE(nama_proyek, 'Intellecta', 'Productivier') WHERE nama_proyek LIKE '%Intellecta%'").run();
      db.prepare("UPDATE project_links SET url = REPLACE(url, 'intellecta', 'productivier') WHERE LOWER(url) LIKE '%intellecta%'").run();
      db.prepare('INSERT OR IGNORE INTO _migrations (key) VALUES (?)').run('hygiene_and_backfill_v3');
    }
  } catch (err) {
    console.error('Migration hygiene_and_backfill_v2 warning:', err);
  }

  return db;
}

export function getDb(): DatabaseSync {
  if (!global.__productivierDb) {
    global.__productivierDb = initDb();
  }
  return global.__productivierDb;
}
