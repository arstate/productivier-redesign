import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM realisasi WHERE id = ?').get(Number(id));
    if (!existing) {
      return NextResponse.json({ error: 'Data realisasi tidak ditemukan' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.aktivitas !== undefined) {
      updates.push('aktivitas = ?');
      values.push(String(body.aktivitas).trim());
    }
    if (body.target !== undefined) {
      updates.push('target = ?');
      values.push(Number(body.target));
    }
    if (body.realisasi !== undefined) {
      updates.push('realisasi = ?');
      values.push(Number(body.realisasi));
    }
    if (body.satuan !== undefined) {
      updates.push('satuan = ?');
      values.push(String(body.satuan).trim());
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(String(body.status).trim());
    }
    if (body.kendala !== undefined) {
      updates.push('kendala = ?');
      values.push(String(body.kendala).trim());
    }
    if (body.solusi !== undefined) {
      updates.push('solusi = ?');
      values.push(String(body.solusi).trim());
    }
    if (body.tanggal !== undefined) {
      updates.push('tanggal = ?');
      values.push(String(body.tanggal).trim());
    }

    if (body.target !== undefined && body.realisasi !== undefined) {
      const t = Number(body.target) || 1;
      const r = Number(body.realisasi) || 0;
      const p = Math.round((r / t) * 100);
      updates.push('persentase = ?');
      values.push(p);
    }

    if (updates.length > 0) {
      values.push(Number(id));
      db.prepare(`UPDATE realisasi SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM realisasi WHERE id = ?').get(Number(id));
    return NextResponse.json({ success: true, realisasi: updated });
  } catch (error: any) {
    console.error('Error PATCH /api/realisasi/[id]:', error);
    return NextResponse.json({ error: error.message || 'Gagal memperbarui realisasi' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();

    db.prepare('DELETE FROM realisasi WHERE id = ?').run(Number(id));
    return NextResponse.json({ success: true, message: 'Laporan realisasi berhasil dihapus' });
  } catch (error: any) {
    console.error('Error DELETE /api/realisasi/[id]:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus realisasi' }, { status: 500 });
  }
}
