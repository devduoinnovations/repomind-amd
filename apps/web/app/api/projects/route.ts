import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { registerWebhook } from "@/lib/github";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, repoFull, slug } = await req.json();

  if (!name || !repoFull || !slug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const githubToken = (session as any).accessToken;

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: session.user.id,
      name,
      repo_full: repoFull,
      slug,
      github_token: githubToken || null,
    })
    .select()
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  if (githubToken) {
    try {
      const webhookUrl = `${process.env.APP_URL}/api/webhooks/github`;
      const secret = process.env.GITHUB_WEBHOOK_SECRET || "dummy_secret";
      const webhookId = await registerWebhook(repoFull, githubToken, webhookUrl, secret);
      await supabaseAdmin
        .from("projects")
        .update({ webhook_id: webhookId.toString() })
        .eq("id", project.id);
    } catch (error: any) {
      console.error("Failed to register webhook:", error.message);
    }
  }

  return NextResponse.json(project);
}
