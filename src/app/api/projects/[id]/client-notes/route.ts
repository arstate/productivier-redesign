import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { clampStr } from "@/lib/validation";

function isAuthorizedClientPortalRequest(req: NextRequest, projectId: number): boolean {
  const sessionUser = getSessionUser(req);
  if (sessionUser) return true;

  const tokenFromHeader = req.headers.get("x-share-token")?.trim();
  const tokenFromQuery = new URL(req.url).searchParams.get("token")?.trim();
  const provided = tokenFromHeader || tokenFromQuery;
  if (!provided) return false;

  const db = getDb();
  const row = db.prepare("SELECT share_token FROM projects WHERE id = ?").get(projectId) as
    | { share_token?: string }
    | undefined;
  return Boolean(row?.share_token && row.share_token === provided);
}

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

    if (!isAuthorizedClientPortalRequest(req, projectId)) {
      return NextResponse.json({ error: "Token akses portal klien tidak valid." }, { status: 401 });
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

    if (!isAuthorizedClientPortalRequest(req, projectId)) {
      return NextResponse.json({ error: "Token akses portal klien tidak valid." }, { status: 401 });
    }

    const body = await req.json();
    const { author_name, author_role, message, category, status } = body;

    const cleanMessage = clampStr(message, 2000);
    if (!cleanMessage) {
      return NextResponse.json({ error: "Pesan catatan wajib diisi" }, { status: 400 });
    }

    const sessionUser = getSessionUser(req);
    const cleanAuthor = clampStr(author_name, 80) || sessionUser?.nama || "Klien Tamu";
    const cleanRole = author_role === "team" && sessionUser ? "team" : "client";
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

    const result = stmt.run(projectId, cleanAuthor, cleanRole, cleanMessage, cleanCategory, cleanStatus);
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
    const auth = requireAuth(req);
    if ("error" in auth) return auth.error;

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
