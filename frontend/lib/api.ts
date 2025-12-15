import axios from 'axios';
import type { StrategyResponse, LessonResponse, ActivityResponse } from './types';

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

export type { StrategyResponse, LessonResponse, ActivityResponse };
