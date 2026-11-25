import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*, u.nama as pic_nama,
        COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi,
        COALESCE((SELECT COUNT(r.id) FROM realisasi r WHERE r.project_id = p.id), 0) as jumlah_laporan
      FROM projects p
      LEFT JOIN users u ON p.pic_id = u.id
      WHERE p.id = ?
    `).get(Number(id));

    if (!project) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat proyek' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(id)) as { pic_id: number | null } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    if (auth.user.role !== 'admin' && existing.pic_id !== auth.user.id) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Leader / PIC proyek yang dapat mengubah pengaturan proyek.' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.nama_proyek !== undefined) {
      updates.push('nama_proyek = ?');
      values.push(String(body.nama_proyek).trim());
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(String(body.status).trim());
    }
    if (body.target_total !== undefined) {
      updates.push('target_total = ?');
      values.push(Number(body.target_total));
    }
    if (body.satuan !== undefined) {
      updates.push('satuan = ?');
      values.push(String(body.satuan).trim());
    }
    if (body.divisi !== undefined) {
      updates.push('divisi = ?');
      values.push(String(body.divisi).trim());
    }
    if (body.pic_id !== undefined) {
      const nextPicId = Number(body.pic_id);
      const picUser = db.prepare('SELECT id FROM users WHERE id = ?').get(nextPicId);
      if (!picUser) {
        return NextResponse.json({ error: 'User PIC tidak ditemukan' }, { status: 404 });
      }
      updates.push('pic_id = ?');
      values.push(nextPicId);
    }
    if (body.deadline !== undefined) {
      updates.push('deadline = ?');
      values.push(String(body.deadline).trim());
    }

    if (updates.length > 0) {
      values.push(Number(id));
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    if (body.pic_id !== undefined) {
      const nextPicId = Number(body.pic_id);
      db.prepare(`
        UPDATE project_members SET role = 'member' WHERE project_id = ? AND role = 'leader' AND user_id != ?
      `).run(Number(id), nextPicId);
      db.prepare(`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (?, ?, 'leader')
        ON CONFLICT(project_id, user_id) DO UPDATE SET role = 'leader'
      `).run(Number(id), nextPicId);

      const linkedGroups = db.prepare('SELECT group_id FROM chat_group_projects WHERE project_id = ?').all(Number(id)) as Array<{ group_id: number }>;
      for (const g of linkedGroups) {
        db.prepare(`
          INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role)
          VALUES (?, ?, 'admin')
        `).run(g.group_id, nextPicId);
      }
    }

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(id));
    return NextResponse.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('Error PATCH /api/projects/[id]:', error);
    return NextResponse.json({ error: error.message || 'Gagal memperbarui proyek' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const projectId = Number(id);
    const db = getDb();

    const existing = db.prepare('SELECT pic_id FROM projects WHERE id = ?').get(projectId) as { pic_id: number | null } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });
    }
    if (auth.user.role !== 'admin' && existing.pic_id !== auth.user.id) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Leader / Admin atau PIC proyek yang dapat menghapus proyek.' }, { status: 403 });
    }

    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM chat_group_projects WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM project_links WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM project_client_notes WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    return NextResponse.json({ success: true, message: 'Proyek berhasil dihapus' });
  } catch (error: any) {
    console.error('Error DELETE /api/projects/[id]:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus proyek' }, { status: 500 });
  }
}
