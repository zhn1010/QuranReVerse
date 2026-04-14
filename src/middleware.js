const CANONICAL_HOST = "quran-re-verse.vercel.app";

export function middleware(req) {
    const url = req.nextUrl;
    const host = req.headers.get("host");

    const isAuthRoute = url.pathname.startsWith("/api/auth");

    if (isAuthRoute && host !== CANONICAL_HOST) {
        url.hostname = CANONICAL_HOST;
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}