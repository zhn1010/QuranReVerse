import { validateFeelingInferenceInput } from '@/lib/antidotes/service';
import type { FeelingInferenceInputGuardResponse } from '@/lib/antidotes/types';
import type { AntidoteDebugLogger } from '@/lib/antidotes/service-shared';

export type InputGuardFailure = {
  error: string;
  reason_code: string;
  status: 422;
};

export async function guardMeaningfulReflectionInput(
  eventContent: string,
  {
    debugLogger,
    validateInput = validateFeelingInferenceInput,
  }: {
    debugLogger: AntidoteDebugLogger;
    validateInput?: (
      eventText: string,
      options: {
        debugLogger: AntidoteDebugLogger;
      },
    ) => Promise<FeelingInferenceInputGuardResponse>;
  },
): Promise<InputGuardFailure | null> {
  const validation = await validateInput(eventContent, {
    debugLogger,
  });

  if (validation.decision === 'usable') {
    return null;
  }

  return {
    error: validation.reply_message,
    reason_code: validation.reason_code,
    status: 422,
  };
}
