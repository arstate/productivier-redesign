import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM realisasi WHERE id = ?').get(Number(id)) as any;
    if (!existing) {
      return NextResponse.json({ error: 'Data realisasi tidak ditemukan' }, { status: 404 });
    }

    const requester = auth.user;
    const requesterId = requester.id;
    const isOwnerOrAssignee =
      existing.user_id === requester.id ||
      existing.assigned_to_user_id === requester.id ||
      existing.assigned_by_user_id === requester.id;
    if (requester.role !== 'admin' && !isOwnerOrAssignee) {
      return NextResponse.json({ error: 'Akses ditolak: Anda tidak berhak mengubah tugas milik anggota lain.' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.aktivitas !== undefined) {
      const cleanAkt = String(body.aktivitas).trim();
      if (!cleanAkt || cleanAkt === '-') {
        return NextResponse.json({ error: 'Deskripsi aktivitas tugas tidak boleh kosong atau "-".' }, { status: 400 });
      }
      updates.push('aktivitas = ?');
      values.push(cleanAkt.slice(0, 500));
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
    if (body.assigned_to_user_id !== undefined) {
      const nextAssigneeId = body.assigned_to_user_id ? Number(body.assigned_to_user_id) : null;
      updates.push('assigned_to_user_id = ?');
      values.push(nextAssigneeId);
      updates.push('user_id = ?');
      values.push(nextAssigneeId);
      if (nextAssigneeId) {
        const assigneeRow = db.prepare('SELECT nama, divisi FROM users WHERE id = ?').get(nextAssigneeId) as
          | { nama: string; divisi: string }
          | undefined;
        if (assigneeRow) {
          updates.push('nama = ?');
          values.push(assigneeRow.nama);
          updates.push('divisi = ?');
          values.push(assigneeRow.divisi);
        }
      }
    }
    if (body.assigned_by_user_id !== undefined) {
      updates.push('assigned_by_user_id = ?');
      values.push(body.assigned_by_user_id ? Number(body.assigned_by_user_id) : null);
    }
    if (body.deadline !== undefined) {
      updates.push('deadline = ?');
      values.push(String(body.deadline).trim());
    }

    if (body.target !== undefined || body.realisasi !== undefined) {
      const t = body.target !== undefined ? Number(body.target) || 1 : Number(existing.target) || 1;
      const r = body.realisasi !== undefined ? Number(body.realisasi) || 0 : Number(existing.realisasi) || 0;
      const p = t > 0 ? Math.round((r / t) * 100) : 0;
      updates.push('persentase = ?');
      values.push(p);
      if (body.status === undefined) {
        const autoStatus = p >= 100 ? 'Tercapai' : p >= 70 ? 'Hampir' : 'Belum';
        updates.push('status = ?');
        values.push(autoStatus);
      }
    }

    if (updates.length > 0) {
      values.push(Number(id));
      db.prepare(`UPDATE realisasi SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`
      SELECT r.*, p.nama_proyek,
             ua.nama as assignee_nama,
             ub.nama as assigner_nama
      FROM realisasi r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN users ua ON r.assigned_to_user_id = ua.id
      LEFT JOIN users ub ON r.assigned_by_user_id = ub.id
      WHERE r.id = ?
    `).get(Number(id)) as any;

    // If task was reassigned to a different user, trigger delegation notification
    if (
      updated &&
      body.assigned_to_user_id !== undefined &&
      updated.assigned_to_user_id &&
      updated.assigned_to_user_id !== existing.assigned_to_user_id
    ) {
      try {
        const assignerId = updated.assigned_by_user_id || requesterId;
        const assignerRow = assignerId
          ? (db.prepare('SELECT nama FROM users WHERE id = ?').get(assignerId) as { nama: string } | undefined)
          : undefined;
        const assignerName = assignerRow?.nama || 'Leader';
        const actionUrl = updated.project_id ? `/?tab=projects&project_id=${updated.project_id}` : '/?tab=reports';

        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, action_url, is_read)
          VALUES (?, 'Tugas Baru Didelegasikan', ?, 'task', ?, 0)
        `).run(
          updated.assigned_to_user_id,
          `${assignerName} menugaskan Anda: "${updated.aktivitas || 'Tugas baru'}" (Target: ${updated.target} ${updated.satuan || 'Tugas'})`,
          actionUrl
        );
      } catch {}
    }

    // If marked as completed (transitioned to >= 100%) and was delegated by someone else, notify the assigner
    if (
      updated &&
      existing.persentase < 100 &&
      updated.persentase >= 100 &&
      updated.assigned_by_user_id &&
      updated.assigned_by_user_id !== (updated.assigned_to_user_id || updated.user_id)
    ) {
      try {
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, action_url, is_read)
          VALUES (?, 'Tugas Delegasi Selesai', ?, 'task', ?, 0)
        `).run(
          updated.assigned_by_user_id,
          `${updated.assignee_nama || updated.nama || 'Anggota Tim'} telah menyelesaikan tugas delegasi: "${updated.aktivitas}" (100%)`,
          updated.project_id ? `/?tab=projects&project_id=${updated.project_id}` : '/?tab=reports'
        );
      } catch {}
    }

    return NextResponse.json({ success: true, realisasi: updated });
  } catch (error: any) {
    console.error('Error PATCH /api/realisasi/[id]:', error);
    return NextResponse.json({ error: error.message || 'Gagal memperbarui realisasi' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM realisasi WHERE id = ?').get(Number(id)) as any;
    if (!existing) {
      return NextResponse.json({ error: 'Data realisasi tidak ditemukan' }, { status: 404 });
    }

    const requester = auth.user;
    const isOwnerOrAssignee =
      existing.user_id === requester.id ||
      existing.assigned_to_user_id === requester.id ||
      existing.assigned_by_user_id === requester.id;
    if (requester.role !== 'admin' && !isOwnerOrAssignee) {
      return NextResponse.json({ error: 'Akses ditolak: Anda tidak berhak menghapus tugas milik anggota lain.' }, { status: 403 });
    }

    db.prepare('DELETE FROM realisasi WHERE id = ?').run(Number(id));
    return NextResponse.json({ success: true, message: 'Laporan realisasi berhasil dihapus' });
  } catch (error: any) {
    console.error('Error DELETE /api/realisasi/[id]:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus realisasi' }, { status: 500 });
  }
}
