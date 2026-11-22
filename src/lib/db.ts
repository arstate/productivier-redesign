import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = path.join(process.cwd(), 'productivier.db');

declare global {
  var __productivierDb: DatabaseSync | undefined;
}

function initDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nama TEXT NOT NULL,
      divisi TEXT NOT NULL DEFAULT 'Umum',
      role TEXT NOT NULL DEFAULT 'karyawan',
      avatar_url TEXT DEFAULT '',
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
  `);

  const fifaExists = db.prepare('SELECT id FROM users WHERE username = ?').get('fifa') as { id: number } | undefined;
  if (!fifaExists) {
    db.prepare('INSERT INTO users (username, password, nama, divisi, role) VALUES (?, ?, ?, ?, ?)').run(
      'fifa', 'cewekalay', 'Fifa (Leader)', 'Management', 'admin'
    );
  } else {
    db.prepare('UPDATE users SET password = ?, role = ? WHERE username = ?').run('cewekalay', 'admin', 'fifa');
  }

  const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (totalUsers <= 1) {
    const ins = db.prepare('INSERT OR IGNORE INTO users (username, password, nama, divisi, role) VALUES (?, ?, ?, ?, ?)');
    ins.run('tim1', 'tim123', 'Anggota Tim 1', 'Operasional', 'karyawan');
    ins.run('tim2', 'tim123', 'Anggota Tim 2', 'Kreatif', 'karyawan');
  }

  const totalProjects = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }).count;
  if (totalProjects === 0) {
    const fifaUser = db.prepare('SELECT id FROM users WHERE username = ?').get('fifa') as { id: number } | undefined;
    db.prepare('INSERT INTO projects (nama_proyek, pic_id, divisi, target_total, satuan, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'Operasional & Konten Harian', fifaUser ? fifaUser.id : 1, 'Operasional', 100, 'Tugas', 'aktif', '2026-12-31'
    );
  }

  return db;
}

export function getDb(): DatabaseSync {
  if (!global.__productivierDb) {
    global.__productivierDb = initDb();
  }
  return global.__productivierDb;
}
