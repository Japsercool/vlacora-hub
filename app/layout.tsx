import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PULSE", template: "%s • PULSE" },
  applicationName: "PULSE",
  description: "Your station. One team. All in sync.",
  icons: {
    icon: "/brand/pulse-icon-256.png",
    apple: "/brand/pulse-icon-256.png"
  }
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
