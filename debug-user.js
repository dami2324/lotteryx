const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
let redisUrl, redisToken;
env.split('\n').forEach(line => {
  if (line.startsWith('UPSTASH_REDIS_REST_URL=')) redisUrl = line.split('=')[1].trim();
  if (line.startsWith('UPSTASH_REDIS_REST_TOKEN=')) redisToken = line.split('=')[1].trim();
});

async function run() {
  const res = await fetch(redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(["HGETALL", "lotteryx:user:amaraquintero78@gmail.com"])
  });
  const data = await res.json();
  console.log("User details:", data);
}
run();
