import axios from 'axios';
import type { StrategyResponse, LessonResponse, ActivityResponse } from './types';

export type ActivityChatStreamEvent =
  | { type: 'stage'; stage: 'thinking' | 'editing' | 'debugging' | 'deploying' }
  | { type: 'explanation'; text: string }
  | { type: 'ready'; sandbox_url?: string; new_code?: string; explanation?: string }
  | { type: 'error'; message: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Database queries for dropdowns
export const dataApi = {
  getStudents: async () => {
    // Query Supabase directly through backend
    const response = await api.get('/api/v1/data/students');
    return response.data;
  },
  
  getTutors: async () => {
    const response = await api.get('/api/v1/data/tutors');
    return response.data;
  },
  
  getStrategies: async (studentId: string) => {
    const response = await api.get(`/api/v1/data/strategies/${studentId}`);
    return response.data;
  },
  
  getLessons: async (studentId: string) => {
    const response = await api.get(`/api/v1/data/lessons/${studentId}`);
    return response.data;
  },
  
  getActivities: async (studentId: string) => {
    const response = await api.get(`/api/v1/data/activities/${studentId}`);
    return response.data;
  },
};

// API functions
export const strategyApi = {
  create: async (data: {
    student_id: string;
    tutor_id: string;
    subject: string;
    weeks: number;
  }) => {
    const response = await api.post('/api/v1/agents/strategy', data);
    return response.data;
  },
  
  getVersions: async (strategyId: string) => {
    const response = await api.get(`/api/v1/content/versions/strategy/${strategyId}`);
    return response.data;
  },
  
  saveVersion: async (data: {
    content_type: string;
    content_id: string;
    content: Record<string, unknown>;
    changes_summary?: string;
    edit_notes?: string;
    tutor_id: string;
  }) => {
    const response = await api.post('/api/v1/content/save-version', data);
    return response.data;
  },
};

export const lessonApi = {
  create: async (data: {
    student_id: string;
    tutor_id: string;
    topic?: string;
    duration?: number;
    strategy_id?: string;
    strategy_week_number?: number;
  }) => {
    const response = await api.post('/api/v1/agents/lesson', data);
    return response.data;
  },
  
  getVersions: async (lessonId: string) => {
    const response = await api.get(`/api/v1/content/versions/lesson/${lessonId}`);
    return response.data;
  },
  
  saveVersion: async (data: {
    content_type: string;
    content_id: string;
    content: Record<string, unknown>;
    changes_summary?: string;
    edit_notes?: string;
    tutor_id: string;
  }) => {
    const response = await api.post('/api/v1/content/save-version', data);
    return response.data;
  },
};

export const activityApi = {
  create: async (data: {
    student_id: string;
    tutor_id: string;
    topic?: string;
    activity_description?: string;
    duration?: number;
    lesson_id?: string;
    lesson_phase?: string;
    max_attempts?: number;
  }) => {
    const response = await api.post('/api/v1/agents/activity', data);
    return response.data;
  },
  
  redeploy: async (data: {
    activity_id: string;
    student_id: string;
  }): Promise<{
    success: boolean;
    activity_id: string;
    deployment: {
      sandbox_id: string;
      url: string;
      status: string;
      exit_code: number;
      error?: string;
    };
    sandbox_url?: string;
  }> => {
    const response = await api.post('/api/v1/agents/activity/redeploy', data);
    return response.data;
  },

  getVersions: async (activityId: string) => {
    const response = await api.get(`/api/v1/content/versions/activity/${activityId}`);
    return response.data;
  },
  
  chat: async (data: {
    activity_id: string;
    tutor_id: string;
    student_id: string;
    message: string;
  }) => {
    const response = await api.post('/api/v1/activity/chat', data);
    return response.data;
  },

  /**
   * Streaming variant of `chat`. Reads SSE-style `data: {json}\n\n` events from
   * the POST response body and dispatches them via `onEvent`. Resolves when the
   * stream closes. Throws on network failures so the caller can show an error.
   */
  chatStream: async (
    data: {
      activity_id: string;
      tutor_id: string;
      student_id: string;
      message: string;
    },
    onEvent: (evt: ActivityChatStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/api/v1/activity/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(data),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Stream failed: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!chunk) continue;
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            onEvent(JSON.parse(json) as ActivityChatStreamEvent);
          } catch (err) {
            console.warn('Failed to parse stream event', err, json);
          }
        }
      }
    }
  },

  getChatHistory: async (activityId: string) => {
    const response = await api.get(`/api/v1/activity/chat/${activityId}`);
    return response.data;
  },
  
  cleanupSandbox: async (data: {
    old_sandbox_id: string;
    session_id?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> => {
    const response = await api.post('/api/v1/agents/activity/cleanup', data);
    return response.data;
  },
};

// ─── Saved prompts (Tier 1.2) ────────────────────────────────────────────────
export interface SavedPrompt {
  id: string;
  tutor_id: string;
  label: string;
  prompt: string;
  use_count: number;
  last_used_at?: string;
  created_at: string;
}

export const tutorApi = {
  listSavedPrompts: async (tutorId: string): Promise<SavedPrompt[]> => {
    const res = await api.get(`/api/v1/tutor/${tutorId}/saved-prompts`);
    return res.data?.prompts ?? [];
  },
  createSavedPrompt: async (
    tutorId: string,
    data: { label: string; prompt: string }
  ): Promise<SavedPrompt> => {
    const res = await api.post(`/api/v1/tutor/${tutorId}/saved-prompts`, data);
    return res.data?.prompt;
  },
  updateSavedPrompt: async (
    id: string,
    data: { label?: string; prompt?: string }
  ): Promise<SavedPrompt> => {
    const res = await api.patch(`/api/v1/tutor/saved-prompts/${id}`, data);
    return res.data?.prompt;
  },
  deleteSavedPrompt: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/tutor/saved-prompts/${id}`);
  },
  recordSavedPromptUse: async (id: string): Promise<void> => {
    await api.post(`/api/v1/tutor/saved-prompts/${id}/use`);
  },
};

// ─── Voice transcription (Tier 1.3) ───────────────────────────────────────────
export const transcribeApi = {
  transcribe: async (audioBlob: Blob): Promise<string> => {
    const form = new FormData();
    form.append('audio', audioBlob, 'audio.webm');
    const res = await fetch(`${API_URL}/api/v1/transcribe`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`Transcribe failed: ${res.status}`);
    const data = await res.json();
    return data.text || '';
  },
};

// ─── Sessions (Tier 2.2) ──────────────────────────────────────────────────────
export interface ActivitySessionEvent {
  kind: string;
  payload?: any;
  ts?: string;
}

export interface ActivitySession {
  id: string;
  activity_id: string;
  student_id?: string;
  tutor_id?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  ai_summary?: string;
  ai_misconceptions?: any[];
  ai_strengths?: any[];
}

export const sessionApi = {
  start: async (data: {
    activity_id: string;
    student_id?: string;
    tutor_id?: string;
  }): Promise<ActivitySession> => {
    const res = await api.post('/api/v1/sessions', data);
    return res.data?.session;
  },
  pushEvents: async (sessionId: string, events: ActivitySessionEvent[]): Promise<void> => {
    await api.post(`/api/v1/sessions/${sessionId}/events`, { events });
  },
  end: async (sessionId: string): Promise<ActivitySession> => {
    const res = await api.post(`/api/v1/sessions/${sessionId}/end`);
    return res.data?.session;
  },
  get: async (sessionId: string): Promise<{ session: ActivitySession; events: any[] }> => {
    const res = await api.get(`/api/v1/sessions/${sessionId}`);
    return res.data;
  },
  listForActivity: async (activityId: string): Promise<ActivitySession[]> => {
    const res = await api.get(`/api/v1/activities/${activityId}/sessions`);
    return res.data?.sessions ?? [];
  },
  listForStudent: async (studentId: string): Promise<ActivitySession[]> => {
    const res = await api.get(`/api/v1/students/${studentId}/sessions`);
    return res.data?.sessions ?? [];
  },
  analytics: async (activityId: string): Promise<any> => {
    const res = await api.get(`/api/v1/activities/${activityId}/analytics`);
    return res.data;
  },
};

// ─── Versions (Tier 3.4) ──────────────────────────────────────────────────────
export interface ActivityVersion {
  id: string;
  activity_id: string;
  version_number: number;
  label?: string;
  code: string;
  sandbox_url?: string;
  pinned_for_student_id?: string;
  created_at: string;
}

export const versionsApi = {
  list: async (activityId: string): Promise<ActivityVersion[]> => {
    const res = await api.get(`/api/v1/activity/${activityId}/versions`);
    return res.data?.versions ?? [];
  },
  label: async (id: string, label: string): Promise<ActivityVersion> => {
    const res = await api.patch(`/api/v1/activity/versions/${id}`, { label });
    return res.data?.version;
  },
  pin: async (id: string, studentId: string | null): Promise<ActivityVersion> => {
    const res = await api.post(`/api/v1/activity/versions/${id}/pin`, {
      student_id: studentId,
    });
    return res.data?.version;
  },
  restore: async (
    id: string
  ): Promise<{ activity_id: string; sandbox_url?: string; code: string }> => {
    const res = await api.post(`/api/v1/activity/versions/${id}/restore`);
    return res.data;
  },
};

// ─── Insights (Tier 3.1) ──────────────────────────────────────────────────────
export interface StudentInsight {
  id: string;
  student_id: string;
  generated_at: string;
  kind: 'misconception' | 'strength' | 'engagement' | string;
  topic?: string;
  evidence?: any[];
  recommended_action?: string;
  dismissed: boolean;
}

export const insightsApi = {
  list: async (studentId: string): Promise<StudentInsight[]> => {
    const res = await api.get(`/api/v1/students/${studentId}/insights`);
    return res.data?.insights ?? [];
  },
  generate: async (studentId: string): Promise<StudentInsight[]> => {
    const res = await api.post(`/api/v1/students/${studentId}/insights/generate`);
    return res.data?.insights ?? [];
  },
  dismiss: async (id: string): Promise<void> => {
    await api.post(`/api/v1/insights/${id}/dismiss`);
  },
};

// ─── Recap (Tier 3.2) ─────────────────────────────────────────────────────────
export const recapApi = {
  generate: async (data: {
    student_id: string;
    from_date: string;
    to_date: string;
    tone?: 'warm' | 'concise';
  }): Promise<{ subject: string; body: string }> => {
    const res = await api.post(`/api/v1/students/${data.student_id}/recap`, data);
    return res.data;
  },
};

// ─── Adapt (Tier 2.3) ─────────────────────────────────────────────────────────
export const adaptApi = {
  adapt: async (data: {
    source_activity_id: string;
    target_student_id: string;
    tutor_id: string;
  }): Promise<{ activity_id: string; sandbox_url?: string }> => {
    const res = await api.post('/api/v1/agents/activity/adapt', data);
    return res.data;
  },
};

// ─── Alignment (Tier 3.3) ─────────────────────────────────────────────────────
export interface AlignmentCheck {
  axis: 'age' | 'objectives' | 'standard';
  status: 'pass' | 'warn' | 'fail';
  reasoning: string;
}

export const alignmentApi = {
  check: async (
    activityId: string,
    data: {
      student_id: string;
      standard_id?: string;
    },
    onEvent: (evt: AlignmentCheck) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/api/v1/activity/${activityId}/check-alignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Alignment failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!chunk) continue;
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            onEvent(JSON.parse(line.slice(5).trim()));
          } catch {
            /* ignore */
          }
        }
      }
    }
  },
  listStandards: async (): Promise<
    { id: string; code: string; framework: string; description: string }[]
  > => {
    const res = await api.get('/api/v1/curriculum-standards');
    return res.data?.standards ?? [];
  },
};

// ─── Feedback / session-recordings API (from main) ────────────────────────────
export const feedbackApi = {
  uploadSession: async (data: {
    student_id: string;
    tutor_id: string;
    lesson_id?: string;
    occurred_at?: string;
    file: File;
  }) => {
    const form = new FormData();
    form.append('student_id', data.student_id);
    form.append('tutor_id', data.tutor_id);
    if (data.lesson_id) form.append('lesson_id', data.lesson_id);
    if (data.occurred_at) form.append('occurred_at', data.occurred_at);
    form.append('file', data.file);
    const response = await api.post('/api/v1/sessions/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  triggerAssess: async (sessionId: string) => {
    const response = await api.post(`/api/v1/sessions/${sessionId}/assess`);
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await api.get(`/api/v1/sessions/${sessionId}`);
    return response.data;
  },

  listSessions: async (studentId: string) => {
    const response = await api.get(`/api/v1/students/${studentId}/sessions`);
    return response.data;
  },

  generateReport: async (data: {
    student_id: string;
    tutor_id: string;
    mode: 'per_session' | 'weekly_digest';
    session_ids: string[];
    period_start?: string;
    period_end?: string;
  }) => {
    const response = await api.post('/api/v1/agents/feedback-generator', data);
    return response.data;
  },

  listReports: async (studentId: string) => {
    const response = await api.get(`/api/v1/students/${studentId}/feedback-reports`);
    return response.data;
  },

  patchReport: async (
    reportId: string,
    patch: { markdown?: string; title?: string; status?: string },
  ) => {
    const response = await api.patch(`/api/v1/feedback-reports/${reportId}`, patch);
    return response.data;
  },

  listMemoryProposals: async (studentId: string, status: string = 'pending') => {
    const response = await api.get(
      `/api/v1/students/${studentId}/memory-proposals?status=${encodeURIComponent(status)}`,
    );
    return response.data;
  },

  decideMemoryProposal: async (
    proposalId: string,
    data: { decision: 'approved' | 'rejected'; reviewed_by?: string },
  ) => {
    const response = await api.post(`/api/v1/memory-proposals/${proposalId}/decision`, data);
    return response.data;
  },
};

export type { StrategyResponse, LessonResponse, ActivityResponse };
