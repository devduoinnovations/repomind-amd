import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("config_cache, last_scan_at")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message ?? "Project not found" },
      { status: 404 }
    );
  }

  const cache = project.config_cache as { codebase?: unknown } | null;

  return NextResponse.json({
    lastScanAt: project.last_scan_at,
    codebase: cache?.codebase ?? null,
  });
}
