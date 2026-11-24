export type UserType = {
  id: number;
  username: string;
  nama: string;
  divisi: string;
  role: "admin" | "karyawan";
  gender?: "female" | "male";
  avatar_url?: string;
  phone?: string;
};

export type PersonalTodoType = {
  id: string;
  user_id: number;
  title: string;
  tag: string;
  time?: string;
  done: boolean;
  created_at: string;
};

export type ProjectLinkType = {
  id: number;
  project_id: number;
  title: string;
  url: string;
  platform: "drive" | "notion" | "figma" | "github" | "sheets" | "other";
  created_at: string;
};

export type ProjectClientNoteType = {
  id: number;
  project_id: number;
  author_name: string;
  author_role: "client" | "team";
  message: string;
  category: "feedback" | "revisi" | "pertanyaan" | "apresiasi";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
};

export type ProjectType = {
  id: number;
  nama_proyek: string;
  pic_id: number | null;
  pic_nama: string | null;
  divisi: string;
  target_total: number;
  total_realisasi: number;
  jumlah_laporan: number;
  satuan: string;
  status: string;
  deadline?: string;
  persentase: number;
  links?: ProjectLinkType[];
};

export type RealisasiType = {
  id: number;
  project_id: number | null;
  nama_proyek: string | null;
  user_id: number;
  nama: string;
  divisi: string;
  tanggal: string;
  aktivitas: string;
  target: number;
  realisasi: number;
  satuan: string;
  persentase: number;
  status: string;
  kendala?: string;
  solusi?: string;
  bukti_foto_url?: string;
};

export type MonitoringType = {
  today: string;
  statusTim: Array<{
    id: number;
    nama: string;
    divisi: string;
    sudah_input: boolean;
    jumlah_input: number;
    rata_persen: number;
  }>;
  tren7Hari: Array<{
    tanggal: string;
    jumlah_laporan: number;
    rata_persen: number;
  }>;
};

export type NoteType = {
  id: number;
  user_id: number;
  author_nama?: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  color: string;
  project_id: number | null;
  project_nama?: string | null;
  checklist?: Array<{ id: string; text: string; done: boolean }>;
  created_at: string;
  updated_at: string;
};

export type CalendarEventType = {
  id: number;
  user_id: number | null;
  user_nama?: string | null;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  category: "activity" | "deadline" | "meeting" | "milestone";
  color: string;
  project_id: number | null;
  project_nama?: string | null;
  created_at: string;
};

export type AIMessageType = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  actionResult?: {
    type:
      | "task_created"
      | "note_created"
      | "event_created"
      | "project_created"
      | "group_created"
      | "user_created"
      | "ui_navigated"
      | "project_info"
      | "advice"
      | "recommendations"
      | "link_created"
      | "link_deleted"
      | "client_note_created"
      | "client_note_updated"
      | "note_pinned"
      | "checklist_updated"
      | "event_rescheduled"
      | "notifications_fetched"
      | "notifications_read"
      | "user_updated"
      | "blocker_reported"
      | "blocker_resolved"
      | "sprint_analytics"
      | "nudge_sent"
      | "message_sent"
      | string;
    title: string;
    details?: string;
    id?: number;
  };
  actionPending?: AIActionRequestType;
  thinkingProcess?: string;
  thinkingTime?: number;
  thinkingMode?: "low" | "medium" | "high" | "native" | "direct" | string;
  model?: string;
  suggestions?: string[];
  uiAction?: {
    action: "open_project" | "navigate_tab" | "open_chat_group" | "open_note";
    tab: TabType;
    projectId?: number;
    projectName?: string;
    groupId?: number;
    groupName?: string;
    filterView?: ViewModeType;
    reason?: string;
  };
  compacted?: boolean;
  compactCount?: number;
};

export type NotificationType = {
  id: number;
  user_id: number | null;
  title: string;
  message: string;
  type: "chat" | "ai_permission" | "task" | "client" | "system";
  action_url?: string;
  payload_json?: string;
  is_read: boolean;
  created_at: string;
};

export type AIActionRequestType = {
  id: number;
  user_id: number;
  action_type:
    | "create_task"
    | "create_note"
    | "update_note"
    | "create_event"
    | "update_project"
    | "create_project"
    | "create_chat_group"
    | "create_user"
    | "create_project_link"
    | "delete_project_link"
    | "create_client_note"
    | "update_client_note_status"
    | "toggle_note_pin"
    | "update_note_checklist"
    | "update_calendar_event"
    | "mark_all_notifications_read"
    | "update_user"
    | "report_task_blocker"
    | "resolve_task_blocker"
    | "delete_all_data"
    | "wipe_database"
    | "delete_chat_group"
    | "delete_all_chat_groups"
    | "delete_project"
    | "delete_all_projects"
    | "delete_task"
    | "delete_all_tasks"
    | "delete_note"
    | "delete_all_notes"
    | "delete_calendar_event"
    | "delete_all_calendar_events"
    | "delete_user"
    | "update_project_status"
    | "update_task_status"
    | "nudge_user"
    | "send_chat_message"
    | "add_group_member"
    | "remove_group_member"
    | "plan_tasks"
    | string;
  description: string;
  payload_json: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type ChatGroupMemberType = {
  id: number;
  group_id: number;
  user_id: number;
  nama: string;
  username: string;
  divisi: string;
  user_role: string;
  avatar_url?: string;
  role: "admin" | "member";
  joined_at: string;
};

export type ChatGroupType = {
  id: number;
  name: string;
  description: string;
  project_id: number | null;
  project_nama?: string | null;
  connected_projects?: Array<{
    id: number;
    nama_proyek: string;
    divisi: string;
    persentase: number;
    target_total?: number;
    total_realisasi?: number;
    satuan?: string;
    status?: string;
    deadline?: string;
    kendala_count?: number;
  }>;
  created_by: number;
  creator_nama?: string;
  ai_name?: string;
  ai_model?: string;
  ai_thinking_mode?: 'low' | 'medium' | 'high' | string;
  created_at: string;
  unread_count?: number;
  message_count?: number;
  members_count?: number;
  is_admin?: boolean;
  members?: ChatGroupMemberType[];
  last_message?: string;
  last_message_time?: string;
};

export type ChatMessageType = {
  id: number;
  group_id: number;
  user_id: number | null;
  sender_name: string;
  message: string;
  is_ai: boolean;
  reply_to_id?: number | null;
  reply_to_sender?: string | null;
  reply_to_text?: string | null;
  reasoning_text?: string;
  created_at: string;
};

export type TabType = "home" | "projects" | "calendar" | "notes" | "chat" | "input" | "reports" | "profile";
export type ViewModeType = "pribadi" | "tim";
