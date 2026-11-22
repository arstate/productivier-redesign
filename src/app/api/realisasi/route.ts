import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  const role = searchParams.get('role');
  const projectId = searchParams.get('project_id');

  let sql = `
    SELECT r.*, p.nama_proyek
    FROM realisasi r
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE 1=1
  `;
  const params: Array<number> = [];
  if (role !== 'admin' && userId) {
    sql += ' AND r.user_id = ?';
    params.push(Number(userId));
  }
  if (projectId) {
    sql += ' AND r.project_id = ?';
    params.push(Number(projectId));
  }
  sql += ' ORDER BY r.tanggal DESC, r.id DESC';

  const db = getDb();
  const realisasi = db.prepare(sql).all(...params);
  return NextResponse.json({ realisasi });
}

export async function POST(req: Request) {
  try {
    const {
      project_id, user_id, nama, divisi, tanggal, aktivitas,
      target, realisasi, satuan, kendala, solusi, bukti_foto_url
    } = await req.json();

    const t = Number(target) || 0;
    const r = Number(realisasi) || 0;
    const persentase = t > 0 ? Math.round((r / t) * 100) : 0;
    const status = persentase >= 100 ? 'Tercapai' : persentase >= 70 ? 'Hampir' : 'Belum';

    const db = getDb();
    const info = db.prepare(`
      INSERT INTO realisasi (project_id, user_id, nama, divisi, tanggal, aktivitas, target, realisasi, satuan, persentase, status, kendala, solusi, bukti_foto_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id ? Number(project_id) : null,
      user_id ? Number(user_id) : null,
      nama || 'Tim',
      divisi || 'Umum',
      tanggal || new Date().toISOString().slice(0, 10),
      aktivitas || '-',
      t,
      r,
      satuan || 'Tugas',
      persentase,
      status,
      kendala || '',
      solusi || '',
      bukti_foto_url || ''
    );

    return NextResponse.json({ id: Number(info.lastInsertRowid), persentase, status }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menyimpan realisasi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
