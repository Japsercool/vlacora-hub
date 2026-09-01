import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VLACORA HUB",
  description: "Multi-station radio collaboration hub demo"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
