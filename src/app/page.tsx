import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/guard";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/teams" : "/login");
}
