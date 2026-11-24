import { NextResponse } from 'next/server';
import { getDb, verifyPassword, hashPassword } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const cleanUser = (username || '').trim();
    const cleanPass = password || '';

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

    const safeUser = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      divisi: user.divisi,
      role: user.role,
      gender: user.gender,
      avatar_url: user.avatar_url,
      phone: user.phone,
    };

    return NextResponse.json({ user: safeUser });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Login gagal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
