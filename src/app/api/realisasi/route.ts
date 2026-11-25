import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateRealisasiCreate } from '@/lib/validation';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');

  let sql = `
    SELECT r.*, p.nama_proyek,
           ua.nama as assignee_nama,
           ub.nama as assigner_nama
    FROM realisasi r
    LEFT JOIN projects p ON r.project_id = p.id
    LEFT JOIN users ua ON r.assigned_to_user_id = ua.id
    LEFT JOIN users ub ON r.assigned_by_user_id = ub.id
    WHERE 1=1
  `;
  const params: Array<number> = [];

  // When viewing a specific project, collaborators can view tasks in that project.
  // Otherwise non-admins strictly receive their own / delegated-to tasks based on verified session identity.
  if (projectId) {
    const pid = Number(projectId);
    if (!Number.isInteger(pid) || pid <= 0) {
      return NextResponse.json({ realisasi: [] });
    }
    sql += ' AND r.project_id = ?';
    params.push(pid);
  } else if (auth.user.role !== 'admin') {
    sql += ' AND (r.user_id = ? OR r.assigned_to_user_id = ?)';
    params.push(auth.user.id, auth.user.id);
  }

  sql += ' ORDER BY r.tanggal DESC, r.id DESC';

  const db = getDb();
  const realisasi = db.prepare(sql).all(...params);
  return NextResponse.json({ realisasi });
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const rawBody = await req.json();
    const parsed = validateRealisasiCreate(rawBody || {});
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const {
      project_id, assigned_to_user_id, assigned_by_user_id, deadline,
      tanggal, aktivitas, target, realisasi: r, satuan, kendala, solusi, bukti_foto_url
    } = parsed.data;

    const persentase = target > 0 ? Math.round((r / target) * 100) : 0;
    const status = persentase >= 100 ? 'Tercapai' : persentase >= 70 ? 'Hampir' : 'Belum';

    const db = getDb();

    // Non-admins cannot arbitrarily assign tasks to other people on behalf of someone else unless delegating properly as themselves
    const targetUserId = assigned_to_user_id || auth.user.id;
    const isDelegatingToOther = targetUserId !== auth.user.id;
    const assignerUserId = isDelegatingToOther ? (assigned_by_user_id || auth.user.id) : null;

    if (isDelegatingToOther && auth.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Hanya Leader / Admin yang dapat mendelegasikan tugas ke anggota lain.' },
        { status: 403 }
      );
    }

    // Resolve name & divisi cleanly from authoritative users table
    const targetUserRow = db.prepare('SELECT id, nama, divisi FROM users WHERE id = ?').get(targetUserId) as
      | { id: number; nama: string; divisi: string }
      | undefined;
    if (!targetUserRow) {
      return NextResponse.json({ error: 'Pengguna penerima tugas tidak ditemukan.' }, { status: 404 });
    }

    const effectiveNama = targetUserRow.nama;
    const effectiveDivisi = targetUserRow.divisi;

    const info = db.prepare(`
      INSERT INTO realisasi (
        project_id, user_id, assigned_to_user_id, assigned_by_user_id, deadline,
        nama, divisi, tanggal, aktivitas, target, realisasi, satuan,
        persentase, status, kendala, solusi, bukti_foto_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id,
      targetUserId,
      targetUserId,
      assignerUserId,
      deadline,
      effectiveNama,
      effectiveDivisi,
      tanggal,
      aktivitas,
      target,
      r,
      satuan,
      persentase,
      status,
      kendala,
      solusi,
      bukti_foto_url
    );

    const newId = Number(info.lastInsertRowid);

    // If task was delegated to another user, trigger instant notification
    if (targetUserId && assignerUserId && targetUserId !== assignerUserId) {
      try {
        const assignerRow = db.prepare('SELECT nama FROM users WHERE id = ?').get(assignerUserId) as { nama: string } | undefined;
        const assignerName = assignerRow?.nama || auth.user.nama;
        const actionUrl = project_id ? `/?tab=projects&project_id=${project_id}` : '/?tab=reports';

        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, action_url, is_read)
          VALUES (?, 'Tugas Baru Didelegasikan', ?, 'task', ?, 0)
        `).run(
          targetUserId,
          `${assignerName} menugaskan Anda: "${aktivitas}" (Target: ${target} ${satuan})`,
          actionUrl
        );
      } catch (notifErr) {
        console.error('Failed to trigger delegation notification:', notifErr);
      }
    }

    const createdRow = db.prepare(`
      SELECT r.*, p.nama_proyek,
             ua.nama as assignee_nama,
             ub.nama as assigner_nama
      FROM realisasi r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN users ua ON r.assigned_to_user_id = ua.id
      LEFT JOIN users ub ON r.assigned_by_user_id = ub.id
      WHERE r.id = ?
    `).get(newId);

    return NextResponse.json({ id: newId, persentase, status, realisasi: createdRow }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal menyimpan realisasi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
