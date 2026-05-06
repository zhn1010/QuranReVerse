import { describe, expect, it, vi } from 'vitest';
import { guardMeaningfulReflectionInput } from '@/lib/antidotes/input-guard';

describe('guardMeaningfulReflectionInput', () => {
  it('allows meaningful input to proceed', async () => {
    const validateInput = vi.fn(async () => ({
      decision: 'valid' as const,
      reason_code: 'meaningful' as const,
      reply_message: '',
    }));

    await expect(
      guardMeaningfulReflectionInput('A real event', {
        debugLogger: vi.fn(),
        validateInput,
      }),
    ).resolves.toBeNull();
  });

  it('returns a respectful validation failure for vague input', async () => {
    const validateInput = vi.fn(async () => ({
      decision: 'needs_clarification' as const,
      reason_code: 'too_vague' as const,
      reply_message: 'Please share what happened and how it affected you.',
    }));

    await expect(
      guardMeaningfulReflectionInput('help', {
        debugLogger: vi.fn(),
        validateInput,
      }),
    ).resolves.toEqual({
      error: 'Please share what happened and how it affected you.',
      reason_code: 'too_vague',
      status: 422,
    });
  });
});
