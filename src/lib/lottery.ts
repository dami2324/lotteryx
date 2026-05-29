import { readFile } from "node:fs/promises";
import path from "node:path";

export type DrawName = "Miercolito" | "Dominical" | "Gordito" | "Extraordinaria";

export type StrategyType = "hot" | "cold" | "most_played" | "jump" | "last_year";
export type TimeRange = 30 | 60 | 90 | 180;

export type DrawRow = {
  date: string;
  draw: DrawName;
  first: string;
  second: string;
  third: string;
  firstTerm: string;
  secondTerm: string;
  thirdTerm: string;
  source: string;
};

export type Pick = {
  term: string;
  score: number;
  exposures: number;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
  jumpsWithin3: number;
  jumpsExtended: number;
  verifiedJumps: number;
  averageJumpDelay: number | null;
  lastLowerSeen: string;
  reason: string;
  recentSignal: boolean;
};

export type PatternAnalysis = {
  generatedAt: string;
  nextDraw: {
    name: DrawName;
    date: string;
    label: string;
  };
  topFive: Pick[];
  backups: Pick[];
  generatedTickets: string[];
  lastYearDraw: DrawRow | null;
  watchlist: Array<{
    term: string;
    origin: string;
    prize: string;
    number: string;
  }>;
  latestDraws: DrawRow[];
  totalDraws: number;
  period: {
    start: string;
    end: string;
  };
  sources: string[];
  globalStats: Array<{ term: string; frequency: number; label: "HOT" | "COLD" | "NORMAL" }>;
};

type MutableStats = {
  term: string;
  exposures: number;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
  jumpsWithin1: number;
  jumpsWithin3: number;
  jumpsExtended: number;
  verifiedJumps: number;
  jumpDelays: number[];
  lastLowerIndex: number | null;
  lastLowerSeen: string;
  recentExposure: number;
  score: number;
  recentSignal: boolean;
};

const LOTTERY_GURU = {
  Miercolito: "https://lotteryguru.com/panama-lottery-results/pa-miercolito/pa-miercolito-results-history",
  Dominical: "https://lotteryguru.com/panama-lottery-results/pa-dominical/pa-dominical-results-history",
  Gordito: "https://lotteryguru.com/panama-lottery-results/pa-gordito-del-zodiaco/pa-gordito-del-zodiaco-results-history",
  Extraordinaria: "https://lotteryguru.com/panama-lottery-results/pa-extraordinaria/pa-extraordinaria-results-history"
} as const;

const PANAMA_LOTERIA = {
  Gordito: "https://www.panamaloteria.com/resultados-sorteo-gorditodelzodiaco.php",
  Extraordinaria: "https://www.panamaloteria.com/resultados-sorteo-extraordinario.php"
} as const;

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Sept: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
};

const PANAMA_TIMEZONE = "America/Panama";
const HISTORY_START = "2025-01-01";
const MAX_PAGES = 8;

export async function getGlobalStats(draw: DrawName, timeRange: TimeRange) {
  let allRows = await getHistory();
  if (allRows.length === 0) {
    throw new Error("No se encontraron sorteos validos.");
  }

  // Filter by draw type
  allRows = allRows.filter(r => r.draw === draw);

  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - timeRange);
  let rows = allRows.filter(r => new Date(r.date + "T00:00:00Z") >= cutoffDate);
  if ((draw === "Gordito" || draw === "Extraordinaria") && rows.length < 5) {
    rows = allRows;
  }
  
  if (rows.length === 0) {
    return [];
  }

  const freq: Record<string, number> = {};
  for (let i = 0; i <= 99; i++) {
    freq[i.toString().padStart(2, "0")] = 0;
  }

  for (const r of rows) {
    if (freq[r.firstTerm] !== undefined) freq[r.firstTerm]++;
    if (freq[r.secondTerm] !== undefined) freq[r.secondTerm]++;
    if (freq[r.thirdTerm] !== undefined) freq[r.thirdTerm]++;
  }

  const sorted = Object.entries(freq).map(([term, frequency]) => ({ term, frequency }))
    .sort((a, b) => b.frequency - a.frequency);

  const stats = sorted.map((item, i) => {
    let label: "HOT" | "COLD" | "NORMAL" = "NORMAL";
    if (i < 10) label = "HOT"; // top 10 are HOT
    else if (i >= sorted.length - 10) label = "COLD"; // bottom 10 are COLD
    return { ...item, label };
  });

  return stats;
}

export async function getPatternAnalysis(
  strategy: StrategyType = "jump",
  timeRange: TimeRange = 180,
  excludeLatest = false,
  drawFilter?: DrawName
): Promise<PatternAnalysis> {
  let allRows = await getHistory();
  if (allRows.length === 0) {
    throw new Error("No se encontraron sorteos validos.");
  }

  // Filter by draw type if specified
  if (drawFilter) {
    allRows = allRows.filter(r => r.draw === drawFilter);
    if (allRows.length === 0) {
      throw new Error(`No se encontraron sorteos para ${drawFilter}.`);
    }
  }

  if (excludeLatest && allRows.length > 1) {
    allRows = allRows.slice(0, -1);
  }

  // Filter rows by timeRange
  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - timeRange);
  let rows = allRows.filter(r => new Date(r.date + "T00:00:00Z") >= cutoffDate);
  if (drawFilter && (drawFilter === "Gordito" || drawFilter === "Extraordinaria") && rows.length < 5) {
    rows = allRows;
  }
  
  if (rows.length === 0) {
    throw new Error(`No se encontraron sorteos en ese rango de fechas${drawFilter ? ` para ${drawFilter}` : ""}.`);
  }

  const stats = buildJumpStats(rows);
  const latestDraws = rows.slice(-3);
  const watchlist = latestDraws.flatMap((draw) => [
    { term: draw.secondTerm, origin: `${draw.date} ${draw.draw}`, prize: "2do", number: draw.second },
    { term: draw.thirdTerm, origin: `${draw.date} ${draw.draw}`, prize: "3ro", number: draw.third }
  ]);
  const recentTerms = new Set(watchlist.map((item) => item.term));
  const maxExposures = Math.max(1, ...Object.values(stats).map((item) => item.exposures));

  let picks: Pick[] = [];

  const statValues = Object.values(stats);

  const lastYearDraw = findLastYearDraw(allRows, drawFilter);

  if (strategy === "jump") {
    picks = statValues
      .filter((item) => item.exposures > 0)
      .map((item) => {
        const jumpRate = item.exposures > 0 ? item.jumpsWithin3 / item.exposures : 0;
        const extendedJumpRate = item.exposures > 0 ? item.jumpsExtended / item.exposures : 0;
        const verifiedJumpRate = item.exposures > 0 ? item.verifiedJumps / item.exposures : 0;
        const firstStrength = item.firstCount / Math.max(1, ...statValues.map((stat) => stat.firstCount));
        const lowerLag = item.lastLowerIndex === null ? Number.POSITIVE_INFINITY : rows.length - 1 - item.lastLowerIndex;
        const recentSignal = recentTerms.has(item.term);
        const recency = recentSignal ? 1 : lowerLag <= 5 ? 0.6 : lowerLag <= 10 ? 0.35 : 0;
        const volume = item.exposures / maxExposures;
        
        const score = roundScore(
          100 * (0.34 * recency + 0.22 * volume + 0.12 * jumpRate + 0.12 * extendedJumpRate + 0.14 * verifiedJumpRate + 0.06 * firstStrength)
        );
        
        return {
          ...item,
          score,
          averageJumpDelay: item.jumpDelays.length > 0 ? roundScore(item.jumpDelays.reduce((a, b) => a + b, 0) / item.jumpDelays.length) : null,
          lastLowerSeen: item.lastLowerSeen || "Sin registro reciente",
          recentSignal,
          reason: getReason(recentSignal, item)
        };
      })
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
  } else if (strategy === "last_year") {
    const lastYearTerms = new Set(
      lastYearDraw ? [lastYearDraw.firstTerm, lastYearDraw.secondTerm, lastYearDraw.thirdTerm] : []
    );

    picks = statValues
      .map((item) => {
        const fromLastYear = lastYearTerms.has(item.term);
        const total = item.firstCount + item.secondCount + item.thirdCount;
        const lowerSignal = item.exposures / maxExposures;
        const firstSignal = item.firstCount / Math.max(1, ...statValues.map((stat) => stat.firstCount));
        const score = roundScore(100 * ((fromLastYear ? 0.55 : 0) + 0.25 * lowerSignal + 0.2 * firstSignal));

        return {
          ...item,
          score,
          averageJumpDelay:
            item.jumpDelays.length > 0 ? roundScore(item.jumpDelays.reduce((a, b) => a + b, 0) / item.jumpDelays.length) : null,
          lastLowerSeen: item.lastLowerSeen || "Sin registro",
          recentSignal: fromLastYear,
          reason: fromLastYear
            ? "Jugo el ano pasado en este sorteo."
            : `Apoya el patron anual con ${total} apariciones en el historial.`
        };
      })
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
  } else if (strategy === "most_played") {
    picks = statValues
      .map(item => ({
        ...item,
        score: item.firstCount,
        averageJumpDelay: null,
        lastLowerSeen: item.lastLowerSeen || "N/A",
        recentSignal: false,
        reason: `Apareció ${item.firstCount} veces en el 1er premio durante los últimos ${timeRange} días.`
      }))
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
  } else if (strategy === "hot") {
    picks = statValues
      .map(item => {
        const total = item.firstCount + item.secondCount + item.thirdCount;
        return {
          ...item,
          score: total,
          averageJumpDelay: null,
          lastLowerSeen: item.lastLowerSeen || "N/A",
          recentSignal: false,
          reason: `Alta frecuencia: ${total} apariciones totales en los últimos ${timeRange} días.`
        }
      })
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
  } else if (strategy === "cold") {
    picks = statValues
      .map(item => {
        const total = item.firstCount + item.secondCount + item.thirdCount;
        return {
          ...item,
          score: 1000 - total, // Invert score for sorting
          averageJumpDelay: null,
          lastLowerSeen: item.lastLowerSeen || "N/A",
          recentSignal: false,
          reason: `Ausencia notable: Solo ${total} apariciones en los últimos ${timeRange} días.`
        }
      })
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
  }

  const globalStats = statValues
    .map(item => ({
      term: item.term,
      frequency: item.firstCount + item.secondCount + item.thirdCount
    }))
    .sort((a, b) => b.frequency - a.frequency);

  const top10Freq = globalStats[9]?.frequency || 0;
  const bottom10Freq = globalStats[globalStats.length - 10]?.frequency || 0;

  const globalStatsWithLabels = globalStats.map(item => ({
    term: item.term,
    frequency: item.frequency,
    label: item.frequency >= top10Freq && item.frequency > 0 ? "HOT" : (item.frequency <= bottom10Freq ? "COLD" : "NORMAL") as "HOT" | "COLD" | "NORMAL"
  }));

  const topTen = completeTopTen(picks, statValues);
  const generatedTickets = buildTickets(topTen, rows, strategy, lastYearDraw);

  return {
    generatedAt: getPanamaNow().toISOString(),
    nextDraw: getNextDraw(),
    topFive: topTen.slice(0, 5),
    backups: topTen.slice(5, 10),
    generatedTickets,
    lastYearDraw,
    watchlist,
    latestDraws,
    totalDraws: rows.length,
    period: {
      start: rows[0].date,
      end: rows.at(-1)?.date ?? rows[0].date
    },
    sources: ["LotteryGuru historial paginado", "PanamaLoteria resultados especiales"],
    globalStats: globalStatsWithLabels
  };
}

export async function getHistory(): Promise<DrawRow[]> {
  const [miercolito, dominical, gorditoGuru, extraordinariaGuru, gorditoPanama, extraordinariaPanama] = await Promise.all([
    fetchLotteryGuru(LOTTERY_GURU.Miercolito, "Miercolito"),
    fetchLotteryGuru(LOTTERY_GURU.Dominical, "Dominical"),
    fetchLotteryGuru(LOTTERY_GURU.Gordito, "Gordito"),
    fetchLotteryGuru(LOTTERY_GURU.Extraordinaria, "Extraordinaria"),
    fetchPanamaLoteria(PANAMA_LOTERIA.Gordito, "Gordito"),
    fetchPanamaLoteria(PANAMA_LOTERIA.Extraordinaria, "Extraordinaria")
  ]);
  const seedRows = await getSeedHistory().catch(() => []);

  const unique = new Map<string, DrawRow>();
  for (const row of [
    ...seedRows,
    ...miercolito,
    ...dominical,
    ...gorditoGuru,
    ...extraordinariaGuru,
    ...gorditoPanama,
    ...extraordinariaPanama
  ]) {
    unique.set(`${row.date}|${row.draw}`, row);
  }

  const rows = [...unique.values()].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    return byDate || a.draw.localeCompare(b.draw);
  });

  return rows;
}

async function fetchPanamaLoteria(url: string, draw: DrawName): Promise<DrawRow[]> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 LotteryX/1.0"
    }
  }).catch(() => null);

  if (!response?.ok) {
    return [];
  }

  const html = await response.text();
  return parsePanamaLoteriaPage(html, draw);
}

async function fetchLotteryGuru(baseUrl: string, draw: DrawName): Promise<DrawRow[]> {
  const rows: DrawRow[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${baseUrl}?page=${page}`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 LoteriaBrincoApp/1.0"
      }
    }).catch(() => null);

    if (!response?.ok) {
      continue;
    }

    const html = await response.text();
    rows.push(...parseLotteryGuruPage(html, draw));

    const lastPage = parseLastPage(html);
    if (lastPage !== null && page >= lastPage) {
      break;
    }
  }

  return rows;
}

async function getSeedHistory(): Promise<DrawRow[]> {
  const file = path.join(process.cwd(), "analisis_miercolito_20mayo2026.txt");
  const content = await readFile(file, "utf8");
  const rows: DrawRow[] = [];

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2}) \| (Miercolito|Dominical) \| 1ro (\d{4}) term (\d{2}) \| 2do (\d{4}) term (\d{2}) \| 3ro (\d{4}) term (\d{2}) \| Fuente (.+)$/
    );

    if (!match) {
      continue;
    }

    const [, date, draw, first, firstTerm, second, secondTerm, third, thirdTerm, source] = match;
    rows.push({
      date,
      draw: draw as DrawName,
      first,
      second,
      third,
      firstTerm,
      secondTerm,
      thirdTerm,
      source
    });
  }

  return rows.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    return byDate || a.draw.localeCompare(b.draw);
  });
}

function parseLotteryGuruPage(html: string, draw: DrawName): DrawRow[] {
  const blocks = html.match(
    /<div class="columns is-multiline is-vcentered is-mobile lg-line">[\s\S]*?(?=<div class="columns is-multiline is-vcentered is-mobile lg-line">|<div id="pageInfo")/g
  );

  if (!blocks) {
    return [];
  }

  return blocks.flatMap((block) => {
    const dateMatch = block.match(/<strong>(\d{2}) (\w+)<\/strong>\s*(\d{4})/);
    if (!dateMatch) {
      return [];
    }

    const [, dayText, monthText, yearText] = dateMatch;
    const month = MONTHS[monthText];
    if (month === undefined) {
      return [];
    }

    const date = new Date(Date.UTC(Number(yearText), month, Number(dayText)));
    if (date < new Date(`${HISTORY_START}T00:00:00.000Z`)) {
      return [];
    }

    const prizes = [...block.matchAll(/<ul class="lg-numbers-small-multiple">([\s\S]*?)<\/ul>/g)]
      .slice(0, 3)
      .map((match) => [...match[1].matchAll(/<li class="lg-number">\s*(\d)\s*<\/li>/g)].map((digit) => digit[1]).join(""));

    if (prizes.length < 3 || prizes.some((prize) => !/^\d{4}$/.test(prize))) {
      return [];
    }

    const [first, second, third] = prizes;
    return [
      {
        date: toDateKey(date),
        draw,
        first,
        second,
        third,
        firstTerm: first.slice(2),
        secondTerm: second.slice(2),
        thirdTerm: third.slice(2),
        source: "LotteryGuru"
      }
    ];
  });
}

function parsePanamaLoteriaPage(html: string, draw: DrawName): DrawRow[] {
  const rows: DrawRow[] = [];
  const drawLabel = draw === "Gordito" ? "Gordito Del Zodiaco" : "Extraordinario";

  for (const match of html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)) {
    const rowHtml = match[0];
    const dateMatch = rowHtml.match(new RegExp(`${drawLabel}\\s+(\\d{2})\\/(\\d{2})\\/(\\d{4})`, "i"));

    if (!dateMatch) {
      continue;
    }

    const numbers = [...rowHtml.matchAll(/label-numero">(\d{2,5})<\/span>/g)].map((item) => item[1]);
    if (numbers.length < 3) {
      continue;
    }

    const [, day, month, year] = dateMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date < new Date(`${HISTORY_START}T00:00:00.000Z`)) {
      continue;
    }

    const [first, second, third] = numbers.slice(0, 3);
    rows.push({
      date: toDateKey(date),
      draw,
      first,
      second,
      third,
      firstTerm: toTerm(first),
      secondTerm: toTerm(second),
      thirdTerm: toTerm(third),
      source: "PanamaLoteria"
    });
  }

  return rows;
}

function parseLastPage(html: string): number | null {
  const match = html.match(/<div id="pageInfo"[^>]*lastPage="(\d+)"/);
  return match ? Number(match[1]) : null;
}

function buildJumpStats(rows: DrawRow[]): Record<string, MutableStats> {
  const stats: Record<string, MutableStats> = {};
  for (let value = 0; value <= 99; value += 1) {
    const term = value.toString().padStart(2, "0");
    stats[term] = {
      term,
      exposures: 0,
      firstCount: 0,
      secondCount: 0,
      thirdCount: 0,
      jumpsWithin1: 0,
      jumpsWithin3: 0,
      jumpsExtended: 0,
      verifiedJumps: 0,
      jumpDelays: [],
      lastLowerIndex: null,
      lastLowerSeen: "",
      recentExposure: 0,
      score: 0,
      recentSignal: false
    };
  }

  const recentCutoff = new Date(`${rows.at(-1)?.date ?? HISTORY_START}T00:00:00.000Z`);
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - 60);

  rows.forEach((row, index) => {
    stats[row.firstTerm].firstCount += 1;

    [
      { term: row.secondTerm, prize: "2do" },
      { term: row.thirdTerm, prize: "3ro" }
    ].forEach(({ term, prize }) => {
      const item = stats[term];
      item.exposures += 1;
      if (prize === "2do") {
        item.secondCount += 1;
      } else {
        item.thirdCount += 1;
      }
      item.lastLowerIndex = index;
      item.lastLowerSeen = `${row.date} ${row.draw} ${prize}`;

      if (new Date(`${row.date}T00:00:00.000Z`) >= recentCutoff) {
        item.recentExposure += 1;
      }

      if (rows[index + 1]?.firstTerm === term) {
        item.jumpsWithin1 += 1;
      }

      const jumpedWithin3 = [1, 2, 3].some((offset) => rows[index + offset]?.firstTerm === term);
      if (jumpedWithin3) {
        item.jumpsWithin3 += 1;
      }

      const jumpedExtended = Array.from({ length: 12 }, (_, offset) => offset + 1).some(
        (offset) => rows[index + offset]?.firstTerm === term
      );
      if (jumpedExtended) {
        item.jumpsExtended += 1;
      }

      const laterIndex = rows.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.firstTerm === term);
      if (laterIndex > index) {
        item.verifiedJumps += 1;
        item.jumpDelays.push(laterIndex - index);
      }
    });
  });

  return stats;
}

function getNextDraw() {
  const now = getPanamaNow();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const candidates = Array.from({ length: 10 }, (_, offset) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + offset);
    return date;
  }).filter((date) => date.getUTCDay() === 0 || date.getUTCDay() === 3);

  const next = candidates[0];
  const name: DrawName = next.getUTCDay() === 3 ? "Miercolito" : "Dominical";

  return {
    name,
    date: toDateKey(next),
    label: formatSpanishDate(next)
  };
}

function findLastYearDraw(rows: DrawRow[], drawFilter?: DrawName) {
  const filteredRows = drawFilter ? rows.filter((row) => row.draw === drawFilter) : rows;
  if (filteredRows.length === 0) {
    return null;
  }

  const target = drawFilter === "Miercolito" || drawFilter === "Dominical"
    ? getNextDateForDraw(drawFilter)
    : new Date(`${filteredRows.at(-1)?.date ?? HISTORY_START}T00:00:00.000Z`);
  const lastYearTarget = new Date(Date.UTC(target.getUTCFullYear() - 1, target.getUTCMonth(), target.getUTCDate()));

  return filteredRows
    .map((row) => ({
      row,
      distance: Math.abs(new Date(`${row.date}T00:00:00.000Z`).getTime() - lastYearTarget.getTime())
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.row ?? null;
}

function getNextDateForDraw(draw: DrawName) {
  const now = getPanamaNow();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = draw === "Miercolito" ? 3 : draw === "Dominical" ? 0 : today.getUTCDay();

  for (let offset = 0; offset <= 14; offset += 1) {
    const candidate = new Date(today);
    candidate.setUTCDate(today.getUTCDate() + offset);
    if (candidate.getUTCDay() === weekday) {
      return candidate;
    }
  }

  return today;
}

function getPanamaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PANAMA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return new Date(
    Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      Number(get("hour")),
      Number(get("minute")),
      Number(get("second"))
    )
  );
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTerm(number: string) {
  return number.slice(-2).padStart(2, "0");
}

function formatSpanishDate(date: Date) {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function getReason(recentSignal: boolean, item: MutableStats) {
  if (recentSignal && item.exposures >= 5) {
    return "Salio abajo recientemente y se repite mucho en 2do/3ro.";
  }
  if (recentSignal) {
    return "Salio en 2do/3ro en los ultimos sorteos.";
  }
  if (item.jumpsWithin3 > 0) {
    return "Tiene brinco corto comprobado hacia el 1ro.";
  }
  if (item.verifiedJumps > 0 && item.firstCount > 0) {
    return "Tiene brinco comprobado en sorteos posteriores.";
  }
  return "Aparece con volumen en 2do/3ro dentro del historial.";
}

function completeTopTen(picks: Pick[], statValues: MutableStats[]): Pick[] {
  const used = new Set(picks.map((pick) => pick.term));
  const fallback: Pick[] = statValues
    .filter((item) => !used.has(item.term))
    .map((item) => {
      const total = item.firstCount + item.secondCount + item.thirdCount;
      return {
        term: item.term,
        score: roundScore(total),
        exposures: item.exposures,
        firstCount: item.firstCount,
        secondCount: item.secondCount,
        thirdCount: item.thirdCount,
        jumpsWithin3: item.jumpsWithin3,
        jumpsExtended: item.jumpsExtended,
        verifiedJumps: item.verifiedJumps,
        averageJumpDelay:
          item.jumpDelays.length > 0 ? roundScore(item.jumpDelays.reduce((a, b) => a + b, 0) / item.jumpDelays.length) : null,
        lastLowerSeen: item.lastLowerSeen || "Sin registro",
        reason: "Completa el Top 10 con frecuencia disponible del sorteo.",
        recentSignal: false
      };
    })
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));

  return [...picks, ...fallback].slice(0, 10);
}

function buildTickets(picks: Pick[], rows: DrawRow[], strategy: StrategyType, lastYearDraw: DrawRow | null) {
  const sourceNumbers = rows
    .flatMap((row) => [row.first, row.second, row.third])
    .filter((number) => /^\d{4,5}$/.test(number));
  const preferredNumbers = strategy === "last_year" && lastYearDraw
    ? [lastYearDraw.first, lastYearDraw.second, lastYearDraw.third, ...sourceNumbers]
    : sourceNumbers;
  const tickets: string[] = [];

  for (const pick of picks) {
    const base = preferredNumbers.find((number) => toTerm(number) === pick.term);
    const prefix = base ? base.slice(0, -2).slice(-2).padStart(2, "0") : deriveTicketPrefix(pick);
    const ticket = `${prefix}${pick.term}`.slice(-4).padStart(4, "0");

    if (!tickets.includes(ticket)) {
      tickets.push(ticket);
    }

    if (tickets.length === 5) {
      break;
    }
  }

  return tickets;
}

function deriveTicketPrefix(pick: Pick) {
  const seed = pick.term
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0) + pick.exposures + pick.firstCount + pick.secondCount + pick.thirdCount;
  return ((seed * 7) % 100).toString().padStart(2, "0");
}
