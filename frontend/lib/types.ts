export interface SelfEvaluation {
  overall_score: number;
  criteria: {
    [key: string]: {
      score: number;
      reasoning: string;
    };
  };
  weaknesses?: string[];
  improvements?: string[];
}

export interface StrategyContent {
  format?: string;
  content: string;
  weeks?: number;
  topics?: string[];
  strategy_id?: string;
}

export interface LessonPhase {
  name: string;
  duration: number;
  objectives?: string[];
  activities?: string[];
}

export interface LessonContent {
  phases?: LessonPhase[];
  lesson_id?: string;
}

export interface ActivityContent {
  code?: string;
}

export interface DeploymentInfo {
  status?: string;
  attempts?: number;
  url?: string;
  sandbox_id?: string;
}

export interface ActivityResponse {
  activity_id?: string;
  content?: ActivityContent;
  evaluation?: SelfEvaluation;
  deployment?: DeploymentInfo;
  sandbox_url?: string;
}

export interface StrategyResponse {
  success: boolean;
  strategy_id: string;
  content: StrategyContent;
  evaluation: SelfEvaluation;
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  student: Record<string, unknown>;
  tutor: Record<string, unknown>;
}

export interface LessonResponse {
  success: boolean;
  lesson_id: string;
  content: LessonContent;
  evaluation: SelfEvaluation;
  student: Record<string, unknown>;
  tutor: Record<string, unknown>;
}

export type ActivityChatRole = 'tutor' | 'agent' | 'system';

export interface ActivityChatMessage {
  id?: string;
  role: ActivityChatRole;
  content: string;
  created_at: string;
  sandbox_url?: string;
  isStreaming?: boolean;
  stage?: 'thinking' | 'editing' | 'debugging' | 'deploying' | 'ready' | 'error';
  error?: string;
  version_number?: number;
}

export interface ContentVersion {
  version_number: number;
  content: Record<string, unknown>;
  changes_summary?: string;
  edit_type: string;
  edit_notes?: string;
  edited_by?: string;
  created_at: string;
}

