import { AcademicEntry } from '../types';

// Defensive against rows saved before a field was added, or any other unrecognised shape —
// coerces to sane defaults instead of throwing when a record is opened.
export function normalizeAcademics(raw: unknown): AcademicEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: Record<string, unknown>): AcademicEntry => ({
    level: typeof e.level === 'string' ? e.level : '',
    stream: typeof e.stream === 'string' ? e.stream : '',
    gpa: typeof e.gpa === 'string' ? e.gpa : '',
    completionYear: typeof e.completionYear === 'string' ? e.completionYear : '',
  }));
}
