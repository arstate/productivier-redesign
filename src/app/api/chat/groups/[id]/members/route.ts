import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = Number(id);

    const db = getDb();
    const members = db.prepare(`
      SELECT 
        m.id,
        m.group_id,
        m.user_id,
        m.role,
        m.joined_at,
        u.nama,
        u.username,
        u.divisi,
        u.role as user_role,
        u.avatar_url,
        u.gender
      FROM chat_group_members m
      JOIN users u ON m.user_id = u.id
      WHERE m.group_id = ?
      ORDER BY CASE WHEN m.role = 'admin' THEN 0 ELSE 1 END, u.nama ASC
    `).all(groupId);

    return NextResponse.json({ members });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memuat anggota grup';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = Number(id);
    const body = await req.json();
    const { user_id, added_by_user_id, role = 'member' } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'User ID anggota wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
    if (!group) {
      return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    }

    // Check if requester is group admin or creator or system admin
    if (added_by_user_id) {
      const requester = db.prepare('SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?').get(groupId, Number(added_by_user_id)) as { role: string } | undefined;
      const sysUser = db.prepare('SELECT role FROM users WHERE id = ?').get(Number(added_by_user_id)) as { role: string } | undefined;
      const isAllowed = requester?.role === 'admin' || group.created_by === Number(added_by_user_id) || sysUser?.role === 'admin';
      if (!isAllowed) {
        return NextResponse.json({ error: 'Hanya Admin Grup yang dapat menambahkan anggota baru.' }, { status: 403 });
      }
    }

    // Check if already in group
    const alreadyMember = db.prepare('SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ?').get(groupId, Number(user_id));
    if (alreadyMember) {
      return NextResponse.json({ error: 'User ini sudah menjadi anggota grup.' }, { status: 409 });
    }

    const res = db.prepare(`
      INSERT INTO chat_group_members (group_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(groupId, Number(user_id), role === 'admin' ? 'admin' : 'member');

    const targetUser = db.prepare('SELECT nama FROM users WHERE id = ?').get(Number(user_id)) as { nama: string } | undefined;

    // Send system message
    db.prepare(`
      INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
      VALUES (?, NULL, 'Miu', ?, 1)
    `).run(groupId, `${targetUser?.nama || 'Anggota baru'} telah bergabung ke grup.`);

    return NextResponse.json({ success: true, id: Number(res.lastInsertRowid) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menambahkan anggota';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = Number(id);
    const body = await req.json();
    const { target_user_id, role, updated_by_user_id } = body;

    if (!target_user_id || !role) {
      return NextResponse.json({ error: 'Target user dan role baru wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
    if (!group) {
      return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    }

    // Check permission
    if (updated_by_user_id) {
      const requester = db.prepare('SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?').get(groupId, Number(updated_by_user_id)) as { role: string } | undefined;
      const sysUser = db.prepare('SELECT role FROM users WHERE id = ?').get(Number(updated_by_user_id)) as { role: string } | undefined;
      const isAllowed = requester?.role === 'admin' || group.created_by === Number(updated_by_user_id) || sysUser?.role === 'admin';
      if (!isAllowed) {
        return NextResponse.json({ error: 'Hanya Admin Grup yang dapat mengubah role anggota.' }, { status: 403 });
      }
    }

    // Cannot demote group creator
    if (role === 'member' && group.created_by === Number(target_user_id)) {
      return NextResponse.json({ error: 'Pembuat grup tidak dapat diturunkan dari Admin Grup.' }, { status: 400 });
    }

    db.prepare(`
      UPDATE chat_group_members
      SET role = ?
      WHERE group_id = ? AND user_id = ?
    `).run(role === 'admin' ? 'admin' : 'member', groupId, Number(target_user_id));

    const targetUser = db.prepare('SELECT nama FROM users WHERE id = ?').get(Number(target_user_id)) as { nama: string } | undefined;
    const roleLabel = role === 'admin' ? 'Admin Grup 👑' : 'Anggota';

    db.prepare(`
      INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
      VALUES (?, NULL, 'Miu', ?, 1)
    `).run(groupId, `Peran ${targetUser?.nama || 'Pengguna'} telah diperbarui menjadi ${roleLabel}.`);

    return NextResponse.json({ success: true, role });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memperbarui role anggota';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = Number(id);
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('target_user_id');
    const requesterUserId = searchParams.get('requester_user_id');

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID wajib disertakan' }, { status: 400 });
    }

    const db = getDb();
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
    if (!group) {
      return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    }

    const isSelfLeaving = Number(targetUserId) === Number(requesterUserId);

    if (!isSelfLeaving && requesterUserId) {
      const requester = db.prepare('SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?').get(groupId, Number(requesterUserId)) as { role: string } | undefined;
      const sysUser = db.prepare('SELECT role FROM users WHERE id = ?').get(Number(requesterUserId)) as { role: string } | undefined;
      const isAllowed = requester?.role === 'admin' || group.created_by === Number(requesterUserId) || sysUser?.role === 'admin';
      if (!isAllowed) {
        return NextResponse.json({ error: 'Hanya Admin Grup yang dapat mengeluarkan anggota.' }, { status: 403 });
      }

      // Cannot kick creator
      if (group.created_by === Number(targetUserId)) {
        return NextResponse.json({ error: 'Pembuat grup tidak dapat dikeluarkan.' }, { status: 400 });
      }
    }

    // Check if last admin leaving when others exist
    if (isSelfLeaving) {
      const adminCount = (db.prepare("SELECT COUNT(*) as count FROM chat_group_members WHERE group_id = ? AND role = 'admin'").get(groupId) as { count: number }).count;
      const memberCount = (db.prepare("SELECT COUNT(*) as count FROM chat_group_members WHERE group_id = ?").get(groupId) as { count: number }).count;
      const myRole = (db.prepare("SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?").get(groupId, Number(targetUserId)) as { role: string } | undefined)?.role;

      if (myRole === 'admin' && adminCount === 1 && memberCount > 1) {
        return NextResponse.json({
          error: 'Anda adalah satu-satunya Admin Grup. Tunjuk admin baru terlebih dahulu sebelum keluar.',
        }, { status: 400 });
      }
    }

    const targetUser = db.prepare('SELECT nama FROM users WHERE id = ?').get(Number(targetUserId)) as { nama: string } | undefined;

    db.prepare('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?').run(groupId, Number(targetUserId));

    const notice = isSelfLeaving
      ? `${targetUser?.nama || 'Anggota'} telah meninggalkan grup.`
      : `${targetUser?.nama || 'Anggota'} telah dikeluarkan dari grup.`;

    db.prepare(`
      INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
      VALUES (?, NULL, 'Miu', ?, 1)
    `).run(groupId, notice);

    return NextResponse.json({ success: true, removed_user_id: Number(targetUserId) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menghapus anggota dari grup';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
