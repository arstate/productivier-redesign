import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const tag = searchParams.get('tag');

  let sql = `
    SELECT n.*, u.nama as author_nama, p.nama_proyek as project_nama
    FROM notes n
    LEFT JOIN users u ON n.user_id = u.id
    LEFT JOIN projects p ON n.project_id = p.id
    WHERE 1=1
  `;
  const params: Array<string | number> = [];

  if (auth.user.role !== 'admin' && !projectId) {
    sql += ' AND n.user_id = ?';
    params.push(auth.user.id);
  }
  if (projectId) {
    sql += ' AND n.project_id = ?';
    params.push(Number(projectId));
  }

  sql += ' ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC';

  const db = getDb();
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  const notes = rows.map((r) => {
    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse((r.tags as string) || '[]');
    } catch {
      parsedTags = ((r.tags as string) || '').split(',').map((t) => t.trim()).filter(Boolean);
    }

    let parsedChecklist: Array<{ id: string; text: string; done: boolean }> = [];
    try {
      parsedChecklist = JSON.parse((r.checklist as string) || '[]');
    } catch {
      parsedChecklist = [];
    }

    return {
      ...r,
      pinned: Boolean(r.pinned),
      tags: parsedTags,
      checklist: parsedChecklist,
    };
  });

  const finalNotes = tag
    ? notes.filter((n) => n.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase()))
    : notes;

  return NextResponse.json({ notes: finalNotes });
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { title, content, tags, pinned, color, project_id, checklist } = await req.json();
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Judul catatan wajib diisi.' }, { status: 400 });
    }

    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify([]);
    const checklistJson = Array.isArray(checklist) ? JSON.stringify(checklist) : JSON.stringify([]);

    const db = getDb();
    const info = db.prepare(`
      INSERT INTO notes (user_id, title, content, tags, pinned, color, project_id, checklist)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auth.user.id,
      title.trim().slice(0, 200),
      (content || '').trim(),
      tagsJson,
      pinned ? 1 : 0,
      color || '#FFFFFF',
      project_id ? Number(project_id) : null,
      checklistJson
    );

    return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat catatan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
