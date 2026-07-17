import type { Metadata } from "next";
import { TransitGame } from "./components/TransitGame";

export const metadata: Metadata = {
  title: "환최몇? — 대한민국 대중교통 환승 추리 게임",
  description: "버스·지하철·기차만으로 두 지점을 잇는 최소 환승 횟수를 맞혀보세요.",
};

export default function Home() {
  return <TransitGame />;
}
