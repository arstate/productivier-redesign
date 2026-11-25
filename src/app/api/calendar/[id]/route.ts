import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const { title, description, date, start_time, end_time, category, color, project_id } = body;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
    }
    if (existing.user_id && Number(existing.user_id) !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak: Jadwal milik pengguna lain.' }, { status: 403 });
    }

    db.prepare(`
      UPDATE calendar_events
      SET title = ?, description = ?, date = ?, start_time = ?, end_time = ?, category = ?, color = ?, project_id = ?
      WHERE id = ?
    `).run(
      title !== undefined ? String(title).trim() : existing.title,
      description !== undefined ? String(description).trim() : existing.description,
      date !== undefined ? String(date).trim() : existing.date,
      start_time !== undefined ? String(start_time).trim() : existing.start_time,
      end_time !== undefined ? String(end_time).trim() : existing.end_time,
      category !== undefined ? String(category) : existing.category,
      color !== undefined ? String(color) : existing.color,
      project_id !== undefined ? (project_id ? Number(project_id) : null) : existing.project_id,
      id
    );

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memperbarui jadwal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const db = getDb();
    const existing = db.prepare('SELECT user_id FROM calendar_events WHERE id = ?').get(id) as { user_id: number | null } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
    }
    if (existing.user_id && existing.user_id !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak: Jadwal milik pengguna lain.' }, { status: 403 });
    }
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menghapus jadwal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
