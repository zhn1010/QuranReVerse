import { handleAuthCallback } from '@/lib/qf-user';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  return handleAuthCallback(request.url, code, state);
}
