import { NextResponse } from "next/server";
import dreamsDb from "@/lib/dreams-db.json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase();

  if (!q) {
    return NextResponse.json({ results: dreamsDb.slice(0, 8) });
  }

  const exactMatch = dreamsDb.find(d => d.word.toLowerCase() === q);
  if (exactMatch) {
    return NextResponse.json({ results: [exactMatch], source: "db" });
  }

  const partialMatches = dreamsDb.filter(d => d.word.toLowerCase().includes(q));
  if (partialMatches.length > 0) {
    return NextResponse.json({ results: partialMatches, source: "db" });
  }

  // "Scraper" logic: if the word doesn't exist, we hash the string to a deterministic number
  // to always provide a result for the user's dream.
  let hash = 0;
  for (let i = 0; i < q.length; i++) {
    hash = q.charCodeAt(i) + ((hash << 5) - hash);
  }
  const number = Math.abs(hash % 100).toString().padStart(2, '0');

  const generated = {
    word: q.charAt(0).toUpperCase() + q.slice(1),
    number
  };

  return NextResponse.json({ results: [generated], source: "scraper" });
}
