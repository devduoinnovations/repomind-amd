import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = (session as any).accessToken as string
  if (!token) return NextResponse.json({ error: "No GitHub token" }, { status: 401 })

  // Fetch up to 100 repos the user has access to (owned + member of)
  const res = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  )
  if (!res.ok) return NextResponse.json({ error: "GitHub API error" }, { status: res.status })

  const repos = await res.json()
  return NextResponse.json(
    repos.map((r: any) => ({
      full_name: r.full_name,
      name: r.name,
      private: r.private,
      description: r.description,
      default_branch: r.default_branch,
    }))
  )
}
