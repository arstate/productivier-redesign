import { NextResponse } from 'next/server';
import { getDb, hashPassword } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, username, nama, divisi, role, gender, avatar_url, phone, created_at FROM users ORDER BY id ASC'
  ).all();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  try {
    const { username, password, nama, divisi, role, phone, gender } = await req.json();
    if (!username || !password || !nama) {
      return NextResponse.json({ error: 'Username, password, dan nama wajib diisi.' }, { status: 400 });
    }
    const db = getDb();
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (exists) {
      return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 409 });
    }
    const hashedPassword = hashPassword(password);
    const info = db.prepare(
      'INSERT INTO users (username, password, nama, divisi, role, phone, gender) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      username.trim(),
      hashedPassword,
      nama.trim(),
      (divisi || 'Umum').trim(),
      role === 'admin' ? 'admin' : 'karyawan',
      phone ? phone.trim() : '',
      gender === 'female' ? 'female' : 'male'
    );

    return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat akun';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
