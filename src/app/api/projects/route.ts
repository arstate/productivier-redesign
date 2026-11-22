import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.*, u.nama as pic_nama,
      COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi,
      COALESCE((SELECT COUNT(r.id) FROM realisasi r WHERE r.project_id = p.id), 0) as jumlah_laporan
    FROM projects p
    LEFT JOIN users u ON p.pic_id = u.id
    ORDER BY p.id DESC
  `).all() as Array<Record<string, unknown>>;

  const projects = rows.map((p) => {
    const target = Number(p.target_total) || 0;
    const total = Number(p.total_realisasi) || 0;
    return {
      ...p,
      persentase: target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0,
    };
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  try {
    const { nama_proyek, pic_id, divisi, target_total, satuan, status, deadline } = await req.json();
    if (!nama_proyek) {
      return NextResponse.json({ error: 'Nama proyek wajib diisi.' }, { status: 400 });
    }
    const db = getDb();
    const info = db.prepare(
      'INSERT INTO projects (nama_proyek, pic_id, divisi, target_total, satuan, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      nama_proyek.trim(),
      pic_id ? Number(pic_id) : null,
      (divisi || 'Umum').trim(),
      Number(target_total) || 100,
      (satuan || 'Tugas').trim(),
      status || 'aktif',
      deadline || ''
    );
    return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat proyek';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
