import { NextRequest, NextResponse } from "next/server";
import { verifyGithubWebhook } from "@/lib/github";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const event = req.headers.get("x-github-event") || "";

  let body;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repoFull = body.repository?.full_name;
  if (!repoFull) {
    return NextResponse.json({ error: "Missing repository info" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("repo_full", repoFull)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const isValid = await verifyGithubWebhook(payload, signature, secret);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Log webhook event to Supabase for processing
  if (event === "push" || (event === "pull_request" && body.action === "closed" && body.pull_request?.merged)) {
    try {
      await supabaseAdmin.from("webhook_events").insert({
        project_id: project.id,
        event_type: event,
        payload: body,
        status: "pending",
      });
    } catch (err) {
      console.error("Failed to log webhook:", err);
    }

    return NextResponse.json({ message: "Event queued" });
  }

  return NextResponse.json({ message: "Event ignored" });
}
