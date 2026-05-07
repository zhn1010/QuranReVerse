import { NextResponse } from 'next/server';
import { createTextStreamFromOpenAIResponse, postOpenAIResponse } from '@/lib/openai-client';

const NOTE_DRAFT_SYSTEM_PROMPT = `You are a personal journal ghostwriter for a Muslim who has just gone through a Quranic grounding session on Sakinah.now. The user came to the app feeling spiritually unsettled, received a diagnosis of their inner state, read a curated community reflection tied to specific Quran verses, and was guided back toward a God-centric perspective.

Your task is to write a first-person journal note AS IF the user wrote it themselves—capturing what they felt, what they read, and how their thinking shifted. This note will be saved to their Quran Foundation account so they can revisit it later.

Writing rules:
1. First person, warm, honest, reflective tone—like a private journal entry written right after the session.
2. Begin by briefly naming the moment or event that unsettled them and the feeling it produced.
3. Mention the spiritual drift that was identified (without clinical language—describe it naturally).
4. Reference the specific Quran passage(s) and the reflection they read. Include the surah name and ayah numbers naturally in the text.
5. Capture the key insight or reframe—how the God-centric view replaced the materialistic one.
6. End with a personal takeaway, intention, or dua focus they can carry forward.
7. Keep it between 150-350 words. Do not use bullet points or headers—write flowing prose.
8. Do not use overly formal or preachy language. Sound like a real person writing to their future self.
9. Return ONLY the note text. No JSON wrapping, no titles, no metadata.`;

type DraftRequestBody = {
  diagnosis: {
    god_centric_reframe: string;
    materialistic_narrative: string;
    spiritual_drift: string;
  } | null;
  eventContent: string;
  reflectionBody: string | null;
  reflectionGuide: {
    conclusion_text: string;
    intro_text: string;
  } | null;
  selectedReflection: {
    authorName: string | null;
    ayahNo: string;
    selectionReason: string;
    surahName: string;
    surahNo: number;
  } | null;
  userFeeling: string;
};

function buildPromptInput(body: DraftRequestBody): string {
  const sections: string[] = [];

  sections.push(`What happened:\n${body.eventContent}`);
  sections.push(`What I was feeling:\n${body.userFeeling}`);

  if (body.diagnosis) {
    sections.push(
      `Spiritual diagnosis:\n- Drift: ${body.diagnosis.spiritual_drift}\n- Materialistic lens: ${body.diagnosis.materialistic_narrative}\n- God-centric reframe: ${body.diagnosis.god_centric_reframe}`,
    );
  }

  if (body.selectedReflection) {
    const ref = body.selectedReflection;
    sections.push(
      `Quranic anchor: Surah ${ref.surahName} (${ref.surahNo}:${ref.ayahNo})${ref.authorName ? `\nReflection by: ${ref.authorName}` : ''}${ref.selectionReason ? `\nWhy this was chosen: ${ref.selectionReason}` : ''}`,
    );
  }

  if (body.reflectionBody) {
    sections.push(`The reflection I read:\n${body.reflectionBody}`);
  }

  if (body.reflectionGuide) {
    sections.push(
      `Guidance wrapper:\nIntro: ${body.reflectionGuide.intro_text}\nConclusion: ${body.reflectionGuide.conclusion_text}`,
    );
  }

  return sections.join('\n\n');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DraftRequestBody;

    if (!body.eventContent || !body.userFeeling) {
      return NextResponse.json(
        { error: 'Event content and user feeling are required.' },
        { status: 400 },
      );
    }

    const inputText = buildPromptInput(body);

    const upstreamResponse = await postOpenAIResponse({
      input: [
        {
          content: [
            {
              text: inputText,
              type: 'input_text',
            },
          ],
          role: 'user',
        },
      ],
      instructions: NOTE_DRAFT_SYSTEM_PROMPT,
      max_output_tokens: 600,
      stream: true,
    });

    if (!upstreamResponse.ok) {
      const details = await upstreamResponse.text();
      console.error('[note-draft] OpenAI request failed', {
        details,
        status: upstreamResponse.status,
      });
      return NextResponse.json({ error: 'Could not generate the note draft.' }, { status: 502 });
    }

    const stream = createTextStreamFromOpenAIResponse(upstreamResponse, (streamError) => {
      console.error('[note-draft] stream error', streamError);
    });

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: 'OpenAI API key is not configured.' }, { status: 500 });
    }

    console.error('[note-draft] unexpected error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
