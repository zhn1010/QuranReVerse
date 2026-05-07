import { NextResponse } from 'next/server';
import { getErrorMessage, getQfErrorStatus } from '@/lib/server/qf/route';
import {
  bookmarkAyahsInSakinahCollection,
  getAyahBookmarksInSakinahCollection,
  persistQfUserSession,
  removeAyahBookmarksFromSakinahCollection,
} from '@/lib/server/qf/user';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const hasSessionCookie = cookieHeader.includes('sakinah_session_id=');
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
      return NextResponse.json({ error: 'Both surahNo and ayahNo are required.' }, { status: 400 });
    }

    const result = await bookmarkAyahsInSakinahCollection(body.surahNo, body.ayahNo);
    const response = NextResponse.json({
      collectionId: result.collection.id,
      collectionName: result.collection.name,
      savedCount: result.savedCount,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    const message = getErrorMessage(error);

    return NextResponse.json(
      {
        error: message || 'Unexpected error',
      },
      { status: getQfErrorStatus(error) },
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const surahNo = Number.parseInt(url.searchParams.get('surahNo') ?? '', 10);
    const ayahNo = url.searchParams.get('ayahNo') ?? '';

    if (process.env.QF_AUTH_DEBUG === 'true') {
      console.log('[qf-auth]', 'bookmark route GET request', {
        ayahNo,
        hasAyahNo: Boolean(ayahNo),
        surahNo,
        url: request.url,
      });
    }

    if (!Number.isInteger(surahNo) || surahNo < 1 || !ayahNo) {
      return NextResponse.json({ error: 'Both surahNo and ayahNo are required.' }, { status: 400 });
    }

    const result = await getAyahBookmarksInSakinahCollection(surahNo, ayahNo);

    if (process.env.QF_AUTH_DEBUG === 'true') {
      console.log('[qf-auth]', 'bookmark route GET result', {
        ayahNo,
        bookmarkCount: Object.keys(result.bookmarkIdsByVerseNumber ?? {}).length,
        collectionId: result.collection?.id ?? null,
        surahNo,
      });
    }

    const response = NextResponse.json({
      bookmarkIdsByVerseNumber: result.bookmarkIdsByVerseNumber,
      collectionId: result.collection?.id ?? null,
      collectionName: result.collection?.name ?? null,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    if (process.env.QF_AUTH_DEBUG === 'true') {
      console.log('[qf-auth]', 'bookmark route GET failed', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
    }

    const message = getErrorMessage(error);
    const status = getQfErrorStatus(error);

    if (status === 401 || status === 504) {
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      ayahNo?: string;
      surahNo?: number;
    };

    if (!body.ayahNo || !body.surahNo || !Number.isInteger(body.surahNo) || body.surahNo < 1) {
      return NextResponse.json({ error: 'Both surahNo and ayahNo are required.' }, { status: 400 });
    }

    const result = await removeAyahBookmarksFromSakinahCollection(body.surahNo, body.ayahNo);
    const response = NextResponse.json({
      collectionId: result.collection?.id ?? null,
      collectionName: result.collection?.name ?? null,
      removedCount: result.removedCount,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    const message = getErrorMessage(error);

    return NextResponse.json(
      {
        error: message || 'Unexpected error',
      },
      { status: getQfErrorStatus(error) },
    );
  }
}
