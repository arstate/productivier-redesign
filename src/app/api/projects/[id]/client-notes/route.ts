import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/projects/[id]/client-notes - List all client feedback/notes for a project
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
    const clientNotes = db
      .prepare(`
        SELECT id, project_id, author_name, author_role, message, category, status, created_at
        FROM project_client_notes
        WHERE project_id = ?
        ORDER BY created_at DESC, id DESC
      `)
      .all(projectId);

    return NextResponse.json({ clientNotes });
  } catch (error) {
    console.error("Gagal mengambil catatan klien:", error);
    return NextResponse.json({ error: "Gagal memuat catatan klien" }, { status: 500 });
  }
}

// POST /api/projects/[id]/client-notes - Submit a new client note or team reply
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
    const { author_name, author_role, message, category, status } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Pesan catatan wajib diisi" }, { status: 400 });
    }

    const cleanAuthor = author_name && author_name.trim() ? author_name.trim() : "Klien Tamu";
    const cleanRole = author_role === "team" ? "team" : "client";
    const cleanCategory = ["feedback", "revisi", "pertanyaan", "apresiasi"].includes(category)
      ? category
      : "feedback";
    const cleanStatus = ["open", "in_progress", "resolved"].includes(status)
      ? status
      : "open";

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO project_client_notes (project_id, author_name, author_role, message, category, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(projectId, cleanAuthor, cleanRole, message.trim(), cleanCategory, cleanStatus);
    const newNote = db
      .prepare(`
        SELECT id, project_id, author_name, author_role, message, category, status, created_at
        FROM project_client_notes
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    return NextResponse.json({ clientNote: newNote }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan catatan klien:", error);
    return NextResponse.json({ error: "Gagal menyimpan catatan klien" }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/client-notes - Update status of a client note
export async function PATCH(
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
    const noteId = Number(body.note_id || body.id);
    const status = body.status;

    if (!noteId || !["open", "in_progress", "resolved"].includes(status)) {
      return NextResponse.json({ error: "Parameter status atau note_id tidak valid" }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      UPDATE project_client_notes
      SET status = ?
      WHERE id = ? AND project_id = ?
    `);

    stmt.run(status, noteId, projectId);

    const updated = db
      .prepare("SELECT * FROM project_client_notes WHERE id = ?")
      .get(noteId);

    return NextResponse.json({ clientNote: updated });
  } catch (error) {
    console.error("Gagal memperbarui status catatan klien:", error);
    return NextResponse.json({ error: "Gagal memperbarui catatan klien" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/client-notes?note_id=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    const url = new URL(req.url);
    const noteId = Number(url.searchParams.get("note_id"));

    if (!projectId || !noteId) {
      return NextResponse.json({ error: "Parameter ID tidak lengkap" }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare("DELETE FROM project_client_notes WHERE id = ? AND project_id = ?");
    stmt.run(noteId, projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gagal menghapus catatan klien:", error);
    return NextResponse.json({ error: "Gagal menghapus catatan klien" }, { status: 500 });
  }
}
