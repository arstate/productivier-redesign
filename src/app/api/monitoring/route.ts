import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const today = searchParams.get('tanggal') || new Date().toISOString().slice(0, 10);

  const db = getDb();
  const allUsers = db.prepare(
    "SELECT id, username, nama, divisi, role, phone FROM users ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, nama ASC"
  ).all() as Array<{ id: number; username: string; nama: string; divisi: string; role: string; phone?: string }>;

  const todayInputs = db.prepare(`
    SELECT COALESCE(assigned_to_user_id, user_id) as effective_user_id,
           COUNT(*) as total,
           AVG(persentase) as avg_pct
    FROM realisasi
    WHERE tanggal = ? AND (realisasi > 0 OR assigned_by_user_id IS NULL)
    GROUP BY effective_user_id
  `).all(today) as Array<{ effective_user_id: number; total: number; avg_pct: number }>;

  const inputMap = new Map(todayInputs.map((i) => [i.effective_user_id, i]));
  const statusTim = allUsers.map((u) => {
    const info = inputMap.get(u.id);
    return {
      ...u,
      sudah_input: Boolean(info),
      jumlah_input: info ? info.total : 0,
      rata_persen: info ? Math.round(info.avg_pct) : 0,
    };
  });

  const tren7Hari = db.prepare(`
    SELECT tanggal, COUNT(*) as jumlah_laporan, ROUND(AVG(persentase)) as rata_persen
    FROM realisasi
    GROUP BY tanggal
    ORDER BY tanggal DESC
    LIMIT 7
  `).all().reverse();

  return NextResponse.json({ today, statusTim, tren7Hari });
}
