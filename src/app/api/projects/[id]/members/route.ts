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
    const projectId = Number(id);
    const db = getDb();

    const rawMembers = db.prepare(`
      SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.created_at,
             u.nama, u.username, u.divisi, u.avatar_url, u.gender,
             CASE WHEN p.pic_id = pm.user_id THEN 1 ELSE 0 END as is_creator
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.project_id = ?
      ORDER BY CASE WHEN pm.role = 'leader' THEN 0 ELSE 1 END, pm.id ASC
    `).all(projectId) as any[];

    const members = rawMembers.map((m) => ({
      ...m,
      is_creator: Boolean(m.is_creator),
    }));

    return NextResponse.json({ members });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat anggota proyek' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const projectId = Number(id);
    const body = await request.json();
    const userId = Number(body.user_id);
    const role = (body.role || 'member') === 'leader' ? 'leader' : 'member';

    if (!userId) {
      return NextResponse.json({ error: 'User ID wajib disertakan' }, { status: 400 });
    }

    const db = getDb();

    // Verify project & target user exist
    const project = db.prepare('SELECT id, nama_proyek, pic_id FROM projects WHERE id = ?').get(projectId) as
      | { id: number; nama_proyek: string; pic_id: number | null }
      | undefined;

    if (!project) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    if (auth.user.role !== 'admin' && project.pic_id !== auth.user.id) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin atau PIC proyek yang dapat menambah anggota.' }, { status: 403 });
    }

    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!userExists) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // Insert or update member in project
    db.prepare(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
    `).run(projectId, userId, role);

    // Auto-join user to all chat groups linked to this project
    const linkedGroups = db.prepare(`
      SELECT group_id FROM chat_group_projects WHERE project_id = ?
    `).all(projectId) as Array<{ group_id: number }>;

    for (const g of linkedGroups) {
      db.prepare(`
        INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role)
        VALUES (?, ?, 'member')
      `).run(g.group_id, userId);
    }

    // Create notification for the user
    try {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, action_url)
        VALUES (?, 'Ditambahkan ke Proyek Baru', ?, 'task', ?)
      `).run(
        userId,
        `Anda telah ditambahkan sebagai kolaborator di proyek: "${project.nama_proyek}"`,
        `/?tab=projects&project_id=${projectId}`
      );
    } catch {}

    const updatedRawMembers = db.prepare(`
      SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.created_at,
             u.nama, u.username, u.divisi, u.avatar_url, u.gender,
             CASE WHEN p.pic_id = pm.user_id THEN 1 ELSE 0 END as is_creator
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.project_id = ?
      ORDER BY CASE WHEN pm.role = 'leader' THEN 0 ELSE 1 END, pm.id ASC
    `).all(projectId) as any[];

    const updatedMembers = updatedRawMembers.map((m) => ({
      ...m,
      is_creator: Boolean(m.is_creator),
    }));

    return NextResponse.json({ success: true, members: updatedMembers }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menambahkan anggota' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const projectId = Number(id);
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('user_id');
    const userId = Number(userIdParam);

    if (!userId) {
      return NextResponse.json({ error: 'User ID wajib disertakan' }, { status: 400 });
    }

    const db = getDb();
    const project = db.prepare('SELECT pic_id FROM projects WHERE id = ?').get(projectId) as { pic_id: number | null } | undefined;
    if (auth.user.role !== 'admin' && project?.pic_id !== auth.user.id) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin atau PIC proyek yang dapat mengeluarkan anggota.' }, { status: 403 });
    }
    if (project && project.pic_id === userId) {
      return NextResponse.json(
        { error: 'PIC utama / pembuat proyek tidak dapat dikeluarkan dari tim.' },
        { status: 403 }
      );
    }

    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);

    // Also remove from linked chat groups (if not admin and not a member of another project linked to that group)
    try {
      const linkedGroups = db.prepare(`
        SELECT group_id FROM chat_group_projects WHERE project_id = ?
      `).all(projectId) as Array<{ group_id: number }>;

      for (const g of linkedGroups) {
        const stillInOtherProject = db.prepare(`
          SELECT 1 FROM chat_group_projects cgp
          JOIN project_members pm ON cgp.project_id = pm.project_id
          WHERE cgp.group_id = ? AND pm.user_id = ?
          LIMIT 1
        `).get(g.group_id, userId);
        if (!stillInOtherProject) {
          db.prepare(`
            DELETE FROM chat_group_members
            WHERE group_id = ? AND user_id = ? AND role != 'admin'
          `).run(g.group_id, userId);
        }
      }
    } catch {}

    return NextResponse.json({ success: true, message: 'Anggota berhasil dikeluarkan dari proyek' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus anggota' }, { status: 500 });
  }
}
