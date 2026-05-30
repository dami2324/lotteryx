import { config } from 'dotenv';
config({ path: '.env.local' });
import { getUsers, getUser } from './src/lib/users';

async function run() {
  const users = await getUsers();
  console.log("All users:", users.map(u => u.email));
  const specific = await getUser('amaraquintero78@gmail.com');
  console.log("User details:", specific);
}

run().catch(console.error);
