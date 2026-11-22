import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, nama, divisi, role, avatar_url FROM users WHERE username = ? AND password = ?'
    ).get((username || '').trim(), password || '');

    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Login gagal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
