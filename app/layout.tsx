import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedEvent CRM",
  description: "CRM для управління медичними освітніми заходами"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
