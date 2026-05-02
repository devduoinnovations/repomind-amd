import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { data: invite } = await supabaseAdmin
    .from("project_invites").select("*, project:project_id(id, name)")
    .eq("token", token).eq("status", "pending").single();

  if (!invite) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invite expired" }, { status: 410 });

  await supabaseAdmin.from("project_members").upsert({
    project_id: invite.project_id, user_id: session.user.id, role: "member",
  }, { onConflict: "project_id,user_id", ignoreDuplicates: true });

  await supabaseAdmin.from("project_invites").update({ status: "accepted" }).eq("id", invite.id);

  return NextResponse.json({ projectId: invite.project_id, projectName: (invite.project as any)?.name });
}
