export type ReflectionReference = {
  chapterId: number;
  from: number;
  id: string;
  to: number;
};

export type RelatedReflection = {
  authorName: string;
  body: string;
  commentsCount: number;
  createdAt: string | null;
  id: number;
  languageName: string | null;
  likesCount: number;
  postTypeName: string | null;
  references: ReflectionReference[];
};

export type SelectedReflection = {
  ayah_no: string;
  reflection_is_translated: boolean;
  reflection_original_body: string | null;
  reflection_source_language_code: string | null;
  reflection: RelatedReflection | null;
  selected_reflection_id: number;
  selection_reason: string;
  surah_name: string;
  surah_no: number;
};

export type ReflectionGuide = {
  conclusion_text: string;
  intro_text: string;
};

export type Antidote = {
  ayah_no: string;
  related_reflections: RelatedReflection[];
  reasoning: string;
  surah_name: string;
  surah_no: number;
};

export type Diagnosis = {
  god_centric_reframe: string;
  materialistic_narrative: string;
  spiritual_drift: string;
};

export type ApiResponse = {
  antidotes: Antidote[];
  chat_title: string;
  detected_language_code: string;
  diagnosis: Diagnosis;
  error?: string;
  reflection_guide: ReflectionGuide | null;
  selected_reflection: SelectedReflection | null;
};
