import { googleConfig } from "@/lib/google-auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm google={Boolean(googleConfig())} error={error?.slice(0, 200)} />;
}
