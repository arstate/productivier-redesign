import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const { nama, divisi, password, role, avatar_url } = await req.json();
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, string> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    db.prepare('UPDATE users SET nama = ?, divisi = ?, password = ?, role = ?, avatar_url = ? WHERE id = ?').run(
      nama !== undefined ? nama.trim() : existing.nama,
      divisi !== undefined ? divisi.trim() : existing.divisi,
      password && password.trim() !== '' ? password : existing.password,
      role !== undefined ? role : existing.role,
      avatar_url !== undefined ? avatar_url : existing.avatar_url,
      userId
    );

    const updated = db.prepare('SELECT id, username, nama, divisi, role, avatar_url FROM users WHERE id = ?').get(userId);
    return NextResponse.json({ user: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  const db = getDb();
  const target = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
  if (target?.username === 'fifa') {
    return NextResponse.json({ error: 'Akun utama fifa tidak bisa dihapus.' }, { status: 403 });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return NextResponse.json({ deleted: true });
}
