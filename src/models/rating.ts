// Rating and evaluation models

export interface Rating {
  id: string;
  prompt_id: string;
  user_id: string;
  score: number; // 1-5 stars
  note?: string;
  created_at: string;
  prompt_version?: number;
}

export interface RunLog {
  id: string;
  prompt_id: string;
  user_id: string;
  provider: string;
  model: string;
  created_at: string;
  outcome_note?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface RatingAggregation {
  prompt_id: string;
  average_score: number;
  total_ratings: number;
  score_distribution: Record<number, number>; // score -> count
  latest_rating_date: string;
}