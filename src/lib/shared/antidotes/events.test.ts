import { describe, expect, it } from 'vitest';
import { PIPELINE_STEP_LABELS, createPipelineStep, toJsonLine } from '@/lib/shared/antidotes/events';

describe('createPipelineStep', () => {
  it('uses the canonical label for each pipeline step', () => {
    expect(createPipelineStep('language_detection', 'in_progress')).toEqual({
      label: PIPELINE_STEP_LABELS.language_detection,
      status: 'in_progress',
      step: 'language_detection',
      type: 'step',
    });
  });
});

describe('toJsonLine', () => {
  it('serializes events as ndjson lines', () => {
    expect(
      toJsonLine({
        error: 'failed',
        type: 'error',
      }),
    ).toBe('{"error":"failed","type":"error"}\n');
  });
});
