export function validateHttpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

export function isValidIsoDate(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val);
}

export function isValidTimeHHMM(val: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(val);
}

export function clampStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export interface ValidatedRealisasiInput {
  project_id: number | null;
  assigned_to_user_id: number | null;
  assigned_by_user_id: number | null;
  deadline: string;
  tanggal: string;
  aktivitas: string;
  target: number;
  realisasi: number;
  satuan: string;
  kendala: string;
  solusi: string;
  bukti_foto_url: string;
}

export function validateRealisasiCreate(body: Record<string, unknown>): {
  ok: true;
  data: ValidatedRealisasiInput;
} | {
  ok: false;
  error: string;
} {
  const aktivitas = clampStr(body.aktivitas, 500);
  if (!aktivitas || aktivitas === '-') {
    return { ok: false, error: 'Deskripsi aktivitas tugas wajib diisi secara jelas (tidak boleh "-" atau kosong).' };
  }

  const target = Number(body.target);
  const realisasi = Number(body.realisasi ?? 0);
  if (!Number.isFinite(target) || target <= 0 || target > 1000000) {
    return { ok: false, error: 'Target capaian harus berupa angka positif yang valid.' };
  }
  if (!Number.isFinite(realisasi) || realisasi < 0 || realisasi > 1000000) {
    return { ok: false, error: 'Realisasi tidak boleh negatif atau melebihi batas wajar.' };
  }

  const rawDate = clampStr(body.tanggal, 20) || new Date().toISOString().slice(0, 10);
  if (!isValidIsoDate(rawDate)) {
    return { ok: false, error: 'Format tanggal wajib YYYY-MM-DD.' };
  }

  const rawDeadline = clampStr(body.deadline, 20);
  if (rawDeadline && !isValidIsoDate(rawDeadline)) {
    return { ok: false, error: 'Format deadline wajib YYYY-MM-DD.' };
  }

  const rawPhoto = clampStr(body.bukti_foto_url, 2048);
  if (rawPhoto && !validateHttpUrl(rawPhoto)) {
    return { ok: false, error: 'URL bukti foto hanya boleh menggunakan protokol http:// atau https://.' };
  }

  return {
    ok: true,
    data: {
      project_id: body.project_id ? Number(body.project_id) : null,
      assigned_to_user_id: body.assigned_to_user_id
        ? Number(body.assigned_to_user_id)
        : body.user_id
        ? Number(body.user_id)
        : null,
      assigned_by_user_id: body.assigned_by_user_id ? Number(body.assigned_by_user_id) : null,
      deadline: rawDeadline,
      tanggal: rawDate,
      aktivitas,
      target,
      realisasi,
      satuan: clampStr(body.satuan, 60) || 'Tugas',
      kendala: clampStr(body.kendala, 1000),
      solusi: clampStr(body.solusi, 1000),
      bukti_foto_url: rawPhoto,
    },
  };
}

export function validateProjectCreate(body: Record<string, unknown>): {
  ok: true;
  data: {
    nama_proyek: string;
    divisi: string;
    target_total: number;
    satuan: string;
    status: string;
    deadline: string;
    pic_id: number | null;
    member_ids: number[];
  };
} | {
  ok: false;
  error: string;
} {
  const nama_proyek = clampStr(body.nama_proyek || body.nama, 200);
  if (!nama_proyek || nama_proyek.length < 2) {
    return { ok: false, error: 'Nama proyek minimal 2 karakter.' };
  }

  const target_total = Number(body.target_total ?? 100);
  if (!Number.isFinite(target_total) || target_total <= 0 || target_total > 10000000) {
    return { ok: false, error: 'Target total proyek harus lebih dari 0.' };
  }

  const rawStatus = clampStr(body.status, 30) || 'aktif';
  const status = ['aktif', 'selesai', 'arsip'].includes(rawStatus) ? rawStatus : 'aktif';

  const deadline = clampStr(body.deadline, 20);
  if (deadline && !isValidIsoDate(deadline)) {
    return { ok: false, error: 'Format deadline proyek wajib YYYY-MM-DD.' };
  }

  const memberIds: number[] = [];
  if (Array.isArray(body.member_ids)) {
    for (const m of body.member_ids) {
      const n = Number(m);
      if (Number.isInteger(n) && n > 0) memberIds.push(n);
    }
  }

  return {
    ok: true,
    data: {
      nama_proyek,
      divisi: clampStr(body.divisi, 80) || 'Umum',
      target_total,
      satuan: clampStr(body.satuan, 50) || 'Tugas',
      status,
      deadline,
      pic_id: body.pic_id ? Number(body.pic_id) : null,
      member_ids: memberIds,
    },
  };
}

export function validateUserCreate(body: Record<string, unknown>): {
  ok: true;
  data: {
    username: string;
    password: string;
    nama: string;
    divisi: string;
    role: 'admin' | 'karyawan';
    gender: 'male' | 'female';
    phone: string;
  };
} | {
  ok: false;
  error: string;
} {
  const username = clampStr(body.username, 32).toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return { ok: false, error: 'Username harus 3–32 karakter alfanumerik, titik, strip, atau underscore.' };
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 4 || password.length > 128) {
    return { ok: false, error: 'Password minimal 4 karakter.' };
  }
  const nama = clampStr(body.nama, 100);
  if (nama.length < 2) {
    return { ok: false, error: 'Nama lengkap minimal 2 karakter.' };
  }
  const role = body.role === 'admin' ? 'admin' : 'karyawan';
  const gender = body.gender === 'female' ? 'female' : 'male';
  const phone = clampStr(body.phone, 24).replace(/[^\d+]/g, '');

  return {
    ok: true,
    data: {
      username,
      password,
      nama,
      divisi: clampStr(body.divisi, 80) || 'Umum',
      role,
      gender,
      phone,
    },
  };
}
