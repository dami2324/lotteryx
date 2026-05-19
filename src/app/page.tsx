import { getPatternAnalysis } from "@/lib/lottery";
import { LotteryXClient } from "./lotteryx-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const analysis = await getPatternAnalysis();
  return <LotteryXClient analysis={analysis} />;
}
