import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { supabaseAdmin } from "@/lib/supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const { error } = await supabaseAdmin.from("users").upsert(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.image,
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error("Error syncing user to Supabase:", error);
        return false;
      }

      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session as any).accessToken = token.accessToken;

        const { data } = await supabaseAdmin
          .from("users")
          .select("plan")
          .eq("id", token.sub!)
          .single();

        if (data) {
          session.user.plan = data.plan;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
