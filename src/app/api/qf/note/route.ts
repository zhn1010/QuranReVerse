import { NextResponse } from 'next/server';
import { getErrorMessage, getQfErrorStatus } from '@/lib/qf-route';
import {
  createNoteInQfAccount,
  deleteNoteInQfAccount,
  listNotesInQfAccount,
  persistQfUserSession,
  updateNoteInQfAccount,
} from '@/lib/qf-user';
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
    const message = getErrorMessage(error);
    const status = getQfErrorStatus(error);

    if (status === 401) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const result = await listNotesInQfAccount();
    const response = NextResponse.json({
      notes: result.notes,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    const message = getErrorMessage(error);
    const status = getQfErrorStatus(error);

    if (status === 401) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      body?: string;
      id?: string;
    };

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'Note id is required.' }, { status: 400 });
    }

    if (!body.body || typeof body.body !== 'string') {
      return NextResponse.json({ error: 'Note body is required.' }, { status: 400 });
    }

    if (body.body.length < 6 || body.body.length > 10000) {
      return NextResponse.json(
        { error: 'Note body must be between 6 and 10,000 characters.' },
        { status: 400 },
      );
    }

    const result = await updateNoteInQfAccount(body.id, body.body);
    const response = NextResponse.json({
      note: result.note,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    const message = getErrorMessage(error);
    const status = getQfErrorStatus(error);

    if (status === 401) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
    };

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'Note id is required.' }, { status: 400 });
    }

    const result = await deleteNoteInQfAccount(body.id);
    const response = NextResponse.json({
      success: result.success,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    const message = getErrorMessage(error);
    const status = getQfErrorStatus(error);

    if (status === 401) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
