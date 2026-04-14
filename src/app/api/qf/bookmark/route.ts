import { NextResponse } from 'next/server';
import { bookmarkAyahsInReverseCollection, persistQfUserSession } from '@/lib/qf-user';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const hasSessionCookie = cookieHeader.includes('reverse_session_id=');
    const body = (await request.json()) as {
      ayahNo?: string;
      surahNo?: number;
    };

    if (process.env.QF_AUTH_DEBUG === 'true') {
      console.log('[qf-auth]', 'bookmark route request', {
        cookieHeaderLength: cookieHeader.length,
        hasSessionCookie,
      });
    }

    if (!body.ayahNo || !body.surahNo || !Number.isInteger(body.surahNo) || body.surahNo < 1) {
      return NextResponse.json(
        { error: 'Both surahNo and ayahNo are required.' },
        { status: 400 },
      );
    }

    const result = await bookmarkAyahsInReverseCollection(body.surahNo, body.ayahNo);
    const response = NextResponse.json({
      collectionId: result.collection.id,
      collectionName: result.collection.name,
      savedCount: result.savedCount,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    );
  }
}
