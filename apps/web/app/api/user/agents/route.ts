import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.from("users").select("agent_configs").eq("id", session.user.id).single();
  return NextResponse.json(data?.agent_configs ?? {});
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { agentName, displayName, voiceLine } = body;

  const { data: user } = await supabaseAdmin.from("users").select("agent_configs").eq("id", session.user.id).single();
  const configs = (user?.agent_configs as Record<string, any>) ?? {};
  configs[agentName] = { displayName, voiceLine };

  await supabaseAdmin.from("users").update({ agent_configs: configs }).eq("id", session.user.id);
  return NextResponse.json({ ok: true, configs });
}
