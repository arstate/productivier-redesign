import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const today = searchParams.get('tanggal') || new Date().toISOString().slice(0, 10);

  const db = getDb();
  const allUsers = db.prepare(
    "SELECT id, username, nama, divisi, role FROM users WHERE role != 'admin' OR username = 'fifa' ORDER BY nama ASC"
  ).all() as Array<{ id: number; username: string; nama: string; divisi: string; role: string }>;

  const todayInputs = db.prepare(
    'SELECT user_id, COUNT(*) as total, AVG(persentase) as avg_pct FROM realisasi WHERE tanggal = ? GROUP BY user_id'
  ).all(today) as Array<{ user_id: number; total: number; avg_pct: number }>;

  const inputMap = new Map(todayInputs.map((i) => [i.user_id, i]));
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
