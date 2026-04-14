import { NextResponse } from "next/server";

const CANONICAL_ORIGIN = "https://quran-re-verse.vercel.app";

export function middleware(req) {
    const url = req.nextUrl;
    const requestOrigin = url.origin;

    const isAuthRoute =
        url.pathname.startsWith("/api/qf/auth") ||
        url.pathname.startsWith("/api/auth");

    // If request is NOT on canonical domain → force redirect
    if (isAuthRoute && requestOrigin !== CANONICAL_ORIGIN) {
        const redirectUrl = new URL(url.pathname + url.search, CANONICAL_ORIGIN);

        console.log("[Auth Redirect → Canonical]", {
            from: requestOrigin,
            to: redirectUrl.toString(),
        });

        return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
}