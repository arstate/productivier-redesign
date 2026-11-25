import { NextResponse } from 'next/server';
import { getDb, verifyPassword, hashPassword } from '@/lib/db';
import { attachSessionCookie, clearSessionCookie, getSessionUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Belum login atau sesi berakhir' }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cleanUser = typeof body?.username === 'string' ? body.username.trim() : '';
    const cleanPass = typeof body?.password === 'string' ? body.password : '';

    if (!cleanUser || !cleanPass) {
      return NextResponse.json({ error: 'Username dan password wajib diisi!' }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, password, nama, divisi, role, gender, avatar_url, phone FROM users WHERE username = ?'
    ).get(cleanUser) as {
      id: number;
      username: string;
      password: string;
      nama: string;
      divisi: string;
      role: 'admin' | 'karyawan';
      gender: 'female' | 'male';
      avatar_url?: string;
      phone?: string;
    } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    const { valid, needsRehash } = verifyPassword(cleanPass, user.password);

    if (!valid) {
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    if (needsRehash) {
      const newHashedPassword = hashPassword(cleanPass);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHashedPassword, user.id);
    }

    const normalizedRole = user.role === 'admin' ? 'admin' : 'karyawan';
    const safeUser = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      divisi: user.divisi,
      role: normalizedRole,
      gender: user.gender,
      avatar_url: user.avatar_url,
      phone: user.phone,
    };

    const res = NextResponse.json({ user: safeUser });
    return attachSessionCookie(res, { id: user.id, role: normalizedRole });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Login gagal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  return clearSessionCookie(res);
}
