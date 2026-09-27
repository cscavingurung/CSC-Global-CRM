import { supabase } from '../supabaseClient';
import { PerformanceReview } from '../../types';

export interface PerformanceReviewRow {
  id: string;
  staff_name: string;
  branch: string;
  period: string;
  overall: string;
  strengths: string;
  improvements: string;
  goals: string;
  assessment: PerformanceReview['assessment'];
  acknowledged: boolean;
  acknowledged_at: string | null;
  reviewed_by: string;
  reviewed_at: string;
}

export function fromRow(row: PerformanceReviewRow): PerformanceReview {
  return {
    id: row.id,
    staffName: row.staff_name,
    branch: row.branch,
    period: row.period,
    overall: row.overall,
    strengths: row.strengths,
    improvements: row.improvements,
    goals: row.goals,
    assessment: row.assessment,
    acknowledged: row.acknowledged,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

function toRow(review: PerformanceReview): PerformanceReviewRow {
  return {
    id: review.id,
    staff_name: review.staffName,
    branch: review.branch,
    period: review.period,
    overall: review.overall,
    strengths: review.strengths,
    improvements: review.improvements,
    goals: review.goals,
    assessment: review.assessment,
    acknowledged: review.acknowledged,
    acknowledged_at: review.acknowledgedAt ?? null,
    reviewed_by: review.reviewedBy,
    reviewed_at: review.reviewedAt,
  };
}

export async function fetchPerformanceReviews(): Promise<PerformanceReview[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('performance_reviews').select('*').order('reviewed_at', { ascending: false });
  if (error) throw error;
  return (data as PerformanceReviewRow[]).map(fromRow);
}

export async function upsertPerformanceReview(review: PerformanceReview): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('performance_reviews').upsert(toRow(review));
  if (error) throw error;
}
