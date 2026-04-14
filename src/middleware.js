// middleware.ts
import { NextResponse } from "next/server";

export function middleware(req) {
    const host = req.headers.get("host");

    const isPreview = host?.includes("vercel.app") && !host.startsWith("quran-re-verse");

    if (isPreview && req.nextUrl.pathname.startsWith("/api/auth")) {
        const url = req.nextUrl.clone();
        url.hostname = "quran-re-verse.vercel.app";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}