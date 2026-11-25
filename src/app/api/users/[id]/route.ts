import { NextResponse } from 'next/server';
import { getDb, hashPassword } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 });
    }

    // Non-admin can only update their own profile
    if (auth.user.id !== userId && auth.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah data pengguna ini.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { nama, divisi, password, role, avatar_url, gender, phone } = body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, string> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Only admin can promote/demote roles
    let nextRole = existing.role === 'admin' ? 'admin' : 'karyawan';
    if (role !== undefined) {
      if (auth.user.role !== 'admin' && role !== existing.role) {
        return NextResponse.json(
          { error: 'Akses ditolak: Hanya Leader / Admin yang dapat mengubah peran pengguna.' },
          { status: 403 }
        );
      }
      if (auth.user.role === 'admin') {
        nextRole = role === 'admin' ? 'admin' : 'karyawan';
      }
    }

    const cleanPassword = typeof password === 'string' && password.trim() !== '' ? password.trim() : null;
    if (cleanPassword && cleanPassword.length < 4) {
      return NextResponse.json({ error: 'Password minimal 4 karakter.' }, { status: 400 });
    }
    const newPassword = cleanPassword ? hashPassword(cleanPassword) : existing.password;
    const newPhone = phone !== undefined ? String(phone).trim().slice(0, 24) : (existing.phone || '');
    const nextGender = gender === 'female' ? 'female' : gender === 'male' ? 'male' : (existing.gender || 'male');

    db.prepare('UPDATE users SET nama = ?, divisi = ?, password = ?, role = ?, avatar_url = ?, gender = ?, phone = ? WHERE id = ?').run(
      nama !== undefined ? String(nama).trim().slice(0, 100) : existing.nama,
      divisi !== undefined ? String(divisi).trim().slice(0, 80) : existing.divisi,
      newPassword,
      nextRole,
      avatar_url !== undefined ? String(avatar_url).slice(0, 2048) : existing.avatar_url,
      nextGender,
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
    const auth = requireAdmin(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 });
    }
    const db = getDb();

    const target = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
    if (!target) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    }

    if (target.username === 'fifa') {
      return NextResponse.json({ error: 'Akun utama fifa tidak bisa dihapus.' }, { status: 403 });
    }

    // Transfer ownership of any chat groups created by the departing user to an admin (so ON DELETE CASCADE won't wipe team chat history)
    const fallbackAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND id != ? ORDER BY id ASC LIMIT 1").get(userId) as
      | { id: number }
      | undefined;
    if (fallbackAdmin) {
      db.prepare('UPDATE chat_groups SET created_by = ? WHERE created_by = ?').run(fallbackAdmin.id, userId);
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return NextResponse.json({ deleted: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menghapus user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
