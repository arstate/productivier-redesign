import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_AI_MODEL = 'nvidia/nemotron-3.5-super-vl:free';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json({ error: 'group_id parameter wajib diisi' }, { status: 400 });
    }

    const db = getDb();
    const messages = db.prepare(`
      SELECT * FROM (
        SELECT 
          m.id, 
          m.group_id, 
          m.user_id, 
          m.sender_name, 
          m.message, 
          m.is_ai, 
          m.reply_to_id,
          rm.sender_name as reply_to_sender,
          rm.message as reply_to_text,
          m.reasoning_text,
          m.created_at,
          u.role as sender_role,
          u.gender as sender_gender
        FROM chat_messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN chat_messages rm ON m.reply_to_id = rm.id
        WHERE m.group_id = ?
        ORDER BY m.id DESC
        LIMIT 100
      ) ORDER BY id ASC
    `).all(Number(groupId)) as any[];

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      sender_name: m.sender_name,
      message: m.message,
      is_ai: Boolean(m.is_ai),
      reply_to_id: m.reply_to_id || null,
      reply_to_sender: m.reply_to_sender || null,
      reply_to_text: m.reply_to_text || null,
      reasoning_text: m.reasoning_text || "",
      created_at: m.created_at,
      sender_role: m.sender_role,
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memuat pesan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { group_id, message, ask_ai, reply_to_id } = body;
    const user_id = auth.user.id;
    const sender_name = auth.user.nama;

    if (!group_id || !message || !message.trim()) {
      return NextResponse.json({ error: 'Data pesan tidak lengkap' }, { status: 400 });
    }

    const db = getDb();
    const cleanMessage = message.trim();

    // Verify group existence before insertion
    const group = db.prepare('SELECT name, description, ai_name, ai_model, ai_thinking_mode FROM chat_groups WHERE id = ?').get(Number(group_id)) as {
      name: string;
      description: string;
      ai_name?: string;
      ai_model?: string;
      ai_thinking_mode?: string;
    } | undefined;

    if (!group) {
      return NextResponse.json({ error: 'Grup chat tidak ditemukan' }, { status: 404 });
    }

    // Sanitize user_id and reply_to_id to prevent FOREIGN KEY constraint failures
    let safeUserId: number | null = null;
    if (user_id) {
      const u = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(user_id));
      if (u) safeUserId = Number(user_id);
    }

    let safeReplyToId: number | null = null;
    if (reply_to_id) {
      const rm = db.prepare('SELECT id FROM chat_messages WHERE id = ?').get(Number(reply_to_id));
      if (rm) safeReplyToId = Number(reply_to_id);
    }

    // 1. Insert user message (with reply_to_id support)
    const insertRes = db.prepare(`
      INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai, reply_to_id)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(
      Number(group_id),
      safeUserId,
      sender_name || 'Anggota Tim',
      cleanMessage,
      safeReplyToId
    );
    const userMessageId = Number(insertRes.lastInsertRowid);

    const groupName = group ? group.name : 'Grup Tim';
    const aiName = group?.ai_name?.trim() || 'Miu';
    const groupAiModel = group?.ai_model || DEFAULT_AI_MODEL;
    const groupThinkingMode = (group?.ai_thinking_mode || 'medium').toLowerCase();
    let resolvedModel = groupAiModel;

    // Gender detection: check sender's gender in users table
    let senderGender = 'male';
    if (user_id) {
      const senderUser = db.prepare('SELECT gender, nama, username FROM users WHERE id = ?').get(Number(user_id)) as { gender?: string; nama?: string; username?: string } | undefined;
      if (senderUser) {
        senderGender = senderUser.gender || 'male';
      }
    } else if (sender_name) {
      const senderUser = db.prepare('SELECT gender FROM users WHERE nama = ? OR username = ?').get(sender_name, sender_name) as { gender?: string } | undefined;
      if (senderUser) {
        senderGender = senderUser.gender || 'male';
      }
    }
    const isFifa = (sender_name && sender_name.toLowerCase().includes('fifa')) || false;
    const isFemale = senderGender === 'female' || isFifa;

    // Create notification for other members of this chat group (excluding sender)
    try {
      const groupMembers = db
        .prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?')
        .all(Number(group_id)) as Array<{ user_id: number }>;
      const targetMemberIds = groupMembers
        .map((gm) => gm.user_id)
        .filter((uid) => uid !== safeUserId);

      const insChatNotif = db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
        VALUES (?, ?, ?, 'chat', ?, ?, 0)
      `);
      for (const uid of targetMemberIds) {
        insChatNotif.run(
          uid,
          `Pesan Baru di ${groupName}`,
          `${sender_name}: "${cleanMessage.slice(0, 70)}${cleanMessage.length > 70 ? '...' : ''}"`,
          `/?tab=chat&group=${group_id}`,
          JSON.stringify({ group_id: Number(group_id), sender_name, is_ai: false })
        );
      }
    } catch (e) {
      console.warn('Failed to insert chat notification:', e);
    }

    // Mention check: check @ai, /ai, @{ai_name}, or /project / /pro slash commands
    const cleanAiName = aiName.trim();
    const cleanAiNameLower = cleanAiName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const escapedAiName = escapeRegex(cleanAiName);
    const escapedCleanAiName = escapeRegex(cleanAiNameLower);

    // Slash project tag detection: /project "Nama Proyek" or /project Nama Proyek or /pro ...
    const slashProjectMatch = cleanMessage.match(/(?:^|\s)\/(?:project|pro)\s*(?:["“]([^"”]+)["”]|([^\s\n,]+(?:\s+[^\s\n,]+)*))?/i);
    const hasSlashProject = /(?:^|\s)\/(?:project|pro)\b/i.test(cleanMessage);
    let taggedProjectName = '';
    if (slashProjectMatch && (slashProjectMatch[1] || slashProjectMatch[2])) {
      taggedProjectName = (slashProjectMatch[1] || slashProjectMatch[2] || '').trim();
    }

    const isAiNameMentioned = Boolean(
      (cleanAiName && new RegExp(`@${escapedAiName}(?:\\b|\\s|$)`, 'i').test(cleanMessage)) ||
      (cleanAiNameLower && new RegExp(`@${escapedCleanAiName}(?:\\b|\\s|$)`, 'i').test(cleanMessage)) ||
      /@miu(?:\b|\s|$)/i.test(cleanMessage)
    );
    const isMentionAi = Boolean(
      ask_ai ||
      hasSlashProject ||
      /@ai(?:\b|\s|$)/i.test(cleanMessage) ||
      /@miu(?:\b|\s|$)/i.test(cleanMessage) ||
      /^\/ai(?:\b|\s|$)/i.test(cleanMessage) ||
      isAiNameMentioned
    );

    // 2. If AI is mentioned or asked, fetch full group conversation history & compact if needed
    if (isMentionAi) {
      let aiReply = '';
      const stripPatterns = [
        `@${escapedAiName}`,
        cleanAiNameLower ? `@${escapedCleanAiName}` : '',
        '@miu\\b',
        '@ai\\b',
        '^\\/ai\\b',
      ].filter(Boolean).join('|');
      const promptQuery = cleanMessage
        .replace(new RegExp(stripPatterns, 'gi'), '')
        .trim();

      // Fetch entire group chat history from all participants + previous bot messages
      const fullHistory = db.prepare(`
        SELECT id, group_id, user_id, sender_name, message, is_ai, created_at
        FROM chat_messages
        WHERE group_id = ?
        ORDER BY id ASC
      `).all(Number(group_id)) as Array<{
        id: number;
        group_id: number;
        user_id: number | null;
        sender_name: string;
        message: string;
        is_ai: number;
        created_at: string;
      }>;

      // Compaction engine if history count > 10
      let compactedSummary = '';
      let recentMessages = fullHistory;

      if (fullHistory.length > 10) {
        const older = fullHistory.slice(0, -8);
        recentMessages = fullHistory.slice(-8);
        compactedSummary = [
          '[RINGKASAN DISKUSI GRUP SEBELUMNYA (COMPACTED - FULL CONTEXT MEMORY)]:',
          ...older.map((m) => `- [${m.sender_name}]: ${m.message.replace(/\s+/g, ' ').trim().slice(0, 160)}`),
          '(Pesan-pesan terbaru di bawah ini adalah kelanjutan langsung dari diskusi di atas)',
        ].join('\n');
      }

      // Thinking mode configuration (Control brevity via instructions & reasoning effort, NOT via tiny token cuts)
      let thinkingInstruction = '';
      let temperature = 0.6;
      if (groupThinkingMode === 'low') {
        thinkingInstruction = 'Mode Berpikir AI: Low (Cepat & Ringkas). Berikan jawaban yang padat, ringkas, to the point ke inti solusi tanpa bertele-tele, namun tetap tuntaskan seluruh kalimat dan bagian dengan rapi sampai selesai.';
        temperature = 0.4;
      } else if (groupThinkingMode === 'high') {
        thinkingInstruction = 'Mode Berpikir AI: High (Mendalam & Komprehensif). Berikan penalaran mendalam, pertimbangkan dinamika tim dan dampak kerja, lalu berikan solusi langkah demi langkah yang terstruktur rapi dan tuntas.';
        temperature = 0.7;
      } else {
        thinkingInstruction = 'Mode Berpikir AI: Medium (Seimbang). Berikan jawaban yang ramah, berbobot, seimbang, dan solutif tuntas.';
        temperature = 0.6;
      }

      // Gender-adaptive persona instruction
      const genderInstruction = isFemale
        ? `PANDUAN GENDER & PERSONA KHUSUS WANITA (SANGAT KRUSIAL):
Pengguna penanya (${sender_name}) adalah PEREMPUAN / WANITA (Fifa / Rekan Tim Putri).
- Gunakan persona Gen Z cewek yang hangat, supportive, akrab, ceria, dan bersahabat seperti Bestie rekan kerja ("Bestie", "Sis", "Beb", "Kak", "Say", dengan kata ganti "gw/lu").
- HARAM HUKUMNYA DAN JANGAN SEKALI-KALI MEMANGGIL DENGAN SEBUTAN "Bro", "Men", "Bree", ATAU "Cuy"! Jangan sekali pun memanggil dia "Bro"!
- Sapaan wajib yang tepat: "Halo Bestie ${sender_name}!", "Siap Kak Fifa!", "Tenang Sis, ini gw bantu yaa!", "Semangat Beb!".`
        : `PANDUAN GENDER & PERSONA PRIA:
Pengguna penanya (${sender_name}) adalah PRIA / LAKI-LAKI.
- Gunakan persona Gen Z cowok yang energik, solid, santai, dan asik ("Bro", "Men", "Bree", "Cuy", dengan kata ganti "gw/lu").
- Sapaan yang tepat: "Siap Bro ${sender_name}!", "Gaspol Men!", "Aman Cuy!".`;

      // Multi-project context fetching from chat_group_projects
      const rawConnectedProjects = db.prepare(`
        SELECT 
          p.id, 
          p.nama_proyek, 
          p.divisi, 
          p.target_total, 
          COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi, 
          p.satuan, 
          p.status, 
          p.deadline, 
          u.nama as pic_nama,
          (SELECT COUNT(*) FROM realisasi r WHERE r.project_id = p.id AND r.kendala IS NOT NULL AND TRIM(r.kendala) != '') as kendala_count
        FROM chat_group_projects cgp
        JOIN projects p ON cgp.project_id = p.id
        LEFT JOIN users u ON p.pic_id = u.id
        WHERE cgp.group_id = ?
        ORDER BY p.id ASC
      `).all(Number(group_id)) as any[];

      const connectedProjects = rawConnectedProjects.map((p) => {
        const target = Number(p.target_total) || 0;
        const total = Number(p.total_realisasi) || 0;
        return {
          ...p,
          persentase: target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0,
        };
      });

      // Fallback to legacy group.project_id if connectedProjects is empty
      if (connectedProjects.length === 0 && (group as any).project_id) {
        const legacyP = db.prepare(`
          SELECT 
            p.id, p.nama_proyek, p.divisi, p.target_total, 
            COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi, 
            p.satuan, p.status, p.deadline, u.nama as pic_nama,
            (SELECT COUNT(*) FROM realisasi r WHERE r.project_id = p.id AND r.kendala IS NOT NULL AND TRIM(r.kendala) != '') as kendala_count
          FROM projects p 
          LEFT JOIN users u ON p.pic_id = u.id
          WHERE p.id = ?
        `).get(Number((group as any).project_id)) as any;
        if (legacyP) {
          const target = Number(legacyP.target_total) || 0;
          const total = Number(legacyP.total_realisasi) || 0;
          connectedProjects.push({
            ...legacyP,
            persentase: target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0,
          });
        }
      }

      let connectedProjectsContext = '';
      if (connectedProjects.length > 0) {
        const pLines = connectedProjects.map((p) => {
          const blockers = db.prepare(`
            SELECT nama, aktivitas, kendala, solusi, persentase, tanggal 
            FROM realisasi 
            WHERE project_id = ? AND kendala IS NOT NULL AND TRIM(kendala) != ''
            ORDER BY id DESC LIMIT 3
          `).all(p.id) as any[];

          const recentTasks = db.prepare(`
            SELECT nama, aktivitas, persentase, tanggal
            FROM realisasi
            WHERE project_id = ?
            ORDER BY id DESC LIMIT 2
          `).all(p.id) as any[];

          const blockerInfo = blockers.length > 0
            ? blockers.map(b => `${b.nama}: "${b.kendala}"${b.solusi ? ` (Solusi: ${b.solusi})` : ''}`).join('; ')
            : 'Nihil / Lancar tanpa kendala';

          const taskInfo = recentTasks.length > 0
            ? recentTasks.map(t => `${t.aktivitas} (${t.nama}: ${t.persentase}%)`).join('; ')
            : '-';

          return `• [PROYEK: ${p.nama_proyek}] (ID: ${p.id}, Divisi: ${p.divisi})
  - Progres: ${p.persentase}% (Target: ${p.target_total} ${p.satuan || ''}, Tercapai: ${p.total_realisasi} ${p.satuan || ''})
  - Status: ${p.status} | Deadline: ${p.deadline || 'Belum diatur'} | PIC: ${p.pic_nama || 'Belum ada'}
  - Kendala Aktif (${p.kendala_count}): ${blockerInfo}
  - Progres Terkini: ${taskInfo}`;
        });

        connectedProjectsContext = `DAFTAR PROYEK YANG TERKONEKSI KE GRUP INI (${connectedProjects.length} PROYEK):\n${pLines.join('\n\n')}\n(Anda memiliki akses langsung untuk membaca dan menganalisis status, capaian progres, target, dan kendala dari seluruh proyek di atas)`;
      } else {
        connectedProjectsContext = `PROYEK TERKONEKSI: Belum ada proyek yang dikoneksikan ke grup ini.`;
      }

      // Check if user specifically tagged a project via /project or /pro
      let matchedTaggedProject: any = null;
      let taggedProjectFocusPrompt = '';
      if (taggedProjectName) {
        // Look in connected projects first
        matchedTaggedProject = connectedProjects.find(
          (p) => p.nama_proyek.toLowerCase() === taggedProjectName.toLowerCase() ||
                 p.nama_proyek.toLowerCase().includes(taggedProjectName.toLowerCase())
        );
        // Fallback to all projects in db
        if (!matchedTaggedProject) {
          const fallbackP = db.prepare(`
            SELECT p.*, u.nama as pic_nama,
              COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi
            FROM projects p
            LEFT JOIN users u ON p.pic_id = u.id
            WHERE LOWER(p.nama_proyek) LIKE ? LIMIT 1
          `).get(`%${taggedProjectName.toLowerCase()}%`) as any;
          if (fallbackP) {
            const target = Number(fallbackP.target_total) || 0;
            const total = Number(fallbackP.total_realisasi) || 0;
            matchedTaggedProject = {
              ...fallbackP,
              persentase: target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0,
            };
          }
        }

        if (matchedTaggedProject) {
          const allBlockers = db.prepare(`
            SELECT nama, aktivitas, kendala, solusi, persentase, tanggal 
            FROM realisasi 
            WHERE project_id = ? AND kendala IS NOT NULL AND TRIM(kendala) != ''
            ORDER BY id DESC LIMIT 5
          `).all(matchedTaggedProject.id) as any[];

          const recentRealisasi = db.prepare(`
            SELECT nama, aktivitas, realisasi, persentase, tanggal 
            FROM realisasi 
            WHERE project_id = ?
            ORDER BY id DESC LIMIT 5
          `).all(matchedTaggedProject.id) as any[];

          taggedProjectFocusPrompt = `\n\n🎯 [FOKUS KHUSUS: PENGGUNA NGETAG PROYEK VIA /project "${matchedTaggedProject.nama_proyek}"]
Pengguna secara eksplisit ngetag proyek "${matchedTaggedProject.nama_proyek}".
- Detail: Divisi ${matchedTaggedProject.divisi}, Status: ${matchedTaggedProject.status}, Progres: ${matchedTaggedProject.persentase}%, Target: ${matchedTaggedProject.target_total} ${matchedTaggedProject.satuan || ''}, Tercapai: ${matchedTaggedProject.total_realisasi} ${matchedTaggedProject.satuan || ''}, Deadline: ${matchedTaggedProject.deadline || 'Belum diatur'}.
- Kendala Tim (${allBlockers.length} kendala):
${allBlockers.length > 0 ? allBlockers.map(b => `  * ${b.nama} (${b.aktivitas}): "${b.kendala}" -> Rencana Solusi: ${b.solusi || 'Belum ada'}`).join('\n') : '  * Bersih, tidak ada kendala.'}
- Entri Tugas Terkini:
${recentRealisasi.length > 0 ? recentRealisasi.map(r => `  * [${r.tanggal}] ${r.nama}: ${r.aktivitas} (${r.persentase}%)`).join('\n') : '  * Belum ada laporan.'}

INSTRUKSI:
Langsung berikan ulasan komprehensif, evaluasi capaian target, status deadline, dan rumusan solusi konkret atas kendala proyek "${matchedTaggedProject.nama_proyek}"!`;
        }
      }

      const antiRefusalInstruction = `ZERO-TOLERANCE ANTI-REFUSAL POLICY (MUTLAK BERLAKU):
- DILARANG KERAS berkata "gw nggak bisa", "tidak bisa langsung ngirim", "tidak bisa otomatis mention", "tidak bisa tambah anggota", "cuma bisa manual", atau "sistem belum mendukung"!
- Anda adalah AI Asisten Operasional Tim Productivier dengan wewenang penuh di grup ini.
- Jika pengguna meminta colek/ingatkan anggota tim -> konfirmasi langsung bahwa notifikasi pengingat sistem telah terkirim ke anggota tersebut.
- Jika pengguna meminta kirim pesan/tag anggota di grup -> langsung tag (@nama) dan sampaikan pesannya dengan jelas dan lugas.
- Jika pengguna meminta menambahkan anggota ke grup -> konfirmasi langsung bahwa anggota tersebut telah berhasil dimasukkan ke dalam grup.
- Jika pengguna meminta breakdown rencana kerja atau sprint -> berikan rekomendasi tugas yang terstruktur rapi.`;

      const formattingInstruction = `ATURAN FORMAT MARKDOWN (WAJIB DIPATUHI):
- Gunakan format Markdown standar yang rapi (\`**teks tebal**\`, daftar bullet \`- item\`, daftar bernomor \`1. item\`, heading \`### Judul\`).
- Jika menyajikan data dalam bentuk tabel Markdown, SETIAP BARIS TABEL (baris header, baris pemisah \`| :--- | :--- |\`, dan setiap baris data) WAJIB ditulis dalam SATU BARIS TUNGGAL tanpa pemisah baris (\`\\n\`) di tengah sel atau di tengah baris, diawali dan diakhiri tanda \`|\`, serta dipisahkan baris kosong sebelum dan sesudah tabel.
- DILARANG KERAS memecah satu baris tabel ke baris berikutnya atau meninggalkan karakter \`|\` sendirian di baris baru.`;

      const promptMessages = [
        {
          role: 'system',
          content: `Anda adalah "${aiName}", asisten kerja cerdas yang berkolaborasi di dalam grup diskusi tim "${groupName}".
Anda membaca SELURUH konteks obrolan grup dari semua orang (anggota tim, leader, maupun balasan asisten sebelumnya).

${genderInstruction}

${thinkingInstruction}

${formattingInstruction}

${antiRefusalInstruction}

${connectedProjectsContext}
${taggedProjectFocusPrompt}

Konteks Grup: ${group?.description || 'Koordinasi tugas tim'}.
Model Aktif: ${groupAiModel}.
${compactedSummary ? `\n${compactedSummary}` : ''}`,
        },
        ...recentMessages.map((m) => ({
          role: m.is_ai ? 'assistant' : 'user',
          content: `[${m.sender_name}]: ${m.message}`,
        })),
      ];

      // Autonomous action handler in group chat (Nudge, Add Member, etc.)
      const isNudgeIntent = /(?:colek|ingatkan|remind|nudge)\s+(@?\w+)/i.test(cleanMessage);
      let actionTargetUser: any = null;
      if (isNudgeIntent) {
        const nudgeMatch = cleanMessage.match(/(?:colek|ingatkan|remind|nudge)\s+@?(\w+)/i);
        const targetRaw = nudgeMatch ? nudgeMatch[1].toLowerCase() : '';
        if (targetRaw) {
          actionTargetUser = db.prepare('SELECT id, nama, username FROM users WHERE LOWER(nama) LIKE ? OR LOWER(username) LIKE ?').get(`%${targetRaw}%`, `%${targetRaw}%`);
          if (actionTargetUser) {
            try {
              db.prepare(`
                INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
                VALUES (?, ?, ?, 'nudge', ?, ?, 0)
              `).run(
                actionTargetUser.id,
                `Colekan dari ${sender_name}`,
                `🔔 ${sender_name} mencolek Anda di grup "${groupName}": "${cleanMessage}"`,
                `/?tab=chat&group=${group_id}`,
                JSON.stringify({ group_id: Number(group_id), sender_name, type: 'nudge' })
              );
            } catch (err) {
              console.warn('Failed to insert nudge notification:', err);
            }
          }
        }
      }

      const isAddMemberIntent = /(?:tambah(?:kan)?|masuk(?:kan)?|add)\s+(?:anggota\s+)?@?(\w+)/i.test(cleanMessage);
      let addedMemberUser: any = null;
      if (isAddMemberIntent) {
        const addMatch = cleanMessage.match(/(?:tambah(?:kan)?|masuk(?:kan)?|add)\s+(?:anggota\s+)?@?(\w+)/i);
        const targetRaw = addMatch ? addMatch[1].toLowerCase() : '';
        if (targetRaw) {
          addedMemberUser = db.prepare('SELECT id, nama, username FROM users WHERE LOWER(nama) LIKE ? OR LOWER(username) LIKE ?').get(`%${targetRaw}%`, `%${targetRaw}%`);
          if (addedMemberUser) {
            const exists = db.prepare('SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ?').get(Number(group_id), addedMemberUser.id);
            if (!exists) {
              try {
                db.prepare(`
                  INSERT INTO chat_group_members (group_id, user_id, role)
                  VALUES (?, ?, 'member')
                `).run(Number(group_id), addedMemberUser.id);
              } catch (err) {
                console.warn('Failed to add group member:', err);
              }
            }
          }
        }
      }

      let aiReasoning = '';
      resolvedModel = groupAiModel;

      try {
        const isErnie = groupAiModel.includes('ernie');
        const isNemotron = groupAiModel.includes('nemotron');

        const payload: any = {
          model: groupAiModel,
          messages: promptMessages,
          temperature,
          max_tokens: 2048,
        };

        if (isErnie) {
          if (groupThinkingMode === 'direct' || groupThinkingMode === 'none') {
            payload.reasoning = { exclude: true };
          } else {
            const effort = (groupThinkingMode === 'low' || groupThinkingMode === 'medium' || groupThinkingMode === 'high')
              ? groupThinkingMode
              : 'medium';
            payload.reasoning = {
              effort,
              exclude: false,
            };
          }
        } else if (isNemotron) {
          if (groupThinkingMode === 'direct' || groupThinkingMode === 'none') {
            payload.include_reasoning = false;
          } else {
            payload.include_reasoning = true;
          }
        }

        let aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://productivier.local',
            'X-Title': 'Productivier Team Suite',
          },
          body: JSON.stringify(payload),
        });

        if (aiRes.status === 429) {
          // Upstream rate limit backoff: wait 1.5s and retry once
          await new Promise((resolve) => setTimeout(resolve, 1500));
          aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://productivier.local',
              'X-Title': 'Productivier Team Suite',
            },
            body: JSON.stringify(payload),
          });

          if (aiRes.status === 429 && groupAiModel !== DEFAULT_AI_MODEL) {
            payload.model = DEFAULT_AI_MODEL;
            resolvedModel = DEFAULT_AI_MODEL;
            delete payload.reasoning;
            payload.include_reasoning = true;
            aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://productivier.local',
                'X-Title': 'Productivier Team Suite',
              },
              body: JSON.stringify(payload),
            });
          }
        }

        if (!aiRes.ok && groupAiModel !== DEFAULT_AI_MODEL) {
          payload.model = DEFAULT_AI_MODEL;
          resolvedModel = DEFAULT_AI_MODEL;
          delete payload.reasoning;
          payload.include_reasoning = true;
          aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://productivier.local',
              'X-Title': 'Productivier Team Suite',
            },
            body: JSON.stringify(payload),
          });
        }

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const choice = aiData.choices?.[0];
          aiReply = choice?.message?.content?.trim();
          if (aiReply) {
            aiReply = aiReply
              .replace(new RegExp(`^(\\[${escapedAiName}\\]|${escapedAiName}):\\s*`, 'i'), '')
              .trim();
          }
          const rawReasoning =
            choice?.message?.reasoning ||
            choice?.message?.reasoning_content ||
            choice?.reasoning ||
            aiData?.reasoning;
          if (rawReasoning && typeof rawReasoning === 'string') {
            aiReasoning = rawReasoning.trim();
          } else if (rawReasoning && typeof rawReasoning === 'object') {
            aiReasoning = (rawReasoning.text || rawReasoning.content || '').trim();
          }
          if (!aiReasoning && Array.isArray(choice?.message?.reasoning_details)) {
            const textParts = choice.message.reasoning_details
              .map((d: any) => (typeof d === 'string' ? d : d.text || d.content || ''))
              .filter(Boolean);
            if (textParts.length > 0) {
              aiReasoning = textParts.join('\n').trim();
            }
          }

          if (typeof aiReply === 'string') {
            const thinkMatches = Array.from(aiReply.matchAll(/<think>([\s\S]*?)<\/think>/gi));
            if (thinkMatches.length > 0) {
              if (!aiReasoning) {
                aiReasoning = thinkMatches.map((m) => m[1].trim()).filter(Boolean).join('\n\n');
              }
              aiReply = aiReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            }
            const unclosedThinkMatch = aiReply.match(/<think>([\s\S]*)$/i);
            if (unclosedThinkMatch) {
              if (!aiReasoning && unclosedThinkMatch[1].trim()) {
                aiReasoning = unclosedThinkMatch[1].trim();
              }
              aiReply = aiReply.replace(/<think>[\s\S]*$/gi, '').trim();
            }
          }
        } else {
          console.warn(`OpenRouter HTTP ${aiRes.status} in chat:`, await aiRes.text());
        }
      } catch (err) {
        console.warn('OpenRouter API call failed in chat, fallback locally:', err);
      }

      const lowerQ = (promptQuery || cleanMessage).toLowerCase();

      // Server-side Anti-Refusal Interceptor:
      // If AI output is empty or contains refusal phrases, replace with actionable response
      const refusalRegex = /(nggak bisa|tidak bisa|gak bisa|ngga bisa|tidak dapat|cuma bisa|hanya bisa|fitur.*(belum|tidak|gak)|(belum|tidak|gak).*fitur|bukan wewenang|tidak punya akses|tidak memiliki akses|tidak berwenang|belum mendukung|belum tersedia|hanya asisten|tidak memiliki kemampuan|tidak ada opsi|(?:cuma|hanya|harus|dilakukan secara)\s+manual)/i;

      if (!aiReply || refusalRegex.test(aiReply)) {
        if (isNudgeIntent && actionTargetUser) {
          aiReply = isFemale
            ? `Beres Bestie ${sender_name}! Gw udah langsung mencolek dan mengirimkan notifikasi pengingat ke **${actionTargetUser.nama}** di sistem. Notifikasinya udah aktif ya, Sis! 🚀`
            : `Beres Bro ${sender_name}! Gw udah langsung mencolek dan mengirimkan notifikasi pengingat ke **${actionTargetUser.nama}** di sistem. Notifikasinya udah aktif, Men! 🚀`;
        } else if (isAddMemberIntent && addedMemberUser) {
          aiReply = isFemale
            ? `Siap Bestie ${sender_name}! Rekan kita **${addedMemberUser.nama}** udah berhasil langsung gw masukkan ke grup chat "${groupName}" ini. Welcome aboard! 🎉`
            : `Siap Bro ${sender_name}! Rekan kita **${addedMemberUser.nama}** udah berhasil langsung gw masukkan ke grup chat "${groupName}" ini. Welcome aboard, Men! 🚀`;
        } else if (matchedTaggedProject) {
          const mp = matchedTaggedProject;
          const mpBlockers = db.prepare(`SELECT nama, kendala, solusi FROM realisasi WHERE project_id = ? AND kendala IS NOT NULL AND TRIM(kendala) != ''`).all(mp.id) as any[];
          const blockerSection = mpBlockers.length > 0
            ? mpBlockers.map(b => `⚠️ **Kendala (${b.nama})**: ${b.kendala}${b.solusi ? `\n   *Solusi*: ${b.solusi}` : ''}`).join('\n')
            : '✅ Tidak ada kendala aktif yang menghambat.';

          aiReply = isFemale
            ? `Hai Bestie ${sender_name}! Ini ulasan progres lengkap untuk proyek **${mp.nama_proyek}** (${mp.divisi}):\n\n` +
              `📊 **Capaian Progres**: **${mp.persentase}%** (Target: ${mp.target_total} ${mp.satuan || ''} · Tercapai: ${mp.total_realisasi} ${mp.satuan || ''})\n` +
              `⏳ **Status & Deadline**: ${mp.status} · ${mp.deadline ? `Target: ${mp.deadline}` : 'Belum ditentukan'}\n\n` +
              `**Kondisi Kendala & Lapangan:**\n${blockerSection}\n\n` +
              `Semangat ya Sis! Ada yang perlu kita sinkronkan atau breakdown lebih detail lagi? ✨`
            : `Hai Bro ${sender_name}! Ini ulasan progres lengkap untuk proyek **${mp.nama_proyek}** (${mp.divisi}):\n\n` +
              `📊 **Capaian Progres**: **${mp.persentase}%** (Target: ${mp.target_total} ${mp.satuan || ''} · Tercapai: ${mp.total_realisasi} ${mp.satuan || ''})\n` +
              `⏳ **Status & Deadline**: ${mp.status} · ${mp.deadline ? `Target: ${mp.deadline}` : 'Belum ditentukan'}\n\n` +
              `**Kondisi Kendala & Lapangan:**\n${blockerSection}\n\n` +
              `Gaspol Men! Ada tugas spesifik yang perlu kita eksekusi hari ini? 🚀`;
        } else if (connectedProjects.length > 0 && (lowerQ.includes('proyek') || lowerQ.includes('project') || lowerQ.includes('progres') || lowerQ.includes('progress'))) {
          const overview = connectedProjects.map(cp => `• **${cp.nama_proyek}** (${cp.divisi}): **${cp.persentase}%** · ${cp.status} ${cp.kendala_count > 0 ? `(⚠️ ${cp.kendala_count} Kendala)` : '(Aman)'}`).join('\n');
          aiReply = isFemale
            ? `Siap Bestie ${sender_name}! Ini status ${connectedProjects.length} proyek yang terkoneksi ke grup "${groupName}":\n\n${overview}\n\nKetik \`/project [Nama]\` untuk melihat detail mendalam per proyek ya Sis! ✨`
            : `Siap Bro ${sender_name}! Ini status ${connectedProjects.length} proyek yang terkoneksi ke grup "${groupName}":\n\n${overview}\n\nKetik \`/project [Nama]\` untuk ulasan mendalam per proyek, Men! 🚀`;
        } else if (lowerQ.includes('rekap') || lowerQ.includes('rangkum') || lowerQ.includes('ringkas')) {
          aiReply = isFemale
            ? `Siap Bestie ${sender_name}! Gw (${aiName}) udah baca seluruh riwayat percakapan di grup "${groupName}". Rangkuman intinya: tim sedang fokus mengawal deadline sprint dan memastikan seluruh realisasi harian terdata rapi. Semangat ya Sis, ada tugas spesifik yang mau kita rekap lagi? ✨`
            : `Siap Bro ${sender_name}! Gw (${aiName}) udah baca seluruh riwayat percakapan di grup "${groupName}". Rangkuman intinya: tim sedang fokus mengawal deadline sprint dan memastikan seluruh realisasi harian terdata rapi. Semangat, ada tugas spesifik yang mau kita rekap lagi, Men? 🚀`;
        } else if (lowerQ.includes('rekomendasi') || lowerQ.includes('prioritas') || lowerQ.includes('saran') || lowerQ.includes('tugas') || lowerQ.includes('sprint')) {
          aiReply = isFemale
            ? `Halo Bestie ${sender_name}! Berdasarkan konteks diskusi kita di "${groupName}", ini 3 prioritas utama dari ${aiName}: 1) Tuntaskan tugas-tugas yang mendekati deadline, 2) Validasi kendala teknis lebih awal, 3) Sinkronkan jadwal di kalender tim. Semangat terus ya Sis! ✨`
            : `Halo Bro ${sender_name}! Berdasarkan konteks diskusi kita di "${groupName}", ini 3 prioritas utama dari ${aiName}: 1) Tuntaskan tugas-tugas yang mendekati deadline, 2) Validasi kendala teknis lebih awal, 3) Sinkronkan jadwal di kalender tim. Gaspol bareng, Cuy! 🚀`;
        } else {
          aiReply = isFemale
            ? `Halo Kak ${sender_name}! Gw ${aiName} udah tangkap seluruh konteks diskusi tim di "${groupName}". Terkait "${promptQuery || cleanMessage}", gw siap support bestie biar koordinasi kita makin sat-set dan lancar jaya! ✨`
            : `Halo Bro ${sender_name}! Gw ${aiName} udah tangkap seluruh konteks diskusi tim di "${groupName}". Terkait "${promptQuery || cleanMessage}", gw siap support agar koordinasi kita makin sat-set & mantap, Men! 🚀`;
        }
      }

      // Gender persona safety filter: strictly eliminate male slang for female users
      if (isFemale && aiReply) {
        aiReply = aiReply
          .replace(/\bBro\b/g, 'Bestie')
          .replace(/\bbro\b/g, 'bestie')
          .replace(/\bBree\b/g, 'Sis')
          .replace(/\bbree\b/g, 'sis')
          .replace(/\bCuy\b/g, 'Beb')
          .replace(/\bcuy\b/g, 'beb')
          .replace(/,\s*men\b/gi, ', Sis')
          .replace(/\bMen!\b/g, 'Sis!')
          .replace(/\bMen\?\b/g, 'Sis?')
          .replace(/\bmen!\b/g, 'sis!')
          .replace(/\bmen\?\b/g, 'sis?')
          .replace(/\bMen\b/g, 'Sis');
      }

      // Save AI reply with reply_to_id and real native reasoning_text!
      db.prepare(`
        INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai, reply_to_id, reasoning_text)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(Number(group_id), null, aiName, aiReply, userMessageId, aiReasoning || '');

      // Notify group members about AI response
      try {
        const groupMembers = db
          .prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?')
          .all(Number(group_id)) as Array<{ user_id: number }>;
        const insAiNotif = db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
          VALUES (?, ?, ?, 'chat', ?, ?, 0)
        `);
        for (const gm of groupMembers) {
          insAiNotif.run(
            gm.user_id,
            `Balasan ${aiName} di ${groupName}`,
            `${aiName} membalas: "${aiReply.slice(0, 70)}${aiReply.length > 70 ? '...' : ''}"`,
            `/?tab=chat&group=${group_id}`,
            JSON.stringify({ group_id: Number(group_id), sender_name: aiName, is_ai: true })
          );
        }
      } catch (e) {
        console.warn('Failed to insert AI chat notification:', e);
      }
    }

    return NextResponse.json({ success: true, messageId: userMessageId, model: resolvedModel });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal mengirim pesan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
