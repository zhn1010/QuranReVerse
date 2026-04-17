import { NextResponse } from 'next/server';
import { createNoteInQfAccount, persistQfUserSession } from '@/lib/qf-user';
import type { QfNoteAttachedEntity } from '@/lib/qf-user';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      attachedEntities?: QfNoteAttachedEntity[];
      body?: string;
      ranges?: string[];
    };

    if (!body.body || typeof body.body !== 'string') {
      return NextResponse.json({ error: 'Note body is required.' }, { status: 400 });
    }

    if (body.body.length < 6 || body.body.length > 10000) {
      return NextResponse.json(
        { error: 'Note body must be between 6 and 10,000 characters.' },
        { status: 400 },
      );
    }

    const rangePattern = /^(\d+):(\d+)-(\d+):(\d+)$/;
    const ranges = (body.ranges ?? []).filter((range) => rangePattern.test(range));

    let attachedEntity: QfNoteAttachedEntity | null = null;

    if (body.attachedEntities && body.attachedEntities.length > 0) {
      const first = body.attachedEntities[0];
      if (first.entityId && first.entityType === 'reflection') {
        attachedEntity = first;
      }
    }

    const result = await createNoteInQfAccount(body.body, ranges, attachedEntity);
    const response = NextResponse.json({
      note: result.note,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('connection expired') ||
      message.includes('connect your Quran Foundation')
    ) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
