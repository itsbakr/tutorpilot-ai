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
