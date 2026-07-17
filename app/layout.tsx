import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "환최몇?",
    template: "%s | 환최몇?",
  },
  description: "대한민국의 대중교통으로 어디까지 갈 수 있을까요? 최소 환승 횟수를 맞히는 지도 추리 게임.",
  applicationName: "환최몇?",
  keywords: ["대중교통", "환승", "지도게임", "버스", "지하철", "기차", "대한민국"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16bc67",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
