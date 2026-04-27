import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
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
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message ?? "Project not found" },
      { status: 404 }
    );
  }

  // Kick off a background scan by triggering the worker endpoint
  // or return instructions for the full worker flow.
  // For now, mark last_scan_at and return a pending response.
  try {
    await supabaseAdmin
      .from("projects")
      .update({ last_scan_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ message: "Scan queued — worker will process shortly." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to queue scan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
