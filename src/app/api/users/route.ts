import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, username, nama, divisi, role, avatar_url, created_at FROM users ORDER BY id ASC'
  ).all();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  try {
    const { username, password, nama, divisi, role } = await req.json();
    if (!username || !password || !nama) {
      return NextResponse.json({ error: 'Username, password, dan nama wajib diisi.' }, { status: 400 });
    }
    const db = getDb();
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (exists) {
      return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 409 });
    }
    const info = db.prepare(
      'INSERT INTO users (username, password, nama, divisi, role) VALUES (?, ?, ?, ?, ?)'
    ).run(username.trim(), password, nama.trim(), (divisi || 'Umum').trim(), role === 'admin' ? 'admin' : 'karyawan');

    return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat akun';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
