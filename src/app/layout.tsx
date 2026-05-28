import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LotteryX | Pro Picks",
  description: "Top 10 terminaciones para la lotería basado en estadística y probabilidad."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
