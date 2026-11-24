import { NextResponse } from 'next/server';
import { getDb, hashPassword } from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const body = await req.json();
    const { nama, divisi, password, role, avatar_url, gender, phone, current_user_id } = body;
    const db = getDb();

    // Access control check
    const headerUserId = req.headers.get('x-user-id');
    const requesterId = headerUserId ? Number(headerUserId) : (current_user_id ? Number(current_user_id) : null);

    if (requesterId) {
      const requester = db.prepare('SELECT id, role FROM users WHERE id = ?').get(requesterId) as { id: number; role: string } | undefined;
      if (!requester) {
        return NextResponse.json({ error: 'Pengguna yang melakukan permintaan tidak ditemukan' }, { status: 401 });
      }
      // Non-admin can only update their own profile and cannot change their role
      if (requester.id !== userId && requester.role !== 'admin') {
        return NextResponse.json({ error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah data pengguna ini.' }, { status: 403 });
      }
    }

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, string> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const newPassword = password && password.trim() !== '' ? hashPassword(password.trim()) : existing.password;
    const newPhone = phone !== undefined ? phone.trim() : (existing.phone || '');

    db.prepare('UPDATE users SET nama = ?, divisi = ?, password = ?, role = ?, avatar_url = ?, gender = ?, phone = ? WHERE id = ?').run(
      nama !== undefined ? nama.trim() : existing.nama,
      divisi !== undefined ? divisi.trim() : existing.divisi,
      newPassword,
      role !== undefined ? role : existing.role,
      avatar_url !== undefined ? avatar_url : existing.avatar_url,
      gender !== undefined ? gender : (existing.gender || 'male'),
      newPhone,
      userId
    );

    const updated = db.prepare('SELECT id, username, nama, divisi, role, gender, avatar_url, phone FROM users WHERE id = ?').get(userId);
    return NextResponse.json({ user: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const db = getDb();

    // Access control check
    const headerUserId = req.headers.get('x-user-id');
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get('user_id');
    const requesterId = headerUserId ? Number(headerUserId) : (queryUserId ? Number(queryUserId) : null);

    if (requesterId) {
      const requester = db.prepare('SELECT id, role FROM users WHERE id = ?').get(requesterId) as { id: number; role: string } | undefined;
      if (!requester || requester.role !== 'admin') {
        return NextResponse.json({ error: 'Akses ditolak: Hanya Leader / Admin yang dapat menghapus akun.' }, { status: 403 });
      }
    }

    const target = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
    if (!target) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    }

    if (target.username === 'fifa') {
      return NextResponse.json({ error: 'Akun utama fifa tidak bisa dihapus.' }, { status: 403 });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return NextResponse.json({ deleted: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menghapus user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
