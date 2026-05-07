import { describe, expect, it, vi } from 'vitest';
import { guardMeaningfulReflectionInput } from '@/lib/antidotes/input-guard';

describe('guardMeaningfulReflectionInput', () => {
  it('allows meaningful input to proceed', async () => {
    const validateInput = vi.fn(async () => ({
      decision: 'usable' as const,
      reason_code: 'usable' as const,
      reply_message: '',
    }));

    await expect(
      guardMeaningfulReflectionInput('A real event', {
        debugLogger: vi.fn(),
        validateInput,
      }),
    ).resolves.toBeNull();
  });

  it('returns a respectful validation failure only for invalid input', async () => {
    const validateInput = vi.fn(async () => ({
      decision: 'invalid' as const,
      reason_code: 'noise' as const,
      reply_message: 'Please share a real situation, thought, or concern.',
    }));

    await expect(
      guardMeaningfulReflectionInput('help', {
        debugLogger: vi.fn(),
        validateInput,
      }),
    ).resolves.toEqual({
      error: 'Please share a real situation, thought, or concern.',
      reason_code: 'noise',
      status: 422,
    });
  });
});
