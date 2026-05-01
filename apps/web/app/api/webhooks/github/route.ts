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

      // Trigger immediate sync for "push" events if we have a token
      if (event === "push" && project.github_token) {
        const { GitHubRepoFileClient, syncTicketIndex } = await import("@/lib/git-storage");
        const client = new GitHubRepoFileClient({
          owner: body.repository.owner.login,
          repo: body.repository.name,
          token: project.github_token,
          branch: body.ref?.replace("refs/heads/", "") || project.default_branch || "main",
        });
        
        // Run sync in background (Vercel/Next.js might cut this off, but it's better than nothing for now)
        syncTicketIndex(client).catch(err => console.error("[WebhookSync] Sync failed:", err));
      }
    } catch (err) {
      console.error("Failed to process webhook:", err);
    }

    return NextResponse.json({ message: "Event queued and sync triggered" });
  }

  return NextResponse.json({ message: "Event ignored" });
}
