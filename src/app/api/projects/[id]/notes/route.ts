import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/projects/[id]/notes - Fetch internal notes linked to this project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    if (!projectId) {
      return NextResponse.json({ error: "ID proyek tidak valid" }, { status: 400 });
    }

    const db = getDb();
    const rows = db
      .prepare(`
        SELECT n.*, u.nama as author_nama, p.nama_proyek as project_nama
        FROM notes n
        LEFT JOIN users u ON n.user_id = u.id
        LEFT JOIN projects p ON n.project_id = p.id
        WHERE n.project_id = ?
        ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
      `)
      .all(projectId) as Array<Record<string, unknown>>;

    const notes = rows.map((r) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse((r.tags as string) || "[]");
      } catch {
        parsedTags = ((r.tags as string) || "").split(",").map((t) => t.trim()).filter(Boolean);
      }

      let parsedChecklist: Array<{ id: string; text: string; done: boolean }> = [];
      try {
        parsedChecklist = JSON.parse((r.checklist as string) || "[]");
      } catch {
        parsedChecklist = [];
      }

      return {
        ...r,
        pinned: Boolean(r.pinned),
        tags: parsedTags,
        checklist: parsedChecklist,
      };
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Gagal mengambil catatan proyek internal:", error);
    return NextResponse.json({ error: "Gagal memuat catatan proyek" }, { status: 500 });
  }
}

// POST /api/projects/[id]/notes - Create an internal note scoped to this project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    if (!projectId) {
      return NextResponse.json({ error: "ID proyek tidak valid" }, { status: 400 });
    }

    const body = await req.json();
    const { user_id, title, content, tags, pinned, color, checklist } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Judul catatan wajib diisi" }, { status: 400 });
    }

    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify([]);
    const checklistJson = Array.isArray(checklist) ? JSON.stringify(checklist) : JSON.stringify([]);

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO notes (user_id, title, content, tags, pinned, color, project_id, checklist)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      user_id ? Number(user_id) : 1,
      title.trim(),
      (content || "").trim(),
      tagsJson,
      pinned ? 1 : 0,
      color || "#D2F27C",
      projectId,
      checklistJson
    );

    const newNote = db
      .prepare(`
        SELECT n.*, u.nama as author_nama, p.nama_proyek as project_nama
        FROM notes n
        LEFT JOIN users u ON n.user_id = u.id
        LEFT JOIN projects p ON n.project_id = p.id
        WHERE n.id = ?
      `)
      .get(result.lastInsertRowid) as Record<string, unknown>;

    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse((newNote.tags as string) || "[]");
    } catch {
      parsedTags = [];
    }

    let parsedChecklist: Array<{ id: string; text: string; done: boolean }> = [];
    try {
      parsedChecklist = JSON.parse((newNote.checklist as string) || "[]");
    } catch {
      parsedChecklist = [];
    }

    return NextResponse.json(
      {
        note: {
          ...newNote,
          pinned: Boolean(newNote.pinned),
          tags: parsedTags,
          checklist: parsedChecklist,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal membuat catatan proyek:", error);
    return NextResponse.json({ error: "Gagal membuat catatan proyek" }, { status: 500 });
  }
}
