import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // e.g. '2026-11'
  const projectId = searchParams.get('project_id');

  let sql = `
    SELECT c.*, u.nama as user_nama, p.nama_proyek as project_nama
    FROM calendar_events c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN projects p ON c.project_id = p.id
    WHERE 1=1
  `;
  const params: Array<string | number> = [];

  if (month) {
    sql += ' AND c.date LIKE ?';
    params.push(`${month}%`);
  }
  if (projectId) {
    sql += ' AND c.project_id = ?';
    params.push(Number(projectId));
  }

  sql += ' ORDER BY c.date ASC, c.start_time ASC';

  const db = getDb();
  const events = db.prepare(sql).all(...params);

  // Also fetch project deadlines to show as milestone events
  const projectDeadlines = db.prepare(`
    SELECT p.id as project_id, p.nama_proyek as title, p.deadline as date, p.divisi, 'deadline' as category, '#F87171' as color
    FROM projects p
    WHERE p.deadline IS NOT NULL AND p.deadline != ''
  `).all();

  return NextResponse.json({ events, projectDeadlines });
}

export async function POST(req: Request) {
  try {
    const {
      user_id, title, description, date, start_time, end_time, category, color, project_id
    } = await req.json();

    if (!title || !title.trim() || !date) {
      return NextResponse.json({ error: 'Judul dan tanggal jadwal wajib diisi.' }, { status: 400 });
    }

    const db = getDb();
    const info = db.prepare(`
      INSERT INTO calendar_events (user_id, title, description, date, start_time, end_time, category, color, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user_id ? Number(user_id) : null,
      title.trim(),
      (description || '').trim(),
      date.trim(),
      (start_time || '09:00').trim(),
      (end_time || '10:00').trim(),
      category || 'activity',
      color || '#D2F27C',
      project_id ? Number(project_id) : null
    );

    return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat event jadwal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
