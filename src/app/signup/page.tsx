import { googleConfig } from "@/lib/google-auth";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return <SignupForm google={Boolean(googleConfig())} />;
}
