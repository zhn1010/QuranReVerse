import { logoutQfUser } from '@/lib/qf-user';

export async function GET(request: Request) {
  return logoutQfUser(request.url);
}
