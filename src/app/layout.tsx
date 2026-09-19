import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hangar",
  description: "One shared, permissioned home for your team's AI-built tools.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
