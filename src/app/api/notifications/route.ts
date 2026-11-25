import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('user_id');
    const userId = auth.user.role === 'admin' && requestedUserId ? Number(requestedUserId) : auth.user.id;
    const type = searchParams.get('type');
    const unreadOnly = searchParams.get('unread_only') === 'true';

    const db = getDb();

    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params: (number | string)[] = [];

    if (userId) {
      query += ' AND (user_id = ? OR user_id IS NULL)';
      params.push(userId);
    }

    if (type && type !== 'all') {
      query += ' AND type = ?';
      params.push(type);
    }

    if (unreadOnly) {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY id DESC LIMIT 50';

    const rows = db.prepare(query).all(...params) as Array<{
      id: number;
      user_id: number | null;
      title: string;
      message: string;
      type: string;
      action_url: string;
      payload_json: string;
      is_read: number;
      created_at: string;
    }>;

    const notifications = rows.map((r) => ({
      ...r,
      is_read: Boolean(r.is_read),
    }));

    // Calculate unread count
    let unreadQuery = 'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0';
    const unreadParams: number[] = [];
    if (userId) {
      unreadQuery += ' AND (user_id = ? OR user_id IS NULL)';
      unreadParams.push(Number(userId));
    }
    const unreadCountRow = db.prepare(unreadQuery).get(...unreadParams) as { count: number } | undefined;
    const unread_count = unreadCountRow ? unreadCountRow.count : 0;

    return NextResponse.json({ notifications, unread_count });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memuat notifikasi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { user_id, title, message, type, action_url, payload_json } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title dan message wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const ins = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(
      user_id ? Number(user_id) : null,
      title.trim(),
      message.trim(),
      type || 'system',
      action_url || '',
      typeof payload_json === 'string' ? payload_json : JSON.stringify(payload_json || {})
    );

    return NextResponse.json({
      success: true,
      id: Number(ins.lastInsertRowid),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat notifikasi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { id, mark_all_read } = body;

    const db = getDb();

    if (mark_all_read) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL').run(auth.user.id);
      return NextResponse.json({ success: true, message: 'Semua notifikasi ditandai dibaca' });
    }

    if (id) {
      const existing = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(Number(id)) as
        | { user_id: number | null }
        | undefined;
      if (existing && existing.user_id && existing.user_id !== auth.user.id && auth.user.role !== 'admin') {
        return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
      }
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(Number(id));
      return NextResponse.json({ success: true, message: 'Notifikasi ditandai dibaca' });
    }

    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memperbarui notifikasi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(Number(id)) as
      | { user_id: number | null }
      | undefined;
    if (existing && existing.user_id && existing.user_id !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    db.prepare('DELETE FROM notifications WHERE id = ?').run(Number(id));

    return NextResponse.json({ success: true, message: 'Notifikasi dihapus' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menghapus notifikasi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
