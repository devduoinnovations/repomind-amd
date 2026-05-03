import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabaseAdmin
    .from("projects").select("id, name").eq("id", id).eq("user_id", session.user.id).single();
  if (!project) return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { data: invite, error } = await supabaseAdmin.from("project_invites").insert({
    project_id: id, email, invited_by: session.user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inviteUrl = `${process.env.APP_URL}/invites/${invite.token}`;

  const { sendTeamInviteEmail } = await import("@/lib/email");
  sendTeamInviteEmail(
    email,
    session.user.name ?? "A teammate",
    project.name,
    inviteUrl
  ).catch(() => {});

  return NextResponse.json({ token: invite.token, inviteUrl });
}
