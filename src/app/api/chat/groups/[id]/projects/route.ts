import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const groupId = Number(id);

    if (!groupId) {
      return NextResponse.json({ error: 'ID grup wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const group = db.prepare('SELECT id, name FROM chat_groups WHERE id = ?').get(groupId);
    if (!group) {
      return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    }

    const rows = db.prepare(`
      SELECT 
        p.id,
        p.nama_proyek,
        p.pic_id,
        u.nama as pic_nama,
        p.divisi,
        p.target_total,
        COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi,
        p.satuan,
        p.status,
        p.deadline,
        cgp.created_at as connected_at,
        (SELECT COUNT(*) FROM realisasi r WHERE r.project_id = p.id AND r.kendala IS NOT NULL AND TRIM(r.kendala) != '') as kendala_count
      FROM chat_group_projects cgp
      JOIN projects p ON cgp.project_id = p.id
      LEFT JOIN users u ON p.pic_id = u.id
      WHERE cgp.group_id = ?
      ORDER BY p.id ASC
    `).all(groupId) as any[];

    const connectedProjects = rows.map((p) => {
      const target = Number(p.target_total) || 0;
      const total = Number(p.total_realisasi) || 0;
      return {
        ...p,
        persentase: target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0,
      };
    });

    return NextResponse.json({ projects: connectedProjects });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memuat proyek terhubung';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const groupId = Number(id);
    const body = await req.json();
    const { project_id } = body;

    if (!groupId || !project_id) {
      return NextResponse.json({ error: 'group_id dan project_id wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const group = db.prepare('SELECT id, name FROM chat_groups WHERE id = ?').get(groupId);
    if (!group) {
      return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    }

    const project = db.prepare('SELECT id, nama_proyek, divisi FROM projects WHERE id = ?').get(Number(project_id)) as any;
    if (!project) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    // Insert connection
    db.prepare(`
      INSERT OR IGNORE INTO chat_group_projects (group_id, project_id)
      VALUES (?, ?)
    `).run(groupId, Number(project_id));

    return NextResponse.json({
      success: true,
      message: `Proyek "${project.nama_proyek}" berhasil dikoneksikan ke grup.`,
      project,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menambahkan koneksi proyek';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const groupId = Number(id);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!groupId || !projectId) {
      return NextResponse.json({ error: 'group_id dan project_id wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    db.prepare(`
      DELETE FROM chat_group_projects 
      WHERE group_id = ? AND project_id = ?
    `).run(groupId, Number(projectId));

    return NextResponse.json({
      success: true,
      message: 'Koneksi proyek berhasil diputus dari grup.',
      removed_project_id: Number(projectId),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memutuskan koneksi proyek';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
