import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const SESSION_COOKIE_NAME = 'prod_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: number;
  username: string;
  nama: string;
  divisi: string;
  role: 'admin' | 'karyawan';
  gender: 'female' | 'male';
  avatar_url?: string;
  phone?: string;
}

function getSessionSecret(): string {
  if (process.env.PRODUCTIVIER_SESSION_SECRET) {
    return process.env.PRODUCTIVIER_SESSION_SECRET;
  }
  return crypto
    .createHash('sha256')
    .update(`${process.cwd()}:productivier-session-signing-secret-v2`)
    .digest('hex');
}

interface SessionPayload {
  uid: number;
  role: string;
  exp: number;
}

export function signSessionToken(userId: number, role: string): string {
  const payload: SessionPayload = {
    uid: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || !Number.isInteger(parsed.uid) || parsed.uid <= 0) return null;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export function getSessionUserFromToken(token?: string | null): SessionUser | null {
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const db = getDb();
  const user = db
    .prepare(
      'SELECT id, username, nama, divisi, role, gender, avatar_url, phone FROM users WHERE id = ?'
    )
    .get(payload.uid) as SessionUser | undefined;

  if (!user) return null;
  return {
    ...user,
    role: user.role === 'admin' ? 'admin' : 'karyawan',
    gender: user.gender === 'female' ? 'female' : 'male',
  };
}

export function getSessionUser(req: Request): SessionUser | null {
  const rawToken = parseCookieValue(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  return getSessionUserFromToken(rawToken);
}

export function requireAuth(req: Request): { user: SessionUser } | { error: NextResponse } {
  const user = getSessionUser(req);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Sesi login tidak valid atau telah berakhir. Silakan login kembali.' },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export function requireAdmin(req: Request): { user: SessionUser } | { error: NextResponse } {
  const auth = requireAuth(req);
  if ('error' in auth) return auth;
  if (auth.user.role !== 'admin') {
    return {
      error: NextResponse.json(
        { error: 'Akses ditolak: Hanya Leader / Admin yang memiliki izin ini.' },
        { status: 403 }
      ),
    };
  }
  return auth;
}

export function attachSessionCookie(res: NextResponse, user: { id: number; role: string }): NextResponse {
  const token = signSessionToken(user.id, user.role);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
