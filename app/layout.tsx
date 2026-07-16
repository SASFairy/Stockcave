import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockcave | Stock Portfolio Manager",
  description: "개개인의 독립된 멀티 증권 계좌 잔고를 한눈에 관리하는 폐쇄형 자산 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="antialiased selection:bg-indigo-500/30 selection:text-white">
        <main className="min-height-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
