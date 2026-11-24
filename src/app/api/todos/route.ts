import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    const db = getDb();
    let todos;
    if (userId) {
      todos = db.prepare('SELECT * FROM personal_todos WHERE user_id = ? ORDER BY created_at DESC').all(Number(userId));
    } else {
      todos = db.prepare('SELECT * FROM personal_todos ORDER BY created_at DESC').all();
    }

    const formatted = todos.map((t: any) => ({
      ...t,
      done: Boolean(t.done),
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error GET /api/todos:', error);
    return NextResponse.json({ error: error.message || 'Gagal memuat to-do' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, title, tag, time } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Judul to-do wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const id = body.id || `todo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalUserId = Number(user_id) || 1;
    const finalTag = tag ? String(tag).trim() : 'Umum';
    const finalTime = time ? String(time).trim() : '';

    db.prepare(`
      INSERT INTO personal_todos (id, user_id, title, tag, time, done, created_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now', 'localtime'))
    `).run(id, finalUserId, title.trim(), finalTag, finalTime);

    const newTodo = db.prepare('SELECT * FROM personal_todos WHERE id = ?').get(id) as any;

    return NextResponse.json({
      success: true,
      todo: {
        ...newTodo,
        done: Boolean(newTodo.done),
      },
    });
  } catch (error: any) {
    console.error('Error POST /api/todos:', error);
    return NextResponse.json({ error: error.message || 'Gagal membuat to-do' }, { status: 500 });
  }
}
