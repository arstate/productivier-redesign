import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    const db = getDb();
    let query = `
      SELECT 
        g.id, 
        g.name, 
        g.description, 
        g.project_id, 
        COALESCE(g.ai_name, 'Miu') as ai_name,
        COALESCE(g.ai_model, 'nvidia/nemotron-3.5-super-vl:free') as ai_model,
        COALESCE(g.ai_thinking_mode, 'medium') as ai_thinking_mode,
        p.nama_proyek as project_nama,
        g.created_by,
        u.nama as creator_nama,
        g.created_at,
        (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = g.id) as members_count,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.group_id = g.id) as message_count,
        (SELECT m.message FROM chat_messages m WHERE m.group_id = g.id ORDER BY m.id DESC LIMIT 1) as last_message,
        (SELECT m.created_at FROM chat_messages m WHERE m.group_id = g.id ORDER BY m.id DESC LIMIT 1) as last_message_time
      FROM chat_groups g
      LEFT JOIN projects p ON g.project_id = p.id
      LEFT JOIN users u ON g.created_by = u.id
    `;

    const params: unknown[] = [];
    if (projectId && projectId !== 'all') {
      query += ` WHERE g.project_id = ? `;
      params.push(Number(projectId));
    }

    query += ` ORDER BY g.id ASC`;

    const groups = db.prepare(query).all(...params);

    const allGroupProjects = db.prepare(`
      SELECT 
        cgp.group_id,
        p.id,
        p.nama_proyek,
        p.divisi,
        p.target_total,
        COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi,
        p.satuan,
        p.status,
        p.deadline,
        (SELECT COUNT(*) FROM realisasi r WHERE r.project_id = p.id AND r.kendala IS NOT NULL AND TRIM(r.kendala) != '') as kendala_count
      FROM chat_group_projects cgp
      JOIN projects p ON cgp.project_id = p.id
      ORDER BY p.id ASC
    `).all() as any[];

    const projectsByGroup = new Map<number, any[]>();
    for (const gp of allGroupProjects) {
      if (!projectsByGroup.has(gp.group_id)) {
        projectsByGroup.set(gp.group_id, []);
      }
      const target = Number(gp.target_total) || 0;
      const total = Number(gp.total_realisasi) || 0;
      const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
      projectsByGroup.get(gp.group_id)!.push({
        id: gp.id,
        nama_proyek: gp.nama_proyek,
        divisi: gp.divisi,
        persentase: pct,
        target_total: gp.target_total,
        total_realisasi: total,
        satuan: gp.satuan,
        status: gp.status,
        deadline: gp.deadline,
        kendala_count: gp.kendala_count,
      });
    }

    const enrichedGroups = (groups as any[]).map((g) => ({
      ...g,
      connected_projects: projectsByGroup.get(g.id) || (g.project_id && g.project_nama ? [{
        id: g.project_id,
        nama_proyek: g.project_nama,
        divisi: '',
        persentase: 0
      }] : []),
    }));

    return NextResponse.json({ groups: enrichedGroups });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memuat grup chat';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, project_id, user_id, user_role, ai_name, ai_model, ai_thinking_mode } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama grup chat wajib diisi' }, { status: 400 });
    }

    // Role check: Only leaders (admin) can create groups
    if (user_role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Leader (Admin) yang memiliki wewenang untuk membuat grup chat baru.' }, { status: 403 });
    }

    const defaultAiName = ai_name && ai_name.trim() ? ai_name.trim() : 'Miu';
    const defaultAiModel = ai_model || 'nvidia/nemotron-3.5-super-vl:free';
    const defaultAiThinking = ai_thinking_mode || 'medium';

    const db = getDb();
    const res = db.prepare(`
      INSERT INTO chat_groups (name, description, project_id, created_by, ai_name, ai_model, ai_thinking_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      description ? description.trim() : '',
      project_id ? Number(project_id) : null,
      user_id ? Number(user_id) : 1,
      defaultAiName,
      defaultAiModel,
      defaultAiThinking
    );

    const newGroupId = Number(res.lastInsertRowid);

    // Link project in chat_group_projects if provided
    if (project_id) {
      db.prepare(`
        INSERT OR IGNORE INTO chat_group_projects (group_id, project_id)
        VALUES (?, ?)
      `).run(newGroupId, Number(project_id));
    }

    // Add creator as group admin in members table
    db.prepare(`
      INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role)
      VALUES (?, ?, 'admin')
    `).run(newGroupId, user_id ? Number(user_id) : 1);

    // Initial welcome message from AI
    db.prepare(`
      INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      newGroupId,
      null,
      defaultAiName,
      `Grup obrolan "${name.trim()}" berhasil dibuat oleh Leader. Selamat berkolaborasi! Ketik @${defaultAiName.toLowerCase().replace(/\s+/g, '')} atau @ai untuk meminta bantuan rangkuman atau rekomendasi.`,
      1
    );

    return NextResponse.json({ success: true, id: newGroupId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal membuat grup chat';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, name, description, project_id, user_id, user_role, ai_name, ai_model, ai_thinking_mode } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID grup wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(Number(id)) as any;
    if (!group) {
      return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    }

    const isGroupCreator = group.created_by === Number(user_id);
    const memberRow = db.prepare('SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?').get(Number(id), Number(user_id)) as { role: string } | undefined;
    const isGroupAdmin = memberRow?.role === 'admin' || isGroupCreator || user_role === 'admin';

    // STRICT PERMISSION CHECK: Only group creator can edit AI settings
    const isUpdatingAISettings = ai_name !== undefined || ai_model !== undefined || ai_thinking_mode !== undefined;
    if (isUpdatingAISettings && !isGroupCreator) {
      return NextResponse.json({ error: 'Hanya Pembuat Grup yang memiliki wewenang untuk mengubah pengaturan Asisten AI.' }, { status: 403 });
    }

    if (!isGroupAdmin) {
      return NextResponse.json({ error: 'Hanya Admin Grup atau Leader yang dapat mengedit profil grup.' }, { status: 403 });
    }

    db.prepare(`
      UPDATE chat_groups 
      SET name = ?, description = ?, project_id = ?, ai_name = ?, ai_model = ?, ai_thinking_mode = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : group.name,
      description !== undefined ? description.trim() : group.description,
      project_id !== undefined ? (project_id ? Number(project_id) : null) : group.project_id,
      ai_name !== undefined ? (ai_name.trim() || 'Miu') : (group.ai_name || 'Miu'),
      ai_model !== undefined ? ai_model : (group.ai_model || 'nvidia/nemotron-3.5-super-vl:free'),
      ai_thinking_mode !== undefined ? ai_thinking_mode : (group.ai_thinking_mode || 'medium'),
      Number(id)
    );

    if (project_id) {
      db.prepare(`
        INSERT OR IGNORE INTO chat_group_projects (group_id, project_id)
        VALUES (?, ?)
      `).run(Number(id), Number(project_id));
    }

    const updated = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(Number(id));
    return NextResponse.json({ success: true, group: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memperbarui grup chat';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');
    const userRole = searchParams.get('user_role');

    if (!id) {
      return NextResponse.json({ error: 'ID grup wajib disertakan' }, { status: 400 });
    }

    const db = getDb();
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(Number(id)) as any;
    if (!group) {
      return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    }

    // Only group creator or system admin can delete the whole group
    const isAuthorized = group.created_by === Number(userId) || userRole === 'admin';
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Hanya Pembuat Grup atau Leader yang berhak menghapus grup ini.' }, { status: 403 });
    }

    // Delete messages, members, and connected projects
    db.prepare('DELETE FROM chat_messages WHERE group_id = ?').run(Number(id));
    db.prepare('DELETE FROM chat_group_members WHERE group_id = ?').run(Number(id));
    db.prepare('DELETE FROM chat_group_projects WHERE group_id = ?').run(Number(id));
    db.prepare('DELETE FROM chat_groups WHERE id = ?').run(Number(id));

    return NextResponse.json({ success: true, deleted_id: Number(id) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menghapus grup chat';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
