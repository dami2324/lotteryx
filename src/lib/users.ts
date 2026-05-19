export type LotteryXUser = {
  email: string;
  name: string;
  createdAt: string;
  password?: string;
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
  
  if (user.password) {
    await redisCommand(["HSET", userKey(email), "email", email, "name", user.name, "createdAt", user.createdAt, "password", user.password]);
  } else {
    await redisCommand(["HSET", userKey(email), "email", email, "name", user.name, "createdAt", user.createdAt]);
  }
  
  return { persisted: true };
}

export async function getUser(email: string): Promise<LotteryXUser | null> {
  if (!redisUrl || !redisToken) return null;
  const safeEmail = email.trim().toLowerCase();
  const data = await redisCommand<string[]>(["HMGET", userKey(safeEmail), "email", "name", "createdAt", "password"]);
  
  if (!data[0]) return null;
  
  return {
    email: data[0],
    name: data[1] ?? "Jugador",
    createdAt: data[2] ?? new Date().toISOString(),
    password: data[3] ?? undefined
  };
}

export async function getUsers(): Promise<LotteryXUser[]> {
  if (!redisUrl || !redisToken) {
    return [];
  }

  const emails = await redisCommand<string[]>(["SMEMBERS", USERS_KEY]);
  const users = await Promise.all(
    emails.map(async (email) => {
      const data = await redisCommand<string[]>(["HMGET", userKey(email), "email", "name", "createdAt"]);
      return {
        email: data[0] ?? email,
        name: data[1] ?? "Jugador",
        createdAt: data[2] ?? new Date().toISOString()
      };
    })
  );

  return users.filter((user) => user.email.includes("@"));
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
