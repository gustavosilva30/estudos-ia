export type ThemePreference = "light" | "dark" | "system";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

export interface Preferences {
  theme: ThemePreference;
  default_detail_level: "curto" | "medio" | "detalhado";
  daily_ai_limit: number;
}

export interface SessionData {
  user: User;
  preferences: Preferences;
  csrf_token: string;
}

export interface LessonListItem {
  id: string;
  title: string;
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  folder_id: string | null;
  lesson_date: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecentSummary {
  id: string;
  lesson_id: string;
  lesson_title: string;
  kind: string;
  title: string;
  is_favorite: boolean;
  updated_at: string;
}

export interface Dashboard {
  counts: {
    subjects: number;
    lessons: number;
    materials: number;
    summaries: number;
    favorites: number;
  };
  progress: {
    lessons_total: number;
    lessons_with_material: number;
    lessons_with_summary: number;
    percent_with_summary: number;
  };
  recent_lessons: LessonListItem[];
  recent_summaries: RecentSummary[];
  reviews: { available: boolean; pending: number | null };
  ai_usage: {
    used_today: number;
    daily_limit: number;
    month_cost_usd: number;
    monthly_budget_usd: number;
  };
}

/* ---------- Biblioteca (E6) ---------- */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Subject {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  is_archived: boolean;
  lesson_count: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  lesson_id: string;
  content: string;
  content_hash: string;
  origin: "typed" | "pasted";
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  lesson_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface LessonDetail {
  id: string;
  title: string;
  subject_id: string;
  folder_id: string | null;
  lesson_date: string | null;
  observations: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  materials: Material[];
  notes: Note[];
}

export interface SummaryItem {
  id: string;
  lesson_id: string;
  kind: string;
  title: string;
  current_version: number;
  is_favorite: boolean;
  updated_at: string;
}

export interface Summary extends SummaryItem {
  generation_id: string | null;
  content: string;
  created_at: string;
}

export interface SummaryVersion {
  version_number: number;
  title: string;
  content: string;
  origin: "ai" | "user" | "duplicate";
  created_at: string;
}

export interface AiOperation {
  id: string;
  label: string;
  description: string;
  supports_detail: boolean;
}

export interface AiOperations {
  operations: AiOperation[];
  max_input_chars: number;
}

export interface Generation {
  id: string;
  material_id: string;
  lesson_id: string;
  operation: string;
  operation_label: string;
  detail_level: string;
  provider: string;
  model: string;
  markdown: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
  cached: boolean;
}

export interface SearchResults {
  query: string;
  subjects: { id: string; name: string; color: string | null; is_archived: boolean }[];
  lessons: LessonListItem[];
  lessons_total: number;
  summaries: {
    id: string;
    lesson_id: string;
    lesson_title: string;
    title: string;
    kind: string;
    snippet: string;
    updated_at: string;
  }[];
  summaries_total: number;
}
