import type { Row } from '@/types/db-rows';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM personal_todos WHERE id = ?').get(id) as Row;
    if (!existing) {
      return NextResponse.json({ error: 'To-do tidak ditemukan' }, { status: 404 });
    }
    if (existing.user_id !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.done !== undefined) {
      updates.push('done = ?');
      values.push(body.done ? 1 : 0);
    }
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(String(body.title).trim());
    }
    if (body.tag !== undefined) {
      updates.push('tag = ?');
      values.push(String(body.tag).trim());
    }
    if (body.time !== undefined) {
      updates.push('time = ?');
      values.push(String(body.time).trim());
    }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE personal_todos SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM personal_todos WHERE id = ?').get(id) as Row;

    return NextResponse.json({
      success: true,
      todo: {
        ...updated,
        done: Boolean(updated.done),
      },
    });
  } catch (error) {
    console.error('Error PATCH /api/todos/[id]:', error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : '') || 'Gagal memperbarui to-do' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const db = getDb();

    const existing = db.prepare('SELECT user_id FROM personal_todos WHERE id = ?').get(id) as { user_id: number } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'To-do tidak ditemukan' }, { status: 404 });
    }
    if (existing.user_id !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const res = db.prepare('DELETE FROM personal_todos WHERE id = ?').run(id);

    return NextResponse.json({
      success: true,
      deleted: (res as Row).changes > 0,
    });
  } catch (error) {
    console.error('Error DELETE /api/todos/[id]:', error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : '') || 'Gagal menghapus to-do' }, { status: 500 });
  }
}
