import { authenticateDeployToken } from "@/lib/deploy-tokens";

/** GET /api/v1/whoami: lets the CLI confirm a token before saving it. */
export async function GET(request: Request) {
  const auth = await authenticateDeployToken(request.headers.get("authorization"));
  if (!auth) {
    return Response.json({ error: "Missing, revoked or unknown deploy token." }, { status: 401 });
  }
  return Response.json({
    user: { name: auth.user.name, email: auth.user.email },
    team: { slug: auth.team.slug, name: auth.team.name },
    role: auth.role,
    canDeploy: auth.can("app:create"),
  });
}
