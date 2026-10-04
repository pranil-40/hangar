import { STATE_COOKIE, beginLogin, googleConfig } from "@/lib/google-auth";
import { appUrl } from "@/lib/urls";

/** GET /auth/google: start "Continue with Google". */
export async function GET() {
  if (!googleConfig()) return new Response("Google sign-in is not configured.", { status: 404 });

  const { url, cookie } = beginLogin(appUrl("/auth/google/callback"));
  return new Response(null, {
    status: 303,
    headers: {
      Location: url,
      "Set-Cookie": `${STATE_COOKIE}=${cookie}; Path=/auth/google; Max-Age=600; HttpOnly; SameSite=Lax${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
      "Cache-Control": "no-store",
    },
  });
}
