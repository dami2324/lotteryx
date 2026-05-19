import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LotteryX",
  description: "Top 10 de terminaciones basado en el patron 2do/3ro hacia 1ro."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
