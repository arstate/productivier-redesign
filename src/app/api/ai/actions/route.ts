import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('user_id');
    const userId = auth.user.role === 'admin' && requestedUserId ? Number(requestedUserId) : auth.user.id;
    const status = searchParams.get('status');

    const db = getDb();
    let query = 'SELECT * FROM ai_action_requests WHERE 1=1';
    const params: (string | number)[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY id DESC LIMIT 50';

    const requests = db.prepare(query).all(...params);
    return NextResponse.json({ requests });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memuat permintaan aksi AI';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { action_request_id, status, action_type, payload } = body;

    const db = getDb();

    // 1. If direct approval or rejection of an existing action_request_id
    if (action_request_id) {
      const res = executeActionRequest(db, Number(action_request_id), status || 'approved', auth.user.id);
      if (res.error) {
        return NextResponse.json({ error: res.error }, { status: res.statusCode || 400 });
      }
      return NextResponse.json(res);
    }

    // 2. If creating a new action request directly
    if (action_type && payload) {
      const targetUserId =
        auth.user.role === 'admin' && body.user_id ? Number(body.user_id) : auth.user.id;
      const ins = db.prepare(`
        INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(
        targetUserId,
        action_type,
        body.description || `Permintaan aksi AI: ${action_type}`,
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      );

      const newId = Number(ins.lastInsertRowid);

      // Create notification for this permission request
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
        VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
      `).run(
        targetUserId,
        'Izin Aksi Diperlukan dari Asisten AI',
        body.description || `AI ingin melakukan perubahan data: ${action_type}. Mohon tinjau dan konfirmasi.`,
        '/api/ai/actions',
        JSON.stringify({ action_request_id: newId, action_type })
      );

      return NextResponse.json({
        success: true,
        action_request_id: newId,
        status: 'pending',
      });
    }

    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memproses aksi AI';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export function executeActionRequest(
  db: any,
  actionRequestId: number,
  status: string = 'approved',
  userIdParam?: number
): { success?: boolean; status?: string; statusCode?: number; message?: string; result_id?: number | null; error?: string } {
  const existingReq = db.prepare('SELECT * FROM ai_action_requests WHERE id = ?').get(Number(actionRequestId)) as {
id: number;
        user_id: number;
        action_type: string;
        description: string;
        payload_json: string;
        status: string;
      } | undefined;

      if (!existingReq) {
        return { error: 'Permintaan aksi AI tidak ditemukan', statusCode: 404 };
      }

      if (status === 'rejected') {
        db.prepare("UPDATE ai_action_requests SET status = 'rejected' WHERE id = ?").run(existingReq.id);

        // Mark associated notification as read
        db.prepare("UPDATE notifications SET is_read = 1 WHERE payload_json LIKE ?").run(`%"action_request_id":${existingReq.id}%`);

        return {
      success: true,
      status: 'rejected',
      message: 'Permintaan aksi AI telah dibatalkan.',
    };
      }

      if (status === 'approved') {
        let actionPayload: any = {};
        try {
          actionPayload = JSON.parse(existingReq.payload_json);
        } catch {
          actionPayload = {};
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const executingUserId = userIdParam ? Number(userIdParam) : existingReq.user_id;

        const userRow = db.prepare('SELECT nama, divisi FROM users WHERE id = ?').get(executingUserId) as {
          nama: string;
          divisi: string;
        } | undefined;

        const namaUser = userRow ? userRow.nama : 'Fifa (Leader)';
        const divisiUser = userRow ? userRow.divisi : 'Operasional';

        let resultId: number | null = null;
        let executionSummary = '';

        // Execute mutation based on action_type
        if (existingReq.action_type === 'create_task') {
          const target = Number(actionPayload.target) || 1;
          const realisasi = actionPayload.realisasi !== undefined ? Number(actionPayload.realisasi) : target;
          const pct = target > 0 ? Math.round((realisasi / target) * 100) : 100;
          const taskStatus = pct >= 100 ? 'Tercapai' : pct >= 70 ? 'Hampir' : 'Belum';

          let validProjId = actionPayload.project_id ? Number(actionPayload.project_id) : null;
          if (!validProjId) {
            const firstP = db.prepare('SELECT id FROM projects LIMIT 1').get() as { id: number } | undefined;
            validProjId = firstP ? firstP.id : null;
          }

          const ins = db.prepare(`
            INSERT INTO realisasi (project_id, user_id, nama, divisi, tanggal, aktivitas, target, realisasi, satuan, persentase, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            validProjId,
            executingUserId,
            namaUser,
            divisiUser,
            actionPayload.tanggal || todayStr,
            actionPayload.aktivitas || 'Tugas Baru dari AI',
            target,
            realisasi,
            actionPayload.satuan || 'Tugas',
            pct,
            taskStatus
          );

          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Tugas "${actionPayload.aktivitas}" berhasil dimasukkan ke sistem.`;
        } else if (existingReq.action_type === 'create_note') {
          const tagsJson = JSON.stringify(actionPayload.tags || ['ai', 'catatan']);
          const checklistJson = JSON.stringify(actionPayload.checklist || []);

          const ins = db.prepare(`
            INSERT INTO notes (user_id, title, content, tags, pinned, color, project_id, checklist)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            executingUserId,
            actionPayload.title || 'Catatan Baru dari AI',
            actionPayload.content || '',
            tagsJson,
            0,
            actionPayload.color || '#D2F27C',
            actionPayload.project_id ? Number(actionPayload.project_id) : null,
            checklistJson
          );

          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Catatan "${actionPayload.title}" berhasil disimpan di Notes.`;
        } else if (existingReq.action_type === 'update_note') {
          let nId = actionPayload.note_id || actionPayload.id ? Number(actionPayload.note_id || actionPayload.id) : null;
          if (!nId && (actionPayload.title || actionPayload.target_name)) {
            const titleSearch = (actionPayload.title || actionPayload.target_name).toLowerCase();
            const nRow = db.prepare('SELECT id, title FROM notes WHERE LOWER(title) LIKE ?').get(`%${titleSearch}%`) as any;
            if (nRow) nId = nRow.id;
          }
          if (nId) {
            db.prepare(`
              UPDATE notes
              SET title = COALESCE(?, title),
                  content = COALESCE(?, content),
                  tags = COALESCE(?, tags),
                  checklist = COALESCE(?, checklist),
                  pinned = COALESCE(?, pinned),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(
              actionPayload.title || null,
              actionPayload.content || null,
              actionPayload.tags ? (typeof actionPayload.tags === 'string' ? actionPayload.tags : JSON.stringify(actionPayload.tags)) : null,
              actionPayload.checklist ? (typeof actionPayload.checklist === 'string' ? actionPayload.checklist : JSON.stringify(actionPayload.checklist)) : null,
              actionPayload.pinned !== undefined && actionPayload.pinned !== null ? Number(actionPayload.pinned) : null,
              nId
            );
            resultId = nId;
            const updatedRow = db.prepare('SELECT title FROM notes WHERE id = ?').get(nId) as any;
            executionSummary = `Catatan "${updatedRow ? updatedRow.title : 'ID ' + nId}" berhasil diperbarui.`;
          }
        } else if (existingReq.action_type === 'create_event') {
          const ins = db.prepare(`
            INSERT INTO calendar_events (user_id, title, description, date, start_time, end_time, category, color, project_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            executingUserId,
            actionPayload.title || 'Agenda Baru dari AI',
            actionPayload.description || '',
            actionPayload.date || todayStr,
            actionPayload.start_time || '09:00',
            actionPayload.end_time || '10:00',
            actionPayload.category || 'meeting',
            actionPayload.color || '#D2F27C',
            actionPayload.project_id ? Number(actionPayload.project_id) : null
          );

          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Agenda "${actionPayload.title}" berhasil dijadwalkan di Kalender.`;
        } else if (existingReq.action_type === 'create_project') {
          const targetTotal = Number(actionPayload.target_total) || 100;
          const pic = actionPayload.pic_id ? Number(actionPayload.pic_id) : executingUserId;
          const ins = db.prepare(`
            INSERT INTO projects (nama_proyek, pic_id, divisi, target_total, satuan, status, deadline)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            actionPayload.nama_proyek || 'Proyek Baru dari AI',
            pic,
            actionPayload.divisi || divisiUser || 'Operasional',
            targetTotal,
            actionPayload.satuan || 'Tugas',
            actionPayload.status || 'aktif',
            actionPayload.deadline || ''
          );

          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Proyek "${actionPayload.nama_proyek}" berhasil dibuat.`;

          // Auto-insert leader in project_members
          try {
            db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
              resultId,
              pic,
              'leader'
            );

            // Auto-provision chat group
            const groupName = `${actionPayload.nama_proyek || 'Proyek Baru'} 🚀`;
            const groupDesc = `Ruang koordinasi resmi tim untuk proyek ${actionPayload.nama_proyek || ''}`;
            const groupIns = db.prepare(`
              INSERT INTO chat_groups (name, description, project_id, created_by, ai_name, ai_model, ai_thinking_mode)
              VALUES (?, ?, ?, ?, 'Miu', 'nvidia/nemotron-3.5-super-vl:free', 'medium')
            `).run(groupName, groupDesc, resultId, pic);

            const newGroupId = Number(groupIns.lastInsertRowid);
            db.prepare('INSERT OR IGNORE INTO chat_group_projects (group_id, project_id) VALUES (?, ?)').run(newGroupId, resultId);
            db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(newGroupId, pic, 'admin');

            if (Array.isArray(actionPayload.member_ids)) {
              for (const mid of actionPayload.member_ids) {
                const numMid = Number(mid);
                if (numMid && numMid !== pic) {
                  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(resultId, numMid, 'member');
                  db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(newGroupId, numMid, 'member');
                }
              }
            }

            db.prepare(`
              INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
              VALUES (?, NULL, 'Miu', ?, 1)
            `).run(
              newGroupId,
              `Halo tim! 👋 Grup koordinasi untuk proyek **${actionPayload.nama_proyek || 'Proyek Baru'}** telah dibuat otomatis oleh Miu AI. Silakan berdiskusi di sini!`
            );
          } catch (autoErr) {
            console.error('Failed auto-provisioning from AI create_project:', autoErr);
          }
        } else if (existingReq.action_type === 'create_chat_group') {
          const ins = db.prepare(`
            INSERT INTO chat_groups (name, description, project_id, created_by)
            VALUES (?, ?, ?, ?)
          `).run(
            actionPayload.name || 'Grup Baru dari AI',
            actionPayload.description || '',
            actionPayload.project_id ? Number(actionPayload.project_id) : null,
            executingUserId
          );

          resultId = Number(ins.lastInsertRowid);

          // Add creator as admin member
          db.prepare(`
            INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role)
            VALUES (?, ?, 'admin')
          `).run(resultId, executingUserId);

          executionSummary = `Grup chat "${actionPayload.name}" berhasil dibuat.`;
        } else if (existingReq.action_type === 'create_user') {
          const uname = (actionPayload.username || `user_${Date.now()}`).toLowerCase().trim();
          const pass = actionPayload.password || 'password123';
          const nama = actionPayload.nama || 'Anggota Baru';
          const divisi = actionPayload.divisi || 'Operasional';
          const role = actionPayload.role === 'admin' ? 'admin' : 'karyawan';
          const gender = actionPayload.gender === 'female' ? 'female' : 'male';

          const ins = db.prepare(`
            INSERT INTO users (username, password, nama, divisi, role, gender)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(uname, pass, nama, divisi, role, gender);

          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Akun anggota "${nama}" (@${uname}) berhasil didaftarkan.`;
        } else if (existingReq.action_type === 'delete_all_data' || existingReq.action_type === 'wipe_database') {
          db.prepare('DELETE FROM chat_messages').run();
          db.prepare('DELETE FROM chat_group_members').run();
          db.prepare('DELETE FROM chat_groups').run();
          db.prepare('DELETE FROM project_links').run();
          db.prepare('DELETE FROM project_client_notes').run();
          db.prepare('DELETE FROM realisasi').run();
          db.prepare('DELETE FROM notes').run();
          db.prepare('DELETE FROM calendar_events').run();
          db.prepare('DELETE FROM projects').run();
          executionSummary = `Berhasil membersihkan seluruh data operasional tim (grup chat, proyek, tugas, catatan, dan agenda kalender).`;
        } else if (existingReq.action_type === 'delete_chat_group' || existingReq.action_type === 'delete_all_chat_groups') {
          const isAll = existingReq.action_type === 'delete_all_chat_groups' || Boolean(actionPayload.all);
          if (isAll) {
            const count = (db.prepare('SELECT COUNT(*) as c FROM chat_groups').get() as any)?.c || 0;
            db.prepare('DELETE FROM chat_messages').run();
            db.prepare('DELETE FROM chat_group_members').run();
            db.prepare('DELETE FROM chat_groups').run();
            executionSummary = `Berhasil menghapus seluruh grup obrolan tim (${count} grup telah dihapus).`;
          } else {
            let gId = actionPayload.group_id ? Number(actionPayload.group_id) : null;
            if (!gId && (actionPayload.name || actionPayload.target_name)) {
              const query = (actionPayload.name || actionPayload.target_name).toLowerCase();
              const gRow = db.prepare('SELECT id, name FROM chat_groups WHERE LOWER(name) LIKE ?').get(`%${query}%`) as any;
              if (gRow) {
                gId = gRow.id;
                actionPayload.name = gRow.name;
              }
            }
            if (gId) {
              const gRow = db.prepare('SELECT name FROM chat_groups WHERE id = ?').get(gId) as any;
              const gName = gRow ? gRow.name : (actionPayload.name || 'ID ' + gId);
              db.prepare('DELETE FROM chat_messages WHERE group_id = ?').run(gId);
              db.prepare('DELETE FROM chat_group_members WHERE group_id = ?').run(gId);
              db.prepare('DELETE FROM chat_groups WHERE id = ?').run(gId);
              executionSummary = `Grup obrolan "${gName}" berhasil dihapus.`;
            } else {
              executionSummary = `Grup obrolan "${actionPayload.name || 'terpilih'}" tidak ditemukan atau sudah dihapus.`;
            }
          }
        } else if (existingReq.action_type === 'delete_project' || existingReq.action_type === 'delete_all_projects') {
          const isAll = existingReq.action_type === 'delete_all_projects' || Boolean(actionPayload.all);
          if (isAll) {
            const count = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any)?.c || 0;
            db.prepare('DELETE FROM project_links').run();
            db.prepare('DELETE FROM project_client_notes').run();
            db.prepare('DELETE FROM realisasi').run();
            db.prepare('DELETE FROM projects').run();
            executionSummary = `Berhasil menghapus seluruh proyek tim (${count} proyek telah dihapus).`;
          } else {
            let pId = actionPayload.project_id ? Number(actionPayload.project_id) : null;
            if (!pId && (actionPayload.name || actionPayload.nama_proyek || actionPayload.target_name)) {
              const query = (actionPayload.name || actionPayload.nama_proyek || actionPayload.target_name).toLowerCase();
              const pRow = db.prepare('SELECT id, nama_proyek FROM projects WHERE LOWER(nama_proyek) LIKE ?').get(`%${query}%`) as any;
              if (pRow) {
                pId = pRow.id;
                actionPayload.name = pRow.nama_proyek;
              }
            }
            if (pId) {
              const pRow = db.prepare('SELECT nama_proyek FROM projects WHERE id = ?').get(pId) as any;
              const pName = pRow ? pRow.nama_proyek : (actionPayload.name || 'ID ' + pId);
              db.prepare('DELETE FROM project_links WHERE project_id = ?').run(pId);
              db.prepare('DELETE FROM project_client_notes WHERE project_id = ?').run(pId);
              db.prepare('DELETE FROM realisasi WHERE project_id = ?').run(pId);
              db.prepare('DELETE FROM projects WHERE id = ?').run(pId);
              executionSummary = `Proyek "${pName}" berhasil dihapus.`;
            } else {
              executionSummary = `Proyek "${actionPayload.name || 'terpilih'}" tidak ditemukan atau sudah dihapus.`;
            }
          }
        } else if (existingReq.action_type === 'delete_task' || existingReq.action_type === 'delete_all_tasks') {
          const isAll = existingReq.action_type === 'delete_all_tasks' || Boolean(actionPayload.all);
          if (isAll) {
            const count = (db.prepare('SELECT COUNT(*) as c FROM realisasi').get() as any)?.c || 0;
            db.prepare('DELETE FROM realisasi').run();
            executionSummary = `Berhasil menghapus seluruh tugas tim (${count} tugas telah dihapus).`;
          } else {
            let tId = actionPayload.task_id ? Number(actionPayload.task_id) : null;
            if (!tId && (actionPayload.aktivitas || actionPayload.name || actionPayload.title || actionPayload.target_name)) {
              const query = (actionPayload.aktivitas || actionPayload.name || actionPayload.title || actionPayload.target_name).toLowerCase();
              const tRow = db.prepare('SELECT id, aktivitas FROM realisasi WHERE LOWER(aktivitas) LIKE ?').get(`%${query}%`) as any;
              if (tRow) {
                tId = tRow.id;
                actionPayload.aktivitas = tRow.aktivitas;
              }
            }
            if (tId) {
              const tRow = db.prepare('SELECT aktivitas FROM realisasi WHERE id = ?').get(tId) as any;
              const tName = tRow ? tRow.aktivitas : (actionPayload.aktivitas || 'ID ' + tId);
              db.prepare('DELETE FROM realisasi WHERE id = ?').run(tId);
              executionSummary = `Tugas "${tName}" berhasil dihapus.`;
            } else {
              executionSummary = `Tugas "${actionPayload.aktivitas || 'terpilih'}" tidak ditemukan atau sudah dihapus.`;
            }
          }
        } else if (existingReq.action_type === 'delete_note' || existingReq.action_type === 'delete_all_notes') {
          const isAll = existingReq.action_type === 'delete_all_notes' || Boolean(actionPayload.all);
          if (isAll) {
            const count = (db.prepare('SELECT COUNT(*) as c FROM notes').get() as any)?.c || 0;
            db.prepare('DELETE FROM notes').run();
            executionSummary = `Berhasil menghapus seluruh catatan memo (${count} memo telah dihapus).`;
          } else {
            let nId = actionPayload.note_id || actionPayload.id ? Number(actionPayload.note_id || actionPayload.id) : null;
            if (!nId && (actionPayload.title || actionPayload.name || actionPayload.target_name)) {
              const query = (actionPayload.title || actionPayload.name || actionPayload.target_name).toLowerCase();
              const nRow = db.prepare('SELECT id, title FROM notes WHERE LOWER(title) LIKE ?').get(`%${query}%`) as any;
              if (nRow) {
                nId = nRow.id;
                actionPayload.title = nRow.title;
              }
            }
            if (nId) {
              const nRow = db.prepare('SELECT title FROM notes WHERE id = ?').get(nId) as any;
              const nTitle = nRow ? nRow.title : (actionPayload.title || 'ID ' + nId);
              db.prepare('DELETE FROM notes WHERE id = ?').run(nId);
              executionSummary = `Catatan "${nTitle}" berhasil dihapus.`;
            } else {
              executionSummary = `Catatan "${actionPayload.title || 'terpilih'}" tidak ditemukan atau sudah dihapus.`;
            }
          }
        } else if (existingReq.action_type === 'delete_calendar_event' || existingReq.action_type === 'delete_all_calendar_events') {
          const isAll = existingReq.action_type === 'delete_all_calendar_events' || Boolean(actionPayload.all);
          if (isAll) {
            const count = (db.prepare('SELECT COUNT(*) as c FROM calendar_events').get() as any)?.c || 0;
            db.prepare('DELETE FROM calendar_events').run();
            executionSummary = `Berhasil menghapus seluruh agenda kalender (${count} agenda telah dihapus).`;
          } else {
            let eId = actionPayload.event_id || actionPayload.id ? Number(actionPayload.event_id || actionPayload.id) : null;
            if (!eId && (actionPayload.title || actionPayload.name || actionPayload.target_name)) {
              const query = (actionPayload.title || actionPayload.name || actionPayload.target_name).toLowerCase();
              const eRow = db.prepare('SELECT id, title FROM calendar_events WHERE LOWER(title) LIKE ?').get(`%${query}%`) as any;
              if (eRow) {
                eId = eRow.id;
                actionPayload.title = eRow.title;
              }
            }
            if (eId) {
              const eRow = db.prepare('SELECT title FROM calendar_events WHERE id = ?').get(eId) as any;
              const eTitle = eRow ? eRow.title : (actionPayload.title || 'ID ' + eId);
              db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eId);
              executionSummary = `Agenda "${eTitle}" berhasil dihapus.`;
            } else {
              executionSummary = `Agenda "${actionPayload.title || 'terpilih'}" tidak ditemukan atau sudah dihapus.`;
            }
          }
        } else if (existingReq.action_type === 'delete_user') {
          let uId = actionPayload.user_id ? Number(actionPayload.user_id) : null;
          if (!uId && (actionPayload.username || actionPayload.nama || actionPayload.name || actionPayload.target_name)) {
            const query = (actionPayload.username || actionPayload.nama || actionPayload.name || actionPayload.target_name).toLowerCase();
            const uRow = db.prepare('SELECT id, nama, username FROM users WHERE LOWER(username) = ? OR LOWER(nama) LIKE ?').get(query, `%${query}%`) as any;
            if (uRow) uId = uRow.id;
          }
          if (uId) {
            const uRow = db.prepare('SELECT id, nama, username FROM users WHERE id = ?').get(uId) as any;
            const targetName = uRow ? `${uRow.nama} (@${uRow.username})` : (actionPayload.name || `ID ${uId}`);
            db.prepare('DELETE FROM users WHERE id = ?').run(uId);
            executionSummary = `Pengguna "${targetName}" berhasil dihapus dari sistem.`;
          } else {
            executionSummary = `Pengguna tidak ditemukan atau sudah dihapus.`;
          }
        } else if (existingReq.action_type === 'update_project_status') {
          let pId = actionPayload.project_id ? Number(actionPayload.project_id) : null;
          if (!pId && (actionPayload.nama_proyek || actionPayload.name || actionPayload.target_name)) {
            const query = (actionPayload.nama_proyek || actionPayload.name || actionPayload.target_name).toLowerCase();
            const pRow = db.prepare('SELECT id, nama_proyek FROM projects WHERE LOWER(nama_proyek) LIKE ?').get(`%${query}%`) as any;
            if (pRow) pId = pRow.id;
          }
          if (pId) {
            const newStatus = actionPayload.status || 'aktif';
            db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(newStatus, pId);
            const pRow = db.prepare('SELECT nama_proyek FROM projects WHERE id = ?').get(pId) as any;
            resultId = pId;
            executionSummary = `Status proyek "${pRow ? pRow.nama_proyek : 'ID ' + pId}" berhasil diubah menjadi "${newStatus}".`;
          }
        } else if (existingReq.action_type === 'update_task' || existingReq.action_type === 'update_task_status') {
          let tId = actionPayload.task_id ? Number(actionPayload.task_id) : null;
          if (!tId && (actionPayload.aktivitas || actionPayload.name || actionPayload.target_name)) {
            const query = (actionPayload.aktivitas || actionPayload.name || actionPayload.target_name).toLowerCase();
            const tRow = db.prepare('SELECT id, aktivitas FROM realisasi WHERE LOWER(aktivitas) LIKE ?').get(`%${query}%`) as any;
            if (tRow) tId = tRow.id;
          }
          if (tId) {
            const currentTask = db.prepare('SELECT * FROM realisasi WHERE id = ?').get(tId) as any;
            if (currentTask) {
              const newAktivitas = actionPayload.aktivitas !== undefined ? actionPayload.aktivitas : currentTask.aktivitas;
              const newTarget = actionPayload.target !== undefined && actionPayload.target !== null ? Number(actionPayload.target) : Number(currentTask.target);
              const newRealisasi = actionPayload.realisasi !== undefined && actionPayload.realisasi !== null ? Number(actionPayload.realisasi) : Number(currentTask.realisasi);
              const newPct = newTarget > 0 ? Math.round((newRealisasi / newTarget) * 100) : 100;
              let newStatus = actionPayload.status;
              if (!newStatus) {
                newStatus = newPct >= 100 ? 'Tercapai' : newPct >= 70 ? 'Hampir' : 'Belum';
              }
              db.prepare(`
                UPDATE realisasi
                SET aktivitas = ?,
                    target = ?,
                    realisasi = ?,
                    persentase = ?,
                    status = ?
                WHERE id = ?
              `).run(newAktivitas, newTarget, newRealisasi, newPct, newStatus, tId);
              resultId = tId;
              executionSummary = `Tugas "${newAktivitas}" (Target: ${newTarget}, Realisasi: ${newRealisasi}, Status: ${newStatus}) berhasil diperbarui.`;
            }
          }
        } else if (existingReq.action_type === 'create_project_link') {
          const pId = Number(actionPayload.project_id) || 1;
          const ins = db.prepare(`
            INSERT INTO project_links (project_id, title, url, platform)
            VALUES (?, ?, ?, ?)
          `).run(pId, actionPayload.title, actionPayload.url, actionPayload.platform || 'other');
          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Tautan "${actionPayload.title}" berhasil ditambahkan ke Resource Hub proyek.`;
        } else if (existingReq.action_type === 'delete_project_link') {
          let lId = actionPayload.link_id ? Number(actionPayload.link_id) : null;
          if (!lId && (actionPayload.title || actionPayload.target_title)) {
            const link = db.prepare('SELECT id FROM project_links WHERE LOWER(title) LIKE ?').get(`%${(actionPayload.title || actionPayload.target_title).toLowerCase()}%`) as any;
            if (link) lId = link.id;
          }
          if (lId) {
            db.prepare('DELETE FROM project_links WHERE id = ?').run(lId);
            executionSummary = `Tautan (ID: ${lId}) berhasil dihapus dari Resource Hub.`;
          }
        } else if (existingReq.action_type === 'create_client_note') {
          const pId = Number(actionPayload.project_id) || 1;
          const ins = db.prepare(`
            INSERT INTO project_client_notes (project_id, author_name, author_role, message, category, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            pId,
            actionPayload.author_name || 'Klien',
            actionPayload.author_role || 'client',
            actionPayload.message,
            actionPayload.category || 'feedback',
            actionPayload.status || 'open'
          );
          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Catatan portal klien berhasil direkam: "${actionPayload.message}".`;
        } else if (existingReq.action_type === 'update_client_note_status') {
          let nId = actionPayload.note_id ? Number(actionPayload.note_id) : null;
          if (!nId && (actionPayload.message || actionPayload.search_keyword)) {
            const q = (actionPayload.message || actionPayload.search_keyword).toLowerCase();
            const cnRow = db.prepare('SELECT id FROM project_client_notes WHERE LOWER(message) LIKE ?').get(`%${q}%`) as any;
            if (cnRow) nId = cnRow.id;
          }
          if (nId) {
            const st = actionPayload.status || 'resolved';
            db.prepare('UPDATE project_client_notes SET status = ? WHERE id = ?').run(st, nId);
            resultId = nId;
            executionSummary = `Status catatan klien #${nId} diubah menjadi "${st}".`;
          }
        } else if (existingReq.action_type === 'toggle_note_pin') {
          const nId = Number(actionPayload.note_id);
          let pinVal: number;
          if (actionPayload.pinned !== undefined && actionPayload.pinned !== null) {
            pinVal = actionPayload.pinned ? 1 : 0;
          } else {
            const cur = db.prepare('SELECT pinned FROM notes WHERE id = ?').get(nId) as any;
            pinVal = cur?.pinned ? 0 : 1;
          }
          db.prepare('UPDATE notes SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(pinVal, nId);
          resultId = nId;
          executionSummary = `Status pin catatan #${nId} berhasil diubah menjadi ${pinVal ? 'tersemat' : 'dilepas'}.`;
        } else if (existingReq.action_type === 'update_note_checklist') {
          const nId = Number(actionPayload.note_id);
          const nRow = db.prepare('SELECT checklist FROM notes WHERE id = ?').get(nId) as any;
          if (nRow) {
            let list: any[] = [];
            try { list = JSON.parse(nRow.checklist || '[]'); } catch { list = []; }
            const itemText = String(actionPayload.item_text || '').trim();
            const done = Boolean(actionPayload.done);
            const foundIdx = list.findIndex((item: any, idx: number) =>
              String(idx + 1) === itemText || (item.text && item.text.toLowerCase().includes(itemText.toLowerCase()))
            );
            if (foundIdx >= 0) {
              list[foundIdx].done = done;
            } else {
              list.push({ id: String(Date.now()), text: itemText, done });
            }
            db.prepare('UPDATE notes SET checklist = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(list), nId);
            resultId = nId;
            executionSummary = `Checklist catatan #${nId} berhasil diperbarui.`;
          }
        } else if (existingReq.action_type === 'update_calendar_event') {
          let eId = actionPayload.event_id ? Number(actionPayload.event_id) : null;
          if (!eId && (actionPayload.title || actionPayload.target_title)) {
            const q = (actionPayload.title || actionPayload.target_title).toLowerCase();
            const eRow = db.prepare('SELECT id FROM calendar_events WHERE LOWER(title) LIKE ?').get(`%${q}%`) as any;
            if (eRow) eId = eRow.id;
          }
          if (eId) {
            db.prepare(`
              UPDATE calendar_events
              SET title = COALESCE(?, title),
                  date = COALESCE(?, date),
                  start_time = COALESCE(?, start_time),
                  end_time = COALESCE(?, end_time)
              WHERE id = ?
            `).run(
              actionPayload.title || null,
              actionPayload.date || null,
              actionPayload.start_time || null,
              actionPayload.end_time || null,
              eId
            );
            resultId = eId;
            executionSummary = `Agenda kalender #${eId} berhasil dijadwalkan ulang.`;
          }
        } else if (existingReq.action_type === 'mark_all_notifications_read') {
          db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL').run(executingUserId);
          executionSummary = 'Seluruh notifikasi ditandai sebagai sudah dibaca.';
        } else if (existingReq.action_type === 'update_user') {
          let uId = actionPayload.user_id ? Number(actionPayload.user_id) : null;
          if (!uId && (actionPayload.username || actionPayload.target_name || actionPayload.nama)) {
            const q = (actionPayload.username || actionPayload.target_name || actionPayload.nama).toLowerCase();
            const uRow = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(nama) LIKE ?').get(q, `%${q}%`) as any;
            if (uRow) uId = uRow.id;
          }
          if (uId) {
            db.prepare(`
              UPDATE users
              SET nama = COALESCE(?, nama),
                  divisi = COALESCE(?, divisi),
                  role = COALESCE(?, role),
                  gender = COALESCE(?, gender)
              WHERE id = ?
            `).run(
              actionPayload.nama || null,
              actionPayload.divisi || null,
              actionPayload.role || null,
              actionPayload.gender || null,
              uId
            );
            resultId = uId;
            executionSummary = `Profil pengguna #${uId} berhasil diperbarui.`;
          }
        } else if (existingReq.action_type === 'report_task_blocker') {
          let tId = actionPayload.task_id ? Number(actionPayload.task_id) : null;
          if (!tId && (actionPayload.aktivitas || actionPayload.target_name)) {
            const q = (actionPayload.aktivitas || actionPayload.target_name).toLowerCase();
            const tRow = db.prepare('SELECT id FROM realisasi WHERE LOWER(aktivitas) LIKE ?').get(`%${q}%`) as any;
            if (tRow) tId = tRow.id;
          }
          if (tId) {
            db.prepare(`
              UPDATE realisasi
              SET kendala = ?,
                  solusi = COALESCE(?, solusi)
              WHERE id = ?
            `).run(actionPayload.kendala, actionPayload.solusi || '', tId);
            resultId = tId;
            executionSummary = `Kendala tugas #${tId} berhasil dicatat.`;
          }
        } else if (existingReq.action_type === 'resolve_task_blocker') {
          let tId = actionPayload.task_id ? Number(actionPayload.task_id) : null;
          if (!tId && (actionPayload.aktivitas || actionPayload.target_name)) {
            const q = (actionPayload.aktivitas || actionPayload.target_name).toLowerCase();
            const tRow = db.prepare('SELECT id FROM realisasi WHERE LOWER(aktivitas) LIKE ?').get(`%${q}%`) as any;
            if (tRow) tId = tRow.id;
          }
          if (tId) {
            db.prepare(`
              UPDATE realisasi
              SET kendala = '',
                  solusi = ?
              WHERE id = ?
            `).run(actionPayload.solusi || 'Teratasi', tId);
            resultId = tId;
            executionSummary = `Kendala tugas #${tId} telah diselesaikan.`;
          }
        } else if (existingReq.action_type === 'nudge_user') {
          const targetUid = Number(actionPayload.user_id);
          const ins = db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
            VALUES (?, ?, ?, 'nudge', '/?tab=input', ?, 0)
          `).run(targetUid, 'Pengingat dari Tim', actionPayload.pesan || 'Yuk update realisasi harian lu!', JSON.stringify({ nudge: true }));
          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Colekan berhasil dikirim ke user #${targetUid}.`;
        } else if (existingReq.action_type === 'send_chat_message') {
          const gId = Number(actionPayload.group_id);
          const ins = db.prepare(`
            INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
            VALUES (?, ?, ?, ?, 1)
          `).run(gId, executingUserId, 'Miu', actionPayload.message);
          resultId = Number(ins.lastInsertRowid);
          executionSummary = `Pesan obrolan berhasil dikirim ke grup #${gId}.`;
        } else if (existingReq.action_type === 'add_group_member') {
          const gId = Number(actionPayload.group_id);
          const uId = Number(actionPayload.user_id);
          const role = actionPayload.role === 'admin' ? 'admin' : 'member';
          db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(gId, uId, role);
          const uRow = db.prepare('SELECT nama FROM users WHERE id = ?').get(uId) as any;
          db.prepare("INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai) VALUES (?, NULL, 'Miu', ?, 1)").run(gId, `👋 ${uRow?.nama || 'Anggota baru'} telah ditambahkan ke grup.`);
          executionSummary = `Anggota ${uRow?.nama || uId} berhasil dimasukkan ke grup #${gId}.`;
        } else if (existingReq.action_type === 'remove_group_member') {
          const gId = Number(actionPayload.group_id);
          const uId = Number(actionPayload.user_id);
          db.prepare('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?').run(gId, uId);
          const uRow = db.prepare('SELECT nama FROM users WHERE id = ?').get(uId) as any;
          db.prepare("INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai) VALUES (?, NULL, 'Miu', ?, 1)").run(gId, `📢 ${uRow?.nama || 'Anggota'} telah dikeluarkan dari grup.`);
          executionSummary = `Anggota ${uRow?.nama || uId} berhasil dikeluarkan dari grup #${gId}.`;
        } else if (existingReq.action_type === 'plan_tasks') {
          const pId = Number(actionPayload.project_id) || 1;
          const tasks = Array.isArray(actionPayload.tasks) ? actionPayload.tasks : [];
          for (const t of tasks) {
            const assignedUid = t.user_id ? Number(t.user_id) : executingUserId;
            const uRow = db.prepare('SELECT nama, divisi FROM users WHERE id = ?').get(assignedUid) as any;
            const taskNama = uRow ? uRow.nama : namaUser;
            const taskDivisi = uRow ? uRow.divisi : divisiUser;

            db.prepare(`
              INSERT INTO realisasi (
                project_id, user_id, assigned_to_user_id, assigned_by_user_id, deadline,
                nama, divisi, tanggal, aktivitas, target, realisasi, satuan, persentase, status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 'Belum')
            `).run(
              pId,
              assignedUid,
              assignedUid,
              executingUserId,
              t.deadline || t.tanggal || todayStr,
              taskNama,
              taskDivisi,
              t.tanggal || todayStr,
              t.aktivitas,
              Number(t.target) || 1,
              t.satuan || 'Tugas'
            );

            // Notify assignee if delegated
            if (assignedUid !== executingUserId) {
              try {
                db.prepare(`
                  INSERT INTO notifications (user_id, title, message, type, action_url, is_read)
                  VALUES (?, 'Tugas Baru Didelegasikan oleh AI', ?, 'task', ?, 0)
                `).run(
                  assignedUid,
                  `${namaUser} menugaskan tugas baru via Miu AI: "${t.aktivitas}" (Target: ${t.target || 1} ${t.satuan || 'Tugas'})`,
                  `/?tab=projects&project_id=${pId}`
                );
              } catch {}
            }
          }
          executionSummary = `Berhasil merencanakan ${tasks.length} tugas ke proyek #${pId}.`;
        }

        // Update action request status to approved
        try {
          db.prepare("UPDATE ai_action_requests SET status = 'approved' WHERE id = ?").run(existingReq.id);
        } catch {}

        // Mark associated notification as read
        try {
          db.prepare("UPDATE notifications SET is_read = 1 WHERE payload_json LIKE ?").run(`%"action_request_id":${existingReq.id}%`);
        } catch {}

        // Create success notification for user if user still exists
        try {
          const userStillExists = db.prepare('SELECT id FROM users WHERE id = ?').get(executingUserId);
          if (userStillExists) {
            db.prepare(`
              INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
              VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
            `).run(
              executingUserId,
              'Aksi AI Berhasil Dieksekusi',
              `Aksi telah disetujui: ${executionSummary}`,
              '/?tab=home',
              JSON.stringify({ action_request_id: existingReq.id, executed: true, result_id: resultId })
            );
          }
        } catch {}

        return {
      success: true,
      status: 'approved',
      message: executionSummary || 'Aksi AI berhasil dieksekusi.',
      result_id: resultId,
    };
  }
  return { error: 'Status aksi tidak valid', statusCode: 400 };
}
