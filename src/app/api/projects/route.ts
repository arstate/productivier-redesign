import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateProjectCreate } from '@/lib/validation';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;

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
    const pId = Number(p.id);

    const links = db
      .prepare('SELECT id, project_id, title, url, platform, created_at FROM project_links WHERE project_id = ? ORDER BY id ASC')
      .all(pId) as Array<Record<string, unknown>>;

    const members = db
      .prepare(`
        SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.created_at,
               u.nama, u.username, u.divisi, u.avatar_url, u.gender
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ?
        ORDER BY CASE WHEN pm.role = 'leader' THEN 0 ELSE 1 END, pm.id ASC
      `)
      .all(pId) as Array<Record<string, unknown>>;

    const member_ids = members.map((m) => Number(m.user_id));

    const chatRow = db
      .prepare('SELECT group_id FROM chat_group_projects WHERE project_id = ? LIMIT 1')
      .get(pId) as { group_id: number } | undefined;

    return {
      ...p,
      persentase: target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0,
      links,
      members,
      member_ids,
      chat_group_id: chatRow?.group_id || null,
    };
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const parsed = validateProjectCreate(body || {});
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { nama_proyek, divisi, target_total, satuan, status, deadline, member_ids } = parsed.data;
    const effectivePicId = parsed.data.pic_id || auth.user.id;
    const shareToken = crypto.randomBytes(12).toString('hex');

    const db = getDb();

    const picExists = db.prepare('SELECT id FROM users WHERE id = ?').get(effectivePicId);
    if (!picExists) {
      return NextResponse.json({ error: 'PIC proyek tidak ditemukan.' }, { status: 404 });
    }

    const info = db.prepare(
      'INSERT INTO projects (nama_proyek, pic_id, divisi, target_total, satuan, status, deadline, share_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      nama_proyek,
      effectivePicId,
      divisi,
      target_total,
      satuan,
      status,
      deadline,
      shareToken
    );

    const newProjectId = Number(info.lastInsertRowid);

    // 1. Insert PIC as leader in project_members
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
      newProjectId,
      effectivePicId,
      'leader'
    );

    // 2. Insert additional members
    const allMemberIds = new Set<number>([effectivePicId]);
    if (Array.isArray(member_ids)) {
      for (const mId of member_ids) {
        const numId = Number(mId);
        if (numId) {
          allMemberIds.add(numId);
          if (numId !== effectivePicId) {
            db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
              newProjectId,
              numId,
              'member'
            );
          }
        }
      }
    }

    // 3. Auto-provision chat group for this project
    let chatGroupId: number | null = null;
    try {
      const groupName = `${nama_proyek} 🚀`;
      const groupDesc = `Ruang koordinasi resmi tim untuk proyek ${nama_proyek}`;
      const groupIns = db.prepare(`
        INSERT INTO chat_groups (name, description, project_id, created_by, ai_name, ai_model, ai_thinking_mode)
        VALUES (?, ?, ?, ?, 'Miu', 'nvidia/nemotron-3.5-super-vl:free', 'medium')
      `).run(groupName, groupDesc, newProjectId, effectivePicId);

      chatGroupId = Number(groupIns.lastInsertRowid);

      // Connect in chat_group_projects
      db.prepare('INSERT OR IGNORE INTO chat_group_projects (group_id, project_id) VALUES (?, ?)').run(
        chatGroupId,
        newProjectId
      );

      // Add all members to chat_group_members
      for (const memberId of allMemberIds) {
        const role = memberId === effectivePicId ? 'admin' : 'member';
        db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
          chatGroupId,
          memberId,
          role
        );
      }

      // Initial welcome message from Miu AI
      db.prepare(`
        INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
        VALUES (?, NULL, 'Miu', ?, 1)
      `).run(
        chatGroupId,
        `Halo tim! 👋 Grup koordinasi untuk proyek **${nama_proyek}** telah resmi dibuat. Saya **Miu AI**, asisten kolaborator proyek Anda. Silakan koordinasikan target, diskusikan kendala, atau panggil saya (@Miu) jika butuh bantuan perencanaan tugas!`
      );
    } catch (chatErr) {
      console.error('Auto-provision chat group error:', chatErr);
    }

    // Fetch members for response
    const members = db.prepare(`
      SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.created_at,
             u.nama, u.username, u.divisi, u.avatar_url, u.gender
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY CASE WHEN pm.role = 'leader' THEN 0 ELSE 1 END, pm.id ASC
    `).all(newProjectId) as Array<Record<string, unknown>>;

    const createdProject = {
      id: newProjectId,
      nama_proyek,
      pic_id: effectivePicId,
      divisi,
      target_total,
      satuan,
      status,
      deadline,
      members,
      member_ids: Array.from(allMemberIds),
      chat_group_id: chatGroupId,
    };

    return NextResponse.json({
      id: newProjectId,
      chat_group_id: chatGroupId,
      project: createdProject,
    }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat proyek';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
