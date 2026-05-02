import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "RepoMind <no-reply@repomind.dev>";

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: "Welcome to RepoMind",
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#60a5fa;letter-spacing:0.1em;font-size:20px">REPOMIND</h1>
        <p>Welcome, ${name}.</p>
        <p>Your AI crew is ready. Connect a GitHub repo to start scanning.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(96,165,250,0.2);color:#60a5fa;border:1px solid rgba(96,165,250,0.4);text-decoration:none;border-radius:6px;font-size:13px">
          OPEN DASHBOARD
        </a>
      </div>`,
  }).catch(err => console.error("[email/welcome]", err.message));
}

export async function sendSuggestionDigestEmail(
  to: string, projectName: string, count: number
): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: `PATCH found ${count} new suggestion${count > 1 ? "s" : ""} — ${projectName}`,
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#14b8a6;font-size:16px;letter-spacing:0.08em">PATCH</h1>
        <p>Analyzed recent commits in <strong>${projectName}</strong> and found <strong>${count}</strong> ticket update suggestion${count > 1 ? "s" : ""}.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(20,184,166,0.2);color:#14b8a6;border:1px solid rgba(20,184,166,0.4);text-decoration:none;border-radius:6px;font-size:13px">
          REVIEW SUGGESTIONS
        </a>
      </div>`,
  }).catch(err => console.error("[email/digest]", err.message));
}

export async function sendScanCompleteEmail(
  to: string, projectName: string, moduleCount: number
): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: `SCOUT scan complete — ${projectName}`,
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#22c55e;font-size:16px;letter-spacing:0.08em">SCOUT</h1>
        <p>Scan of <strong>${projectName}</strong> is complete. Indexed <strong>${moduleCount}</strong> modules.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.3);text-decoration:none;border-radius:6px;font-size:13px">
          VIEW ARCHITECTURE
        </a>
      </div>`,
  }).catch(err => console.error("[email/scan]", err.message));
}

export async function sendTeamInviteEmail(
  to: string, inviterName: string, projectName: string, inviteUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: `${inviterName} invited you to ${projectName} on RepoMind`,
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#60a5fa;letter-spacing:0.1em;font-size:20px">REPOMIND</h1>
        <p><strong>${inviterName}</strong> invited you to join <strong>${projectName}</strong>.</p>
        <a href="${inviteUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(96,165,250,0.2);color:#60a5fa;border:1px solid rgba(96,165,250,0.4);text-decoration:none;border-radius:6px;font-size:13px">
          ACCEPT INVITE
        </a>
        <p style="font-size:11px;color:#64748b;margin-top:16px">Link expires in 7 days.</p>
      </div>`,
  }).catch(err => console.error("[email/invite]", err.message));
}
