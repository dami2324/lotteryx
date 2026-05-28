import type { Ticket, UserStats } from "./types";

export type LotteryXUser = {
  email: string;
  name: string;
  createdAt: string;
  password?: string;
  drawPreference?: string;
  notificationEmail?: boolean;
  notificationPush?: boolean;
  favorites?: string[];
  tickets?: Ticket[];
  stats?: UserStats;
  generationHistory?: import("./types").GenerationRecord[];
  photo?: string;
};

const USERS_KEY = "lotteryx:users";

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export async function saveUser(user: LotteryXUser) {
  if (!redisUrl || !redisToken) {
    return { persisted: false };
  }

  const email = user.email.trim().toLowerCase();
  await redisCommand(["SADD", USERS_KEY, email]);
  
  const fields: Array<string | number> = [
    "email", email,
    "name", user.name,
    "createdAt", user.createdAt
  ];

  if (user.password) {
    fields.push("password", user.password);
  }
  if (user.drawPreference) {
    fields.push("drawPreference", user.drawPreference);
  }
  if (user.notificationEmail !== undefined) {
    fields.push("notificationEmail", user.notificationEmail ? "true" : "false");
  }
  if (user.notificationPush !== undefined) {
    fields.push("notificationPush", user.notificationPush ? "true" : "false");
  }
  if (user.favorites) {
    fields.push("favorites", JSON.stringify(user.favorites));
  }
  if (user.tickets) {
    fields.push("tickets", JSON.stringify(user.tickets));
  }
  if (user.stats) {
    fields.push("stats", JSON.stringify(user.stats));
  }
  if (user.generationHistory) {
    fields.push("generationHistory", JSON.stringify(user.generationHistory));
  }
  if (user.photo !== undefined) {
    fields.push("photo", user.photo);
  }

  await redisCommand(["HSET", userKey(email), ...fields]);
  
  return { persisted: true };
}

export async function getUser(email: string): Promise<LotteryXUser | null> {
  if (!redisUrl || !redisToken) return null;
  const safeEmail = email.trim().toLowerCase();
  const data = await redisCommand<string[]>(["HMGET", userKey(safeEmail), 
    "email", "name", "createdAt", "password", 
    "drawPreference", "notificationEmail", "notificationPush", 
    "favorites", "tickets", "stats", "generationHistory", "photo"
  ]);
  
  if (!data[0]) return null;
  
  let favorites: string[] = [];
  try {
    favorites = data[7] ? JSON.parse(data[7]) : [];
  } catch (e) {}

  let tickets: Ticket[] = [];
  try {
    tickets = data[8] ? JSON.parse(data[8]) : [];
  } catch (e) {}

  let stats: UserStats = { totalTickets: 0, totalWins: 0, totalMatchedDigits: 0 };
  try {
    stats = data[9] ? JSON.parse(data[9]) : { totalTickets: 0, totalWins: 0, totalMatchedDigits: 0 };
  } catch (e) {}
  
  let generationHistory: import("./types").GenerationRecord[] = [];
  try {
    generationHistory = data[10] ? JSON.parse(data[10]) : [];
  } catch (e) {}

  return {
    email: data[0],
    name: data[1] ?? "Jugador",
    createdAt: data[2] ?? new Date().toISOString(),
    password: data[3] ?? undefined,
    drawPreference: data[4] ?? "Miercolito",
    notificationEmail: data[5] !== "false",
    notificationPush: data[6] === "true",
    favorites,
    tickets,
    stats,
    generationHistory,
    photo: data[11] ?? undefined
  };
}

export async function getUsers(): Promise<LotteryXUser[]> {
  if (!redisUrl || !redisToken) {
    return [];
  }

  const emails = await redisCommand<string[]>(["SMEMBERS", USERS_KEY]);
  const users = await Promise.all(
    emails.map(async (email) => {
      return await getUser(email);
    })
  );

  return users.filter((user): user is LotteryXUser => user !== null && user.email.includes("@"));
}

async function redisCommand<T>(command: Array<string | number>) {
  const response = await fetch(redisUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Redis error ${response.status}`);
  }

  const payload = (await response.json()) as { result: T };
  return payload.result;
}

function userKey(email: string) {
  return `lotteryx:user:${email}`;
}
