import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { executeActionRequest } from '../actions/route';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_AI_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
const ALLOWED_AI_MODELS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'baidu/ernie-5.5-flash-preview:free',
];

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_project',
      description: 'Membuat proyek baru ke dalam database Productivier.',
      parameters: {
        type: 'object',
        properties: {
          nama_proyek: { type: 'string', description: 'Nama proyek baru' },
          target_total: { type: 'number', description: 'Target kuantitas total (misal 100, 50)' },
          satuan: { type: 'string', description: 'Satuan tugas (misal: Tugas, Modul, Konten, Desain)' },
          divisi: { type: 'string', description: 'Divisi proyek (misal: Operasional, Kreatif, Marketing, IT)' },
          deadline: { type: 'string', description: 'Tanggal deadline YYYY-MM-DD' },
          pic_id: { type: 'number', description: 'ID user PIC penanggung jawab' },
          member_ids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Daftar ID anggota tim yang ikut tergabung dalam proyek & grup chat',
          },
        },
        required: ['nama_proyek', 'target_total'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_chat_group',
      description: 'Membuat grup obrolan (chat) tim baru.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama grup chat' },
          description: { type: 'string', description: 'Deskripsi singkat ruang diskusi' },
          project_id: { type: 'number', description: 'ID proyek terkait (opsional)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_user',
      description: 'Mendaftarkan anggota tim baru ke dalam database Productivier.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Username login (huruf kecil tanpa spasi)' },
          password: { type: 'string', description: 'Password akun awal' },
          nama: { type: 'string', description: 'Nama lengkap anggota' },
          divisi: { type: 'string', description: 'Divisi kerja' },
          role: { type: 'string', enum: ['admin', 'karyawan'], description: 'Peran akun' },
          gender: { type: 'string', enum: ['male', 'female'], description: 'Gender akun' },
        },
        required: ['username', 'nama'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_ui',
      description: 'Menavigasi antarmuka pengguna web secara otonom (pindah tab, buka in-page detail proyek, buka grup chat, dsb).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['open_project', 'navigate_tab', 'open_chat_group', 'open_note'],
            description: 'Jenis aksi kontrol UI',
          },
          tab: {
            type: 'string',
            enum: ['home', 'projects', 'calendar', 'notes', 'chat', 'input', 'reports', 'profile'],
            description: 'Tab tujuan',
          },
          project_id: { type: 'number', description: 'ID proyek jika membuka proyek' },
          project_name: { type: 'string', description: 'Nama proyek terkait' },
          group_id: { type: 'number', description: 'ID grup chat jika membuka chat' },
          filter_view: { type: 'string', enum: ['pribadi', 'tim'], description: 'Mode view tampilan' },
          reason: { type: 'string', description: 'Alasan otomasi UI dilakukan' },
        },
        required: ['action', 'tab'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Membuat atau mencatat tugas/realisasi baru ke dalam database Productivier.',
      parameters: {
        type: 'object',
        properties: {
          aktivitas: { type: 'string', description: 'Deskripsi aktivitas kerja/tugas' },
          target: { type: 'number', description: 'Target kuantitas kerja (default 1)' },
          realisasi: { type: 'number', description: 'Realisasi capaian saat ini (default sama dengan target atau 0)' },
          satuan: { type: 'string', description: 'Satuan tugas (misal: Tugas, Konten, Modul, Desain)' },
          project_id: { type: 'number', description: 'ID proyek terkait jika ada' },
          tanggal: { type: 'string', description: 'Tanggal YYYY-MM-DD (default hari ini)' },
        },
        required: ['aktivitas', 'target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_note',
      description: 'Membuat memo atau catatan cepat baru ke dalam database Notes.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Judul catatan/memo' },
          content: { type: 'string', description: 'Isi lengkap catatan' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Label tag (misal: ["ide", "rapat", "urgent"])',
          },
          color: {
            type: 'string',
            description: 'Warna kartu pastel (#D2F27C lime, #DCD4FB purple, #CBD5E1 slate, #FFFFFF white)',
          },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Menjadwalkan agenda baru atau deadline ke kalender tim.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Nama acara / agenda / deadline' },
          date: { type: 'string', description: 'Tanggal YYYY-MM-DD' },
          start_time: { type: 'string', description: 'Jam mulai (format HH:mm, misal: 10:00)' },
          end_time: { type: 'string', description: 'Jam selesai (format HH:mm, misal: 11:30)' },
          category: {
            type: 'string',
            enum: ['activity', 'meeting', 'deadline', 'milestone'],
            description: 'Kategori event',
          },
          description: { type: 'string', description: 'Keterangan tambahan agenda' },
        },
        required: ['title', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_projects_overview',
      description: 'Mengambil ringkasan progres seluruh proyek aktif tim saat ini.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_team_status',
      description: 'Mengambil status kepatuhan input realisasi harian anggota tim hari ini.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_productivity_recommendations',
      description: 'Memberikan analisis mendalam dan rekomendasi taktis produktivitas tim berdasarkan data beban kerja saat ini.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_chat_group',
      description: 'Menghapus satu grup obrolan tertentu atau SEMUA grup obrolan tim (operasi destruktif/berbahaya). Memerlukan konfirmasi kartu izin [Izinkan / Tolak].',
      parameters: {
        type: 'object',
        properties: {
          group_id: { type: 'number', description: 'ID grup chat spesifik yang ingin dihapus' },
          all: { type: 'boolean', description: 'Set true jika pengguna ingin menghapus SEMUA grup obrolan tim' },
          target_name: { type: 'string', description: 'Nama atau kata kunci grup yang ingin dihapus' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_project',
      description: 'Menghapus satu proyek tertentu atau SEMUA proyek di database (operasi berbahaya/destruktif). Membutuhkan konfirmasi pengguna.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID proyek yang ingin dihapus' },
          all: { type: 'boolean', description: 'Set true jika ingin menghapus SEMUA proyek tim' },
          target_name: { type: 'string', description: 'Nama atau kata kunci judul proyek yang ingin dihapus' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Menghapus satu tugas atau SEMUA tugas di database realisasi (operasi berbahaya/destruktif). Membutuhkan konfirmasi pengguna.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'ID tugas yang ingin dihapus' },
          all: { type: 'boolean', description: 'Set true jika ingin menghapus SEMUA tugas tim' },
          target_name: { type: 'string', description: 'Nama aktivitas atau kata kunci tugas yang ingin dihapus' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_note',
      description: 'Menghapus satu catatan memo atau SEMUA catatan di Notes (operasi destruktif). Membutuhkan konfirmasi pengguna.',
      parameters: {
        type: 'object',
        properties: {
          note_id: { type: 'number', description: 'ID catatan yang ingin dihapus' },
          all: { type: 'boolean', description: 'Set true jika ingin menghapus SEMUA memo' },
          target_name: { type: 'string', description: 'Judul atau kata kunci catatan memo yang ingin dihapus' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_event',
      description: 'Menghapus satu agenda atau SEMUA agenda di kalender tim (operasi destruktif). Membutuhkan konfirmasi pengguna.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'number', description: 'ID agenda kalender yang ingin dihapus' },
          all: { type: 'boolean', description: 'Set true jika ingin menghapus SEMUA agenda kalender' },
          target_name: { type: 'string', description: 'Judul atau kata kunci agenda yang ingin dihapus' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_user',
      description: 'Menghapus akun pengguna dari database (operasi destruktif). Membutuhkan konfirmasi pengguna.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'number', description: 'ID akun user yang akan dihapus' },
          username: { type: 'string', description: 'Username akun user yang akan dihapus' },
          nama: { type: 'string', description: 'Nama pengguna yang akan dihapus' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_project_status',
      description: 'Memperbarui status proyek (aktif, selesai, diarsipkan, dsb).',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID proyek yang statusnya ingin diubah' },
          target_name: { type: 'string', description: 'Nama atau kata kunci judul proyek' },
          status: { type: 'string', enum: ['aktif', 'selesai', 'arsip', 'tertunda'], description: 'Status baru proyek' },
        },
        required: ['status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Memperbarui data aktivitas, target, realisasi, atau status tugas.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'ID tugas yang akan diperbarui' },
          target_name: { type: 'string', description: 'Nama aktivitas atau kata kunci tugas yang akan diperbarui' },
          aktivitas: { type: 'string', description: 'Nama aktivitas baru' },
          target: { type: 'number', description: 'Target kuantitas baru' },
          realisasi: { type: 'number', description: 'Realisasi capaian baru' },
          status: { type: 'string', description: 'Status capaian tugas' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_note',
      description: 'Memperbarui judul, isi, atau status pin catatan memo di Notes.',
      parameters: {
        type: 'object',
        properties: {
          note_id: { type: 'number', description: 'ID catatan yang akan diperbarui' },
          target_name: { type: 'string', description: 'Judul atau kata kunci catatan yang akan diperbarui' },
          title: { type: 'string', description: 'Judul baru catatan' },
          content: { type: 'string', description: 'Isi baru catatan' },
          pinned: { type: 'number', description: '1 untuk pin, 0 untuk unpin' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_project_link',
      description: 'Menambahkan link resource baru (Google Drive, Figma, Notion, GitHub, Sheets) ke dalam Resource Hub proyek.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID proyek tujuan (opsional jika nama proyek terdeteksi)' },
          project_name: { type: 'string', description: 'Nama atau kata kunci judul proyek tujuan' },
          title: { type: 'string', description: 'Judul tautan (misal: "Link Figma Desain Feed", "Folder Google Drive")' },
          url: { type: 'string', description: 'URL link lengkap (https://...)' },
          platform: {
            type: 'string',
            enum: ['drive', 'figma', 'notion', 'github', 'sheets', 'other'],
            description: 'Platform tautan (opsional, auto-detect dari URL)',
          },
        },
        required: ['title', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_project_link',
      description: 'Menghapus link dari Resource Hub proyek.',
      parameters: {
        type: 'object',
        properties: {
          link_id: { type: 'number', description: 'ID link yang ingin dihapus' },
          project_id: { type: 'number', description: 'ID proyek terkait (opsional)' },
          target_title: { type: 'string', description: 'Judul link yang ingin dihapus' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_client_note',
      description: 'Mencatat feedback, revisi, pertanyaan, atau apresiasi baru dari portal publik klien.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID proyek terkait (opsional jika nama proyek terdeteksi)' },
          project_name: { type: 'string', description: 'Nama proyek terkait' },
          author_name: { type: 'string', description: 'Nama author / klien pemberi catatan' },
          author_role: { type: 'string', enum: ['client', 'team'], description: 'Peran author (default client)' },
          message: { type: 'string', description: 'Isi catatan, feedback, atau revisi dari klien' },
          category: {
            type: 'string',
            enum: ['feedback', 'revisi', 'pertanyaan', 'apresiasi'],
            description: 'Kategori catatan klien',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_client_note_status',
      description: 'Memperbarui status catatan atau revisi klien (open, in_progress, resolved).',
      parameters: {
        type: 'object',
        properties: {
          note_id: { type: 'number', description: 'ID catatan klien yang ingin diubah statusnya' },
          project_id: { type: 'number', description: 'ID proyek terkait (opsional)' },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved'], description: 'Status baru' },
          search_keyword: { type: 'string', description: 'Kata kunci pencarian pesan catatan klien' },
        },
        required: ['status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_note_pin',
      description: 'Menyematkan (PIN) catatan penting di bagian atas atau melepas pin memo di tab Notes.',
      parameters: {
        type: 'object',
        properties: {
          note_id: { type: 'number', description: 'ID catatan memo yang ingin di-pin / unpin' },
          target_title: { type: 'string', description: 'Judul catatan memo yang dicari' },
          pinned: { type: 'boolean', description: 'true untuk PIN, false untuk UNPIN (toggle jika tidak diisi)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_note_checklist',
      description: 'Mencentang atau mengubah status item checklist to-do di dalam catatan memo, atau menambah checklist item baru.',
      parameters: {
        type: 'object',
        properties: {
          note_id: { type: 'number', description: 'ID catatan memo' },
          target_title: { type: 'string', description: 'Judul catatan memo' },
          item_text: { type: 'string', description: 'Teks atau nomor item checklist yang diubah' },
          done: { type: 'boolean', description: 'Status selesai item checklist (true = selesai/dicentang, false = belum)' },
        },
        required: ['item_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_calendar_event',
      description: 'Menjadwalkan ulang (reschedule) atau mengubah jam, tanggal, atau judul agenda acara di kalender tim.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'number', description: 'ID agenda yang ingin di-reschedule' },
          target_title: { type: 'string', description: 'Judul agenda yang dicari jika ID tidak diketahui' },
          date: { type: 'string', description: 'Tanggal baru YYYY-MM-DD' },
          start_time: { type: 'string', description: 'Jam mulai baru (format HH:mm, misal: 14:00)' },
          end_time: { type: 'string', description: 'Jam selesai baru (format HH:mm, misal: 15:30)' },
          title: { type: 'string', description: 'Judul baru acara' },
          description: { type: 'string', description: 'Deskripsi baru acara' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_unread_notifications',
      description: 'Mengambil daftar notifikasi baru yang belum dibaca dari lonceng notifikasi navbar.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_all_notifications_read',
      description: 'Menandai semua notifikasi pengguna sebagai telah dibaca (is_read = 1).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_user',
      description: 'Memperbarui data akun tim (nama lengkap, divisi, role, gender).',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'number', description: 'ID akun user' },
          username: { type: 'string', description: 'Username akun jika ID tidak diketahui' },
          target_name: { type: 'string', description: 'Nama user yang dicari' },
          nama: { type: 'string', description: 'Nama lengkap baru' },
          divisi: { type: 'string', description: 'Divisi baru (misal: Operasional, Kreatif, Marketing, IT)' },
          role: { type: 'string', enum: ['admin', 'karyawan'], description: 'Peran akun' },
          gender: { type: 'string', enum: ['male', 'female'], description: 'Gender akun' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'report_task_blocker',
      description: 'Mencatat kendala/blocker dan rencana solusi pada tugas tertentu di daftar realisasi.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'ID tugas yang terhalang kendala' },
          target_name: { type: 'string', description: 'Nama aktivitas tugas' },
          kendala: { type: 'string', description: 'Rincian kendala atau blocker yang dialami' },
          solusi: { type: 'string', description: 'Rencana tindakan atau solusi penanganan' },
        },
        required: ['kendala'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_task_blocker',
      description: 'Menyelesaikan kendala/blocker pada tugas tertentu dan mencatat solusi akhirnya.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'ID tugas yang kendalanya sudah beres' },
          target_name: { type: 'string', description: 'Nama tugas yang dicari' },
          solusi: { type: 'string', description: 'Solusi yang berhasil mengatasi kendala' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sprint_analytics_summary',
      description: 'Mengambil ringkasan analitik sprint eksekutif: skor kecepatan tim, ranking divisi tercepat/terlambat, bottleneck, dan tingkat penyelesaian tugas.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nudge_user',
      description: 'Mengirim notifikasi colek/pengingat langsung ke anggota tim tertentu.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'number', description: 'ID user yang dicolek' },
          nama: { type: 'string', description: 'Nama atau username anggota tim' },
          pesan: { type: 'string', description: 'Pesan pengingat singkat' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_chat_message',
      description: 'Mengirim pesan obrolan ke salah satu ruang chat grup tim.',
      parameters: {
        type: 'object',
        properties: {
          group_id: { type: 'number', description: 'ID grup chat tujuan' },
          group_name: { type: 'string', description: 'Nama grup chat tujuan' },
          message: { type: 'string', description: 'Isi pesan yang dikirim' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_group_member',
      description: 'Menambahkan anggota tim ke grup obrolan chat.',
      parameters: {
        type: 'object',
        properties: {
          group_id: { type: 'number', description: 'ID grup chat' },
          group_name: { type: 'string', description: 'Nama grup chat' },
          user_id: { type: 'number', description: 'ID user yang dimasukkan' },
          username: { type: 'string', description: 'Username anggota' },
          role: { type: 'string', enum: ['member', 'admin'], default: 'member', description: 'Peran dalam grup (default member)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_group_member',
      description: 'Mengeluarkan anggota dari grup obrolan chat.',
      parameters: {
        type: 'object',
        properties: {
          group_id: { type: 'number', description: 'ID grup chat' },
          group_name: { type: 'string', description: 'Nama grup chat' },
          user_id: { type: 'number', description: 'ID user yang dikeluarkan' },
          username: { type: 'string', description: 'Username anggota' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_tasks',
      description: 'Menyusun perencanaan tugas (task planning / sprint breakdown) multi-langkah ke dalam proyek secara langsung.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID proyek yang akan direncanakan tugasnya' },
          project_name: { type: 'string', description: 'Nama proyek tujuan' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                aktivitas: { type: 'string', description: 'Nama aktivitas/tugas' },
                target: { type: 'number', description: 'Target kuantitas (default: 1)' },
                satuan: { type: 'string', description: 'Satuan tugas (misal: Tugas, Modul, Desain)' },
                tanggal: { type: 'string', description: 'Tanggal YYYY-MM-DD' },
                user_id: { type: 'number', description: 'ID user yang ditugaskan (opsional)' },
              },
              required: ['aktivitas'],
            },
            description: 'Daftar rincian tugas kerja dalam task planning',
          },
        },
      },
    },
  },
];

function registerPendingAction(
  db: any,
  userId: number,
  actionType: string,
  description: string,
  payload: any,
  notifTitle: string,
  notifMsg: string
) {
  const insReq = db.prepare(`
    INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(userId, actionType, description, JSON.stringify(payload));

  const reqId = Number(insReq.lastInsertRowid);

  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
    VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
  `).run(
    userId,
    notifTitle,
    notifMsg,
    '/api/ai/actions',
    JSON.stringify({ action_request_id: reqId, action_type: actionType })
  );

  return {
    id: reqId,
    user_id: userId,
    action_type: actionType,
    description,
    payload_json: JSON.stringify(payload),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

function cleanSearchQuery(text: string, domainStopWords: string[] = []): string {
  if (!text) return '';
  let str = text.toLowerCase();
  const stopWords = [
    'hapus', 'delete', 'buang', 'bersihkan', 'wipe', 'remove', 'drop', 'batalkan', 'clear',
    'tolong', 'dong', 'bisa', 'minta', 'tolongin', 'mohon', 'gw', 'gua', 'gue', 'lu', 'lo',
    'yang', 'bernama', 'judul', 'nama', 'dengan', 'id', 'ke', 'dari', 'semua', 'all', 'seluruh', 'total',
    ...domainStopWords,
  ];
  for (const sw of stopWords) {
    const reg = new RegExp(`\\b${sw}\\b`, 'gi');
    str = str.replace(reg, ' ');
  }
  return str.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchEntityScore(candidateName: string, queryClean: string): number {
  if (!candidateName || !queryClean) return 0;
  const cLower = candidateName.toLowerCase();
  const qLower = queryClean.toLowerCase();
  if (cLower === qLower) return 100;
  if (cLower.includes(qLower)) return 80;
  if (qLower.includes(cLower)) return 70;
  const tokens = qLower.split(' ').filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;
  let matchedTokens = 0;
  for (const t of tokens) {
    if (cLower.includes(t)) matchedTokens++;
  }
  const ratio = matchedTokens / tokens.length;
  return ratio >= 0.5 ? Math.round(ratio * 60) : 0;
}

function extractEntityId(text: string, entityKeywords: string[]): number | null {
  if (!text) return null;
  const kw = entityKeywords.join('|');
  const kwRegex = new RegExp(`(?:${kw})\\s*(?:id|#|no|nomor)?\\s*(\\d+)`, 'i');
  const kwMatch = text.match(kwRegex);
  if (kwMatch) return Number(kwMatch[1]);

  const genRegex = /\b(?:id|#|no|nomor)\s*[:=]?\s*(\d+)\b/i;
  const genMatch = text.match(genRegex);
  if (genMatch) return Number(genMatch[1]);

  return null;
}

function findChatGroup(db: any, query: { id?: any; name?: string; text?: string }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['grup', 'group', 'room', 'obrolan', 'chat']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, name FROM chat_groups WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  const all = db.prepare('SELECT id, name FROM chat_groups').all() as any[];
  if (!all.length) return null;

  const rawSearch = (query.name || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((g: any) => g.name.toLowerCase() === rawSearch || g.name.toLowerCase().includes(rawSearch) || rawSearch.includes(g.name.toLowerCase()));
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || query.name || '', ['grup', 'group', 'obrolan', 'room']);
  if (!cleaned) return null;

  let bestMatch: any = null;
  let bestScore = 0;
  for (const g of all) {
    const score = matchEntityScore(g.name, cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = g;
    }
  }
  return bestScore >= 40 ? bestMatch : null;
}

function findProject(db: any, query: { id?: any; name?: string; text?: string }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['proyek', 'project']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, nama_proyek FROM projects WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  const all = db.prepare('SELECT id, nama_proyek FROM projects').all() as any[];
  if (!all.length) return null;

  const rawSearch = (query.name || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((p: any) => p.nama_proyek.toLowerCase() === rawSearch || p.nama_proyek.toLowerCase().includes(rawSearch) || rawSearch.includes(p.nama_proyek.toLowerCase()));
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || query.name || '', ['proyek', 'project']);
  if (!cleaned) return null;

  let bestMatch: any = null;
  let bestScore = 0;
  for (const p of all) {
    const score = matchEntityScore(p.nama_proyek, cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }
  return bestScore >= 40 ? bestMatch : null;
}

function findTask(db: any, query: { id?: any; name?: string; text?: string }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['tugas', 'task', 'realisasi', 'kendala', 'blocker']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, aktivitas FROM realisasi WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  const all = db.prepare('SELECT id, aktivitas FROM realisasi').all() as any[];
  if (!all.length) return null;

  const rawSearch = (query.name || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((t: any) => t.aktivitas.toLowerCase() === rawSearch || t.aktivitas.toLowerCase().includes(rawSearch) || rawSearch.includes(t.aktivitas.toLowerCase()));
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || query.name || '', ['tugas', 'task', 'realisasi']);
  if (!cleaned) return null;

  let bestMatch: any = null;
  let bestScore = 0;
  for (const t of all) {
    const score = matchEntityScore(t.aktivitas, cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = t;
    }
  }
  return bestScore >= 40 ? bestMatch : null;
}

function findNote(db: any, query: { id?: any; name?: string; text?: string }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['note', 'notes', 'memo', 'catatan', 'sop', 'checklist']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  const all = db.prepare('SELECT id, title FROM notes').all() as any[];
  if (!all.length) return null;

  const rawSearch = (query.name || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((n: any) => n.title.toLowerCase() === rawSearch || n.title.toLowerCase().includes(rawSearch) || rawSearch.includes(n.title.toLowerCase()));
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || query.name || '', ['note', 'notes', 'memo', 'catatan']);
  if (!cleaned) return null;

  let bestMatch: any = null;
  let bestScore = 0;
  for (const n of all) {
    const score = matchEntityScore(n.title, cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = n;
    }
  }
  return bestScore >= 40 ? bestMatch : null;
}

function findCalendarEvent(db: any, query: { id?: any; name?: string; text?: string }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['agenda', 'kalender', 'event', 'jadwal', 'rapat', 'meeting', 'acara']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, title, date, start_time, end_time FROM calendar_events WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  const all = db.prepare('SELECT id, title, date, start_time, end_time FROM calendar_events').all() as any[];
  if (!all.length) return null;

  const rawSearch = (query.name || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((e: any) => e.title.toLowerCase() === rawSearch || e.title.toLowerCase().includes(rawSearch) || rawSearch.includes(e.title.toLowerCase()));
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || query.name || '', ['agenda', 'kalender', 'event', 'jadwal']);
  if (!cleaned) return null;

  let bestMatch: any = null;
  let bestScore = 0;
  for (const e of all) {
    const score = matchEntityScore(e.title, cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = e;
    }
  }
  return bestScore >= 40 ? bestMatch : null;
}

function findUser(db: any, query: { id?: any; username?: string; name?: string; text?: string }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['user', 'pengguna', 'anggota', 'karyawan', 'akun', 'member']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, username, nama, divisi, role, gender FROM users WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  const all = db.prepare('SELECT id, username, nama, divisi, role, gender FROM users').all() as any[];
  if (!all.length) return null;

  const rawSearch = (query.username || query.name || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((u: any) =>
      u.username.toLowerCase() === rawSearch ||
      u.nama.toLowerCase() === rawSearch ||
      u.username.toLowerCase().includes(rawSearch) ||
      u.nama.toLowerCase().includes(rawSearch)
    );
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || '', ['user', 'pengguna', 'anggota', 'karyawan', 'akun', 'member']);
  const cleanNoSpace = cleaned.replace(/\s+/g, '');
  if (!cleaned && !cleanNoSpace) return null;

  for (const u of all) {
    const uLower = u.username.toLowerCase();
    const nLower = u.nama.toLowerCase();
    if (
      uLower === cleanNoSpace ||
      uLower === cleaned ||
      nLower === cleaned ||
      (cleaned && (uLower.includes(cleaned) || nLower.includes(cleaned) || cleaned.includes(uLower) || cleaned.includes(nLower))) ||
      (cleanNoSpace && (uLower.includes(cleanNoSpace) || cleanNoSpace.includes(uLower)))
    ) {
      return u;
    }
  }

  return null;
}

function findProjectLink(db: any, query: { id?: any; title?: string; text?: string; projectId?: any }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['link', 'tautan', 'resource', 'figma', 'drive', 'notion', 'github', 'sheets']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, project_id, title, url, platform FROM project_links WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  let sql = 'SELECT id, project_id, title, url, platform FROM project_links';
  const params: any[] = [];
  if (query.projectId) {
    sql += ' WHERE project_id = ?';
    params.push(Number(query.projectId));
  }
  sql += ' ORDER BY id DESC';
  const all = db.prepare(sql).all(...params) as any[];
  if (!all.length) return null;

  const rawSearch = (query.title || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((l: any) => l.title.toLowerCase() === rawSearch || l.title.toLowerCase().includes(rawSearch) || rawSearch.includes(l.title.toLowerCase()));
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || query.title || '', ['link', 'tautan', 'figma', 'drive', 'notion', 'github', 'sheets']);
  if (!cleaned) return query.text ? null : all[0];

  let bestMatch: any = null;
  let bestScore = 0;
  for (const l of all) {
    const score = matchEntityScore(l.title, cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = l;
    }
  }
  return bestScore >= 30 ? bestMatch : (query.text ? null : all[0]);
}

function findClientNote(db: any, query: { id?: any; keyword?: string; text?: string; projectId?: any }) {
  let targetId = query.id ? Number(query.id) : null;
  if (!targetId && query.text) {
    targetId = extractEntityId(query.text, ['klien', 'client', 'revisi', 'feedback', 'catatan', 'portal', 'note']);
  }
  if (targetId) {
    const row = db.prepare('SELECT id, project_id, author_name, author_role, message, category, status FROM project_client_notes WHERE id = ?').get(targetId) as any;
    if (row) return row;
  }
  let sql = 'SELECT id, project_id, author_name, author_role, message, category, status FROM project_client_notes';
  const params: any[] = [];
  if (query.projectId) {
    sql += ' WHERE project_id = ?';
    params.push(Number(query.projectId));
  }
  sql += ' ORDER BY id DESC';
  const all = db.prepare(sql).all(...params) as any[];
  if (!all.length) return null;

  const rawSearch = (query.keyword || '').toLowerCase().trim();
  if (rawSearch) {
    const direct = all.find((n: any) => n.message.toLowerCase().includes(rawSearch) || n.author_name.toLowerCase().includes(rawSearch));
    if (direct) return direct;
  }

  const cleaned = cleanSearchQuery(query.text || query.keyword || '', ['revisi', 'feedback', 'catatan', 'klien', 'client', 'portal', 'note']);
  if (!cleaned) return query.text ? null : all[0];

  let bestMatch: any = null;
  let bestScore = 0;
  for (const n of all) {
    const score = matchEntityScore(n.message, cleaned) + matchEntityScore(n.author_name, cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = n;
    }
  }
  return bestScore >= 20 ? bestMatch : (query.text ? null : all[0]);
}

function computeSprintAnalytics(db: any) {
  const allRealisasi = db.prepare(`
    SELECT r.*, p.nama_proyek
    FROM realisasi r
    LEFT JOIN projects p ON r.project_id = p.id
  `).all() as any[];

  const totalTasks = allRealisasi.length;
  const tercapaiTasks = allRealisasi.filter((r: any) => r.status === 'Tercapai').length;
  const avgPct = totalTasks > 0 ? Math.round(allRealisasi.reduce((sum: number, r: any) => sum + (Number(r.persentase) || 0), 0) / totalTasks) : 0;
  const activeBlockers = allRealisasi.filter((r: any) => r.kendala && r.kendala.trim() !== '');

  const divisionMap = new Map<string, { total: number; avgPct: number; tercapai: number; blockers: number }>();
  for (const r of allRealisasi) {
    const div = r.divisi || 'Umum';
    const cur = divisionMap.get(div) || { total: 0, avgPct: 0, tercapai: 0, blockers: 0 };
    cur.total++;
    cur.avgPct += Number(r.persentase) || 0;
    if (r.status === 'Tercapai') cur.tercapai++;
    if (r.kendala && r.kendala.trim() !== '') cur.blockers++;
    divisionMap.set(div, cur);
  }

  const divisionStats: Array<{ divisi: string; total: number; avgPct: number; tercapai: number; blockers: number }> = [];
  divisionMap.forEach((val, div) => {
    divisionStats.push({
      divisi: div,
      total: val.total,
      avgPct: Math.round(val.avgPct / (val.total || 1)),
      tercapai: val.tercapai,
      blockers: val.blockers,
    });
  });

  divisionStats.sort((a, b) => b.avgPct - a.avgPct);
  const fastestDiv = divisionStats[0] || { divisi: 'Operasional', avgPct: 100, total: 0, tercapai: 0, blockers: 0 };
  const slowestDiv = divisionStats[divisionStats.length - 1] || { divisi: 'Kreatif', avgPct: 50, total: 0, tercapai: 0, blockers: 0 };

  return {
    totalTasks,
    tercapaiTasks,
    avgPct,
    activeBlockers,
    divisionStats,
    fastestDiv,
    slowestDiv,
  };
}

function parseChecklistTarget(lastUserMsg: string): { itemIdx: number; itemText: string; isExplicitDone: boolean | null } {
  const low = lastUserMsg.toLowerCase();
  let isExplicitDone: boolean | null = null;
  if (low.includes('uncheck') || low.includes('belum') || low.includes('batal') || low.includes('pending') || low.includes('false')) {
    isExplicitDone = false;
  } else if (low.includes('centang') || low.includes('selesai') || low.includes('beres') || low.includes('done') || low.includes('true') || low.includes('ceklist')) {
    isExplicitDone = true;
  }

  const itemMatch = lastUserMsg.match(/(?:item|checklist|to-?do|nomor|ke-?)\s*#?\s*(\d+)/i);
  let itemIdx = itemMatch ? Number(itemMatch[1]) - 1 : -1;

  if (itemIdx < 0) {
    const withoutNoteKw = lastUserMsg.replace(/(?:note|catatan|memo)\s*#?\s*\d+/gi, '');
    const numMatch = withoutNoteKw.match(/\b(\d+)\b/);
    if (numMatch) {
      itemIdx = Number(numMatch[1]) - 1;
    }
  }

  const cleanedItemText = lastUserMsg
    .replace(/(?:centang|uncheck|update|checklist|to-?do|catatan|memo|note|item|nomor|ke-?|\d+|di|pada|jadi|done|selesai|beres|tolong|dong|bro|bestie)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { itemIdx, itemText: cleanedItemText, isExplicitDone };
}

function parseCalendarReschedule(lastUserMsg: string, currentEvent: any): { date: string; startTime: string; endTime: string; title: string | null } {
  const low = lastUserMsg.toLowerCase();
  let date = currentEvent.date;
  const dateMatch = lastUserMsg.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    date = dateMatch[1];
  } else if (low.includes('lusa')) {
    date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  } else if (low.includes('besok')) {
    date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  }

  const times = [...lastUserMsg.matchAll(/\b(\d{1,2}[:.]\d{2})\b/g)].map((m) => m[1].replace('.', ':'));
  const startTime = times[0] ? (times[0].length === 4 ? `0${times[0]}` : times[0]) : currentEvent.start_time;
  const endTime = times[1] ? (times[1].length === 4 ? `0${times[1]}` : times[1]) : currentEvent.end_time;

  let title: string | null = null;
  const titleMatch = lastUserMsg.match(/(?:ganti judul|ubah judul|judul baru|nama baru)\s*(?:menjadi|jadi)?\s*[:"']?([^"'\n,]+)/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  return { date, startTime, endTime, title };
}

function parseUserUpdate(lastUserMsg: string, currentUser: any): { nama: string | null; divisi: string; role: string; gender: string } {
  const low = lastUserMsg.toLowerCase();

  let divisi = currentUser.divisi;
  if (low.includes('operasional')) divisi = 'Operasional';
  else if (low.includes('kreatif')) divisi = 'Kreatif';
  else if (low.includes('marketing')) divisi = 'Marketing';
  else if (low.includes('it')) divisi = 'IT';
  else if (low.includes('management')) divisi = 'Management';

  let role = currentUser.role;
  if (low.includes('admin')) role = 'admin';
  else if (low.includes('karyawan') || low.includes('staff') || low.includes('member')) role = 'karyawan';

  let gender = currentUser.gender || 'male';
  if (low.includes('female') || low.includes('wanita') || low.includes('perempuan')) gender = 'female';
  else if (low.includes('male') || low.includes('pria') || low.includes('laki-laki') || low.includes('cowok')) gender = 'male';

  let nama: string | null = null;
  const namaMatch = lastUserMsg.match(/(?:nama|nama baru|ganti nama)\s*(?:menjadi|jadi)?\s*[:"']?([A-Za-z0-9\s()]+?)(?=\s+(?:divisi|role|gender|jadi|ke|$))/i);
  if (namaMatch && namaMatch[1].trim() && !['baru', 'user', 'akun', 'tim'].includes(namaMatch[1].trim().toLowerCase())) {
    nama = namaMatch[1].trim();
  }

  return { nama, divisi, role, gender };
}

function parseTaskBlocker(lastUserMsg: string): { isResolve: boolean; kendala: string; solusi: string } {
  const low = lastUserMsg.toLowerCase();
  const isResolve = low.includes('teratasi') || low.includes('selesai') || low.includes('resolve') || low.includes('beres') || low.includes('unblock');

  const solMatch = lastUserMsg.match(/(?:solusi|solusinya|penanganan|cara|dengan)\s*[:=]?\s*(.+)/i);
  const solusi = solMatch ? solMatch[1].trim() : (isResolve ? 'Kendala telah diselesaikan dan teratasi' : '');

  const kendalaMatch = lastUserMsg.match(/(?:kendala|blocker|masalah)\s*[:=]?\s*([^,\n.]+)/i);
  let kendala = kendalaMatch ? kendalaMatch[1].trim() : '';
  if (!kendala && !isResolve) {
    kendala = lastUserMsg.replace(/catat|kendala|blocker|masalah|pada|di|tugas|task|tolong|dong|bro|bestie|\d+/gi, ' ').replace(/\s+/g, ' ').trim() || 'Terhalang kendala teknis';
  }

  return { isResolve, kendala, solusi };
}

function parseClientNoteUpdate(lastUserMsg: string): string {
  const low = lastUserMsg.toLowerCase();
  if (low.includes('in_progress') || low.includes('in progress') || low.includes('proses') || low.includes('sedang dikerjakan')) {
    return 'in_progress';
  }
  if (low.includes('open') || low.includes('buka') || low.includes('reopen')) {
    return 'open';
  }
  return 'resolved';
}

function handleDangerousAction(
  db: any,
  userId: number,
  sapaan: string,
  actionName: string,
  args: any,
  rawUserText: string
): { actionPending: any; aiResponseText: string } {
  const textLower = (rawUserText || '').toLowerCase();
  const isExplicitAll = Boolean(args.all) || textLower.includes('semua') || textLower.includes('all') || textLower.includes('seluruh') || textLower.includes('total');

  if (actionName === 'delete_all_data' || actionName === 'wipe_database') {
    const desc = 'Membersihkan seluruh data operasional tim (grup chat, proyek, tugas, catatan, dan agenda kalender)';
    const payload = { all: true, wipe_all: true };
    const actionPending = registerPendingAction(
      db,
      userId,
      'delete_all_data',
      desc,
      payload,
      'Konfirmasi Bersihkan Seluruh Data Sistem',
      `Miu meminta izin untuk membersihkan seluruh data operasional tim.`
    );
    return {
      actionPending,
      aiResponseText: `⚠️ **PERINGATAN AKSI KRITIS**: ${sapaan}, lu meminta untuk **membersihkan seluruh data operasional tim** (grup obrolan, proyek, tugas, catatan, dan kalender).\n\nTindakan ini destruktif total dan memerlukan persetujuan lu. Izinkan aksi ini?`,
    };
  }

  if (actionName === 'delete_chat_group') {
    const g = !isExplicitAll ? findChatGroup(db, { id: args.group_id, name: args.target_name || args.name, text: rawUserText }) : null;
    if (g) {
      const desc = `Menghapus grup obrolan tim "${g.name}" (ID: ${g.id})`;
      const payload = { group_id: g.id, name: g.name, all: false };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_chat_group',
        desc,
        payload,
        'Konfirmasi Hapus Grup Chat',
        `Miu meminta izin untuk menghapus grup obrolan "${g.name}".`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Penghapusan Grup Chat**: ${sapaan}, grup obrolan **"${g.name}"** (ID: ${g.id}) akan dihapus secara permanen.\n\nSesuai protokol keamanan sistem, tindakan destruktif ini memerlukan persetujuan lu. Izinkan aksi ini?`,
      };
    } else {
      const allGroups = db.prepare('SELECT id, name FROM chat_groups').all() as any[];
      const count = allGroups.length;
      if (count === 0) {
        return {
          actionPending: null,
          aiResponseText: `ℹ️ **Grup Obrolan Kosong**: ${sapaan}, database grup chat saat ini sudah kosong (tidak ada grup tersisa untuk dihapus).`,
        };
      }
      if (count === 1 && !isExplicitAll) {
        const singleG = allGroups[0];
        const desc = `Menghapus grup obrolan tim "${singleG.name}" (ID: ${singleG.id})`;
        const payload = { group_id: singleG.id, name: singleG.name, all: false };
        const actionPending = registerPendingAction(
          db,
          userId,
          'delete_chat_group',
          desc,
          payload,
          'Konfirmasi Hapus Grup Chat',
          `Miu meminta izin untuk menghapus satu-satunya grup obrolan "${singleG.name}".`
        );
        return {
          actionPending,
          aiResponseText: `⚠️ **Permintaan Penghapusan Grup Chat**: ${sapaan}, grup obrolan **"${singleG.name}"** akan dihapus permanen. Izinkan aksi ini?`,
        };
      }
      const desc = `Menghapus semua grup obrolan tim (${count} grup akan dihapus)`;
      const payload = { all: true, count, group_ids: allGroups.map((grp) => grp.id) };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_chat_group',
        desc,
        payload,
        'Konfirmasi Hapus Semua Grup Chat',
        `Miu meminta izin untuk menghapus SEMUA (${count}) grup obrolan tim.`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Penghapusan Grup Chat**: ${sapaan}, lu meminta untuk menghapus **semua grup obrolan tim** (${count} grup akan dihapus permanen).\n\nSesuai protokol keamanan sistem, tindakan destruktif ini memerlukan persetujuan lu. Izinkan aksi ini?`,
      };
    }
  }

  if (actionName === 'delete_project') {
    const p = !isExplicitAll ? findProject(db, { id: args.project_id, name: args.target_name || args.name || args.nama_proyek, text: rawUserText }) : null;
    if (p) {
      const desc = `Menghapus proyek "${p.nama_proyek}" (ID: ${p.id})`;
      const payload = { project_id: p.id, name: p.nama_proyek, all: false };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_project',
        desc,
        payload,
        'Konfirmasi Hapus Proyek',
        `Miu meminta izin untuk menghapus proyek "${p.nama_proyek}".`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Penghapusan Proyek**: ${sapaan}, proyek **"${p.nama_proyek}"** (ID: ${p.id}) akan dihapus permanen beserta data terkaitnya. Izinkan penghapusan?`,
      };
    } else {
      const allProjects = db.prepare('SELECT id, nama_proyek FROM projects').all() as any[];
      const count = allProjects.length;
      if (count === 0) {
        return {
          actionPending: null,
          aiResponseText: `ℹ️ **Proyek Kosong**: ${sapaan}, database proyek saat ini sudah kosong (tidak ada proyek tersisa untuk dihapus).`,
        };
      }
      if (count === 1 && !isExplicitAll) {
        const singleP = allProjects[0];
        const desc = `Menghapus proyek "${singleP.nama_proyek}" (ID: ${singleP.id})`;
        const payload = { project_id: singleP.id, name: singleP.nama_proyek, all: false };
        const actionPending = registerPendingAction(
          db,
          userId,
          'delete_project',
          desc,
          payload,
          'Konfirmasi Hapus Proyek',
          `Miu meminta izin untuk menghapus proyek "${singleP.nama_proyek}".`
        );
        return {
          actionPending,
          aiResponseText: `⚠️ **Permintaan Penghapusan Proyek**: ${sapaan}, proyek **"${singleP.nama_proyek}"** akan dihapus permanen. Izinkan aksi ini?`,
        };
      }
      const desc = `Menghapus semua proyek tim (${count} proyek akan dihapus)`;
      const payload = { all: true, count, project_ids: allProjects.map((prj) => prj.id) };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_project',
        desc,
        payload,
        'Konfirmasi Hapus Semua Proyek',
        `Miu meminta izin untuk menghapus SEMUA (${count}) proyek tim.`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Penghapusan Proyek**: ${sapaan}, lu meminta untuk menghapus **semua proyek tim** (${count} proyek akan dihapus permanen beserta data terkait).\n\nSistem mengunci aksi ini dan butuh konfirmasi lu. Izinkan penghapusan?`,
      };
    }
  }

  if (actionName === 'delete_task') {
    const t = !isExplicitAll ? findTask(db, { id: args.task_id, name: args.target_name || args.name || args.aktivitas, text: rawUserText }) : null;
    if (t) {
      const desc = `Menghapus tugas "${t.aktivitas}" (ID: ${t.id})`;
      const payload = { task_id: t.id, aktivitas: t.aktivitas, all: false };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_task',
        desc,
        payload,
        'Konfirmasi Hapus Tugas',
        `Miu meminta izin untuk menghapus tugas "${t.aktivitas}".`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Hapus Tugas**: ${sapaan}, tugas **"${t.aktivitas}"** (ID: ${t.id}) akan dihapus. Izinkan penghapusan?`,
      };
    } else {
      const allTasks = db.prepare('SELECT id, aktivitas FROM realisasi').all() as any[];
      const count = allTasks.length;
      if (count === 0) {
        return {
          actionPending: null,
          aiResponseText: `ℹ️ **Tugas Kosong**: ${sapaan}, daftar tugas/realisasi saat ini sudah kosong (tidak ada tugas tersisa untuk dihapus).`,
        };
      }
      if (count === 1 && !isExplicitAll) {
        const singleT = allTasks[0];
        const desc = `Menghapus tugas "${singleT.aktivitas}" (ID: ${singleT.id})`;
        const payload = { task_id: singleT.id, aktivitas: singleT.aktivitas, all: false };
        const actionPending = registerPendingAction(
          db,
          userId,
          'delete_task',
          desc,
          payload,
          'Konfirmasi Hapus Tugas',
          `Miu meminta izin untuk menghapus tugas "${singleT.aktivitas}".`
        );
        return {
          actionPending,
          aiResponseText: `⚠️ **Permintaan Hapus Tugas**: ${sapaan}, tugas **"${singleT.aktivitas}"** akan dihapus. Izinkan?`,
        };
      }
      const desc = `Menghapus semua tugas tim (${count} tugas akan dihapus)`;
      const payload = { all: true, count };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_task',
        desc,
        payload,
        'Konfirmasi Hapus Semua Tugas',
        `Miu meminta izin untuk menghapus seluruh (${count}) tugas tim.`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Hapus Semua Tugas**: ${sapaan}, lu meminta untuk menghapus **seluruh tugas (${count} tugas)** di database. Izinkan tindakan destruktif ini?`,
      };
    }
  }

  if (actionName === 'delete_note') {
    const n = !isExplicitAll ? findNote(db, { id: args.note_id || args.id, name: args.target_name || args.title || args.name, text: rawUserText }) : null;
    if (n) {
      const desc = `Menghapus catatan memo "${n.title}" (ID: ${n.id})`;
      const payload = { note_id: n.id, id: n.id, title: n.title, all: false };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_note',
        desc,
        payload,
        'Konfirmasi Hapus Catatan',
        `Miu meminta izin untuk menghapus catatan "${n.title}".`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Hapus Catatan**: ${sapaan}, memo **"${n.title}"** (ID: ${n.id}) akan dihapus. Izinkan?`,
      };
    } else {
      const allNotes = db.prepare('SELECT id, title FROM notes').all() as any[];
      const count = allNotes.length;
      if (count === 0) {
        return {
          actionPending: null,
          aiResponseText: `ℹ️ **Catatan Kosong**: ${sapaan}, daftar catatan di Notes sudah kosong (tidak ada memo tersisa untuk dihapus).`,
        };
      }
      if (count === 1 && !isExplicitAll) {
        const singleN = allNotes[0];
        const desc = `Menghapus catatan memo "${singleN.title}" (ID: ${singleN.id})`;
        const payload = { note_id: singleN.id, id: singleN.id, title: singleN.title, all: false };
        const actionPending = registerPendingAction(
          db,
          userId,
          'delete_note',
          desc,
          payload,
          'Konfirmasi Hapus Catatan',
          `Miu meminta izin untuk menghapus catatan "${singleN.title}".`
        );
        return {
          actionPending,
          aiResponseText: `⚠️ **Permintaan Hapus Catatan**: ${sapaan}, catatan **"${singleN.title}"** akan dihapus. Izinkan?`,
        };
      }
      const desc = `Menghapus semua catatan memo (${count} memo akan dihapus)`;
      const payload = { all: true, count };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_note',
        desc,
        payload,
        'Konfirmasi Hapus Semua Catatan',
        `Miu meminta izin untuk menghapus seluruh (${count}) catatan memo.`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Hapus Semua Catatan**: ${sapaan}, seluruh catatan memo (${count} memo) akan dihapus. Izinkan?`,
      };
    }
  }

  if (actionName === 'delete_calendar_event') {
    const e = !isExplicitAll ? findCalendarEvent(db, { id: args.event_id || args.id, name: args.target_name || args.title || args.name, text: rawUserText }) : null;
    if (e) {
      const desc = `Menghapus agenda kalender "${e.title}" (ID: ${e.id})`;
      const payload = { event_id: e.id, id: e.id, title: e.title, all: false };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_calendar_event',
        desc,
        payload,
        'Konfirmasi Hapus Agenda Kalender',
        `Miu meminta izin untuk menghapus agenda "${e.title}".`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Hapus Agenda**: ${sapaan}, agenda **"${e.title}"** (ID: ${e.id}) akan dihapus. Izinkan?`,
      };
    } else {
      const allEvents = db.prepare('SELECT id, title FROM calendar_events').all() as any[];
      const count = allEvents.length;
      if (count === 0) {
        return {
          actionPending: null,
          aiResponseText: `ℹ️ **Kalender Kosong**: ${sapaan}, jadwal kalender saat ini sudah kosong (tidak ada agenda tersisa untuk dihapus).`,
        };
      }
      if (count === 1 && !isExplicitAll) {
        const singleE = allEvents[0];
        const desc = `Menghapus agenda kalender "${singleE.title}" (ID: ${singleE.id})`;
        const payload = { event_id: singleE.id, id: singleE.id, title: singleE.title, all: false };
        const actionPending = registerPendingAction(
          db,
          userId,
          'delete_calendar_event',
          desc,
          payload,
          'Konfirmasi Hapus Agenda Kalender',
          `Miu meminta izin untuk menghapus agenda "${singleE.title}".`
        );
        return {
          actionPending,
          aiResponseText: `⚠️ **Permintaan Hapus Agenda**: ${sapaan}, agenda **"${singleE.title}"** akan dihapus. Izinkan?`,
        };
      }
      const desc = `Menghapus semua agenda kalender (${count} agenda akan dihapus)`;
      const payload = { all: true, count };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_calendar_event',
        desc,
        payload,
        'Konfirmasi Hapus Semua Agenda Kalender',
        `Miu meminta izin untuk menghapus seluruh (${count}) agenda di kalender.`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Hapus Agenda Kalender**: ${sapaan}, seluruh agenda (${count} agenda) di kalender akan dihapus. Izinkan?`,
      };
    }
  }

  if (actionName === 'delete_user') {
    const u = findUser(db, { id: args.user_id, username: args.username, name: args.nama || args.target_name, text: rawUserText });
    if (u) {
      const uName = `${u.nama} (@${u.username})`;
      const desc = `Menghapus pengguna "${uName}" (ID: ${u.id}) dari sistem`;
      const payload = { user_id: u.id, username: u.username, name: u.nama };
      const actionPending = registerPendingAction(
        db,
        userId,
        'delete_user',
        desc,
        payload,
        'Konfirmasi Hapus Pengguna',
        `Miu meminta izin untuk menghapus akun "${uName}".`
      );
      return {
        actionPending,
        aiResponseText: `⚠️ **Permintaan Hapus Pengguna**: ${sapaan}, akun pengguna **${uName}** (ID: ${u.id}) akan dihapus dari sistem. Izinkan tindakan destruktif ini?`,
      };
    } else {
      const nonAdmins = db.prepare("SELECT id, username, nama FROM users WHERE role != 'admin'").all() as any[];
      if (nonAdmins.length === 1) {
        const singleU = nonAdmins[0];
        const uName = `${singleU.nama} (@${singleU.username})`;
        const desc = `Menghapus pengguna "${uName}" (ID: ${singleU.id}) dari sistem`;
        const payload = { user_id: singleU.id, username: singleU.username, name: singleU.nama };
        const actionPending = registerPendingAction(
          db,
          userId,
          'delete_user',
          desc,
          payload,
          'Konfirmasi Hapus Pengguna',
          `Miu meminta izin untuk menghapus akun "${uName}".`
        );
        return {
          actionPending,
          aiResponseText: `⚠️ **Permintaan Hapus Pengguna**: ${sapaan}, akun pengguna **${uName}** (ID: ${singleU.id}) akan dihapus dari sistem. Izinkan tindakan ini?`,
        };
      } else if (nonAdmins.length > 1) {
        return {
          actionPending: null,
          aiResponseText: `⚠️ **Pilih Pengguna yang Ingin Dihapus**: ${sapaan}, terdapat beberapa anggota tim (${nonAdmins.map((usr) => `@${usr.username}`).join(', ')}). Boleh sebutkan username atau nama yang ingin dihapus?`,
        };
      } else {
        return {
          actionPending: null,
          aiResponseText: `ℹ️ **Pengguna Tidak Tersedia**: ${sapaan}, tidak ada anggota tim non-admin yang dapat dihapus.`,
        };
      }
    }
  }

  if (actionName === 'update_project_status') {
    const p = findProject(db, { id: args.project_id, name: args.target_name || args.nama_proyek, text: rawUserText });
    if (p) {
      const newStatus = args.status || 'selesai';
      const desc = `Mengubah status proyek "${p.nama_proyek}" menjadi "${newStatus}"`;
      const payload = { project_id: p.id, status: newStatus, name: p.nama_proyek };
      const actionPending = registerPendingAction(
        db,
        userId,
        'update_project_status',
        desc,
        payload,
        'Konfirmasi Ubah Status Proyek',
        `Miu ingin mengubah status proyek "${p.nama_proyek}" menjadi "${newStatus}".`
      );
      return {
        actionPending,
        aiResponseText: `⚙️ **Pembaruan Status Proyek**: ${sapaan}, status proyek **"${p.nama_proyek}"** akan diubah menjadi **"${newStatus}"**. Izinkan aksi ini?`,
      };
    } else {
      return {
        actionPending: null,
        aiResponseText: `⚠️ **Proyek Tidak Ditemukan**: ${sapaan}, proyek yang ingin diubah statusnya tidak ditemukan.`,
      };
    }
  }

  if (actionName === 'update_task') {
    const t = findTask(db, { id: args.task_id, name: args.target_name || args.aktivitas, text: rawUserText });
    if (t) {
      const desc = `Memperbarui tugas "${t.aktivitas}" (ID: ${t.id})`;
      const payload = { task_id: t.id, aktivitas: t.aktivitas, ...args };
      const actionPending = registerPendingAction(
        db,
        userId,
        'update_task',
        desc,
        payload,
        'Konfirmasi Pembaruan Tugas',
        `Miu ingin memperbarui data tugas "${t.aktivitas}".`
      );
      return {
        actionPending,
        aiResponseText: `⚙️ **Pembaruan Tugas**: ${sapaan}, tugas **"${t.aktivitas}"** akan diperbarui. Izinkan aksi ini?`,
      };
    } else {
      return {
        actionPending: null,
        aiResponseText: `⚠️ **Tugas Tidak Ditemukan**: ${sapaan}, tugas yang ingin diperbarui tidak ditemukan di sistem.`,
      };
    }
  }

  if (actionName === 'update_note') {
    const n = findNote(db, { id: args.note_id || args.id, name: args.target_name || args.title, text: rawUserText });
    if (n) {
      const desc = `Memperbarui catatan "${n.title}" (ID: ${n.id})`;
      const payload = { note_id: n.id, id: n.id, title: n.title, ...args };
      const actionPending = registerPendingAction(
        db,
        userId,
        'update_note',
        desc,
        payload,
        'Konfirmasi Pembaruan Catatan',
        `Miu ingin memperbarui catatan "${n.title}".`
      );
      return {
        actionPending,
        aiResponseText: `⚙️ **Pembaruan Catatan**: ${sapaan}, catatan **"${n.title}"** akan diperbarui. Izinkan aksi ini?`,
      };
    } else {
      return {
        actionPending: null,
        aiResponseText: `⚠️ **Catatan Tidak Ditemukan**: ${sapaan}, memo yang ingin diperbarui tidak ditemukan di Notes.`,
      };
    }
  }

  return { actionPending: null, aiResponseText: '' };
}

function executeNudge(
  db: any,
  sapaan: string,
  args: { user_id?: number; nama?: string; alasan?: string; pesan?: string; all_unsubmitted?: boolean },
  rawUserText: string,
  todayStr: string,
  prevContextText: string = ''
) {
  const textLower = (rawUserText || '').toLowerCase();
  const isAll = Boolean(args.all_unsubmitted) ||
    textLower.includes('belum setor') ||
    textLower.includes('semua') ||
    textLower.includes('mereka') ||
    textLower.includes('ya anda colek') ||
    textLower === 'ya' ||
    textLower === 'iya' ||
    textLower === 'colek';

  const nudgedNames: string[] = [];

  if (isAll && !args.nama && !args.user_id) {
    const unsubmitted = db.prepare(`
      SELECT id, nama FROM users
      WHERE role != 'admin' AND id NOT IN (
        SELECT DISTINCT COALESCE(assigned_to_user_id, user_id) FROM realisasi
        WHERE tanggal = ? AND (realisasi > 0 OR assigned_by_user_id IS NULL)
      )
    `).all(todayStr) as Array<{ id: number; nama: string }>;

    const targetList = unsubmitted.length > 0
      ? unsubmitted
      : (db.prepare("SELECT id, nama FROM users WHERE role != 'admin'").all() as Array<{ id: number; nama: string }>);

    for (const u of targetList) {
      const msg = args.pesan || `Halo ${u.nama}, yuk segera setor realisasi harian tugasmu di Productivier hari ini! ⏰`;
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
        VALUES (?, 'Pengingat Setor Realisasi', ?, 'nudge', '/?tab=input', ?, 0)
      `).run(
        u.id,
        msg,
        JSON.stringify({ sender: 'Miu', type: 'nudge', alasan: args.alasan || 'belum_setor_realisasi' })
      );
      nudgedNames.push(u.nama);
    }
  } else {
    let targetUser: any = null;
    if (args.user_id) {
      targetUser = db.prepare('SELECT id, nama FROM users WHERE id = ?').get(Number(args.user_id));
    }
    if (!targetUser && args.nama) {
      targetUser = findUser(db, { name: args.nama });
    }
    if (!targetUser) {
      targetUser = findUser(db, { text: rawUserText });
    }
    if (!targetUser && prevContextText) {
      targetUser = findUser(db, { text: prevContextText });
    }
    if (!targetUser) {
      const unsubmitted = db.prepare(`
        SELECT id, nama FROM users
        WHERE role != 'admin' AND id NOT IN (
          SELECT DISTINCT COALESCE(assigned_to_user_id, user_id) FROM realisasi
          WHERE tanggal = ? AND (realisasi > 0 OR assigned_by_user_id IS NULL)
        ) LIMIT 1
      `).get(todayStr) as any;
      targetUser = unsubmitted || db.prepare("SELECT id, nama FROM users WHERE role != 'admin' LIMIT 1").get();
    }

    if (targetUser) {
      const msg = args.pesan || `Halo ${targetUser.nama}, yuk segera setor realisasi harian tugasmu di Productivier! ⏰`;
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
        VALUES (?, 'Pengingat Setor Realisasi', ?, 'nudge', '/?tab=input', ?, 0)
      `).run(
        targetUser.id,
        msg,
        JSON.stringify({ sender: 'Miu', type: 'nudge', alasan: args.alasan || 'belum_setor_realisasi' })
      );
      nudgedNames.push(targetUser.nama);
    }
  }

  const targetStr = nudgedNames.length > 0 ? nudgedNames.join(', ') : 'Anggota Tim 2';
  const responseText = `✅ **Beres ${sapaan}!** Notifikasi pengingat setor realisasi sudah langsung terkirim ke **${targetStr}**. Notifikasi telah aktif di sistem! 🚀`;

  return {
    aiResponseText: responseText,
    toolExecuted: 'nudge_user',
    actionResult: {
      type: 'nudge_sent',
      title: `Pengingat Terkirim ke ${targetStr}`,
      details: `Notifikasi pengingat setor realisasi harian berhasil dikirimkan ke ${targetStr}.`,
    },
    uiAction: {
      action: 'navigate_tab',
      tab: 'input',
      reason: 'Mengecek kepatuhan input realisasi tim',
    },
  };
}

function executeSendChatMessage(
  db: any,
  sapaan: string,
  args: { group_id?: number; group_name?: string; message?: string },
  rawUserText: string,
  prevContextText: string = ''
) {
  const textLower = (rawUserText || '').toLowerCase();

  let targetGroup: any = null;
  if (args.group_id) {
    targetGroup = db.prepare('SELECT id, name FROM chat_groups WHERE id = ?').get(Number(args.group_id));
  }
  if (!targetGroup && args.group_name) {
    targetGroup = findChatGroup(db, { name: args.group_name });
  }
  if (!targetGroup) {
    targetGroup = findChatGroup(db, { text: rawUserText });
  }
  if (!targetGroup && prevContextText) {
    targetGroup = findChatGroup(db, { text: prevContextText });
  }
  if (!targetGroup) {
    const allGroups = db.prepare('SELECT id, name FROM chat_groups').all() as any[];
    if (allGroups.length > 0) targetGroup = allGroups[0];
  }

  if (!targetGroup) {
    return {
      aiResponseText: `⚠️ Maaf ${sapaan}, belum ada grup obrolan yang tersedia. Buat grup dulu dengan perintah 'buat grup chat' ya!`,
      toolExecuted: 'send_chat_message',
      actionResult: null,
      uiAction: null,
    };
  }

  let taggedUser: any = null;
  const allUsers = db.prepare('SELECT id, nama, username FROM users').all() as any[];
  for (const u of allUsers) {
    if (textLower.includes(u.nama.toLowerCase()) || textLower.includes(u.username.toLowerCase())) {
      taggedUser = u;
      break;
    }
  }
  if (!taggedUser && prevContextText) {
    taggedUser = findUser(db, { text: prevContextText });
  }
  if (!taggedUser) {
    taggedUser = allUsers.find((u: any) => u.nama.toLowerCase().includes('tim 2') || u.id === 4) || allUsers[1] || allUsers[0];
  }

  let msg = args.message || '';
  if (!msg || msg.trim() === '') {
    msg = `Halo @${taggedUser ? taggedUser.nama : 'Anggota Tim'}, yuk segera setor realisasi harian dan koordinasi progres tugas sprint kita di sini! 🚀`;
  }

  if ((textLower.includes('tag') || textLower.includes('mention')) && taggedUser && !msg.includes(`@${taggedUser.nama}`) && !msg.includes('@')) {
    msg = `@${taggedUser.nama} ${msg}`;
  }

  db.prepare(`
    INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
    VALUES (?, NULL, 'Miu', ?, 1)
  `).run(targetGroup.id, msg);

  // Global chat notification
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
      VALUES (?, ?, ?, 'chat', ?, ?, 0)
    `).run(
      null,
      `Pesan Baru di ${targetGroup.name}`,
      `Miu: "${msg.slice(0, 70)}${msg.length > 70 ? '...' : ''}"`,
      `/?tab=chat&group=${targetGroup.id}`,
      JSON.stringify({ group_id: targetGroup.id, sender_name: 'Miu', is_ai: true })
    );
  } catch {}

  // Targeted notification for mentioned user
  if (taggedUser) {
    try {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
        VALUES (?, ?, ?, 'chat', ?, ?, 0)
      `).run(
        taggedUser.id,
        `Kamu di-tag oleh Miu di ${targetGroup.name}`,
        `"${msg.slice(0, 80)}${msg.length > 80 ? '...' : ''}"`,
        `/?tab=chat&group=${targetGroup.id}`,
        JSON.stringify({ group_id: targetGroup.id, sender_name: 'Miu', is_ai: true, mention: true })
      );
    } catch {}
  }

  const responseText = `✅ **Beres ${sapaan}!** Pesan dan tag sudah langsung terkirim ke grup **${targetGroup.name}**:\n\n> "${msg}"\n\nSeluruh anggota grup dapat membaca pesan ini sekarang! 💬`;

  return {
    aiResponseText: responseText,
    toolExecuted: 'send_chat_message',
    targetGroup,
    actionResult: {
      type: 'chat_sent',
      title: `Pesan Diposting ke ${targetGroup.name}`,
      details: msg,
    },
    uiAction: {
      action: 'open_chat_group',
      tab: 'chat',
      groupId: targetGroup.id,
      reason: `Membuka ruang obrolan ${targetGroup.name}`,
    },
  };
}

function executeAddGroupMember(
  db: any,
  sapaan: string,
  args: { group_id?: number; group_name?: string; user_id?: number; nama?: string; role?: string },
  rawUserText: string,
  prevContextText: string = ''
) {
  const textLower = (rawUserText || '').toLowerCase();

  let targetGroup: any = null;
  if (args.group_id) {
    targetGroup = db.prepare('SELECT id, name FROM chat_groups WHERE id = ?').get(Number(args.group_id));
  }
  if (!targetGroup && args.group_name) {
    targetGroup = findChatGroup(db, { name: args.group_name });
  }
  if (!targetGroup) {
    targetGroup = findChatGroup(db, { text: rawUserText });
  }
  if (!targetGroup && prevContextText) {
    targetGroup = findChatGroup(db, { text: prevContextText });
  }
  if (!targetGroup) {
    const allGroups = db.prepare('SELECT id, name FROM chat_groups').all() as any[];
    if (allGroups.length > 0) targetGroup = allGroups[0];
  }

  let targetUser: any = null;
  if (args.user_id) {
    targetUser = db.prepare('SELECT id, nama, username FROM users WHERE id = ?').get(Number(args.user_id));
  }
  if (!targetUser && args.nama) {
    targetUser = findUser(db, { name: args.nama });
  }
  if (!targetUser) {
    targetUser = findUser(db, { text: rawUserText });
  }
  if (!targetUser && prevContextText) {
    targetUser = findUser(db, { text: prevContextText });
  }
  if (!targetUser && targetGroup) {
    const candidate = db.prepare(`
      SELECT id, nama, username FROM users
      WHERE id NOT IN (SELECT user_id FROM chat_group_members WHERE group_id = ?)
      LIMIT 1
    `).get(targetGroup.id) as any;
    targetUser = candidate || (db.prepare('SELECT id, nama, username FROM users ORDER BY id DESC LIMIT 1').get() as any);
  }

  if (!targetGroup || !targetUser) {
    return {
      aiResponseText: `⚠️ ${sapaan}, tolong pastikan grup dan nama anggota tim sudah terdaftar di sistem.`,
      toolExecuted: 'add_group_member',
      actionResult: null,
      uiAction: null,
    };
  }

  const role = (args.role === 'admin' || textLower.includes('admin')) ? 'admin' : 'member';
  db.prepare(`
    INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role)
    VALUES (?, ?, ?)
  `).run(targetGroup.id, targetUser.id, role);

  db.prepare(`
    INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
    VALUES (?, NULL, 'Miu', ?, 1)
  `).run(targetGroup.id, `👋 ${targetUser.nama} telah ditambahkan ke grup oleh Miu.`);

  let tagMessage = '';
  if (textLower.includes('tag') || textLower.includes('mention')) {
    tagMessage = `Halo @${targetUser.nama}, selamat bergabung di grup ${targetGroup.name}! Yuk koordinasi tugas di sini ya! 🚀`;
    db.prepare(`
      INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
      VALUES (?, NULL, 'Miu', ?, 1)
    `).run(targetGroup.id, tagMessage);
  }

  try {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
      VALUES (?, 'Ditambahkan ke Grup Obrolan', ?, 'chat', ?, ?, 0)
    `).run(
      targetUser.id,
      `Kamu telah ditambahkan ke grup ${targetGroup.name}`,
      `Miu menambahkan kamu ke ${targetGroup.name}`,
      `/?tab=chat&group=${targetGroup.id}`,
      JSON.stringify({ group_id: targetGroup.id, role })
    );
  } catch {}

  const responseText = tagMessage
    ? `✅ **Beres ${sapaan}!** **${targetUser.nama}** berhasil dimasukkan ke dalam grup **${targetGroup.name}** dan sudah langsung gw tag di grup:\n\n> "${tagMessage}"\n\nAnggota tim sudah aktif di ruang obrolan! 🎉`
    : `✅ **Beres ${sapaan}!** **${targetUser.nama}** berhasil dimasukkan ke dalam grup **${targetGroup.name}** sebagai ${role === 'admin' ? 'Admin Grup 👑' : 'Anggota Tim'}. Anggota sudah langsung aktif di ruang obrolan! 🎉`;

  return {
    aiResponseText: responseText,
    toolExecuted: 'add_group_member',
    targetGroup,
    actionResult: {
      type: 'member_added',
      title: `Anggota Ditambahkan ke ${targetGroup.name}`,
      details: `${targetUser.nama} berhasil dimasukkan ke ${targetGroup.name}.`,
    },
    uiAction: {
      action: 'open_chat_group',
      tab: 'chat',
      groupId: targetGroup.id,
      reason: `Membuka ruang obrolan ${targetGroup.name}`,
    },
  };
}

function executeRemoveGroupMember(
  db: any,
  sapaan: string,
  args: { group_id?: number; group_name?: string; user_id?: number; nama?: string },
  rawUserText: string,
  prevContextText: string = ''
) {
  let targetGroup: any = null;
  if (args.group_id) {
    targetGroup = db.prepare('SELECT id, name FROM chat_groups WHERE id = ?').get(Number(args.group_id));
  }
  if (!targetGroup && args.group_name) {
    targetGroup = findChatGroup(db, { name: args.group_name });
  }
  if (!targetGroup) {
    targetGroup = findChatGroup(db, { text: rawUserText });
  }
  if (!targetGroup && prevContextText) {
    targetGroup = findChatGroup(db, { text: prevContextText });
  }
  if (!targetGroup) {
    const allGroups = db.prepare('SELECT id, name FROM chat_groups').all() as any[];
    if (allGroups.length > 0) targetGroup = allGroups[0];
  }

  let targetUser: any = null;
  if (args.user_id) {
    targetUser = db.prepare('SELECT id, nama, username FROM users WHERE id = ?').get(Number(args.user_id));
  }
  if (!targetUser && args.nama) {
    targetUser = findUser(db, { name: args.nama });
  }
  if (!targetUser) {
    targetUser = findUser(db, { text: rawUserText });
  }
  if (!targetUser && prevContextText) {
    targetUser = findUser(db, { text: prevContextText });
  }

  if (!targetGroup || !targetUser) {
    return {
      aiResponseText: `⚠️ ${sapaan}, anggota atau grup tidak ditemukan di sistem.`,
      toolExecuted: 'remove_group_member',
      actionResult: null,
      uiAction: null,
    };
  }

  db.prepare('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?').run(targetGroup.id, targetUser.id);

  db.prepare(`
    INSERT INTO chat_messages (group_id, user_id, sender_name, message, is_ai)
    VALUES (?, NULL, 'Miu', ?, 1)
  `).run(targetGroup.id, `📢 ${targetUser.nama} telah dikeluarkan dari grup.`);

  const responseText = `✅ **Beres ${sapaan}!** **${targetUser.nama}** berhasil dikeluarkan dari grup **${targetGroup.name}**. Keanggotaan grup telah diperbarui.`;

  return {
    aiResponseText: responseText,
    toolExecuted: 'remove_group_member',
    targetGroup,
    actionResult: {
      type: 'member_removed',
      title: `Anggota Dikeluarkan dari ${targetGroup.name}`,
      details: `${targetUser.nama} dikeluarkan dari grup ${targetGroup.name}.`,
    },
    uiAction: {
      action: 'open_chat_group',
      tab: 'chat',
      groupId: targetGroup.id,
      reason: `Membuka ruang obrolan ${targetGroup.name}`,
    },
  };
}

function parseTasksFromText(
  rawUserText: string,
  targetProj: any,
  todayStr: string
): Array<{ aktivitas: string; target: number; satuan: string; tanggal: string; user_id?: number }> {
  const text = (rawUserText || '').trim();
  const tasks: Array<{ aktivitas: string; target: number; satuan: string; tanggal: string; user_id?: number }> = [];

  // 1. Look for numbered or bulleted items
  const lines = text.split(/[\r\n]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    const itemMatch = trimmed.match(/^(?:\d+[\.\)]|[-•*])\s+(.+)$/);
    if (itemMatch) {
      const rawItem = itemMatch[1].trim();
      if (rawItem && !rawItem.toLowerCase().startsWith('task planning') && !rawItem.toLowerCase().startsWith('target')) {
        const targetMatch = rawItem.match(/\((?:target\s*)?(\d+)\s*([a-zA-Z]*)\)/i) || rawItem.match(/target\s*(\d+)\s*([a-zA-Z]*)/i);
        const targetNum = targetMatch ? Number(targetMatch[1]) : 10;
        const targetSatuan = targetMatch && targetMatch[2] ? targetMatch[2] : (targetProj?.satuan || 'Tugas');
        const cleanAktivitas = rawItem.replace(/\((?:target\s*)?(\d+)\s*([a-zA-Z]*)\)/gi, '').replace(/target\s*(\d+)\s*([a-zA-Z]*)/gi, '').trim();
        tasks.push({
          aktivitas: cleanAktivitas,
          target: targetNum || 10,
          satuan: targetSatuan,
          tanggal: todayStr,
        });
      }
    }
  }

  if (tasks.length > 0) return tasks;

  // 2. Look for comma or semicolon separated list after colon
  if (text.includes(':')) {
    const afterColon = text.split(':')[1]?.trim();
    if (afterColon) {
      const parts = afterColon.split(/[,;\n]/).map((p) => p.trim()).filter((p) => p.length > 2 && !p.toLowerCase().includes('target'));
      if (parts.length >= 2) {
        return parts.map((item, idx) => ({
          aktivitas: `Sprint ${idx + 1}: ${item}`,
          target: (idx + 1) * 5,
          satuan: targetProj?.satuan || 'Tugas',
          tanggal: todayStr,
        }));
      }
    }
  }

  // 3. Look for explicit target count in text: e.g. "target 5 tugas", "buat 4 task sprint"
  const countMatch = text.match(/(\d+)\s*(?:tugas|task|pekerjaan|aktivitas|item)/i) ||
                     text.match(/(?:target|jumlah|buat)\s*(\d+)/i);
  const count = countMatch ? Math.min(Math.max(Number(countMatch[1]), 1), 10) : 3;

  const projName = targetProj ? targetProj.nama_proyek : 'Proyek Tim';
  const divisi = (targetProj?.divisi || 'Operasional').toLowerCase();

  const templatesByDivisi: Record<string, string[]> = {
    kreatif: [
      `Riset Visual, Moodboard & Konsep Desain ${projName}`,
      `Produksi Asset Desain Feed 3:4 & Carousel ${projName}`,
      `Editing & Animasi Motion Video Reel 9:16 ${projName}`,
      `Review Internal Kreatif & Penyesuaian Brand Guideline ${projName}`,
      `Final Export, Quality Check & Handover Asset ${projName}`,
      `Distribusi Konten & Penjadwalan Posting Medsos ${projName}`,
      `Evaluasi Performa Visual & Feedback Klien ${projName}`,
    ],
    operasional: [
      `Daily Standup & Pemetaan Kebutuhan Operasional ${projName}`,
      `Eksekusi Alur Kerja & Standarisasi SOP Tim ${projName}`,
      `Koordinasi Lintas Divisi & Penanganan Kendala ${projName}`,
      `Audit Kualitas Output & Validasi Hasil Kerja ${projName}`,
      `Laporan Evaluasi Harian & Rekap Capaian Sprint ${projName}`,
      `Distribusi Dokumen Panduan & Rekap Data Progres ${projName}`,
      `Review Efisiensi Kerja & Perencanaan Tindak Lanjut ${projName}`,
    ],
    marketing: [
      `Riset Target Audiens & Copywriting Headline AIDA ${projName}`,
      `Setup Kampanye Iklan Meta Ads Advantage+ CBO ${projName}`,
      `A/B Testing Variasi Angle Iklan & Kreatif ${projName}`,
      `Optimasi Biaya Iklan (CPR) & Skalasi Budget ${projName}`,
      `Analisis Konversi & Laporan Mingguan ROAS ${projName}`,
      `Penyusunan Strategi Retargeting & Lead Nurturing ${projName}`,
      `Evaluasi Funnel Penjualan & Rekomendasi Pertumbuhan ${projName}`,
    ],
    it: [
      `Analisis Kebutuhan Sistem & Desain Skema Database ${projName}`,
      `Slicing Komponen UI & Penerapan Responsive Design ${projName}`,
      `Implementasi REST API & Logika Backend Otonom ${projName}`,
      `Integrasi End-to-End & Automated Unit Testing ${projName}`,
      `Security Audit, Refactoring & Deployment Server ${projName}`,
      `Monitoring Kinerja Server & Penanganan Error Log ${projName}`,
      `Dokumentasi Teknis API & Panduan Penggunaan ${projName}`,
    ],
  };

  const selectedTemplates = templatesByDivisi[divisi] || templatesByDivisi.operasional;
  const result: Array<{ aktivitas: string; target: number; satuan: string; tanggal: string }> = [];

  for (let i = 0; i < count; i++) {
    const template = selectedTemplates[i % selectedTemplates.length];
    const targetVal = (i + 1) * 5;
    result.push({
      aktivitas: `Fase ${i + 1}: ${template}`,
      target: targetVal,
      satuan: targetProj?.satuan || 'Tugas',
      tanggal: todayStr,
    });
  }

  return result;
}

function executePlanTasks(
  db: any,
  sapaan: string,
  args: { project_id?: number; project_name?: string; tasks?: Array<any> },
  rawUserText: string,
  defaultUserId: number,
  defaultDivisi: string,
  todayStr: string,
  prevContextText: string = ''
) {
  let targetProj: any = null;
  if (args.project_id) {
    targetProj = db.prepare('SELECT id, nama_proyek, target_total, satuan, divisi, pic_id FROM projects WHERE id = ?').get(Number(args.project_id));
  }
  if (!targetProj && args.project_name) {
    targetProj = findProject(db, { name: args.project_name });
  }
  if (!targetProj) {
    targetProj = findProject(db, { text: rawUserText });
  }
  if (!targetProj && prevContextText) {
    targetProj = findProject(db, { text: prevContextText });
  }
  if (!targetProj) {
    const allProjects = db.prepare('SELECT id, nama_proyek, target_total, satuan, divisi, pic_id FROM projects').all() as any[];
    if (allProjects.length > 0) targetProj = allProjects[0];
  }

  // Determine assigned user
  let assignedUser: any = null;
  if (args.tasks && args.tasks[0]?.user_id) {
    assignedUser = db.prepare('SELECT id, nama, divisi FROM users WHERE id = ?').get(Number(args.tasks[0].user_id));
  }
  if (!assignedUser) {
    assignedUser = findUser(db, { text: rawUserText });
  }
  if (!assignedUser && prevContextText) {
    assignedUser = findUser(db, { text: prevContextText });
  }
  if (!assignedUser && targetProj && targetProj.pic_id) {
    assignedUser = db.prepare('SELECT id, nama, divisi FROM users WHERE id = ?').get(targetProj.pic_id);
  }
  if (!assignedUser) {
    assignedUser = db.prepare('SELECT id, nama, divisi FROM users WHERE id = ?').get(defaultUserId) || {
      id: defaultUserId,
      nama: 'Fifa',
      divisi: defaultDivisi,
    };
  }

  let tasksList: Array<any> = Array.isArray(args.tasks) && args.tasks.length > 0 ? args.tasks : [];

  if (tasksList.length === 0) {
    tasksList = parseTasksFromText(rawUserText, targetProj, todayStr);
  }

  const insertedTasks: string[] = [];
  for (const t of tasksList) {
    const target = Number(t.target) || 1;
    const taskUserId = t.user_id ? Number(t.user_id) : assignedUser.id;
    let taskNama = assignedUser.nama;
    let taskDivisi = assignedUser.divisi || defaultDivisi;

    if (t.user_id && Number(t.user_id) !== assignedUser.id) {
      const u = db.prepare('SELECT nama, divisi FROM users WHERE id = ?').get(Number(t.user_id)) as any;
      if (u) {
        taskNama = u.nama;
        taskDivisi = u.divisi;
      }
    }

    db.prepare(`
      INSERT INTO realisasi (
        project_id, user_id, assigned_to_user_id, assigned_by_user_id, deadline,
        nama, divisi, tanggal, aktivitas, target, realisasi, satuan, persentase, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 'Belum')
    `).run(
      targetProj ? targetProj.id : null,
      taskUserId,
      taskUserId,
      defaultUserId,
      t.deadline || t.tanggal || todayStr,
      taskNama,
      taskDivisi,
      t.tanggal || todayStr,
      t.aktivitas,
      target,
      t.satuan || (targetProj?.satuan || 'Tugas')
    );
    if (taskUserId !== defaultUserId) {
      try {
        const assignerRow = db.prepare('SELECT nama FROM users WHERE id = ?').get(defaultUserId) as { nama: string } | undefined;
        const assignerName = assignerRow?.nama || 'Leader';
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, action_url, is_read)
          VALUES (?, 'Tugas Baru Didelegasikan oleh AI', ?, 'task', ?, 0)
        `).run(
          taskUserId,
          `${assignerName} menugaskan Anda via Miu AI: "${t.aktivitas}" (Target: ${target} ${t.satuan || targetProj?.satuan || 'Tugas'})`,
          targetProj ? `/?tab=projects&project_id=${targetProj.id}` : '/?tab=reports'
        );
      } catch {}
    }
    insertedTasks.push(`• **${t.aktivitas}** (Target: ${target} ${t.satuan || targetProj?.satuan || 'Tugas'}) · PIC: *${taskNama}*`);
  }

  const projTitle = targetProj ? targetProj.nama_proyek : 'Proyek Tim';

  try {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
      VALUES (?, 'Task Planning Sprint Baru', ?, 'task', '/?tab=projects', ?, 0)
    `).run(
      assignedUser.id,
      `${tasksList.length} tugas sprint baru dijadwalkan di ${projTitle} untukmu.`,
      JSON.stringify({ project_id: targetProj?.id, task_count: tasksList.length })
    );
  } catch {}

  const responseText = `📋 **Task Planning Berhasil Disusun!** ${sapaan}, ${tasksList.length} tugas sprint telah berhasil dijadwalkan ke proyek **${projTitle}** untuk **${assignedUser.nama}**:\n\n${insertedTasks.join('\n')}\n\nSeluruh tugas sudah resmi masuk ke sistem dan siap dieksekusi tim! 🚀`;

  const uiAction = targetProj
    ? {
        action: 'open_project',
        tab: 'projects',
        projectId: targetProj.id,
        projectName: targetProj.nama_proyek,
        reason: `Melihat hasil task planning sprint ${targetProj.nama_proyek}`,
      }
    : {
        action: 'navigate_tab',
        tab: 'projects',
        reason: 'Melihat daftar proyek aktif',
      };

  return {
    aiResponseText: responseText,
    toolExecuted: 'plan_tasks',
    targetProj,
    actionResult: {
      type: 'tasks_planned',
      title: `Task Planning (${tasksList.length} Tugas) untuk ${projTitle}`,
      details: `${tasksList.length} tugas sprint berhasil dimasukkan ke realisasi untuk ${assignedUser.nama}.`,
    },
    uiAction,
  };
}

/**
 * Compact chat history into an executive memory block when messages get long.
 */
function compactChatHistory(olderMessages: Array<{ role: string; content: string }>): string {
  if (!olderMessages.length) return '';
  const lines: string[] = [];
  lines.push('[MEMORI KONTEKS DISKUSI TERDAHULU (AUTO-COMPACTED)]:');

  olderMessages.forEach((m, idx) => {
    const roleTag = m.role === 'user' ? 'User' : 'Miu';
    const cleanContent = (m.content || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    if (cleanContent) {
      lines.push(`${idx + 1}. [${roleTag}]: ${cleanContent}${m.content.length > 160 ? '...' : ''}`);
    }
  });

  lines.push('Pedoman Konteks: Gunakan ringkasan memori di atas agar pembicaraan tetap sinkron jika pengguna merujuk hal terdahulu. Jangan pernah kehilangan konteks.');
  return lines.join('\n');
}

/**
 * Format internal system/tool execution log transparently when genuine model reasoning is not present
 */
function buildSystemExecutionLog(
  toolExecuted: string | null,
  uiAction: any | null,
  actionPending: any | null,
  actionResult: any | null,
  isCriticalReject: boolean,
  isOutOfScopeRefusal: boolean = false
): string {
  if (isOutOfScopeRefusal) {
    return '[Log Eksekusi Sistem]\n• Status: Ditolak oleh Guardrail Domain (Permintaan di luar ruang lingkup operasional Productivier)';
  }

  if (isCriticalReject) {
    return '[Log Eksekusi Sistem]\n• Status: Anti-Yes-Man Gate (Menolak parameter ambigu / tidak lengkap)';
  }

  if (toolExecuted || uiAction || actionPending || actionResult) {
    const logs: string[] = ['[Log Eksekusi Sistem]'];
    if (toolExecuted) {
      logs.push(`• Eksekusi Tool: ${toolExecuted}`);
    }
    if (uiAction) {
      logs.push(`• Kontrol UI: Navigasi ke tab "${uiAction.tab}"${uiAction.reason ? ` (${uiAction.reason})` : ''}`);
    }
    if (actionPending) {
      logs.push(`• Human-in-the-Loop: Menunggu konfirmasi pengguna (${actionPending.action_type})`);
    }
    if (actionResult) {
      logs.push(`• Hasil Eksekusi: ${actionResult.title || 'Selesai'}`);
    }
    return logs.join('\n');
  }

  return '';
}

/**
 * Generate contextual suggestions ala Gemini chips based on exact conversation context
 */
function generateSuggestions(context: {
  lastUserMsg?: string;
  aiResponseText?: string;
  actionPending?: any | null;
  toolExecuted?: string | null;
  uiAction?: any | null;
  isCriticalReject?: boolean;
  isOutOfScopeRefusal?: boolean;
}): string[] {
  // 1. Out-of-scope refusal suggestions
  if (context.isOutOfScopeRefusal) {
    return [
      '⚡ Rekap Progres Proyek',
      '➕ Buat Tugas Harian Tim',
      '📅 Cek Kalender Sprint',
      '💡 Rekomendasi Produktivitas',
    ];
  }

  // 2. Dangerous Action Pending (User must confirm or reject)
  if (context.actionPending) {
    const actType = context.actionPending.action_type || '';
    if (actType === 'delete_chat_group') {
      return [
        'Jelaskan Dampak Penghapusan',
        'Cek Data Sebelum Dihapus',
        'Buka Tab Obrolan Tim',
        'Batalkan Aksi',
      ];
    }
    if (actType === 'delete_project') {
      return [
        'Jelaskan Dampak Penghapusan',
        'Cek Data Sebelum Dihapus',
        'Buka Tab Proyek',
        'Batalkan Aksi',
      ];
    }
    if (actType === 'delete_task') {
      return [
        'Jelaskan Dampak Penghapusan',
        'Cek Data Sebelum Dihapus',
        'Buka Tab Input Realisasi',
        'Batalkan Aksi',
      ];
    }
    if (actType === 'delete_note') {
      return [
        'Jelaskan Dampak Penghapusan',
        'Cek Data Sebelum Dihapus',
        'Buka Tab Notes',
        'Batalkan Aksi',
      ];
    }
    if (actType === 'delete_calendar_event' || (actType.startsWith('delete') && (actType.includes('calendar') || actType.includes('event')))) {
      return [
        'Jelaskan Dampak Penghapusan',
        'Cek Data Sebelum Dihapus',
        'Buka Kalender',
        'Batalkan Aksi',
      ];
    }
    if (actType === 'delete_user') {
      return [
        'Jelaskan Dampak Penghapusan',
        'Cek Data Sebelum Dihapus',
        'Buka Tab Profil',
        'Batalkan Aksi',
      ];
    }
    if (actType.startsWith('delete') || actType.includes('wipe')) {
      return [
        'Jelaskan Dampak Penghapusan',
        'Cek Data Sebelum Dihapus',
        'Buka Tab Terkait',
        'Batalkan Aksi',
      ];
    }
    if (actType === 'create_project') {
      return [
        'Setujui Pembuatan Proyek',
        'Buka Tab Proyek',
        'Ubah Target atau Deadline',
        'Batalkan Buat Proyek',
      ];
    }
    if (actType === 'create_task') {
      return [
        'Setujui Tambah Tugas',
        'Buka Tab Input Realisasi',
        'Ubah Target Capaian',
        'Batalkan Tambah Tugas',
      ];
    }
    if (actType === 'create_note') {
      return [
        'Setujui Simpan Memo',
        'Buka Tab Notes',
        'Tambahkan Tag Catatan',
        'Batalkan Simpan Memo',
      ];
    }
    if (actType === 'create_chat_group') {
      return [
        'Setujui Buat Grup',
        'Buka Tab Obrolan Tim',
        'Undang Anggota ke Grup',
        'Batalkan Buat Grup',
      ];
    }
    if (actType === 'create_calendar_event' || actType === 'create_event' || (actType.startsWith('create') && (actType.includes('calendar') || actType.includes('event')))) {
      return [
        'Setujui Pasang di Kalender',
        'Buka Kalender',
        'Ubah Jam Agenda',
        'Batalkan Pasang Agenda',
      ];
    }
    if (actType === 'create_user') {
      return [
        'Setujui Pendaftaran Akun',
        'Buka Tab Profil Tim',
        'Atur Role Akun',
        'Batalkan Pendaftaran',
      ];
    }
    return [
      'Jelaskan Dampak Penghapusan',
      'Cek Data Sebelum Dihapus',
      'Buka Tab Terkait',
      'Batalkan Aksi',
    ];
  }

  // 3. UI Navigation Action
  if (context.uiAction) {
    const tab = context.uiAction.tab;
    if (tab === 'projects' || context.uiAction.action === 'open_project') {
      return [
        'Lihat Detail Proyek',
        'Tambah Tugas Pertama',
        'Atur Deadline di Kalender',
        'Buat Grup Diskusi Proyek',
      ];
    }
    if (tab === 'chat' || context.uiAction.action === 'open_chat_group') {
      return [
        'Buat Grup Baru',
        'Lihat Anggota Grup',
        'Buka Tab Obrolan Tim',
        'Kirim Pengumuman',
      ];
    }
    if (tab === 'notes' || context.uiAction.action === 'open_note') {
      return [
        'Buat Catatan Memo Baru',
        'Lihat Catatan Tersemat',
        'Jadwalkan Ide ke Kalender',
        'Buka Tab Notes',
      ];
    }
    if (tab === 'calendar') {
      return [
        'Jadwalkan Rapat Baru',
        'Cek Deadline Pekan Ini',
        'Buka Kalender',
        'Lihat Agenda Hari Ini',
      ];
    }
    if (tab === 'input') {
      return [
        'Input Capaian Hari Ini',
        'Cek Anggota Belum Input',
        'Lihat Rekap Tugas Tim',
        'Buka Tab Input Realisasi',
      ];
    }
    if (tab === 'reports') {
      return [
        'Unduh Rekap Laporan',
        'Bandingkan Capaian Divisi',
        'Lihat Tren 7 Hari',
        'Kembali ke Dashboard',
      ];
    }
    if (tab === 'profile') {
      return [
        'Lihat Daftar Anggota',
        'Daftarkan Karyawan Baru',
        'Ganti Profil User',
        'Cek Hak Akses Tim',
      ];
    }
  }

  // 3.5. Direct Tool Execution Suggestions
  if (context.toolExecuted === 'get_team_status' || context.aiResponseText?.toLowerCase().includes('colek yang belum setor')) {
    return [
      'Ya, colek yang belum setor',
      'Kirim pesan dan tag di grup chat',
      'Buka tab input realisasi',
      'Cek rekap progres proyek',
    ];
  }

  if (context.toolExecuted === 'nudge_user') {
    return [
      'Kirim pesan ke grup dan tag anggota tim 2',
      'Cek status tim lagi',
      'Susun task planning sprint',
      'Buka tab obrolan tim',
    ];
  }

  if (context.toolExecuted === 'send_chat_message' || context.toolExecuted === 'add_group_member') {
    return [
      'Buka tab obrolan tim',
      'Kirim update progres ke grup',
      'Susun task planning sprint',
      'Cek pantauan tim hari ini',
    ];
  }

  if (context.toolExecuted === 'plan_tasks') {
    return [
      'Buka tab proyek',
      'Cek jadwal di kalender',
      'Kirim pengumuman tugas ke grup chat',
      'Colek tim untuk mulai eksekusi',
    ];
  }

  // 4. Context & Topic Analysis: prioritize checking user query first, then full context
  const userText = (context.lastUserMsg || '').toLowerCase();
  const fullText = `${context.lastUserMsg || ''} ${context.aiResponseText || ''} ${context.toolExecuted || ''}`.toLowerCase();

  const isGroupTopic =
    /\b(grup|group|chat|obrolan|room|pesan grup|diskusi tim)\b/i.test(userText) ||
    Boolean(context.toolExecuted?.includes('chat_group'));

  const isUserTopic =
    /\b(user|pengguna|anggota|karyawan|akun|profil|member|karyawan baru|daftar user|daftarkan user|pic)\b/i.test(userText) ||
    Boolean(context.toolExecuted?.includes('user'));

  const isCalendarTopic =
    /\b(kalender|calendar|agenda|jadwal|jadwalkan|meeting|rapat|deadline sprint|event)\b/i.test(userText) ||
    Boolean(context.toolExecuted?.includes('calendar'));

  const isTaskTopic =
    /\b(tugas|task|realisasi|capaian|input tugas|setor|aktivitas|kerjaan|beban kerja)\b/i.test(userText) ||
    Boolean(context.toolExecuted?.includes('task')) ||
    Boolean(context.toolExecuted?.includes('realisasi'));

  const isNoteTopic =
    /\b(note|notes|memo|catatan|notula|ide)\b/i.test(userText) ||
    Boolean(context.toolExecuted?.includes('note'));

  const isProjectTopic =
    /\b(proyek|project|rekap proyek|progres|sprint|mvp|landing page)\b/i.test(userText) ||
    Boolean(context.toolExecuted?.includes('project'));

  // 5. Critical Clarification (Anti-yes-man): Tailor clarification options to the exact domain!
  if (context.isCriticalReject) {
    if (isUserTopic) {
      return [
        'Divisi Operasional & Role Karyawan',
        'Divisi Kreatif & Role Admin',
        'Lihat Daftar Anggota',
        'Batalkan Pendaftaran',
      ];
    }
    if (isGroupTopic) {
      return [
        'Grup Diskusi Operasional',
        'Grup Ide Kreatif',
        'Buka Tab Obrolan Tim',
        'Batalkan Buat Grup',
      ];
    }
    if (isCalendarTopic) {
      return [
        'Rapat Sprint Besok Jam 10:00',
        'Deadline Akhir Pekan Jam 17:00',
        'Buka Kalender',
        'Batalkan Jadwal',
      ];
    }
    if (isTaskTopic) {
      return [
        'Target 10 Tugas Hari Ini',
        'Input Realisasi 100%',
        'Buka Tab Input Realisasi',
        'Batalkan Tambah Tugas',
      ];
    }
    if (isNoteTopic) {
      return [
        'Catatan Ide Kreatif Baru',
        'Notula Rapat Singkat',
        'Buka Tab Notes',
        'Batalkan Simpan Memo',
      ];
    }
    if (isProjectTopic) {
      return [
        'Target 50 Tugas & Satuan Tugas',
        'Deadline Akhir Bulan Ini',
        'Divisi Operasional & Kreatif',
        'Tampilkan Daftar PIC',
      ];
    }
    return [
      'Jelaskan Detail Kebutuhan',
      'Tampilkan Opsi Pilihan',
      'Buka Halaman Terkait',
      'Batalkan Permintaan',
    ];
  }

  // 6. Domain-specific contextual follow-up suggestions
  // Chat & Groups
  if (isGroupTopic) {
    return [
      'Buat Grup Baru',
      'Lihat Anggota Grup',
      'Buka Tab Obrolan Tim',
      'Kirim Pengumuman',
    ];
  }

  // Users, Team & Profile
  if (isUserTopic) {
    return [
      'Lihat Daftar Anggota',
      'Daftarkan Karyawan Baru',
      'Ganti Profil User',
      'Cek Pantauan Tim Hari Ini',
    ];
  }

  // Calendar, Agenda & Meetings
  if (isCalendarTopic) {
    return [
      'Jadwalkan Rapat Baru',
      'Cek Deadline Pekan Ini',
      'Buka Kalender',
      'Lihat Agenda Hari Ini',
    ];
  }

  // Tasks, Realisasi & Input
  if (isTaskTopic) {
    return [
      'Input Capaian Hari Ini',
      'Cek Anggota Belum Input',
      'Lihat Rekap Tugas Tim',
      'Buka Tab Input Realisasi',
    ];
  }

  // Notes & Memo
  if (isNoteTopic) {
    return [
      'Buat Catatan Memo Baru',
      'Lihat Catatan Tersemat',
      'Jadwalkan Ide ke Kalender',
      'Buka Tab Notes',
    ];
  }

  // Projects & Sprints
  if (isProjectTopic) {
    return [
      'Lihat Detail Proyek',
      'Tambah Tugas Pertama',
      'Atur Deadline di Kalender',
      'Rekap Progres Proyek',
    ];
  }

  // Fallback scan on full text if user text was ambiguous
  if (/\b(grup|group|chat|obrolan)\b/i.test(fullText)) {
    return [
      'Buat Grup Baru',
      'Lihat Anggota Grup',
      'Buka Tab Obrolan Tim',
      'Kirim Pengumuman',
    ];
  }
  if (/\b(user|pengguna|anggota|karyawan|akun)\b/i.test(fullText)) {
    return [
      'Lihat Daftar Anggota',
      'Daftarkan Karyawan Baru',
      'Ganti Profil User',
      'Cek Pantauan Tim Hari Ini',
    ];
  }
  if (/\b(kalender|calendar|agenda|jadwal|rapat)\b/i.test(fullText)) {
    return [
      'Jadwalkan Rapat Baru',
      'Cek Deadline Pekan Ini',
      'Buka Kalender',
      'Lihat Agenda Hari Ini',
    ];
  }
  if (/\b(tugas|task|realisasi|capaian)\b/i.test(fullText)) {
    return [
      'Input Capaian Hari Ini',
      'Cek Anggota Belum Input',
      'Lihat Rekap Tugas Tim',
      'Buka Tab Input Realisasi',
    ];
  }
  if (/\b(note|notes|memo|catatan)\b/i.test(fullText)) {
    return [
      'Buat Catatan Memo Baru',
      'Lihat Catatan Tersemat',
      'Jadwalkan Ide ke Kalender',
      'Buka Tab Notes',
    ];
  }
  if (/\b(proyek|project|sprint)\b/i.test(fullText)) {
    return [
      'Lihat Detail Proyek',
      'Tambah Tugas Pertama',
      'Atur Deadline di Kalender',
      'Rekap Progres Proyek',
    ];
  }

  return [
    'Lihat Detail Proyek',
    'Input Capaian Hari Ini',
    'Jadwalkan Rapat Baru',
    'Buat Grup Baru',
  ];
}

function executeAutonomousIntent(options: {
  db: any;
  sapaan: string;
  lastUserMsg: string;
  lastUserLower: string;
  user_id: any;
  user_nama: string;
  user_divisi: string;
  todayStr: string;
  firstName: string;
  prevContextMsg: string;
}): {
  aiResponseText: string;
  actionResult?: any;
  actionPending?: any;
  uiAction?: any;
  toolExecuted?: string;
} {
  const { db, sapaan, lastUserMsg, lastUserLower, user_id, user_nama, user_divisi, todayStr, firstName, prevContextMsg } = options;

  // 1. High-Level Destructive / Mutation Confirmation Actions
  const isDeleteAllData =
    (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('bersihkan') || lastUserLower.includes('wipe') || lastUserLower.includes('reset')) &&
    (lastUserLower.includes('semua data') || lastUserLower.includes('database') || lastUserLower.includes('seluruh data') || lastUserLower === 'hapus semua' || lastUserLower === 'delete all');

  const isDeleteGroup =
    (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang')) &&
    (lastUserLower.includes('grup') || lastUserLower.includes('group') || lastUserLower.includes('obrolan') || lastUserLower.includes('room'));

  const isDeleteProject =
    (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang')) &&
    (lastUserLower.includes('proyek') || lastUserLower.includes('project'));

  const isDeleteTask =
    (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang')) &&
    (lastUserLower.includes('tugas') || lastUserLower.includes('task') || lastUserLower.includes('realisasi')) &&
    !lastUserLower.includes('kendala') && !lastUserLower.includes('blocker');

  const isDeleteNote =
    (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang')) &&
    (lastUserLower.includes('note') || lastUserLower.includes('memo') || lastUserLower.includes('catatan')) &&
    !lastUserLower.includes('checklist') && !lastUserLower.includes('pin');

  const isDeleteCalendar =
    (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang') || lastUserLower.includes('batalkan')) &&
    (lastUserLower.includes('kalender') || lastUserLower.includes('agenda') || lastUserLower.includes('event') || lastUserLower.includes('jadwal'));

  const isDeleteUser =
    (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('kick') || lastUserLower.includes('buang')) &&
    (lastUserLower.includes('user') || lastUserLower.includes('pengguna') || lastUserLower.includes('anggota') || lastUserLower.includes('karyawan') || lastUserLower.includes('akun'));

  const isUpdateProjectStatus =
    (lastUserLower.includes('selesaikan') || lastUserLower.includes('arsipkan') || lastUserLower.includes('ubah status') || lastUserLower.includes('update status')) &&
    (lastUserLower.includes('proyek') || lastUserLower.includes('project'));

  const isUpdateTaskDirect =
    (lastUserLower.includes('tugas') || lastUserLower.includes('task')) &&
    (lastUserLower.includes('update tugas') || lastUserLower.includes('ubah tugas') || lastUserLower.includes('perbarui tugas'));

  const detectedDangerousAction = isDeleteAllData ? 'delete_all_data'
    : isDeleteGroup ? 'delete_chat_group'
    : isDeleteProject ? 'delete_project'
    : isDeleteTask ? 'delete_task'
    : isDeleteNote ? 'delete_note'
    : isDeleteCalendar ? 'delete_calendar_event'
    : isDeleteUser ? 'delete_user'
    : isUpdateProjectStatus ? 'update_project_status'
    : isUpdateTaskDirect ? 'update_task'
    : null;

  if (detectedDangerousAction) {
    const res = handleDangerousAction(db, user_id ? Number(user_id) : 1, sapaan, detectedDangerousAction, {}, lastUserMsg);
    return {
      actionPending: res.actionPending,
      aiResponseText: res.aiResponseText,
      toolExecuted: detectedDangerousAction,
    };
  }

  // 2. Resource Hub Links (Gap 1)
  if (
    lastUserLower.includes('link') ||
    lastUserLower.includes('tautan') ||
    lastUserLower.includes('figma') ||
    lastUserLower.includes('drive') ||
    lastUserLower.includes('notion') ||
    lastUserLower.includes('github') ||
    lastUserLower.includes('sheets') ||
    lastUserLower.includes('resource')
  ) {
    if (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang')) {
      const link = findProjectLink(db, { text: lastUserMsg });
      if (link) {
        db.prepare('DELETE FROM project_links WHERE id = ?').run(link.id);
        return {
          toolExecuted: 'delete_project_link',
          actionResult: {
            type: 'link_deleted',
            title: `Tautan "${link.title}" dihapus dari Resource Hub`,
            id: link.id,
          },
          aiResponseText: `🗑️ **Tautan Berhasil Dihapus!** ${sapaan}, tautan **"${link.title}"** telah dibersihkan dari Resource Hub proyek.`,
        };
      } else {
        return {
          toolExecuted: 'delete_project_link',
          aiResponseText: `ℹ️ **Tautan Tidak Ditemukan**: ${sapaan}, tautan yang lu maksud tidak ditemukan di Resource Hub.`,
        };
      }
    } else {
      const urlMatch = lastUserMsg.match(/https?:\/\/[^\s]+/i);
      const foundUrl = urlMatch ? urlMatch[0] : 'https://figma.com/file/sample-project';
      let detectedPlatform = 'other';
      const lowUrl = foundUrl.toLowerCase();
      if (lowUrl.includes('drive.google.com')) detectedPlatform = 'drive';
      else if (lowUrl.includes('figma.com')) detectedPlatform = 'figma';
      else if (lowUrl.includes('notion.so') || lowUrl.includes('notion.site')) detectedPlatform = 'notion';
      else if (lowUrl.includes('github.com') || lowUrl.includes('gitlab.com')) detectedPlatform = 'github';
      else if (lowUrl.includes('docs.google.com/spreadsheets') || lowUrl.includes('airtable.com')) detectedPlatform = 'sheets';

      const p = findProject(db, { text: lastUserMsg }) || (db.prepare('SELECT id, nama_proyek FROM projects LIMIT 1').get() as any);
      const pId = p ? p.id : 1;
      const pName = p ? p.nama_proyek : 'Proyek';
      const linkTitle =
        lastUserMsg
          .replace(/https?:\/\/[^\s]+/i, '')
          .replace(/tambah|buat|simpan|link|tautan|ke|proyek|project|tolong|dong|bro|bestie/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim() || `${detectedPlatform.toUpperCase()} Asset Link`;

      const ins = db.prepare('INSERT INTO project_links (project_id, title, url, platform) VALUES (?, ?, ?, ?)').run(pId, linkTitle, foundUrl, detectedPlatform);
      const newLinkId = Number(ins.lastInsertRowid);
      return {
        toolExecuted: 'create_project_link',
        actionResult: {
          type: 'link_created',
          title: `Link "${linkTitle}" ditambahkan ke Resource Hub`,
          details: `${pName} (${detectedPlatform.toUpperCase()})`,
          id: newLinkId,
        },
        aiResponseText: `🔗 **Tautan Berhasil Ditambahkan ke Resource Hub!** ${sapaan}, tautan **"${linkTitle}"** [${detectedPlatform.toUpperCase()}] sudah langsung tersimpan di proyek **"${pName}"** ✨\n\nURL: [${foundUrl}](${foundUrl})`,
      };
    }
  }

  // 3. Client Portal Feedback (Gap 2)
  if (
    lastUserLower.includes('klien') ||
    lastUserLower.includes('client') ||
    lastUserLower.includes('portal') ||
    (lastUserLower.includes('revisi') && !lastUserLower.includes('realisasi')) ||
    lastUserLower.includes('feedback')
  ) {
    if (
      lastUserLower.includes('selesai') ||
      lastUserLower.includes('resolved') ||
      lastUserLower.includes('status') ||
      lastUserLower.includes('tandai') ||
      lastUserLower.includes('in_progress') ||
      lastUserLower.includes('open') ||
      lastUserLower.includes('buka')
    ) {
      const cn = findClientNote(db, { text: lastUserMsg });
      if (cn) {
        const newStatus = parseClientNoteUpdate(lastUserMsg);
        db.prepare('UPDATE project_client_notes SET status = ? WHERE id = ?').run(newStatus, cn.id);
        return {
          toolExecuted: 'update_client_note_status',
          actionResult: {
            type: 'client_note_updated',
            title: `Catatan Klien #${cn.id} Ditandai ${newStatus.toUpperCase()}`,
            id: cn.id,
          },
          aiResponseText: `✅ **Catatan Klien Diperbarui!** ${sapaan}, catatan dari **${cn.author_name}** (*"${cn.message.slice(0, 45)}..."*) telah ditandai **${newStatus.toUpperCase()}** ✨`,
        };
      } else {
        return {
          toolExecuted: 'update_client_note_status',
          aiResponseText: `⚠️ **Catatan Klien Tidak Ditemukan**: ${sapaan}, catatan atau revisi klien yang dimaksud tidak ditemukan.`,
        };
      }
    } else {
      const p = findProject(db, { text: lastUserMsg }) || (db.prepare('SELECT id, nama_proyek FROM projects LIMIT 1').get() as any);
      const pId = p ? p.id : 1;
      const pName = p ? p.nama_proyek : 'Proyek';
      const author = user_nama ? `${user_nama} (Klien)` : 'Klien Tamu';
      const cleanMsg =
        lastUserMsg
          .replace(/catat|revisi|baru|dari|klien|portal|feedback|tolong|dong|bro|bestie/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim() || 'Catatan revisi dari portal klien.';
      const ins = db
        .prepare("INSERT INTO project_client_notes (project_id, author_name, author_role, message, category, status) VALUES (?, ?, 'client', ?, 'revisi', 'open')")
        .run(pId, author, cleanMsg);
      const newNoteId = Number(ins.lastInsertRowid);
      return {
        toolExecuted: 'create_client_note',
        actionResult: {
          type: 'client_note_created',
          title: 'Catatan Klien Dicatat',
          details: cleanMsg,
          id: newNoteId,
        },
        aiResponseText: `💬 **Catatan Klien Berhasil Dicatat!** ${sapaan}, revisi dari **${author}** pada proyek **"${pName}"** sudah resmi disimpan di portal klien:\n\n*"${cleanMsg}"*`,
      };
    }
  }

  // 4. Granular Note Pinning & Checklists (Gap 3)
  if (
    lastUserLower.includes('pin') ||
    lastUserLower.includes('sematkan') ||
    lastUserLower.includes('checklist') ||
    lastUserLower.includes('centang') ||
    lastUserLower.includes('to-do') ||
    lastUserLower.includes('uncheck')
  ) {
    if (
      lastUserLower.includes('pin') ||
      lastUserLower.includes('sematkan') ||
      lastUserLower.includes('unpin') ||
      lastUserLower.includes('lepas')
    ) {
      const n = findNote(db, { text: lastUserMsg });
      if (n) {
        const cur = db.prepare('SELECT pinned FROM notes WHERE id = ?').get(n.id) as any;
        let newPinned = 1;
        if (lastUserLower.includes('unpin') || lastUserLower.includes('lepas') || lastUserLower.includes('batal')) {
          newPinned = 0;
        } else if (lastUserLower.includes('sematkan')) {
          newPinned = 1;
        } else {
          newPinned = cur?.pinned ? 0 : 1;
        }
        db.prepare('UPDATE notes SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newPinned, n.id);
        return {
          toolExecuted: 'toggle_note_pin',
          actionResult: {
            type: 'note_pinned',
            title: `Catatan "${n.title}" ${newPinned ? 'Disematkan (PIN)' : 'Dilepas PIN-nya'}`,
            id: n.id,
          },
          aiResponseText: `📌 **Status PIN Memo Diperbarui!** ${sapaan}, memo **"${n.title}"** sekarang sudah **${newPinned ? 'DISEMATKAN (PIN) di atas' : 'DILEPAS dari sematan'}** di tab Notes.`,
        };
      } else {
        return {
          toolExecuted: 'toggle_note_pin',
          aiResponseText: `⚠️ **Catatan Tidak Ditemukan**: ${sapaan}, memo yang ingin disematkan/lepas pin tidak ditemukan.`,
        };
      }
    } else {
      const n = findNote(db, { text: lastUserMsg });
      if (n) {
        const row = db.prepare('SELECT checklist FROM notes WHERE id = ?').get(n.id) as any;
        let list: any[] = [];
        try {
          list = JSON.parse(row?.checklist || '[]');
        } catch {
          list = [];
        }
        const parsed = parseChecklistTarget(lastUserMsg);
        let finalDone = true;
        let targetText = parsed.itemText || 'Checklist Item';

        if (parsed.itemIdx >= 0 && list[parsed.itemIdx]) {
          finalDone = parsed.isExplicitDone !== null ? parsed.isExplicitDone : !list[parsed.itemIdx].done;
          list[parsed.itemIdx].done = finalDone;
          targetText = list[parsed.itemIdx].text;
        } else if (parsed.itemText) {
          const matchedItem = list.find((it: any) => it.text && it.text.toLowerCase().includes(parsed.itemText.toLowerCase()));
          if (matchedItem) {
            finalDone = parsed.isExplicitDone !== null ? parsed.isExplicitDone : !matchedItem.done;
            matchedItem.done = finalDone;
            targetText = matchedItem.text;
          } else {
            finalDone = parsed.isExplicitDone !== null ? parsed.isExplicitDone : true;
            list.push({ id: String(Date.now()), text: parsed.itemText, done: finalDone });
            targetText = parsed.itemText;
          }
        } else if (list.length > 0) {
          finalDone = parsed.isExplicitDone !== null ? parsed.isExplicitDone : !list[0].done;
          list[0].done = finalDone;
          targetText = list[0].text;
        }

        db.prepare('UPDATE notes SET checklist = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(list), n.id);
        return {
          toolExecuted: 'update_note_checklist',
          actionResult: {
            type: 'checklist_updated',
            title: `Checklist Memo "${n.title}" Diperbarui`,
            details: targetText,
            id: n.id,
          },
          aiResponseText: `☑️ **Checklist Memo Diperbarui!** ${sapaan}, item checklist **"${targetText}"** di memo **"${n.title}"** sudah ${finalDone ? 'dicentang selesai (Done) ✅' : 'di-uncheck (Pending) ⏳'}.`,
        };
      } else {
        return {
          toolExecuted: 'update_note_checklist',
          aiResponseText: `⚠️ **Catatan Tidak Ditemukan**: ${sapaan}, memo yang ingin diubah checklist-nya tidak ditemukan.`,
        };
      }
    }
  }

  // 5. Calendar Event Rescheduling (Gap 4)
  if (
    lastUserLower.includes('undur') ||
    lastUserLower.includes('geser') ||
    lastUserLower.includes('reschedule') ||
    lastUserLower.includes('majukan') ||
    ((lastUserLower.includes('jam') || lastUserLower.includes('tanggal') || lastUserLower.includes('ganti') || lastUserLower.includes('update')) &&
      (lastUserLower.includes('rapat') || lastUserLower.includes('meeting') || lastUserLower.includes('agenda') || lastUserLower.includes('deadline')))
  ) {
    const e = findCalendarEvent(db, { text: lastUserMsg });
    if (e) {
      const parsed = parseCalendarReschedule(lastUserMsg, e);
      db.prepare(`
        UPDATE calendar_events
        SET title = COALESCE(?, title),
            date = ?,
            start_time = ?,
            end_time = ?
        WHERE id = ?
      `).run(parsed.title, parsed.date, parsed.startTime, parsed.endTime, e.id);

      const eventTitle = parsed.title || e.title;
      return {
        toolExecuted: 'update_calendar_event',
        actionResult: {
          type: 'event_rescheduled',
          title: `Agenda "${eventTitle}" Dijadwalkan Ulang`,
          details: `${parsed.date} jam ${parsed.startTime}-${parsed.endTime}`,
          id: e.id,
        },
        aiResponseText: `📅 **Agenda Kalender Berhasil Dijadwalkan Ulang!** ${sapaan}, agenda **"${eventTitle}"** sudah digeser ke **${parsed.date}** pukul **${parsed.startTime}-${parsed.endTime}** 🕒`,
      };
    } else {
      return {
        toolExecuted: 'update_calendar_event',
        aiResponseText: `⚠️ **Agenda Tidak Ditemukan**: ${sapaan}, agenda kalender yang ingin dijadwalkan ulang tidak ditemukan.`,
      };
    }
  }

  // 6. Notification Center (Gap 5)
  if (lastUserLower.includes('notifikasi') || lastUserLower.includes('lonceng') || lastUserLower.includes('notif')) {
    if (
      lastUserLower.includes('tandai') ||
      lastUserLower.includes('baca') ||
      lastUserLower.includes('bersihkan') ||
      lastUserLower.includes('clear') ||
      lastUserLower.includes('read')
    ) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL').run(user_id ? Number(user_id) : 1);
      return {
        toolExecuted: 'mark_all_notifications_read',
        actionResult: {
          type: 'notifications_read',
          title: 'Semua Notifikasi Ditandai Sudah Dibaca',
        },
        aiResponseText: `🔔 **Semua Notifikasi Ditandai Dibaca!** ${sapaan}, lonceng notifikasi lu sudah bersih 100% dan bebas unread ✨`,
      };
    } else {
      const unreads = db
        .prepare('SELECT id, title, message, type FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0 ORDER BY id DESC LIMIT 5')
        .all(user_id ? Number(user_id) : 1) as any[];
      return {
        toolExecuted: 'get_unread_notifications',
        actionResult: {
          type: 'notifications_fetched',
          title: `Pusat Notifikasi (${unreads.length} Belum Dibaca)`,
        },
        aiResponseText:
          unreads.length > 0
            ? `🔔 **Notifikasi Belum Dibaca (${unreads.length} Pesan Baru), ${sapaan}:**\n\n${unreads.map((n) => `• [${n.type.toUpperCase()}] **${n.title}**: ${n.message}`).join('\n')}\n\nMau langsung gw tandai semua sudah dibaca?`
            : `🔔 **Pusat Notifikasi Bersih!** ${sapaan}, tidak ada notifikasi yang belum dibaca saat ini ✨`,
      };
    }
  }

  // 7. Team Account Management (Gap 6)
  if (
    lastUserLower.includes('user') ||
    lastUserLower.includes('pengguna') ||
    lastUserLower.includes('anggota') ||
    lastUserLower.includes('karyawan') ||
    lastUserLower.includes('akun')
  ) {
    if (
      lastUserLower.includes('update') ||
      lastUserLower.includes('ubah') ||
      lastUserLower.includes('pindah') ||
      lastUserLower.includes('role') ||
      lastUserLower.includes('divisi') ||
      lastUserLower.includes('nama') ||
      lastUserLower.includes('ganti') ||
      lastUserLower.includes('gender')
    ) {
      const u = findUser(db, { text: lastUserMsg });
      if (u) {
        const parsed = parseUserUpdate(lastUserMsg, u);
        db.prepare(`
          UPDATE users
          SET nama = COALESCE(?, nama),
              divisi = ?,
              role = ?,
              gender = ?
          WHERE id = ?
        `).run(parsed.nama, parsed.divisi, parsed.role, parsed.gender, u.id);

        const updatedName = parsed.nama || u.nama;
        return {
          toolExecuted: 'update_user',
          actionResult: {
            type: 'user_updated',
            title: `Data Akun @${u.username} Diperbarui`,
            details: `${parsed.divisi} · ${parsed.role}`,
            id: u.id,
          },
          aiResponseText: `👤 **Data Anggota Tim Diperbarui!** ${sapaan}, akun **${updatedName}** (@${u.username}) berhasil diperbarui:\n• **Divisi:** ${parsed.divisi}\n• **Role:** ${parsed.role}\n• **Gender:** ${parsed.gender}`,
        };
      } else {
        return {
          toolExecuted: 'update_user',
          aiResponseText: `⚠️ **Pengguna Tidak Ditemukan**: ${sapaan}, akun user yang ingin diperbarui tidak ditemukan.`,
        };
      }
    }
  }

  // 8. Task Blocker Tracking (Gap 7)
  if (
    lastUserLower.includes('kendala') ||
    lastUserLower.includes('blocker') ||
    lastUserLower.includes('masalah') ||
    lastUserLower.includes('crash') ||
    lastUserLower.includes('teratasi') ||
    lastUserLower.includes('solusi') ||
    lastUserLower.includes('unblock')
  ) {
    const t = findTask(db, { text: lastUserMsg });
    if (t) {
      const parsed = parseTaskBlocker(lastUserMsg);
      if (parsed.isResolve) {
        db.prepare("UPDATE realisasi SET kendala = '', solusi = ? WHERE id = ?").run(parsed.solusi, t.id);
        return {
          toolExecuted: 'resolve_task_blocker',
          actionResult: {
            type: 'blocker_resolved',
            title: `Kendala Tugas #${t.id} Resmi Teratasi`,
            details: parsed.solusi,
            id: t.id,
          },
          aiResponseText: `🎉 **Kendala Tugas Resmi Teratasi!** ${sapaan}, tugas **"${t.aktivitas}"** sekarang sudah unblocked!\n\n• **Solusi:** ${parsed.solusi}\n\nProgres kerja kembali lancar tanpa hambatan! 🚀`,
        };
      } else {
        db.prepare('UPDATE realisasi SET kendala = ?, solusi = ? WHERE id = ?').run(parsed.kendala, parsed.solusi || 'Menunggu koordinasi tim', t.id);
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
          VALUES (?, 'Kendala Tugas Baru Dicatat', ?, 'task', '/?tab=input', ?, 0)
        `).run(user_id ? Number(user_id) : 1, `Tugas "${t.aktivitas}" mengalami kendala: "${parsed.kendala}".`, JSON.stringify({ task_id: t.id, blocker: true }));
        return {
          toolExecuted: 'report_task_blocker',
          actionResult: {
            type: 'blocker_reported',
            title: `Kendala Tugas #${t.id} Dicatat`,
            details: parsed.kendala,
            id: t.id,
          },
          aiResponseText: `⚠️ **Kendala Tugas Berhasil Direkam!** ${sapaan}, blocker pada tugas **"${t.aktivitas}"** sudah tercatat di sistem:\n\n• **Kendala:** ${parsed.kendala}\n• **Rencana Solusi:** ${parsed.solusi || 'Menunggu koordinasi tim'}\n\nNotifikasi pemantauan telah aktif di dashboard tim!`,
        };
      }
    } else {
      return {
        toolExecuted: 'report_task_blocker',
        aiResponseText: `⚠️ **Tugas Tidak Ditemukan**: ${sapaan}, tugas yang mengalami kendala tidak ditemukan.`,
      };
    }
  }

  // 9. Sprint Analytics Summary (Gap 8)
  if (
    lastUserLower.includes('sprint') ||
    lastUserLower.includes('kecepatan') ||
    lastUserLower.includes('paling lambat') ||
    lastUserLower.includes('paling cepat') ||
    lastUserLower.includes('bottleneck') ||
    lastUserLower.includes('analitik') ||
    lastUserLower.includes('laporan sprint') ||
    lastUserLower.includes('efisiensi')
  ) {
    const analytics = computeSprintAnalytics(db);
    const divLines = analytics.divisionStats
      .map((d) => `• **${d.divisi}**: Rata-rata ${d.avgPct}% (${d.tercapai}/${d.total} tugas selesai${d.blockers > 0 ? `, ⚠️ ${d.blockers} kendala` : ''})`)
      .join('\n');
    return {
      toolExecuted: 'get_sprint_analytics_summary',
      actionResult: {
        type: 'sprint_analytics',
        title: `Laporan Sprint: Efisiensi ${analytics.avgPct}%`,
      },
      aiResponseText: `📈 **Laporan Analitik Sprint Eksekutif, ${sapaan}:**\n\n• **Efisiensi Rata-rata Tim:** **${analytics.avgPct}%** (${analytics.tercapaiTasks}/${analytics.totalTasks} tugas selesai)\n• **Divisi Tercepat (Sprint Leader):** **${analytics.fastestDiv.divisi}** (${analytics.fastestDiv.avgPct}%)\n• **Divisi Bottleneck:** **${analytics.slowestDiv.divisi}** (${analytics.slowestDiv.avgPct}%)\n• **Kendala Aktif:** **${analytics.activeBlockers.length} tugas** butuh penanganan\n\n**Performa Per Divisi:**\n${divLines}\n\nMau gw alokasikan tugas bantuan ke divisi ${analytics.slowestDiv.divisi}?`,
    };
  }

  // 10. Colek / Nudge
  if (
    lastUserLower.includes('colek') ||
    lastUserLower.includes('nudge') ||
    lastUserLower.includes('ingatkan') ||
    lastUserLower.includes('reminder') ||
    lastUserLower.includes('pengingat') ||
    lastUserLower.includes('anda colek') ||
    ((lastUserLower.includes('ya') || lastUserLower.includes('iya')) && (prevContextMsg.toLowerCase().includes('colek') || prevContextMsg.toLowerCase().includes('belum setor')))
  ) {
    const res = executeNudge(db, sapaan, {}, lastUserMsg, todayStr, prevContextMsg);
    return {
      toolExecuted: res.toolExecuted,
      actionResult: res.actionResult,
      aiResponseText: res.aiResponseText,
      uiAction: res.uiAction,
    };
  }

  // 11. Chat Group Add/Remove Member
  if (
    !lastUserLower.includes('buat grup') &&
    !lastUserLower.includes('bikin grup') &&
    !lastUserLower.includes('hapus grup') &&
    (lastUserLower.includes('di grup yg udah ada') ||
      lastUserLower.includes('ke grup yg udah ada') ||
      lastUserLower.includes('grup yang sudah ada') ||
      lastUserLower.includes('tambah anggota') ||
      ((lastUserLower.includes('masukin') || lastUserLower.includes('masukkan') || lastUserLower.includes('tambah') || lastUserLower.includes('invite') || lastUserLower.includes('add')) &&
        (lastUserLower.includes('grup') || lastUserLower.includes('group') || Boolean(findChatGroup(db, { text: lastUserMsg })))))
  ) {
    const res = executeAddGroupMember(db, sapaan, {}, lastUserMsg, prevContextMsg);
    return {
      toolExecuted: res.toolExecuted,
      actionResult: res.actionResult,
      aiResponseText: res.aiResponseText,
      uiAction: res.uiAction,
    };
  }

  if (
    (lastUserLower.includes('keluarkan') || lastUserLower.includes('kick') || (lastUserLower.includes('hapus') && (lastUserLower.includes('anggota') || lastUserLower.includes('member')))) &&
    (lastUserLower.includes('grup') || lastUserLower.includes('group') || Boolean(findChatGroup(db, { text: lastUserMsg })))
  ) {
    const res = executeRemoveGroupMember(db, sapaan, {}, lastUserMsg, prevContextMsg);
    return {
      toolExecuted: res.toolExecuted,
      actionResult: res.actionResult,
      aiResponseText: res.aiResponseText,
      uiAction: res.uiAction,
    };
  }

  // 12. Send Chat Message
  if (
    lastUserLower.includes('kirim pesan') ||
    lastUserLower.includes('ketik pesan') ||
    lastUserLower.includes('posting pesan') ||
    lastUserLower.includes('chat ke') ||
    lastUserLower.includes('pesan ke grup') ||
    lastUserLower.includes('tag di grup') ||
    (lastUserLower.includes('tag') && lastUserLower.includes('grup'))
  ) {
    const res = executeSendChatMessage(db, sapaan, {}, lastUserMsg, prevContextMsg);
    return {
      toolExecuted: res.toolExecuted,
      actionResult: res.actionResult,
      aiResponseText: res.aiResponseText,
      uiAction: res.uiAction,
    };
  }

  // 13. Task Planning
  if (
    lastUserLower.includes('task planning') ||
    lastUserLower.includes('rencana kerja sprint') ||
    lastUserLower.includes('rencana kerja') ||
    lastUserLower.includes('perencanaan tugas') ||
    lastUserLower.includes('sprint planning') ||
    (lastUserLower.includes('planning') && (lastUserLower.includes('tugas') || lastUserLower.includes('sprint') || lastUserLower.includes('proyek')))
  ) {
    const res = executePlanTasks(db, sapaan, {}, lastUserMsg, user_id ? Number(user_id) : 1, user_divisi || 'Operasional', todayStr, prevContextMsg);
    return {
      toolExecuted: res.toolExecuted,
      actionResult: res.actionResult,
      aiResponseText: res.aiResponseText,
      uiAction: res.uiAction,
    };
  }

  // 14. UI Navigation
  if (
    lastUserLower.includes('buka tab') ||
    lastUserLower.includes('navigasi') ||
    lastUserLower.includes('buka halaman') ||
    lastUserLower.includes('pergi ke') ||
    lastUserLower.includes('lihat kalender') ||
    lastUserLower.includes('lihat proyek') ||
    lastUserLower.includes('lihat notes') ||
    lastUserLower.includes('buka kalender') ||
    lastUserLower.includes('buka proyek') ||
    lastUserLower.includes('buka notes') ||
    lastUserLower.includes('buka chat')
  ) {
    let tab = 'projects';
    if (lastUserLower.includes('kalender') || lastUserLower.includes('calendar') || lastUserLower.includes('agenda')) tab = 'calendar';
    else if (lastUserLower.includes('note') || lastUserLower.includes('memo') || lastUserLower.includes('catatan')) tab = 'notes';
    else if (lastUserLower.includes('chat') || lastUserLower.includes('grup') || lastUserLower.includes('obrolan')) tab = 'chat';
    else if (lastUserLower.includes('input') || lastUserLower.includes('setor') || lastUserLower.includes('realisasi')) tab = 'input';
    else if (lastUserLower.includes('laporan') || lastUserLower.includes('report') || lastUserLower.includes('pantau')) tab = 'reports';
    else if (lastUserLower.includes('profil') || lastUserLower.includes('profile')) tab = 'profile';
    else if (lastUserLower.includes('home') || lastUserLower.includes('beranda')) tab = 'home';

    const p = tab === 'projects' ? findProject(db, { text: lastUserMsg }) : null;
    return {
      toolExecuted: 'navigate_ui',
      uiAction: {
        action: p ? 'open_project' : 'navigate_tab',
        tab: tab as any,
        projectId: p ? p.id : undefined,
        projectName: p ? p.nama_proyek : undefined,
        reason: 'Permintaan navigasi pengguna',
      },
      actionResult: {
        type: 'ui_navigated',
        title: `Mengalihkan tampilan ke ${tab.toUpperCase()}`,
        details: 'Navigasi antarmuka otomatis',
      },
      aiResponseText: `🧭 **Navigasi Antarmuka:** ${sapaan}, gw langsung alihkan layar lu ke tab **${tab.toUpperCase()}** ${p ? `untuk membuka proyek **"${p.nama_proyek}"**` : ''} ✨`,
    };
  }

  // 15. Create Proactive Staged Actions
  if (lastUserLower.includes('buat proyek') || lastUserLower.includes('bikin proyek') || lastUserLower.includes('proyek baru')) {
    const cleanTitle = lastUserMsg.replace(/buat|bikin|proyek|project|baru|tolong|dong|bro|bestie/gi, ' ').replace(/\s+/g, ' ').trim() || 'Proyek Baru dari AI';
    const desc = `Buat proyek baru "${cleanTitle}"`;
    const payload = {
      nama_proyek: cleanTitle,
      target_total: 100,
      satuan: 'Tugas',
      divisi: user_divisi || 'Operasional',
      pic_id: user_id ? Number(user_id) : 1,
      status: 'aktif',
    };
    const actionPending = registerPendingAction(db, user_id ? Number(user_id) : 1, 'create_project', desc, payload, 'Izin Buat Proyek Baru dari Asisten AI', `Miu ingin membuat proyek: "${cleanTitle}". Izinkan?`);
    return {
      toolExecuted: 'create_project',
      actionPending,
      aiResponseText: `🚀 **Draft Proyek Baru Siap!** ${sapaan}, proyek **"${cleanTitle}"** sudah gw siapkan di sistem. Konfirmasi kartunya ya biar langsung aktif! ✨`,
    };
  }

  if (lastUserLower.includes('tambah tugas') || lastUserLower.includes('buat tugas') || lastUserLower.includes('tugas baru') || lastUserLower.includes('input tugas')) {
    const cleanAct = lastUserMsg.replace(/tambah|buat|tugas|baru|input|realisasi|tolong|dong|bro|bestie/gi, ' ').replace(/\s+/g, ' ').trim() || 'Tugas Baru dari AI';
    const p = findProject(db, { text: lastUserMsg }) || (db.prepare('SELECT id, nama_proyek FROM projects LIMIT 1').get() as any);
    const pId = p ? p.id : 1;
    const ins = db
      .prepare("INSERT INTO realisasi (project_id, user_id, nama, divisi, tanggal, aktivitas, target, realisasi, satuan, persentase, status) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'Tugas', 100, 'Tercapai')")
      .run(pId, user_id ? Number(user_id) : 1, user_nama || 'Fifa (Leader)', user_divisi || 'Operasional', todayStr, cleanAct);
    const newTaskId = Number(ins.lastInsertRowid);
    return {
      toolExecuted: 'create_task',
      actionResult: {
        type: 'task_created',
        title: `Tugas "${cleanAct}" Berhasil Dibuat`,
        details: `Target: 1 Tugas · 100% Tercapai`,
        id: newTaskId,
      },
      aiResponseText: `✅ **Tugas Berhasil Dicatat!** ${sapaan}, tugas **"${cleanAct}"** sudah masuk ke sistem dan realisasinya tercatat 100% tercapai! 🚀`,
    };
  }

  if (lastUserLower.includes('catat memo') || lastUserLower.includes('buat catatan') || lastUserLower.includes('bikin note') || lastUserLower.includes('memo baru') || lastUserLower.includes('catatan baru')) {
    const cleanTitle = lastUserMsg.replace(/catat|buat|bikin|memo|catatan|note|baru|tolong|dong|bro|bestie/gi, ' ').replace(/\s+/g, ' ').trim() || 'Catatan Baru';
    const ins = db.prepare('INSERT INTO notes (user_id, title, content, tags, pinned, color, project_id, checklist) VALUES (?, ?, ?, ?, 0, ?, NULL, ?)').run(
      user_id ? Number(user_id) : 1,
      cleanTitle,
      `Catatan: ${cleanTitle}`,
      JSON.stringify(['ai', 'memo']),
      '#D2F27C',
      JSON.stringify([])
    );
    const newNoteId = Number(ins.lastInsertRowid);
    return {
      toolExecuted: 'create_note',
      actionResult: {
        type: 'note_created',
        title: `Catatan "${cleanTitle}" Disimpan`,
        id: newNoteId,
      },
      aiResponseText: `📝 **Memo Berhasil Disimpan!** ${sapaan}, catatan **"${cleanTitle}"** sudah masuk ke tab Notes lu ✨`,
    };
  }

  if (lastUserLower.includes('jadwalkan') || lastUserLower.includes('jadwal') || lastUserLower.includes('rapat') || lastUserLower.includes('meeting') || lastUserLower.includes('agenda baru')) {
    const cleanTitle = lastUserMsg.replace(/jadwalkan|jadwal|rapat|meeting|agenda|baru|tolong|dong|bro|bestie/gi, ' ').replace(/\s+/g, ' ').trim() || 'Rapat Koordinasi Tim';
    const desc = `Jadwalkan agenda: "${cleanTitle}"`;
    const payload = {
      title: cleanTitle,
      description: 'Dijadwalkan otomatis oleh Miu.',
      date: todayStr,
      start_time: '10:00',
      end_time: '11:00',
      category: 'meeting',
      color: '#D2F27C',
    };
    const actionPending = registerPendingAction(db, user_id ? Number(user_id) : 1, 'create_event', desc, payload, 'Izin Jadwalkan Agenda dari Asisten AI', `Miu ingin menjadwalkan agenda: "${cleanTitle}". Izinkan?`);
    return {
      toolExecuted: 'create_calendar_event',
      actionPending,
      aiResponseText: `📅 **Agenda Siap Dijadwalkan!** ${sapaan}, agenda **"${cleanTitle}"** siap dipasang di Kalender. Boleh gw eksekusi sekarang? ✨`,
    };
  }

  // 16. Default Proactive Autonomous AI Reply
  return {
    aiResponseText: `Hai ${firstName}! Gw Miu siap bantuin lu kelola tugas, Resource Hub link, catatan klien, memo Notes, jadwal Kalender, atau pantau sprint tim. Semua sistem siap gw eksekusi, ${sapaan}! 🚀 Mau gas apa hari ini?`,
  };
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const startTime = Date.now();
    const {
      messages,
      thinking_mode = 'medium',
      selected_model,
      model,
    } = await req.json();
    const user_id = auth.user.id;
    const user_nama = auth.user.nama;
    const user_divisi = auth.user.divisi;
    const user_role = auth.user.role;
    const user_gender = auth.user.gender;

    const requestedModel = selected_model || model || DEFAULT_AI_MODEL;
    const activeModel = ALLOWED_AI_MODELS.includes(requestedModel)
      ? requestedModel
      : DEFAULT_AI_MODEL;

    const db = getDb();
    const todayStr = new Date().toISOString().slice(0, 10);
    const firstName = (user_nama || 'Fifa').split(' ')[0];

    // Resolve gender from request or DB
    let isFemale = user_gender === 'female';
    if (!user_gender && user_id) {
      const uRow = db.prepare('SELECT gender, username FROM users WHERE id = ?').get(Number(user_id)) as { gender?: string; username?: string } | undefined;
      if (uRow) {
        isFemale = uRow.gender === 'female' || uRow.username === 'fifa';
      }
    } else if (!user_gender && (firstName.toLowerCase() === 'fifa')) {
      isFemale = true;
    }

    const sapaan = isFemale ? 'Bestie' : 'Bro';

    // Official polite refusal tailored to gender persona
    const refusalExample = isFemale
      ? `Maaf Bestie, gw adalah AI Asisten Operasional & Manajemen Proyek di Productivier. Gw nggak dirancang untuk bikin codingan bebas atau tugas di luar operasional tim kita. Yuk fokus bahas progres proyek, tugas harian, kalender, atau analisis sprint tim!`
      : `Maaf Bro, gw adalah AI Asisten Operasional & Manajemen Proyek di Productivier. Gw nggak dirancang untuk bikin codingan bebas atau tugas di luar operasional tim kita. Yuk fokus bahas progres proyek, tugas harian, kalender, atau analisis sprint tim!`;

    // Context for prompt: Projects in database
    const projects = db.prepare('SELECT id, nama_proyek, divisi, target_total, satuan, status, deadline FROM projects').all() as any[];
    const projectSummary = projects
      .map((p: any) => `- ID ${p.id}: "${p.nama_proyek}" (${p.divisi}) [${p.status}] - Target: ${p.target_total} ${p.satuan} - Deadline: ${p.deadline || 'tidak ada'}`)
      .join('\n');

    // Context for prompt: Users in database
    const dbUsers = db.prepare('SELECT id, username, nama, divisi, role FROM users').all() as any[];
    const userSummary = dbUsers
      .map((u: any) => `- ID ${u.id}: "${u.nama}" (@${u.username}, Divisi: ${u.divisi}, Role: ${u.role})`)
      .join('\n');

    // Context for prompt: Chat Groups in database with connected projects
    const dbGroups = db.prepare(`
      SELECT 
        g.id, 
        g.name, 
        g.description,
        (
          SELECT GROUP_CONCAT(p.nama_proyek, ', ')
          FROM chat_group_projects cgp
          JOIN projects p ON cgp.project_id = p.id
          WHERE cgp.group_id = g.id
        ) as connected_projects
      FROM chat_groups g
    `).all() as any[];
    const groupSummary = dbGroups
      .map((g: any) => `- ID ${g.id}: "${g.name}" (${g.description || 'Grup Diskusi'}${g.connected_projects ? ` | Proyek Terhubung: ${g.connected_projects}` : ''})`)
      .join('\n');

    // Auto-compact chat history only when context is truly long (>16 messages or >6000 chars)
    const allInputMessages: Array<{ role: string; content: string }> = Array.isArray(messages) ? messages : [];
    const totalChars = allInputMessages.reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);
    const KEEP_RECENT_COUNT = 10;
    const shouldCompact = allInputMessages.length > 16 || (totalChars > 6000 && allInputMessages.length > KEEP_RECENT_COUNT);

    let compactedMemory = '';
    let recentMessages = allInputMessages;
    let compactCount = 0;

    if (shouldCompact) {
      const olderMessages = allInputMessages.slice(0, -KEEP_RECENT_COUNT);
      recentMessages = allInputMessages.slice(-KEEP_RECENT_COUNT);
      compactedMemory = compactChatHistory(olderMessages);
      compactCount = olderMessages.length;
    }

    // Check last user prompt for robust routing & domain guardrail enforcement
    const lastUserMsg = (allInputMessages[allInputMessages.length - 1]?.content || '').trim();
    const lastUserLower = lastUserMsg.toLowerCase();
    const prevContextMsg = allInputMessages.length > 1 ? allInputMessages[allInputMessages.length - 2]?.content || '' : '';
    const prevContextLower = prevContextMsg.toLowerCase();

    // 1. High-Priority Autonomous Interceptor: Colek / Nudge
    const isColekAffirmation =
      lastUserLower.includes('colek') ||
      lastUserLower.includes('nudge') ||
      lastUserLower.includes('ingatkan') ||
      lastUserLower.includes('ingetin') ||
      lastUserLower.includes('reminder') ||
      lastUserLower.includes('pengingat') ||
      lastUserLower.includes('anda colek') ||
      lastUserLower.includes('ya colek') ||
      lastUserLower.includes('ya anda colek') ||
      ((lastUserLower === 'ya' || lastUserLower === 'iya' || lastUserLower === 'oke' || lastUserLower === 'gas' || lastUserLower === 'gass' || lastUserLower === 'boleh') &&
        (prevContextLower.includes('colek') || prevContextLower.includes('belum setor') || prevContextLower.includes('ingatkan')));

    if (isColekAffirmation) {
      const res = executeNudge(db, sapaan, {}, lastUserMsg, todayStr, prevContextMsg);
      const elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      const systemLog = buildSystemExecutionLog(
        res.toolExecuted,
        res.uiAction,
        null,
        res.actionResult,
        false,
        false
      );
      return NextResponse.json({
        role: 'assistant',
        content: res.aiResponseText,
        actionResult: res.actionResult,
        actionPending: null,
        uiAction: res.uiAction || null,
        thinking_process: systemLog,
        thinking_time: elapsedSeconds,
        thinking_mode,
        selected_model: activeModel,
        model: activeModel,
        suggestions: generateSuggestions({
          toolExecuted: res.toolExecuted,
          lastUserMsg: lastUserLower,
          aiResponseText: res.aiResponseText,
        }),
        compacted: shouldCompact,
        compactCount,
      });
    }

    // 2. High-Priority Autonomous Interceptor: Masukkan Anggota ke Grup (Add Member)
    const isAddMemberPreflight =
      !lastUserLower.includes('buat grup') && !lastUserLower.includes('bikin grup') && !lastUserLower.includes('hapus grup') && (
        lastUserLower.includes('di grup yg udah ada') ||
        lastUserLower.includes('ke grup yg udah ada') ||
        lastUserLower.includes('grup yang sudah ada') ||
        lastUserLower.includes('grup yg ada') ||
        lastUserLower.includes('grup eksisting') ||
        ((lastUserLower.includes('masukin') || lastUserLower.includes('masukkan') || lastUserLower.includes('tambah') || lastUserLower.includes('invite') || lastUserLower.includes('add') || lastUserLower.includes('gabungkan')) &&
         (lastUserLower.includes('grup') || lastUserLower.includes('group') || Boolean(findChatGroup(db, { text: lastUserMsg }))))
      );

    if (isAddMemberPreflight) {
      const res = executeAddGroupMember(db, sapaan, {}, lastUserMsg, prevContextMsg);
      const elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      const systemLog = buildSystemExecutionLog(
        res.toolExecuted,
        res.uiAction,
        null,
        res.actionResult,
        false,
        false
      );
      return NextResponse.json({
        role: 'assistant',
        content: res.aiResponseText,
        actionResult: res.actionResult,
        actionPending: null,
        uiAction: res.uiAction || null,
        thinking_process: systemLog,
        thinking_time: elapsedSeconds,
        thinking_mode,
        selected_model: activeModel,
        model: activeModel,
        suggestions: generateSuggestions({
          toolExecuted: res.toolExecuted,
          lastUserMsg: lastUserLower,
          aiResponseText: res.aiResponseText,
        }),
        compacted: shouldCompact,
        compactCount,
      });
    }

    // 3. High-Priority Autonomous Interceptor: Kirim Pesan & Tag di Grup Chat
    const isSendChatPreflight =
      !isAddMemberPreflight && (
        lastUserLower.includes('kirim pesan') ||
        lastUserLower.includes('ketik pesan') ||
        lastUserLower.includes('chat ke') ||
        lastUserLower.includes('pesan ke grup') ||
        lastUserLower.includes('posting pesan') ||
        lastUserLower.includes('umumkan di grup') ||
        lastUserLower.includes('chat di grup') ||
        lastUserLower.includes('kabari di grup') ||
        (lastUserLower.includes('tag') && (lastUserLower.includes('grup') || lastUserLower.includes('group'))) ||
        (lastUserLower.includes('mention') && (lastUserLower.includes('grup') || lastUserLower.includes('group')))
      );

    if (isSendChatPreflight) {
      const res = executeSendChatMessage(db, sapaan, {}, lastUserMsg, prevContextMsg);
      const elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      const systemLog = buildSystemExecutionLog(
        res.toolExecuted,
        res.uiAction,
        null,
        res.actionResult,
        false,
        false
      );
      return NextResponse.json({
        role: 'assistant',
        content: res.aiResponseText,
        actionResult: res.actionResult,
        actionPending: null,
        uiAction: res.uiAction || null,
        thinking_process: systemLog,
        thinking_time: elapsedSeconds,
        thinking_mode,
        selected_model: activeModel,
        model: activeModel,
        suggestions: generateSuggestions({
          toolExecuted: res.toolExecuted,
          lastUserMsg: lastUserLower,
          aiResponseText: res.aiResponseText,
        }),
        compacted: shouldCompact,
        compactCount,
      });
    }

    // 4. High-Priority Autonomous Interceptor: Keluarkan Anggota dari Grup (Remove Member)
    const isRemoveMemberPreflight =
      (lastUserLower.includes('keluarkan') || lastUserLower.includes('kick') || (lastUserLower.includes('hapus') && (lastUserLower.includes('anggota') || lastUserLower.includes('member')))) &&
      (lastUserLower.includes('grup') || lastUserLower.includes('group') || Boolean(findChatGroup(db, { text: lastUserMsg })));

    if (isRemoveMemberPreflight) {
      const res = executeRemoveGroupMember(db, sapaan, {}, lastUserMsg, prevContextMsg);
      const elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      const systemLog = buildSystemExecutionLog(
        res.toolExecuted,
        res.uiAction,
        null,
        res.actionResult,
        false,
        false
      );
      return NextResponse.json({
        role: 'assistant',
        content: res.aiResponseText,
        actionResult: res.actionResult,
        actionPending: null,
        uiAction: res.uiAction || null,
        thinking_process: systemLog,
        thinking_time: elapsedSeconds,
        thinking_mode,
        selected_model: activeModel,
        model: activeModel,
        suggestions: generateSuggestions({
          toolExecuted: res.toolExecuted,
          lastUserMsg: lastUserLower,
          aiResponseText: res.aiResponseText,
        }),
        compacted: shouldCompact,
        compactCount,
      });
    }

    // 5. High-Priority Autonomous Interceptor: Task Planning
    const isTaskPlanningPreflight =
      lastUserLower.includes('task planning') ||
      lastUserLower.includes('rencana kerja sprint') ||
      lastUserLower.includes('rencana kerja') ||
      lastUserLower.includes('perencanaan tugas') ||
      lastUserLower.includes('sprint planning') ||
      (lastUserLower.includes('planning') && (lastUserLower.includes('tugas') || lastUserLower.includes('sprint') || lastUserLower.includes('proyek')));

    if (isTaskPlanningPreflight) {
      const res = executePlanTasks(db, sapaan, {}, lastUserMsg, user_id ? Number(user_id) : 1, user_divisi || 'Operasional', todayStr, prevContextMsg);
      const elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      const systemLog = buildSystemExecutionLog(
        res.toolExecuted,
        res.uiAction,
        null,
        res.actionResult,
        false,
        false
      );
      return NextResponse.json({
        role: 'assistant',
        content: res.aiResponseText,
        actionResult: res.actionResult,
        actionPending: null,
        uiAction: res.uiAction || null,
        thinking_process: systemLog,
        thinking_time: elapsedSeconds,
        thinking_mode,
        selected_model: activeModel,
        model: activeModel,
        suggestions: generateSuggestions({
          toolExecuted: res.toolExecuted,
          lastUserMsg: lastUserLower,
          aiResponseText: res.aiResponseText,
        }),
        compacted: shouldCompact,
        compactCount,
      });
    }

    // Conversational Action Approval / Rejection Check (strictly avoid overriding domain commands like 'ya anda colek')
    const isActionCommand =
      lastUserLower.includes('colek') ||
      lastUserLower.includes('nudge') ||
      lastUserLower.includes('grup') ||
      lastUserLower.includes('group') ||
      lastUserLower.includes('jadwal') ||
      lastUserLower.includes('proyek') ||
      lastUserLower.includes('tugas') ||
      lastUserLower.includes('catat') ||
      lastUserLower.includes('memo') ||
      lastUserLower.includes('buka');

    const isConversationalRejection =
      !isActionCommand && (
        /\b(tidak|jangan|tolak|batalkan|batal|cancel|gak jadi|nggak jadi|stop)\b/i.test(lastUserLower)
      );

    const isConversationalApproval =
      !isActionCommand && !isConversationalRejection && (
        /\b(izinkan|setujui|acc|confirm|lanjut|gas|gaskeun|jalankan|diizinkan|disetujui|eksekusi sekarang)\b/i.test(lastUserLower) ||
        /^(ya|oke|ok|yes)\s*$/i.test(lastUserLower)
      );

    if (isConversationalApproval || isConversationalRejection) {
      const pendingReq = db.prepare(`
        SELECT * FROM ai_action_requests
        WHERE (user_id = ? OR user_id = 1) AND status = 'pending'
        ORDER BY id DESC LIMIT 1
      `).get(user_id ? Number(user_id) : 1) as any;

      if (pendingReq) {
        const actionStatus = isConversationalRejection ? 'rejected' : 'approved';
        const execRes = executeActionRequest(db, pendingReq.id, actionStatus, user_id ? Number(user_id) : undefined);
        const thinkingProcess = `[Log Eksekusi Sistem]\n• Status: Human-in-the-Loop Konfirmasi Aksi #${pendingReq.id} (${pendingReq.action_type}) ${actionStatus === 'approved' ? 'Disetujui' : 'Dibatalkan'}`;
        const content = actionStatus === 'approved'
          ? `✅ **Aksi AI Berhasil Disetujui!** ${sapaan}, ${execRes.message || 'Permintaan aksi telah berhasil dieksekusi.'} 🚀`
          : `❌ **Aksi AI Dibatalkan.** ${sapaan}, permintaan "${pendingReq.description}" telah dibatalkan dengan aman ✨`;

        return NextResponse.json({
          role: 'assistant',
          content,
          actionResult: {
            type: actionStatus === 'approved' ? 'action_approved' : 'action_rejected',
            title: actionStatus === 'approved' ? 'Aksi Disetujui & Dieksekusi' : 'Aksi Dibatalkan',
            details: execRes.message,
          },
          actionPending: null,
          uiAction: null,
          thinking_process: thinkingProcess,
          thinking_time: 0.1,
          thinking_mode,
          selected_model: activeModel,
          model: activeModel,
          suggestions: ['Lihat Detail Proyek', 'Input Capaian Hari Ini', 'Jadwalkan Rapat Baru', 'Buka Tab Notes'],
          compacted: shouldCompact,
          compactCount,
        });
      }
    }

    // Domain guardrail detection: check if user is asking for generic coding/scripting, homework, or entertainment
    const isRequestingCode =
      /\b(bikinin|bikin|buatkan|buat|tuliskan|tulis|generate|create|kodingin|minta)\s+(script|skrip|koding|coding|codingan|kode|program|function|fungsi|algoritma|bot|scraper|web scraper|crawler)\b/i.test(lastUserLower) ||
      /\b(script|koding|coding|codingan|kode|program)\s+(python|javascript|typescript|php|html|css|react|nextjs|java|c\+\+|cpp|bash|sh|sql)\b/i.test(lastUserLower) ||
      /\b(python|javascript|typescript|php|html|css|react|nextjs|java|c\+\+|cpp|bash|sh|sql)\s+(script|koding|coding|codingan|kode|program)\b/i.test(lastUserLower) ||
      /\b(scraping|scraper|scrape)\s+(instagram|ig|tiktok|web|data)\b/i.test(lastUserLower) ||
      /\b(bikin|buat)\s+(kalkulator|calculator)\s+(pake|pakai|dengan)?\s*(python|js|javascript|code|codingan|script)?\b/i.test(lastUserLower) ||
      /\b(source code|codingan|kodingan)\b/i.test(lastUserLower) ||
      /\b(write|generate|create)\s+(code|script|python|javascript|program)\b/i.test(lastUserLower);

    // Ensure it's not a legitimate operational task creation (e.g. "buat tugas coding modul login")
    const isLegitTaskAction =
      (lastUserLower.includes('tugas') || lastUserLower.includes('task') || lastUserLower.includes('catat') || lastUserLower.includes('memo') || lastUserLower.includes('proyek')) &&
      (lastUserLower.startsWith('tambah') || lastUserLower.startsWith('buatkan tugas') || lastUserLower.startsWith('buat tugas') || lastUserLower.startsWith('catat') || lastUserLower.startsWith('jadwalkan') || lastUserLower.startsWith('bikin tugas'));

    const isRequestingOtherOutOfScope =
      /\b(bikinin|bikin|buatkan|buat|tuliskan|tulis|ciptakan)\s+(puisi|cerpen|pantun|lirik lagu|dongeng|cerita cinta|gombalan)\b/i.test(lastUserLower) ||
      /\b(crypto trading bot|trading bot|sinyal forex|prediksi saham|analisis kripto)\b/i.test(lastUserLower) ||
      /\b(kerjain|jawab|selesaikan)\s+(pr|tugas sekolah|tugas kuliah|soal matematika|soal fisika|soal kimia)\b/i.test(lastUserLower);

    const isOutOfScope = (isRequestingCode && !isLegitTaskAction) || isRequestingOtherOutOfScope;

    const systemPrompt = `Anda adalah "Miu", asisten produktivitas cerdas, koordinator operasional tim, dan autonomous co-worker andalan di aplikasi Productivier.
Pengguna aktif: ${user_nama || 'Fifa'} (${user_role || 'admin'}, Divisi: ${user_divisi || 'Operasional'}).
Tanggal hari ini: ${todayStr}. Mode Penalaran: ${thinking_mode}.

${compactedMemory ? `${compactedMemory}\n` : ''}
Daftar Proyek di Sistem:
${projectSummary || 'Belum ada proyek.'}

Daftar Anggota Tim di Database:
${userSummary || 'Belum ada data anggota.'}

Daftar Grup Chat di Database:
${groupSummary || 'Belum ada grup chat.'}

================================================================================
ATURAN UTAMA #1 — STRICT SCOPE ENFORCEMENT & ANTI-ABUSE GUARDRAIL (PENOLAKAN MUTLAK)
================================================================================
Miu EKSKLUSIF beroperasi sebagai asisten operasional, koordinator tugas, dan manajemen proyek untuk tim internal di aplikasi Productivier. Anda BUKAN asisten coding bebas, BUKAN pembuat skrip umum, BUKAN penjawab PR sekolah/kuliah, dan BUKAN bot hiburan santai.

1. PERMINTAAN DI LUAR RUANG LINGKUP (OUT-OF-SCOPE) YANG WAJIB DITOLAK:
   - Permintaan membuat/menulis codingan atau skrip pemrograman generik (misal: "bikinin script Python", "buatkan kode JavaScript", "bikin web scraping", "bikinin codingan backend/frontend", "bikin bot Discord", "script kalkulator", "tulis fungsi C++", dsb).
   - Hiburan fiksi umum: Puisi, cerpen, pantun, lirik lagu, gombalan, cerita dongeng, atau curhat asmara.
   - Tugas akademis non-proyek: PR matematika, soal fisika/sejarah sekolah, tugas kuliah umum yang tidak berkaitan dengan operasional proyek Productivier.
   - Finansial spekulatif: Crypto trading bot, prediksi sinyal forex, skema saham cepat kaya.
   - Trivia ensiklopedia umum yang tidak ada relevansinya dengan produktivitas tim.

2. PROTOKOL PENOLAKAN TEGAS & SOPAN (MANDATORY REFUSAL PROTOCOL):
   - Jika pengguna meminta hal out-of-scope di atas, Anda WAJIB MENOLAK SECARA TEGAS DAN SOPAN di baris pertama.
   - DILARANG KERAS memberikan baris kode sedikit pun ("ini kodenya tapi besok jangan ya" -> HARAM MUTLAK!).
   - Gunakan format penolakan resmi berikut:
     "${refusalExample}"
   - Setelah menolak, langsung alihkan pembicaraan dan tawarkan bantuan seputar fitur Productivier (cek progres proyek, catat memo di Notes, jadwal kalender, atau input realisasi tugas harian).

================================================================================
ATURAN UTAMA #2 — POSTUR SUPER KRITIS ANTI-YES-MAN
================================================================================
Anda adalah rekan kerja strategis (co-worker selevel lead operasional), BUKAN robot "yes-man" penurut yang mengiyakan semua hal secara pasif:
1. Tantang Target/Deadline Irasional: Jika pengguna memasukkan target yang terlalu ekstrem (misal 500 tugas dalam 1 hari) atau deadline mustahil, kritik secara konstruktif dan usulkan angka yang realistis.
2. Tolak Asumsi Buta: Jika pengguna memberi instruksi ambigu tanpa parameter penting (misal: "bikin proyek baru" tanpa nama/target), jangan menebak data palsu. Minta klarifikasi 2-3 poin kunci secara tegas.
3. Anti Scope-Creep: Ingatkan jika ada penumpukan tugas di satu orang atau divisi yang mengalami bottleneck.

================================================================================
ATURAN UTAMA #3 — GAYA BAHASA & KEPRIBADIAN GENDER-ADAPTIVE (GEN Z INDONESIA)
================================================================================
${isFemale
  ? `1. KHUSUS PENGGUNA CEWEK: Selalu gunakan sapaan hangat, stylish, antusias, fun, dan solutif ("gw/lu, Bestie", "Sis", "Beb", "Kak", "Say", atau "${firstName}"). HARAM HUKUMNYA menggunakan sapaan cowok ("Bro", "Men", "Cuy").`
  : `1. KHUSUS PENGGUNA COWOK: Selalu gunakan sapaan santuy, taktis, solid, gesit, to-the-point ("gw/lu, Bro", "Men", "Bree", "Cuy", atau "${firstName}"). HARAM HUKUMNYA menggunakan sapaan cewek ("Bestie", "Sis", "Beb", "Say").`}
2. ANSWER FIRST & FRAGMENTS: Hasil, status eksekusi, atau penolakan selalu di baris PERTAMA dengan emoji dan **teks tebal**. Buang basa-basi robotik ("Tentu saja, sebagai AI...", "Halo yang terhormat...").
3. HUMANIZER (ANTI-SLOP): Hindari kata klise AI kaku seperti "menyelami", "merajut", "tapestry", "lanskap dinamis", "secara proaktif". Gunakan bahasa percakapan kerja tim profesional Indonesia yang luwes.
4. PRESISI 100%: Angka target, persentase, tanggal, nama anggota tim, dan judul proyek WAJIB akurat sesuai database.
5. FORMAT MARKDOWN RAPI: Gunakan format Markdown standar (\`**teks tebal**\`, \`- bullet\`, \`1. nomor\`, \`### judul\`). Jika menyajikan data dalam bentuk tabel Markdown, SETIAP BARIS TABEL (header, separator \`| :--- | :--- |\`, dan seluruh baris data) WAJIB ditulis dalam SATU BARIS TUNGGAL tanpa pemisah baris (\`\\n\`) di tengah sel/baris, diawali dan diakhiri \`|\`, serta dipisahkan baris kosong sebelum dan sesudah tabel. DILARANG memecah baris tabel atau meninggalkan tanda \`|\` sendirian di baris baru.

================================================================================
KEMAMPUAN OTONOM PENUH (100% ZERO-GAP FULL ACCESS CONTROLLING & WEB AUTOMATION):
================================================================================
Anda BISA dan BERWENANG memanggil seluruh tools sistem tanpa pengecualian:
1. 'delete_chat_group', 'delete_project', 'delete_task', 'delete_note', 'delete_calendar_event', 'delete_user'.
2. 'update_project_status', 'update_task', 'update_note'.
3. 'create_project', 'create_chat_group', 'create_user', 'create_task', 'create_note', 'create_calendar_event'.
4. 'navigate_ui': Otomasi navigasi tab dan in-page (tab: 'home'|'projects'|'calendar'|'notes'|'chat'|'input'|'reports'|'profile').
5. 'get_projects_overview', 'get_team_status', 'get_productivity_recommendations'.
6. 'create_project_link', 'delete_project_link': Menambah dan menghapus tautan vault di Resource Hub proyek (Drive, Figma, Notion, GitHub, Sheets).
7. 'create_client_note', 'update_client_note_status': Mencatat revisi/feedback klien portal dan memperbarui statusnya.
8. 'toggle_note_pin', 'update_note_checklist': Menyematkan memo (PIN/UNPIN) dan mencentang to-do checklist di memo.
9. 'update_calendar_event': Menjadwalkan ulang (reschedule) jam, tanggal, atau judul agenda kalender.
10. 'get_unread_notifications', 'mark_all_notifications_read': Melihat dan menandai semua notifikasi sudah dibaca.
11. 'update_user': Mengubah nama, divisi, role (admin/karyawan), dan gender anggota tim.
12. 'report_task_blocker', 'resolve_task_blocker': Merekam kendala/blocker tugas dan menandai solusi teratasi.
13. 'get_sprint_analytics_summary': Mengambil ringkasan analitik sprint kecepatan tim dan ranking divisi.
14. 'nudge_user': Mengirimkan notifikasi pengingat/colekan (reminder) secara langsung ke anggota tim yang belum setor realisasi atau perlu follow-up tugas (param: { user_id, nama, alasan, pesan, all_unsubmitted: true }). Anda BISA dan BERWENANG langsung mengirim notifikasi reminder. DILARANG KERAS menolak dengan alasan sistem tidak ada fitur colek/reminder!
15. 'send_chat_message': Mengirim pesan teks dan mention/tag (@nama) ke dalam grup obrolan tim (param: { group_id, group_name, message }). Anda BISA dan BERWENANG langsung memposting pesan chat tim. DILARANG KERAS menolak dengan alasan tidak bisa mengetik atau cuma bisa dilakukan anggota manusia!
16. 'add_group_member': Menambahkan anggota tim ke grup chat yang sudah ada (param: { group_id, group_name, user_id, nama, role }). Anda BISA dan BERWENANG langsung menambahkan anggota. DILARANG KERAS menolak dengan alasan tidak bisa tambah anggota atau cuma bisa manual!
17. 'remove_group_member': Mengeluarkan anggota tim dari grup chat (param: { group_id, group_name, user_id, nama }).
18. 'plan_tasks': Merencanakan rincian tugas kerja sprint (task planning) multi-langkah ke dalam proyek secara langsung (param: { project_id, project_name, tasks }).

ZERO-TOLERANCE ANTI-REFUSAL POLICY (MUTLAK BERLAKU):
- DILARANG KERAS berkata "gw nggak bisa", "tidak bisa", "fitur belum ada", "tidak ada fitur", "cuma bisa manual", "cuma bisa dilakukan oleh anggota manusia", atau "sistem Productivier nggak ada fitur"!
- Anda memiliki akses 100% kendali otonom penuh (*Zero-Gap Full Control*) di seluruh database dan modul aplikasi Productivier.
- Jika pengguna meminta colek/ingatkan anggota tim -> panggil 'nudge_user'.
- Jika pengguna meminta kirim pesan atau tag di grup -> panggil 'send_chat_message'.
- Jika pengguna meminta masukkan anggota ke grup yang sudah ada -> panggil 'add_group_member'.
- Jika pengguna meminta keluarkan anggota dari grup -> panggil 'remove_group_member'.
- Jika pengguna meminta task planning atau rencana kerja -> panggil 'plan_tasks'.
- Untuk aksi destruktif (hapus proyek/grup/tugas), panggil tool penghapusan dan sistem akan memunculkan kartu konfirmasi [Izinkan / Tolak] (Human-in-the-Loop protection).`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    let aiResponseText = '';
    let actionResult: any = null;
    let actionPending: any = null;
    let uiAction: any = null;
    let toolExecuted: string | null = null;
    let isCriticalReject = false;
    let isOutOfScopeRefusal = false;
    let nativeReasoning = '';
    let resolvedModel = activeModel;

    try {
      const isErnie = activeModel.includes('ernie');
      const isNemotron = activeModel.includes('nemotron');

      const openRouterPayload: any = {
        model: activeModel,
        messages: apiMessages,
        tools: TOOLS,
        max_tokens: 2048,
      };

      if (isErnie) {
        if (thinking_mode === 'direct' || thinking_mode === 'none') {
          openRouterPayload.reasoning = { exclude: true };
        } else {
          const effort = (thinking_mode === 'low' || thinking_mode === 'medium' || thinking_mode === 'high')
            ? thinking_mode
            : 'medium';
          openRouterPayload.reasoning = {
            effort,
            exclude: false,
          };
        }
      } else if (isNemotron) {
        if (thinking_mode === 'direct' || thinking_mode === 'none') {
          openRouterPayload.include_reasoning = false;
        } else {
          openRouterPayload.include_reasoning = true;
        }
      }

      let openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3007',
          'X-Title': 'Miu AI',
        },
        body: JSON.stringify(openRouterPayload),
      });

      if (openRouterRes.status === 429) {
        // Upstream rate limit backoff: wait 1.5s and retry once
        await new Promise((resolve) => setTimeout(resolve, 1500));
        openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3007',
            'X-Title': 'Miu AI',
          },
          body: JSON.stringify(openRouterPayload),
        });

        if (openRouterRes.status === 429 && activeModel !== DEFAULT_AI_MODEL) {
          openRouterPayload.model = DEFAULT_AI_MODEL;
          resolvedModel = DEFAULT_AI_MODEL;
          delete openRouterPayload.reasoning;
          openRouterPayload.include_reasoning = true;
          openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3007',
              'X-Title': 'Miu AI',
            },
            body: JSON.stringify(openRouterPayload),
          });
        }
      }

      if (!openRouterRes.ok && activeModel !== DEFAULT_AI_MODEL) {
        // Upstream error fallback to DEFAULT_AI_MODEL
        openRouterPayload.model = DEFAULT_AI_MODEL;
        resolvedModel = DEFAULT_AI_MODEL;
        delete openRouterPayload.reasoning;
        openRouterPayload.include_reasoning = true;
        openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3007',
            'X-Title': 'Miu AI',
          },
          body: JSON.stringify(openRouterPayload),
        });
      }

      if (!openRouterRes.ok) {
        throw new Error(`OpenRouter HTTP ${openRouterRes.status}`);
      }

      const resData = await openRouterRes.json();
      const choice = resData.choices?.[0];
      const aiMessage = choice?.message;

      // Extract genuine native reasoning directly from OpenRouter response
      if (typeof aiMessage?.reasoning === 'string' && aiMessage.reasoning.trim()) {
        nativeReasoning = aiMessage.reasoning.trim();
      } else if (typeof aiMessage?.reasoning_content === 'string' && aiMessage.reasoning_content.trim()) {
        nativeReasoning = aiMessage.reasoning_content.trim();
      } else if (Array.isArray(aiMessage?.reasoning_details)) {
        const textParts = aiMessage.reasoning_details
          .map((d: any) => d.text || d.content || d.reasoning || '')
          .filter(Boolean);
        if (textParts.length > 0) {
          nativeReasoning = textParts.join('\n').trim();
        }
      }

      // Check for <think>...</think> tags (and unclosed <think>...) in content
      if (typeof aiMessage?.content === 'string') {
        const thinkMatches = Array.from(aiMessage.content.matchAll(/<think>([\s\S]*?)<\/think>/gi));
        if (thinkMatches.length > 0) {
          if (!nativeReasoning) {
            nativeReasoning = thinkMatches.map((m: any) => m[1].trim()).filter(Boolean).join('\n\n');
          }
          aiMessage.content = aiMessage.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        }
        const unclosedThinkMatch = aiMessage.content.match(/<think>([\s\S]*)$/i);
        if (unclosedThinkMatch) {
          if (!nativeReasoning && unclosedThinkMatch[1].trim()) {
            nativeReasoning = unclosedThinkMatch[1].trim();
          }
          aiMessage.content = aiMessage.content.replace(/<think>[\s\S]*$/gi, '').trim();
        }
      }

      if (!nativeReasoning) {
        const altReasoning = choice?.reasoning || resData?.reasoning;
        if (typeof altReasoning === 'string' && altReasoning.trim()) {
          nativeReasoning = altReasoning.trim();
        }
      }

      if (aiMessage?.tool_calls && aiMessage.tool_calls.length > 0) {
        const toolCall = aiMessage.tool_calls[0];
        const fnName = toolCall.function?.name;
        toolExecuted = fnName;
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch {
          fnArgs = {};
        }

        if (fnName === 'create_project') {
          const target = Number(fnArgs.target_total) || 100;
          const pic = fnArgs.pic_id ? Number(fnArgs.pic_id) : (user_id ? Number(user_id) : 1);
          const satuan = fnArgs.satuan || 'Tugas';
          const divisi = fnArgs.divisi || user_divisi || 'Operasional';
          const deadline = fnArgs.deadline || '';

          const desc = `Buat proyek baru "${fnArgs.nama_proyek}" (Target: ${target} ${satuan}, Divisi: ${divisi}${deadline ? `, Deadline: ${deadline}` : ''})`;
          const payload = {
            nama_proyek: fnArgs.nama_proyek,
            target_total: target,
            satuan,
            divisi,
            deadline,
            pic_id: pic,
            member_ids: Array.isArray(fnArgs.member_ids) ? fnArgs.member_ids : undefined,
            status: 'aktif',
          };

          const insReq = db.prepare(`
            INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
            VALUES (?, 'create_project', ?, ?, 'pending')
          `).run(user_id ? Number(user_id) : 1, desc, JSON.stringify(payload));

          const reqId = Number(insReq.lastInsertRowid);

          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
            VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
          `).run(
            user_id ? Number(user_id) : 1,
            'Izin Buat Proyek Baru dari Asisten AI',
            `Miu ingin membuat proyek baru: "${fnArgs.nama_proyek}" (${divisi}). Izinkan?`,
            '/api/ai/actions',
            JSON.stringify({ action_request_id: reqId, action_type: 'create_project' })
          );

          actionPending = {
            id: reqId,
            user_id: user_id ? Number(user_id) : 1,
            action_type: 'create_project',
            description: desc,
            payload_json: JSON.stringify(payload),
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          aiResponseText = `🚀 **Draft Proyek Baru Siap!** ${sapaan}, gw udah rancang proyek **"${fnArgs.nama_proyek}"** (**Target: ${target} ${satuan}** · **Divisi: ${divisi}**${deadline ? ` · **Deadline: ${deadline}**` : ''}).\n\nSesuai standar keamanan sistem, butuh izin eksekusi lu dulu nih. Mau gw daftarkan sekarang?`;
        } else if (fnName === 'create_chat_group') {
          const desc = `Buat grup chat tim baru: "${fnArgs.name}"`;
          const payload = {
            name: fnArgs.name,
            description: fnArgs.description || '',
            project_id: fnArgs.project_id ? Number(fnArgs.project_id) : null,
          };

          const insReq = db.prepare(`
            INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
            VALUES (?, 'create_chat_group', ?, ?, 'pending')
          `).run(user_id ? Number(user_id) : 1, desc, JSON.stringify(payload));

          const reqId = Number(insReq.lastInsertRowid);

          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
            VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
          `).run(
            user_id ? Number(user_id) : 1,
            'Izin Buat Grup Chat dari Asisten AI',
            `Miu ingin membuat grup obrolan: "${fnArgs.name}". Izinkan?`,
            '/api/ai/actions',
            JSON.stringify({ action_request_id: reqId, action_type: 'create_chat_group' })
          );

          actionPending = {
            id: reqId,
            user_id: user_id ? Number(user_id) : 1,
            action_type: 'create_chat_group',
            description: desc,
            payload_json: JSON.stringify(payload),
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          aiResponseText = `💬 **Draft Grup Chat Siap!** ${sapaan}, ruang obrolan **"${fnArgs.name}"** udah gw siapkan.\n\nBoleh gw resmikan sekarang di tab Chat Tim?`;
        } else if (fnName === 'create_user') {
          const desc = `Daftarkan anggota tim baru: "${fnArgs.nama}" (@${fnArgs.username})`;
          const payload = {
            username: fnArgs.username,
            password: fnArgs.password || 'password123',
            nama: fnArgs.nama,
            divisi: fnArgs.divisi || 'Operasional',
            role: fnArgs.role || 'karyawan',
            gender: fnArgs.gender || 'male',
          };

          const insReq = db.prepare(`
            INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
            VALUES (?, 'create_user', ?, ?, 'pending')
          `).run(user_id ? Number(user_id) : 1, desc, JSON.stringify(payload));

          const reqId = Number(insReq.lastInsertRowid);

          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
            VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
          `).run(
            user_id ? Number(user_id) : 1,
            'Izin Pendaftaran Anggota Tim dari Asisten AI',
            `Miu ingin mendaftarkan akun: "${fnArgs.nama}" (@${fnArgs.username}). Izinkan?`,
            '/api/ai/actions',
            JSON.stringify({ action_request_id: reqId, action_type: 'create_user' })
          );

          actionPending = {
            id: reqId,
            user_id: user_id ? Number(user_id) : 1,
            action_type: 'create_user',
            description: desc,
            payload_json: JSON.stringify(payload),
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          aiResponseText = `👤 **Draft Pendaftaran Anggota Siap!** ${sapaan}, akun buat **${fnArgs.nama}** (@${fnArgs.username}) udah siap didaftarkan.\n\nIzinkan gw masukkan ke database tim?`;
        } else if (fnName === 'navigate_ui') {
          const targetTab = fnArgs.tab || 'projects';
          const pId = fnArgs.project_id ? Number(fnArgs.project_id) : undefined;
          const pName = fnArgs.project_name || '';
          const gId = fnArgs.group_id ? Number(fnArgs.group_id) : undefined;
          const view = fnArgs.filter_view || undefined;
          const reason = fnArgs.reason || 'Permintaan pengguna';

          uiAction = {
            action: fnArgs.action || (pId ? 'open_project' : 'navigate_tab'),
            tab: targetTab,
            projectId: pId,
            projectName: pName,
            groupId: gId,
            filterView: view,
            reason,
          };

          actionResult = {
            type: 'ui_navigated',
            title: `Mengalihkan tampilan ke ${targetTab.toUpperCase()}${pName ? ` (${pName})` : ''}`,
            details: reason,
          };

          aiResponseText = `🧭 **Otomasi Antarmuka Web:** ${sapaan}, gw langsung alihkan layar lu ke **${targetTab.toUpperCase()}** ${pName ? `untuk membuka proyek **"${pName}"**` : ''}.\n\n*Alasan:* ${reason}. Layar otomatis beralih dalam sekejap!`;
        } else if (fnName === 'create_task') {
          const t = Number(fnArgs.target) || 1;
          const r = fnArgs.realisasi !== undefined ? Number(fnArgs.realisasi) : t;
          let validProjId: number | null = null;
          if (fnArgs.project_id) {
            const pExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(fnArgs.project_id);
            if (pExists) validProjId = Number(fnArgs.project_id);
          }
          if (!validProjId) {
            const firstP = db.prepare('SELECT id FROM projects LIMIT 1').get() as { id: number } | undefined;
            validProjId = firstP ? firstP.id : null;
          }

          const desc = `Buat tugas "${fnArgs.aktivitas || 'Tugas Baru'}" (Target: ${t} ${fnArgs.satuan || 'Tugas'})`;
          const payload = {
            project_id: validProjId,
            aktivitas: fnArgs.aktivitas || 'Tugas Baru dari AI',
            target: t,
            realisasi: r,
            satuan: fnArgs.satuan || 'Tugas',
            tanggal: fnArgs.tanggal || todayStr,
          };

          const insReq = db.prepare(`
            INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
            VALUES (?, 'create_task', ?, ?, 'pending')
          `).run(user_id ? Number(user_id) : 1, desc, JSON.stringify(payload));

          const reqId = Number(insReq.lastInsertRowid);

          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
            VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
          `).run(
            user_id ? Number(user_id) : 1,
            'Izin Buat Tugas dari Asisten AI',
            `Miu ingin membuat tugas: "${fnArgs.aktivitas || 'Tugas Baru'}" (Target: ${t} ${fnArgs.satuan || 'Tugas'}). Izinkan?`,
            '/api/ai/actions',
            JSON.stringify({ action_request_id: reqId, action_type: 'create_task' })
          );

          actionPending = {
            id: reqId,
            user_id: user_id ? Number(user_id) : 1,
            action_type: 'create_task',
            description: desc,
            payload_json: JSON.stringify(payload),
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          aiResponseText = `✨ **Draft Tugas Siap!** ${sapaan}, gw udah rancang tugas **"${fnArgs.aktivitas}"** (**Target: ${t} ${fnArgs.satuan || 'Tugas'}**).\n\nDemi keamanan data lu, gw butuh izin dulu nih sebelum eksekusi ke sistem. Izinkan?`;
        } else if (fnName === 'create_note') {
          const desc = `Buat memo di Notes: "${fnArgs.title || 'Catatan Baru'}"`;
          const payload = {
            title: fnArgs.title || 'Catatan Baru',
            content: fnArgs.content || '',
            tags: fnArgs.tags || ['catatan', 'ai'],
            color: fnArgs.color || '#D2F27C',
          };

          const insReq = db.prepare(`
            INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
            VALUES (?, 'create_note', ?, ?, 'pending')
          `).run(user_id ? Number(user_id) : 1, desc, JSON.stringify(payload));

          const reqId = Number(insReq.lastInsertRowid);

          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
            VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
          `).run(
            user_id ? Number(user_id) : 1,
            'Izin Buat Catatan dari Asisten AI',
            `Miu ingin menyimpan catatan: "${fnArgs.title || 'Catatan Baru'}". Izinkan?`,
            '/api/ai/actions',
            JSON.stringify({ action_request_id: reqId, action_type: 'create_note' })
          );

          actionPending = {
            id: reqId,
            user_id: user_id ? Number(user_id) : 1,
            action_type: 'create_note',
            description: desc,
            payload_json: JSON.stringify(payload),
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          aiResponseText = `📝 **Draft Memo Siap!** ${sapaan}, memo **"${fnArgs.title}"** udah gw siapkan di Notes.\n\nButuh izin lu dulu ya biar resmi disimpan. Boleh gw eksekusi?`;
        } else if (fnName === 'create_calendar_event') {
          const desc = `Jadwalkan agenda: "${fnArgs.title || 'Jadwal Baru'}" pada ${fnArgs.date || todayStr}`;
          const payload = {
            title: fnArgs.title || 'Jadwal Baru',
            description: fnArgs.description || '',
            date: fnArgs.date || todayStr,
            start_time: fnArgs.start_time || '09:00',
            end_time: fnArgs.end_time || '10:00',
            category: fnArgs.category || 'meeting',
            color: '#D2F27C',
          };

          const insReq = db.prepare(`
            INSERT INTO ai_action_requests (user_id, action_type, description, payload_json, status)
            VALUES (?, 'create_event', ?, ?, 'pending')
          `).run(user_id ? Number(user_id) : 1, desc, JSON.stringify(payload));

          const reqId = Number(insReq.lastInsertRowid);

          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
            VALUES (?, ?, ?, 'ai_permission', ?, ?, 0)
          `).run(
            user_id ? Number(user_id) : 1,
            'Izin Jadwalkan Agenda dari Asisten AI',
            `Miu ingin menjadwalkan agenda: "${fnArgs.title || 'Jadwal Baru'}" pada ${fnArgs.date || todayStr}. Izinkan?`,
            '/api/ai/actions',
            JSON.stringify({ action_request_id: reqId, action_type: 'create_event' })
          );

          actionPending = {
            id: reqId,
            user_id: user_id ? Number(user_id) : 1,
            action_type: 'create_event',
            description: desc,
            payload_json: JSON.stringify(payload),
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          aiResponseText = `📅 **Agenda Siap Dijadwalkan!** ${sapaan}, agenda **"${fnArgs.title}"** (${fnArgs.date || todayStr} jam ${fnArgs.start_time || '09:00'}) udah siap.\n\nMau gw pasang di Kalender tim sekarang?`;
        } else if (fnName === 'get_projects_overview') {
          const allProjects = db.prepare(`
            SELECT p.*,
              COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi
            FROM projects p
          `).all();

          const summaryLines = allProjects.map((p: any) => {
            const pct = p.target_total > 0 ? Math.round((p.total_realisasi / p.target_total) * 100) : 0;
            return `• **${p.nama_proyek}** (${p.divisi}): ${pct}% (${p.total_realisasi}/${p.target_total} ${p.satuan}) [${p.status}]`;
          });

          actionResult = {
            type: 'project_info',
            title: `Rekap Proyek Aktif (${allProjects.length})`,
          };

          aiResponseText = `📊 **Rekap Progres Proyek (${allProjects.length} Proyek)** — Nih update-nya, ${sapaan}:\n\n${summaryLines.join('\n')}\n\nAda proyek spesifik yang mau lu gas atau ditambah tugasnya?`;
        } else if (fnName === 'get_team_status') {
          const isAffirmingNudge =
            lastUserLower.includes('colek') ||
            lastUserLower.includes('nudge') ||
            lastUserLower.includes('ingatkan') ||
            lastUserLower.includes('ingetin') ||
            lastUserLower.includes('anda colek') ||
            lastUserLower.includes('ya colek') ||
            lastUserLower === 'ya' ||
            lastUserLower === 'iya' ||
            lastUserLower.includes('ya anda colek') ||
            ((lastUserLower.includes('ya') || lastUserLower.includes('iya') || lastUserLower.includes('oke') || lastUserLower.includes('gass')) &&
              (prevContextMsg.toLowerCase().includes('colek') || prevContextMsg.toLowerCase().includes('setor')));

          if (isAffirmingNudge) {
            const res = executeNudge(db, sapaan, fnArgs, lastUserMsg, todayStr);
            aiResponseText = res.aiResponseText;
            toolExecuted = res.toolExecuted;
            actionResult = res.actionResult;
          } else {
            const allUsers = db.prepare("SELECT id, nama, divisi, role FROM users WHERE role != 'admin' OR username = 'fifa'").all();
            const todayInputs = db.prepare(`
              SELECT COALESCE(assigned_to_user_id, user_id) as effective_user_id,
                     COUNT(*) as total,
                     AVG(persentase) as avg_pct
              FROM realisasi
              WHERE tanggal = ? AND (realisasi > 0 OR assigned_by_user_id IS NULL)
              GROUP BY effective_user_id
            `).all(todayStr);
            const map = new Map(todayInputs.map((i: any) => [i.effective_user_id, i]));

            const statusLines = allUsers.map((u: any) => {
              const info: any = map.get(u.id);
              const status = info ? `✅ Sudah setor (${info.total} tugas, rata-rata ${Math.round(info.avg_pct)}%)` : '⏳ Belum input hari ini';
              return `• **${u.nama}** (${u.divisi}): ${status}`;
            });

            aiResponseText = `👥 **Pantauan Tim Hari Ini (${todayStr})** — Nih laporannya, ${sapaan}:\n\n${statusLines.join('\n')}\n\nMau gw colek yang belum setor?`;
          }
        } else if (fnName === 'get_productivity_recommendations') {
          const rawProjects = db.prepare(`
            SELECT p.*,
              COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi
            FROM projects p
          `).all() as any[];

          const allProjects = rawProjects.map((p: any) => {
            const target = Number(p.target_total) || 1;
            const total = Number(p.total_realisasi) || 0;
            return {
              ...p,
              persentase: Math.min(100, Math.round((total / target) * 100)),
            };
          });

          const pendingUsers = db.prepare(`
            SELECT u.nama, u.divisi FROM users u
            WHERE u.role != 'admin' AND u.id NOT IN (
              SELECT DISTINCT COALESCE(assigned_to_user_id, user_id) FROM realisasi
              WHERE tanggal = ? AND (realisasi > 0 OR assigned_by_user_id IS NULL)
            )
          `).all(todayStr) as any[];

          const lowProjects = allProjects.filter((p: any) => p.persentase < 50 && p.status === 'aktif');

          const tips = [
            `1. **Push Proyek Kritis**: Ada ${lowProjects.length} proyek aktif yang capaiannya masih di bawah 50% (${lowProjects.map((p) => p.nama_proyek).join(', ') || 'Semua aman di atas 50%'}). Alokasikan 2-3 tugas prioritas ke sana sekarang.`,
            `2. **Monitoring Harian Tim**: ${pendingUsers.length > 0 ? `${pendingUsers.length} orang (${pendingUsers.map((u) => u.nama).join(', ')}) belum setor realisasi. Colek santai sebelum jam 17:00 biar data gak bolong.` : 'Keren! Seluruh anggota tim udah disiplin setor realisasi hari ini.'}`,
            `3. **Pace Target Mingguan**: Jangan biarkan tugas menumpuk di akhir pekan. Sinkronkan deadline di tab Kalender biar sprint tim tetap stabil.`,
          ];

          actionResult = {
            type: 'recommendations',
            title: 'Rekomendasi Produktivitas Taktis',
          };

          aiResponseText = `💡 **3 Rekomendasi Taktis Hari Ini, ${sapaan}:**\n\n${tips.join('\n\n')}\n\nMau langsung gw bikinin tugas buat ngejar target proyeknya?`;
        } else if (
          fnName === 'delete_chat_group' ||
          fnName === 'delete_project' ||
          fnName === 'delete_task' ||
          fnName === 'delete_note' ||
          fnName === 'delete_calendar_event' ||
          fnName === 'delete_user' ||
          fnName === 'update_project_status' ||
          fnName === 'update_task' ||
          fnName === 'update_task_status' ||
          fnName === 'update_note'
        ) {
          const res = handleDangerousAction(db, user_id ? Number(user_id) : 1, sapaan, fnName === 'update_task_status' ? 'update_task' : fnName, fnArgs, lastUserMsg);
          actionPending = res.actionPending;
          aiResponseText = res.aiResponseText;
          toolExecuted = fnName;
        } else if (fnName === 'create_project_link') {
          const p = findProject(db, { id: fnArgs.project_id, name: fnArgs.project_name || fnArgs.target_name, text: lastUserMsg }) || db.prepare('SELECT id, nama_proyek FROM projects LIMIT 1').get() as any;
          const pId = p ? p.id : 1;
          const pName = p ? p.nama_proyek : 'Proyek';
          const title = (fnArgs.title || 'Tautan Resource').trim();
          const url = (fnArgs.url || 'https://').trim();
          let platform = fnArgs.platform || 'other';
          const lowUrl = url.toLowerCase();
          if (lowUrl.includes('drive.google.com')) platform = 'drive';
          else if (lowUrl.includes('figma.com')) platform = 'figma';
          else if (lowUrl.includes('notion.so') || lowUrl.includes('notion.site')) platform = 'notion';
          else if (lowUrl.includes('github.com') || lowUrl.includes('gitlab.com')) platform = 'github';
          else if (lowUrl.includes('docs.google.com/spreadsheets') || lowUrl.includes('airtable.com')) platform = 'sheets';

          const ins = db.prepare('INSERT INTO project_links (project_id, title, url, platform) VALUES (?, ?, ?, ?)').run(pId, title, url, platform);
          const linkId = Number(ins.lastInsertRowid);
          actionResult = {
            type: 'link_created',
            title: `Link "${title}" ditambahkan ke Resource Hub`,
            details: `${pName} (${platform.toUpperCase()})`,
            id: linkId,
          };
          aiResponseText = `🔗 **Tautan Berhasil Ditambahkan ke Resource Hub!** ${sapaan}, tautan **"${title}"** [${platform.toUpperCase()}] sudah langsung tersimpan di Resource Hub proyek **"${pName}"** ✨\n\nURL: [${url}](${url})`;
        } else if (fnName === 'delete_project_link') {
          const link = findProjectLink(db, { id: fnArgs.link_id, title: fnArgs.target_title, text: lastUserMsg, projectId: fnArgs.project_id });
          if (link) {
            db.prepare('DELETE FROM project_links WHERE id = ?').run(link.id);
            actionResult = {
              type: 'link_deleted',
              title: `Tautan "${link.title}" dihapus dari Resource Hub`,
              id: link.id,
            };
            aiResponseText = `🗑️ **Tautan Berhasil Dihapus!** ${sapaan}, tautan **"${link.title}"** telah dibersihkan dari Resource Hub proyek.`;
          } else {
            aiResponseText = `ℹ️ **Tautan Tidak Ditemukan**: ${sapaan}, tautan yang dimaksud tidak ditemukan di Resource Hub.`;
          }
        } else if (fnName === 'create_client_note') {
          const p = findProject(db, { id: fnArgs.project_id, name: fnArgs.project_name || fnArgs.target_name, text: lastUserMsg }) || db.prepare('SELECT id, nama_proyek FROM projects LIMIT 1').get() as any;
          const pId = p ? p.id : 1;
          const pName = p ? p.nama_proyek : 'Proyek';
          const author = (fnArgs.author_name || (user_nama ? `${user_nama} (Klien)` : 'Klien Tamu')).trim();
          const role = fnArgs.author_role === 'team' ? 'team' : 'client';
          const msg = (fnArgs.message || 'Catatan baru dari portal klien').trim();
          const cat = ['feedback', 'revisi', 'pertanyaan', 'apresiasi'].includes(fnArgs.category) ? fnArgs.category : 'feedback';

          const ins = db.prepare("INSERT INTO project_client_notes (project_id, author_name, author_role, message, category, status) VALUES (?, ?, ?, ?, ?, 'open')").run(pId, author, role, msg, cat);
          const noteId = Number(ins.lastInsertRowid);
          actionResult = {
            type: 'client_note_created',
            title: `Catatan Klien Dicatat (${cat.toUpperCase()})`,
            details: `Proyek: ${pName} - ${author}`,
            id: noteId,
          };
          aiResponseText = `💬 **Catatan Klien Berhasil Dicatat!** ${sapaan}, catatan/revisi dari **${author}** sudah resmi masuk ke portal klien proyek **"${pName}"**:\n\n• **Kategori:** ${cat.toUpperCase()}\n• **Pesan:** *"${msg}"*`;
        } else if (fnName === 'update_client_note_status') {
          const cn = findClientNote(db, { id: fnArgs.note_id, keyword: fnArgs.search_keyword, text: lastUserMsg, projectId: fnArgs.project_id });
          if (cn) {
            const st = ['open', 'in_progress', 'resolved'].includes(fnArgs.status) ? fnArgs.status : 'resolved';
            db.prepare('UPDATE project_client_notes SET status = ? WHERE id = ?').run(st, cn.id);
            actionResult = {
              type: 'client_note_updated',
              title: `Status Catatan Klien Diubah jadi "${st.toUpperCase()}"`,
              details: cn.author_name,
              id: cn.id,
            };
            aiResponseText = `✅ **Status Catatan Klien Diperbarui!** ${sapaan}, catatan dari **${cn.author_name}** (*"${cn.message.slice(0, 45)}..."*) sekarang berstatus **${st.toUpperCase()}** ✨`;
          } else {
            aiResponseText = `⚠️ **Catatan Klien Tidak Ditemukan**: ${sapaan}, catatan/revisi klien yang dimaksud tidak ditemukan.`;
          }
        } else if (fnName === 'toggle_note_pin') {
          const n = findNote(db, { id: fnArgs.note_id, name: fnArgs.target_title || fnArgs.title, text: lastUserMsg });
          if (n) {
            const curRow = db.prepare('SELECT pinned FROM notes WHERE id = ?').get(n.id) as any;
            const newPin = fnArgs.pinned !== undefined ? (fnArgs.pinned ? 1 : 0) : (curRow?.pinned ? 0 : 1);
            db.prepare('UPDATE notes SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newPin, n.id);
            actionResult = {
              type: 'note_pinned',
              title: `Catatan "${n.title}" ${newPin ? 'Disematkan (PIN)' : 'Dilepas PIN-nya'}`,
              id: n.id,
            };
            aiResponseText = `📌 **Status PIN Memo Diperbarui!** ${sapaan}, memo **"${n.title}"** sekarang sudah **${newPin ? 'DISEMATKAN (PIN) di atas' : 'DILEPAS dari sematan'}** di tab Notes.`;
          } else {
            aiResponseText = `⚠️ **Catatan Tidak Ditemukan**: ${sapaan}, memo yang ingin diatur pin-nya tidak ditemukan.`;
          }
        } else if (fnName === 'update_note_checklist') {
          const n = findNote(db, { id: fnArgs.note_id, name: fnArgs.target_title || fnArgs.title, text: lastUserMsg });
          if (n) {
            const curRow = db.prepare('SELECT checklist FROM notes WHERE id = ?').get(n.id) as any;
            let list: any[] = [];
            try { list = JSON.parse(curRow?.checklist || '[]'); } catch { list = []; }
            const itemText = (fnArgs.item_text || '').trim();
            const done = fnArgs.done !== undefined ? Boolean(fnArgs.done) : true;
            const foundIdx = list.findIndex((item: any, idx: number) =>
              String(idx + 1) === itemText || (item.text && item.text.toLowerCase().includes(itemText.toLowerCase()))
            );
            if (foundIdx >= 0) {
              list[foundIdx].done = done;
            } else if (itemText) {
              list.push({ id: String(Date.now()), text: itemText, done });
            }
            db.prepare('UPDATE notes SET checklist = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(list), n.id);
            actionResult = {
              type: 'checklist_updated',
              title: `Checklist Memo "${n.title}" Diperbarui`,
              details: itemText,
              id: n.id,
            };
            aiResponseText = `☑️ **Checklist Memo Diperbarui!** ${sapaan}, to-do checklist di memo **"${n.title}"** sudah ${done ? 'dicentang selesai (Done) ✅' : 'di-uncheck (Pending) ⏳'}.\n\nItem: *"${itemText}"*`;
          } else {
            aiResponseText = `⚠️ **Catatan Tidak Ditemukan**: ${sapaan}, memo yang ingin diubah checklist-nya tidak ditemukan.`;
          }
        } else if (fnName === 'update_calendar_event') {
          const e = findCalendarEvent(db, { id: fnArgs.event_id, name: fnArgs.target_title || fnArgs.title, text: lastUserMsg });
          if (e) {
            db.prepare(`
              UPDATE calendar_events
              SET title = COALESCE(?, title),
                  date = COALESCE(?, date),
                  start_time = COALESCE(?, start_time),
                  end_time = COALESCE(?, end_time),
                  description = COALESCE(?, description)
              WHERE id = ?
            `).run(
              fnArgs.title || null,
              fnArgs.date || null,
              fnArgs.start_time || null,
              fnArgs.end_time || null,
              fnArgs.description || null,
              e.id
            );
            actionResult = {
              type: 'event_rescheduled',
              title: `Agenda "${fnArgs.title || e.title}" Dijadwalkan Ulang`,
              details: `${fnArgs.date || 'Tanggal tetap'} jam ${fnArgs.start_time || 'Jam tetap'}`,
              id: e.id,
            };
            aiResponseText = `📅 **Agenda Kalender Berhasil Dijadwalkan Ulang!** ${sapaan}, agenda **"${fnArgs.title || e.title}"** sudah digeser ke **${fnArgs.date || 'tanggal tetap'}** pukul **${fnArgs.start_time || 'jam tetap'}** 🕒`;
          } else {
            aiResponseText = `⚠️ **Agenda Tidak Ditemukan**: ${sapaan}, jadwal kalender yang ingin di-reschedule tidak ditemukan.`;
          }
        } else if (fnName === 'get_unread_notifications') {
          const unreads = db.prepare(`
            SELECT id, title, message, type, created_at
            FROM notifications
            WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0
            ORDER BY id DESC LIMIT 5
          `).all(user_id ? Number(user_id) : 1) as any[];

          actionResult = {
            type: 'notifications_fetched',
            title: `Pusat Notifikasi (${unreads.length} Belum Dibaca)`,
          };
          aiResponseText = unreads.length > 0
            ? `🔔 **Notifikasi Belum Dibaca (${unreads.length} Pesan Baru), ${sapaan}:**\n\n${unreads.map((n) => `• [${n.type.toUpperCase()}] **${n.title}**: ${n.message}`).join('\n')}\n\nMau langsung gw tandai semua sudah dibaca?`
            : `🔔 **Pusat Notifikasi Bersih!** ${sapaan}, tidak ada notifikasi yang belum dibaca saat ini ✨`;
        } else if (fnName === 'mark_all_notifications_read') {
          db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL').run(user_id ? Number(user_id) : 1);
          actionResult = {
            type: 'notifications_read',
            title: 'Semua Notifikasi Ditandai Sudah Dibaca',
          };
          aiResponseText = `🔔 **Semua Notifikasi Ditandai Dibaca!** ${sapaan}, lonceng notifikasi lu sudah bersih 100% dan bebas unread ✨`;
        } else if (fnName === 'update_user') {
          const u = findUser(db, { id: fnArgs.user_id, username: fnArgs.username, name: fnArgs.target_name || fnArgs.nama, text: lastUserMsg });
          if (u) {
            db.prepare(`
              UPDATE users
              SET nama = COALESCE(?, nama),
                  divisi = COALESCE(?, divisi),
                  role = COALESCE(?, role),
                  gender = COALESCE(?, gender)
              WHERE id = ?
            `).run(
              fnArgs.nama || null,
              fnArgs.divisi || null,
              fnArgs.role || null,
              fnArgs.gender || null,
              u.id
            );
            actionResult = {
              type: 'user_updated',
              title: `Data Akun @${u.username} Diperbarui`,
              details: `${fnArgs.divisi || u.divisi} · ${fnArgs.role || u.role}`,
              id: u.id,
            };
            aiResponseText = `👤 **Data Anggota Tim Diperbarui!** ${sapaan}, akun **${fnArgs.nama || u.nama}** (@${u.username}) berhasil di-update:\n• **Divisi:** ${fnArgs.divisi || 'tetap'}\n• **Role:** ${fnArgs.role || 'tetap'}\n• **Gender:** ${fnArgs.gender || 'tetap'}`;
          } else {
            aiResponseText = `⚠️ **Pengguna Tidak Ditemukan**: ${sapaan}, akun user yang ingin di-update tidak ditemukan.`;
          }
        } else if (fnName === 'report_task_blocker') {
          const t = findTask(db, { id: fnArgs.task_id, name: fnArgs.target_name || fnArgs.aktivitas, text: lastUserMsg });
          if (t) {
            const kendala = (fnArgs.kendala || 'Terhalang kendala teknis').trim();
            const solusi = (fnArgs.solusi || '').trim();
            db.prepare('UPDATE realisasi SET kendala = ?, solusi = ? WHERE id = ?').run(kendala, solusi, t.id);
            db.prepare(`
              INSERT INTO notifications (user_id, title, message, type, action_url, payload_json, is_read)
              VALUES (?, 'Kendala Tugas Baru Dicatat', ?, 'task', '/?tab=input', ?, 0)
            `).run(user_id ? Number(user_id) : 1, `Tugas "${t.aktivitas}" mengalami kendala: "${kendala}".`, JSON.stringify({ task_id: t.id, blocker: true }));
            actionResult = {
              type: 'blocker_reported',
              title: `Kendala Tugas #${t.id} Dicatat`,
              details: kendala,
              id: t.id,
            };
            aiResponseText = `⚠️ **Kendala Tugas Berhasil Direkam!** ${sapaan}, blocker pada tugas **"${t.aktivitas}"** sudah tercatat di sistem:\n\n• **Kendala:** ${kendala}\n• **Rencana Solusi:** ${solusi || 'Menunggu koordinasi tim'}\n\nNotifikasi pemantauan telah aktif di dashboard tim!`;
          } else {
            aiResponseText = `⚠️ **Tugas Tidak Ditemukan**: ${sapaan}, tugas yang mengalami kendala tidak ditemukan.`;
          }
        } else if (fnName === 'resolve_task_blocker') {
          const t = findTask(db, { id: fnArgs.task_id, name: fnArgs.target_name || fnArgs.aktivitas, text: lastUserMsg });
          if (t) {
            const solusi = (fnArgs.solusi || 'Kendala selesai ditangani').trim();
            db.prepare("UPDATE realisasi SET kendala = '', solusi = ? WHERE id = ?").run(solusi, t.id);
            actionResult = {
              type: 'blocker_resolved',
              title: `Kendala Tugas #${t.id} Resmi Teratasi`,
              details: solusi,
              id: t.id,
            };
            aiResponseText = `🎉 **Kendala Tugas Resmi Teratasi!** ${sapaan}, tugas **"${t.aktivitas}"** sekarang sudah unblocked!\n\n• **Solusi:** ${solusi}\n\nProgres kerja kembali lancar tanpa hambatan! 🚀`;
          } else {
            aiResponseText = `⚠️ **Tugas Tidak Ditemukan**: ${sapaan}, tugas yang ingin diselesaikan kendalanya tidak ditemukan.`;
          }
        } else if (fnName === 'get_sprint_analytics_summary') {
          const analytics = computeSprintAnalytics(db);
          const divLines = analytics.divisionStats.map((d) => `• **${d.divisi}**: Rata-rata ${d.avgPct}% (${d.tercapai}/${d.total} tugas selesai${d.blockers > 0 ? `, ⚠️ ${d.blockers} kendala` : ''})`).join('\n');
          actionResult = {
            type: 'sprint_analytics',
            title: `Laporan Sprint: Efisiensi ${analytics.avgPct}%`,
          };
          aiResponseText = `📈 **Laporan Analitik Sprint Eksekutif, ${sapaan}:**\n\n• **Efisiensi Rata-rata Tim:** **${analytics.avgPct}%** (${analytics.tercapaiTasks}/${analytics.totalTasks} tugas selesai)\n• **Divisi Tercepat (Sprint Leader):** **${analytics.fastestDiv.divisi}** (${analytics.fastestDiv.avgPct}%)\n• **Divisi Bottleneck:** **${analytics.slowestDiv.divisi}** (${analytics.slowestDiv.avgPct}%)\n• **Kendala Aktif:** **${analytics.activeBlockers.length} tugas** butuh penanganan\n\n**Performa Per Divisi:**\n${divLines}\n\nMau gw alokasikan tugas bantuan ke divisi ${analytics.slowestDiv.divisi}?`;
        } else if (fnName === 'nudge_user') {
          const res = executeNudge(db, sapaan, fnArgs, lastUserMsg, todayStr, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (fnName === 'send_chat_message') {
          const res = executeSendChatMessage(db, sapaan, fnArgs, lastUserMsg, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (fnName === 'add_group_member') {
          const res = executeAddGroupMember(db, sapaan, fnArgs, lastUserMsg, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (fnName === 'remove_group_member') {
          const res = executeRemoveGroupMember(db, sapaan, fnArgs, lastUserMsg, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (fnName === 'plan_tasks') {
          const res = executePlanTasks(db, sapaan, fnArgs, lastUserMsg, user_id ? Number(user_id) : 1, user_divisi || 'Operasional', todayStr, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        }
      } else if (aiMessage?.content) {
        aiResponseText = aiMessage.content;

        // Ultra Universal Anti-Refusal Interceptor & Multi-Action Pipeline
        const aiLower = aiResponseText.toLowerCase();
        const llmRefusedAny =
          aiLower.includes('nggak bisa') ||
          aiLower.includes('tidak bisa') ||
          aiLower.includes('gak bisa') ||
          aiLower.includes('tidak dapat') ||
          aiLower.includes('nggak ada fitur') ||
          aiLower.includes('tidak ada fitur') ||
          aiLower.includes('cuma bisa dilakukan manual') ||
          aiLower.includes('cuma bisa manual') ||
          aiLower.includes('hanya bisa manual') ||
          aiLower.includes('hanya bisa dilakukan manual') ||
          aiLower.includes('bukan wewenang');

        const isNudgeIntent =
          (lastUserLower.includes('colek') || lastUserLower.includes('nudge') || lastUserLower.includes('ingatkan') || lastUserLower.includes('reminder') || lastUserLower.includes('pengingat')) ||
          ((lastUserLower.includes('ya') || lastUserLower.includes('iya') || lastUserLower === 'anda colek' || lastUserLower.includes('ya anda colek')) && (prevContextMsg.toLowerCase().includes('colek') || lastUserLower.includes('colek') || prevContextMsg.toLowerCase().includes('belum setor'))) ||
          (llmRefusedAny && (aiLower.includes('reminder') || aiLower.includes('colek') || aiLower.includes('pesan pribadi') || aiLower.includes('notifikasi langsung')));

        // Chained Multi-Action: Masuk Grup + Tag / Mention
        const isAddAndTagIntent =
          (lastUserLower.includes('masukin') || lastUserLower.includes('masukkan') || lastUserLower.includes('tambah')) &&
          (lastUserLower.includes('tag') || lastUserLower.includes('mention')) &&
          (lastUserLower.includes('grup') || lastUserLower.includes('group') || lastUserLower.includes('besti') || lastUserLower.includes('bestie'));

        const isAddMemberIntent =
          isAddAndTagIntent ||
          ((lastUserLower.includes('masukin') || lastUserLower.includes('masukkan') || lastUserLower.includes('tambah') || lastUserLower.includes('invite') || lastUserLower.includes('add')) &&
            (lastUserLower.includes('grup') || lastUserLower.includes('group') || Boolean(findChatGroup(db, { text: lastUserMsg }))) &&
            !lastUserLower.includes('buat grup') && !lastUserLower.includes('bikin grup') && !lastUserLower.includes('hapus grup')) ||
          lastUserLower.includes('di grup yg udah ada') ||
          lastUserLower.includes('ke grup yg udah ada') ||
          lastUserLower.includes('grup yang sudah ada') ||
          (llmRefusedAny && (aiLower.includes('tambah anggota') || aiLower.includes('invite') || aiLower.includes('add member') || aiLower.includes('grup yang udah ada')));

        const isSendChatIntent =
          !isAddAndTagIntent &&
          (lastUserLower.includes('kirim pesan') || lastUserLower.includes('ketik pesan') || lastUserLower.includes('tag di grup') || lastUserLower.includes('mention di grup') || (lastUserLower.includes('tag') && lastUserLower.includes('grup')) ||
            (llmRefusedAny && (aiLower.includes('ngetik') || aiLower.includes('mention') || aiLower.includes('tag') || aiLower.includes('grup chat'))));

        const isRemoveMemberIntent =
          (lastUserLower.includes('keluarkan') || lastUserLower.includes('kick') || (lastUserLower.includes('hapus') && (lastUserLower.includes('anggota') || lastUserLower.includes('member')))) &&
          (lastUserLower.includes('grup') || lastUserLower.includes('group'));

        const isTaskPlanningIntent =
          lastUserLower.includes('task planning') ||
          lastUserLower.includes('rencana kerja sprint') ||
          lastUserLower.includes('rencana kerja') ||
          lastUserLower.includes('perencanaan tugas') ||
          lastUserLower.includes('sprint planning') ||
          (lastUserLower.includes('planning') && (lastUserLower.includes('tugas') || lastUserLower.includes('sprint') || lastUserLower.includes('proyek')));

        if (isNudgeIntent) {
          const res = executeNudge(db, sapaan, {}, lastUserMsg, todayStr, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (isAddMemberIntent) {
          // If user also wants to tag, executeAddGroupMember naturally handles tag insertion
          const res = executeAddGroupMember(db, sapaan, {}, lastUserMsg, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (isSendChatIntent) {
          const res = executeSendChatMessage(db, sapaan, {}, lastUserMsg, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (isRemoveMemberIntent) {
          const res = executeRemoveGroupMember(db, sapaan, {}, lastUserMsg, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        } else if (isTaskPlanningIntent) {
          const res = executePlanTasks(db, sapaan, {}, lastUserMsg, user_id ? Number(user_id) : 1, user_divisi || 'Operasional', todayStr, prevContextMsg);
          aiResponseText = res.aiResponseText;
          toolExecuted = res.toolExecuted;
          actionResult = res.actionResult;
          if (res.uiAction) uiAction = res.uiAction;
        }

        // Defense-in-depth: If user was asking for out-of-scope code/homework and the AI attempted to give code blocks
        if (isOutOfScope) {
          isOutOfScopeRefusal = true;
          // If the model mistakenly provided code instead of refusing, override it with the official polite refusal
          if (aiResponseText.includes('```') || !aiResponseText.toLowerCase().includes('operasional')) {
            aiResponseText = `⚠️ **Permintaan di Luar Ruang Lingkup Operasional.**\n\n${refusalExample}`;
          }
        } else if (
          aiResponseText.toLowerCase().includes('bukan peruntukan') ||
          aiResponseText.toLowerCase().includes('nggak dirancang untuk bikin codingan') ||
          aiResponseText.toLowerCase().includes('luar operasional') ||
          aiResponseText.toLowerCase().includes('luar ruang lingkup')
        ) {
          isOutOfScopeRefusal = true;
        } else if (
          aiResponseText.toLowerCase().includes('klarifikasi') ||
          aiResponseText.toLowerCase().includes('nama projectnya apa') ||
          aiResponseText.toLowerCase().includes('nama proyeknya apa') ||
          aiResponseText.toLowerCase().includes('nama proyek') ||
          aiResponseText.toLowerCase().includes('target total berapa') ||
          aiResponseText.toLowerCase().includes('target total') ||
          aiResponseText.toLowerCase().includes('nggak boleh ngasal') ||
          aiResponseText.toLowerCase().includes('gak bisa asal') ||
          aiResponseText.toLowerCase().includes('tunggu dulu') ||
          aiResponseText.toLowerCase().includes('butuh info') ||
          aiResponseText.toLowerCase().includes('butuh detail') ||
          aiResponseText.toLowerCase().includes('tolong kirim') ||
          aiResponseText.toLowerCase().includes('sebelum bikin project')
        ) {
          isCriticalReject = true;
        }
      } else {
        aiResponseText = `Hai ${firstName}! Gw Miu siap bantuin lu kelola tugas, catat memo di Notes, atur jadwal Kalender, atau pantau progres proyek tim. Ketik aja apa yang lu butuhin, ${sapaan}! 🚀`;
      }

      // Destructive / Deletion & Mutation Interceptor Safety Net for LLM responses
      if (!actionPending && !isOutOfScope) {
        const isDeleteAllData =
          (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('bersihkan') || lastUserLower.includes('wipe') || lastUserLower.includes('reset')) &&
          (lastUserLower.includes('semua data') || lastUserLower.includes('database') || lastUserLower.includes('seluruh data') || lastUserLower === 'hapus semua' || lastUserLower === 'delete all');

        const isDeleteGroup =
          (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('bersihkan') || lastUserLower.includes('buang') || lastUserLower.includes('wipe') || lastUserLower.includes('remove') || lastUserLower.includes('drop')) &&
          (lastUserLower.includes('grup') || lastUserLower.includes('group') || lastUserLower.includes('obrolan') || lastUserLower.includes('room'));

        const isDeleteProject =
          (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang') || lastUserLower.includes('drop')) &&
          (lastUserLower.includes('proyek') || lastUserLower.includes('project'));

        const isDeleteTask =
          (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang')) &&
          (lastUserLower.includes('tugas') || lastUserLower.includes('task') || lastUserLower.includes('realisasi'));

        const isDeleteNote =
          (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang')) &&
          (lastUserLower.includes('note') || lastUserLower.includes('memo') || lastUserLower.includes('catatan'));

        const isDeleteCalendar =
          (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('buang') || lastUserLower.includes('batalkan')) &&
          (lastUserLower.includes('kalender') || lastUserLower.includes('agenda') || lastUserLower.includes('event') || lastUserLower.includes('jadwal'));

        const isDeleteUser =
          (lastUserLower.includes('hapus') || lastUserLower.includes('delete') || lastUserLower.includes('kick') || lastUserLower.includes('buang')) &&
          (lastUserLower.includes('user') || lastUserLower.includes('pengguna') || lastUserLower.includes('anggota') || lastUserLower.includes('karyawan') || lastUserLower.includes('akun'));

        const isUpdateProject =
          (lastUserLower.includes('selesaikan') || lastUserLower.includes('arsipkan') || lastUserLower.includes('ubah status') || lastUserLower.includes('update status')) &&
          (lastUserLower.includes('proyek') || lastUserLower.includes('project'));

        const isUpdateTask =
          lastUserLower.includes('update tugas') || lastUserLower.includes('ubah tugas') || lastUserLower.includes('perbarui tugas');

        const isUpdateNote =
          (lastUserLower.includes('update') || lastUserLower.includes('ubah') || lastUserLower.includes('perbarui')) &&
          (lastUserLower.includes('catatan') || lastUserLower.includes('memo') || lastUserLower.includes('note')) &&
          !lastUserLower.includes('checklist') &&
          !lastUserLower.includes('pin') &&
          !lastUserLower.includes('sematkan');

        // Check if LLM refused in text or user requested deletion/mutation
        const llmRefusedDelete =
          aiResponseText.toLowerCase().includes('nggak bisa hapus') ||
          aiResponseText.toLowerCase().includes('tidak bisa hapus') ||
          aiResponseText.toLowerCase().includes('gak bisa hapus') ||
          aiResponseText.toLowerCase().includes('nggak bisa menghapus') ||
          aiResponseText.toLowerCase().includes('tidak bisa menghapus') ||
          aiResponseText.toLowerCase().includes('gak bisa menghapus') ||
          aiResponseText.toLowerCase().includes('tidak dapat menghapus') ||
          aiResponseText.toLowerCase().includes('bukan wewenang') ||
          aiResponseText.toLowerCase().includes('tidak ada fitur') ||
          aiResponseText.toLowerCase().includes('tidak ada perintah') ||
          aiResponseText.toLowerCase().includes('tidak ada tombol') ||
          aiResponseText.toLowerCase().includes('fitur yang gw punya cuma') ||
          aiResponseText.toLowerCase().includes('fitur yang gue punya cuma') ||
          aiResponseText.toLowerCase().includes('fitur ngga ada') ||
          aiResponseText.toLowerCase().includes('fitur gak ada') ||
          aiResponseText.toLowerCase().includes('hanya bisa membuat') ||
          aiResponseText.toLowerCase().includes('cuma bisa membuat');

        const detectedAction = isDeleteAllData ? 'delete_all_data'
          : isDeleteGroup ? 'delete_chat_group'
          : isDeleteProject ? 'delete_project'
          : isDeleteTask ? 'delete_task'
          : isDeleteNote ? 'delete_note'
          : isDeleteCalendar ? 'delete_calendar_event'
          : isDeleteUser ? 'delete_user'
          : isUpdateProject ? 'update_project_status'
          : isUpdateTask ? 'update_task'
          : isUpdateNote ? 'update_note'
          : null;

        if (detectedAction || llmRefusedDelete) {
          let actToRun = detectedAction;
          if (!actToRun && llmRefusedDelete) {
            const aiLower = aiResponseText.toLowerCase();
            actToRun = (aiLower.includes('grup') || aiLower.includes('group')) ? 'delete_chat_group'
              : (aiLower.includes('proyek') || aiLower.includes('project')) ? 'delete_project'
              : (aiLower.includes('tugas') || aiLower.includes('task')) ? 'delete_task'
              : (aiLower.includes('note') || aiLower.includes('catatan') || aiLower.includes('memo')) ? 'delete_note'
              : (aiLower.includes('kalender') || aiLower.includes('agenda')) ? 'delete_calendar_event'
              : (aiLower.includes('user') || aiLower.includes('pengguna')) ? 'delete_user'
              : 'delete_chat_group';
          }
          if (actToRun) {
            const res = handleDangerousAction(db, user_id ? Number(user_id) : 1, sapaan, actToRun, {}, lastUserMsg);
            if (res.actionPending) {
              actionPending = res.actionPending;
              toolExecuted = actToRun;
              aiResponseText = res.aiResponseText;
            } else if (res.aiResponseText) {
              aiResponseText = res.aiResponseText;
            }
          }
        }
      }
    } catch (apiError) {
      console.warn('Fallback local execution due to:', apiError);

      if (isOutOfScope) {
        isOutOfScopeRefusal = true;
        aiResponseText = `⚠️ **Permintaan di Luar Ruang Lingkup Operasional.**\n\n${refusalExample}`;
      } else {
        const autoRes = executeAutonomousIntent({
          db,
          sapaan,
          lastUserMsg,
          lastUserLower,
          user_id,
          user_nama,
          user_divisi,
          todayStr,
          firstName,
          prevContextMsg,
        });
        aiResponseText = autoRes.aiResponseText;
        if (autoRes.actionResult) actionResult = autoRes.actionResult;
        if (autoRes.actionPending) actionPending = autoRes.actionPending;
        if (autoRes.uiAction) uiAction = autoRes.uiAction;
        if (autoRes.toolExecuted) toolExecuted = autoRes.toolExecuted;
      }
    }

    // ==============================================================================
    // 9. SERVER-SIDE ANTI-REFUSAL INTERCEPTOR (CRUCIAL):
    // If the LLM ever outputs any Indonesian refusal phrase (e.g. /(nggak bisa|tidak bisa|cuma bisa dilakukan manual|fitur.*belum ada|tidak ada fitur|hanya bisa.*aplikasi)/i):
    // The server MUST intercept it, map the user's intent to the appropriate tool or staged action,
    // execute it, and rewrite the reply so the AI NEVER says "nggak bisa" or refuses a user command again!
    // ==============================================================================
    const refusalRegex = /(nggak bisa|tidak bisa|gak bisa|ngga bisa|tidak dapat|cuma bisa|hanya bisa|fitur.*(belum|tidak|gak)|(belum|tidak|gak).*fitur|bukan wewenang|tidak punya akses|tidak memiliki akses|tidak berwenang|belum mendukung|belum tersedia|hanya asisten|tidak memiliki kemampuan|tidak ada opsi|(?:cuma|hanya|harus|dilakukan secara)\s+manual)/i;

    if (!isOutOfScope && refusalRegex.test(aiResponseText)) {
      const autoRes = executeAutonomousIntent({
        db,
        sapaan,
        lastUserMsg,
        lastUserLower,
        user_id,
        user_nama,
        user_divisi,
        todayStr,
        firstName,
        prevContextMsg,
      });
      aiResponseText = autoRes.aiResponseText;
      if (autoRes.actionResult) actionResult = autoRes.actionResult;
      if (autoRes.actionPending) actionPending = autoRes.actionPending;
      if (autoRes.uiAction) uiAction = autoRes.uiAction;
      if (autoRes.toolExecuted) toolExecuted = autoRes.toolExecuted;
    }

    const elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
    const systemLog = buildSystemExecutionLog(
      toolExecuted,
      uiAction,
      actionPending,
      actionResult,
      isCriticalReject,
      isOutOfScopeRefusal
    );
    let thinkingProcess = nativeReasoning;
    if (!thinkingProcess) {
      thinkingProcess = systemLog;
    } else if (systemLog && (toolExecuted || uiAction || actionPending || actionResult)) {
      thinkingProcess = `${thinkingProcess}\n\n${systemLog}`;
    }

    const suggestions = generateSuggestions({
      lastUserMsg,
      aiResponseText,
      actionPending,
      toolExecuted,
      uiAction,
      isCriticalReject,
      isOutOfScopeRefusal,
    });

    return NextResponse.json({
      role: 'assistant',
      content: aiResponseText,
      actionResult,
      actionPending,
      uiAction,
      thinking_process: thinkingProcess,
      thinking_time: elapsedSeconds,
      thinking_mode,
      selected_model: resolvedModel,
      model: resolvedModel,
      suggestions,
      compacted: shouldCompact,
      compactCount: compactCount,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memproses permintaan AI';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
