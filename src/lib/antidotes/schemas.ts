export const antidoteResponseSchema = {
  additionalProperties: false,
  properties: {
    antidotes: {
      items: {
        additionalProperties: false,
        properties: {
          ayah_no: { type: 'string' },
          reasoning: { type: 'string' },
          surah_name: { type: 'string' },
          surah_no: { type: 'integer' },
        },
        required: ['surah_name', 'surah_no', 'ayah_no', 'reasoning'],
        type: 'object',
      },
      maxItems: 3,
      minItems: 1,
      type: 'array',
    },
    diagnosis: {
      additionalProperties: false,
      properties: {
        god_centric_reframe: { type: 'string' },
        materialistic_narrative: { type: 'string' },
        spiritual_drift: { type: 'string' },
      },
      required: ['spiritual_drift', 'materialistic_narrative', 'god_centric_reframe'],
      type: 'object',
    },
  },
  required: ['diagnosis', 'antidotes'],
  type: 'object',
} as const;

export const curatorResponseSchema = {
  additionalProperties: false,
  properties: {
    selected_reflection_id: { type: 'integer' },
    selection_reason: { type: 'string' },
  },
  required: ['selected_reflection_id', 'selection_reason'],
  type: 'object',
} as const;

export const spiritualGuideResponseSchema = {
  additionalProperties: false,
  properties: {
    conclusion_text: { type: 'string' },
    intro_text: { type: 'string' },
  },
  required: ['intro_text', 'conclusion_text'],
  type: 'object',
} as const;

export const languageDetectionResponseSchema = {
  additionalProperties: false,
  properties: {
    language_code: { type: 'string' },
  },
  required: ['language_code'],
  type: 'object',
} as const;

export const inputValidationResponseSchema = {
  additionalProperties: false,
  properties: {
    decision: {
      enum: ['valid', 'needs_clarification', 'invalid'],
      type: 'string',
    },
    reason_code: {
      enum: ['meaningful', 'too_vague', 'noise', 'prompt_injection', 'link_only'],
      type: 'string',
    },
    reply_message: {
      maxLength: 140,
      type: 'string',
    },
  },
  required: ['decision', 'reason_code', 'reply_message'],
  type: 'object',
} as const;

export const reflectionTranslationResponseSchema = {
  additionalProperties: false,
  properties: {
    translated_text: { type: 'string' },
  },
  required: ['translated_text'],
  type: 'object',
} as const;

export const chatTitleResponseSchema = {
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
  },
  required: ['title'],
  type: 'object',
} as const;
