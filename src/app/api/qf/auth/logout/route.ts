import { logoutQfUser } from '@/lib/server/qf/user';

export async function GET(request: Request) {
  return logoutQfUser(request.url);
}
