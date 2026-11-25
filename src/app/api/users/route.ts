import { NextResponse } from 'next/server';
import { getDb, hashPassword } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { validateUserCreate } from '@/lib/validation';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;

  const db = getDb();
  const users = db.prepare(
    'SELECT id, username, nama, divisi, role, gender, avatar_url, phone, created_at FROM users ORDER BY id ASC'
  ).all();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const parsed = validateUserCreate(body || {});
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { username, password, nama, divisi, role, gender, phone } = parsed.data;

    const db = getDb();
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) {
      return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 409 });
    }
    const hashedPassword = hashPassword(password);
    const info = db.prepare(
      'INSERT INTO users (username, password, nama, divisi, role, phone, gender) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(username, hashedPassword, nama, divisi, role, phone, gender);

    return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat akun';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
