import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const noteId = Number(id);
    const body = await req.json();
    const { title, content, tags, pinned, color, project_id, checklist } = body;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Catatan tidak ditemukan' }, { status: 404 });
    }

    // Access control guard
    const headerUserId = req.headers.get('x-user-id');
    const requesterId = headerUserId ? Number(headerUserId) : (body.user_id ? Number(body.user_id) : null);

    if (requesterId) {
      const requester = db.prepare('SELECT id, role FROM users WHERE id = ?').get(requesterId) as { id: number; role: string } | undefined;
      if (!requester) {
        return NextResponse.json({ error: 'Pengguna tidak valid' }, { status: 401 });
      }
      if (Number(existing.user_id) !== requester.id && requester.role !== 'admin') {
        return NextResponse.json({ error: 'Akses ditolak: Anda hanya dapat mengubah catatan milik sendiri.' }, { status: 403 });
      }
    }

    const newTitle = title !== undefined ? String(title).trim() : existing.title;
    const newContent = content !== undefined ? String(content).trim() : existing.content;
    const newTags = tags !== undefined ? JSON.stringify(tags) : existing.tags;
    const newPinned = pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned;
    const newColor = color !== undefined ? color : existing.color;
    const newProjectId = project_id !== undefined ? (project_id ? Number(project_id) : null) : existing.project_id;
    const newChecklist = checklist !== undefined ? JSON.stringify(checklist) : existing.checklist;

    db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, tags = ?, pinned = ?, color = ?, project_id = ?, checklist = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newTitle, newContent, newTags, newPinned, newColor, newProjectId, newChecklist, noteId);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memperbarui catatan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const noteId = Number(id);
    const db = getDb();

    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Catatan tidak ditemukan' }, { status: 404 });
    }

    // Access control guard
    const headerUserId = req.headers.get('x-user-id');
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get('user_id');
    const requesterId = headerUserId ? Number(headerUserId) : (queryUserId ? Number(queryUserId) : null);

    if (requesterId) {
      const requester = db.prepare('SELECT id, role FROM users WHERE id = ?').get(requesterId) as { id: number; role: string } | undefined;
      if (!requester) {
        return NextResponse.json({ error: 'Pengguna tidak valid' }, { status: 401 });
      }
      if (Number(existing.user_id) !== requester.id && requester.role !== 'admin') {
        return NextResponse.json({ error: 'Akses ditolak: Anda hanya dapat menghapus catatan milik sendiri.' }, { status: 403 });
      }
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menghapus catatan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
