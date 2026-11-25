import type { Row } from '@/types/db-rows';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const db = getDb();
    const todos = db
      .prepare('SELECT * FROM personal_todos WHERE user_id = ? ORDER BY created_at DESC')
      .all(auth.user.id) as Row[];

    const formatted = todos.map((t: Row) => ({
      ...t,
      done: Boolean(t.done),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error GET /api/todos:', error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : '') || 'Gagal memuat to-do' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { title, tag, time } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Judul to-do wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const id = body.id || `todo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalUserId = auth.user.id;
    const finalTag = tag ? String(tag).trim() : 'Umum';
    const finalTime = time ? String(time).trim() : '';

    db.prepare(`
      INSERT INTO personal_todos (id, user_id, title, tag, time, done, created_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now', 'localtime'))
    `).run(id, finalUserId, title.trim(), finalTag, finalTime);

    const newTodo = db.prepare('SELECT * FROM personal_todos WHERE id = ?').get(id) as Row;

    return NextResponse.json({
      success: true,
      todo: {
        ...newTodo,
        done: Boolean(newTodo.done),
      },
    });
  } catch (error) {
    console.error('Error POST /api/todos:', error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : '') || 'Gagal membuat to-do' }, { status: 500 });
  }
}
