import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/projects/[id]/links - List all resource links for a project
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
    const links = db
      .prepare(
        "SELECT id, project_id, title, url, platform, created_at FROM project_links WHERE project_id = ? ORDER BY id DESC"
      )
      .all(projectId);

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Gagal mengambil tautan proyek:", error);
    return NextResponse.json({ error: "Gagal memuat tautan proyek" }, { status: 500 });
  }
}

// POST /api/projects/[id]/links - Add a new resource link
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
    const { title, url, platform } = body;

    if (!title || !title.trim() || !url || !url.trim()) {
      return NextResponse.json({ error: "Judul dan URL tautan wajib diisi" }, { status: 400 });
    }

    // Auto-detect platform if not provided or set to other
    let detectedPlatform = platform || "other";
    const lowUrl = url.toLowerCase();
    if (lowUrl.includes("drive.google.com")) detectedPlatform = "drive";
    else if (lowUrl.includes("notion.so") || lowUrl.includes("notion.site")) detectedPlatform = "notion";
    else if (lowUrl.includes("figma.com")) detectedPlatform = "figma";
    else if (lowUrl.includes("github.com") || lowUrl.includes("gitlab.com")) detectedPlatform = "github";
    else if (lowUrl.includes("docs.google.com/spreadsheets") || lowUrl.includes("airtable.com")) detectedPlatform = "sheets";

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO project_links (project_id, title, url, platform)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(projectId, title.trim(), url.trim(), detectedPlatform);
    const newLink = db
      .prepare("SELECT id, project_id, title, url, platform, created_at FROM project_links WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json({ link: newLink }, { status: 201 });
  } catch (error) {
    console.error("Gagal menambahkan tautan proyek:", error);
    return NextResponse.json({ error: "Gagal menyimpan tautan proyek" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/links?link_id=... - Delete a resource link
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    const url = new URL(req.url);
    const linkId = Number(url.searchParams.get("link_id"));

    if (!projectId || !linkId) {
      return NextResponse.json({ error: "Parameter ID tidak lengkap" }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare("DELETE FROM project_links WHERE id = ? AND project_id = ?");
    stmt.run(linkId, projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gagal menghapus tautan proyek:", error);
    return NextResponse.json({ error: "Gagal menghapus tautan proyek" }, { status: 500 });
  }
}
