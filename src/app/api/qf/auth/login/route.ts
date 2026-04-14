import { buildLoginRedirect } from '@/lib/qf-user';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get('next');

  return buildLoginRedirect(request.url, returnTo);
}
