'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { 
  ClockIcon, 
  UserGroupIcon,
  SparklesIcon,
  BookOpenIcon,
  AcademicCapIcon,
  PuzzlePieceIcon,
  ArrowTrendingUpIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline'

type AgentType = 'strategy_planner' | 'lesson_creator' | 'activity_creator'

interface AgentMetrics {
  agent_type: string
  avg_score: number
  total_generations: number
  improvement_trend: number
}

type LearningInsight = {
  id?: string
  learning_type?: string
  insight?: string
  evidence?: string
  confidence?: number
  created_at: string
}

// Time estimates (in minutes) for manual creation
const TIME_ESTIMATES = {
  strategy_planner: 240,
  lesson_creator: 90,
  activity_creator: 60,
}

export default function AnalyticsPage() {
  const toast = useToast()
  const [days, setDays] = useState('30')
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('strategy_planner')
  const [metrics, setMetrics] = useState<AgentMetrics[]>([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [triggeringReflection, setTriggeringReflection] = useState(false)
  const [studentCount, setStudentCount] = useState(0)

  const loadAnalytics = async () => {
    setLoadingAnalytics(true)
    try {
      const d = parseInt(days, 10) || 30
      const [metricsRes, studentsRes] = await Promise.all([
        api.get('/api/v1/analytics/agent-metrics', { params: { days: d } }),
        api.get('/api/v1/students').catch(() => ({ data: [] })),
      ])
      setMetrics(metricsRes.data.metrics || [])
      setStudentCount(Array.isArray(studentsRes.data) ? studentsRes.data.length : 0)
    } catch (err: any) {
      console.error('Failed to load analytics:', err)
      toast.error('Failed to load analytics', err?.message || 'Please try again.')
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const loadInsights = async (agent: AgentType) => {
    setLoadingInsights(true)
    try {
      const res = await api.get(`/api/v1/reflection/insights/${agent}`)
      setInsights(res.data.insights || [])
    } catch (err: any) {
      console.error('Failed to load insights:', err)
    } finally {
      setLoadingInsights(false)
    }
  }

  const triggerReflection = async () => {
    setTriggeringReflection(true)
    try {
      const res = await api.post('/api/v1/reflection/analyze')
      toast.success('Reflection completed', `Generated ${res.data.total_insights || 0} insight(s).`)
      await loadInsights(selectedAgent)
    } catch (err: any) {
      console.error('Failed to trigger reflection:', err)
      toast.error('Reflection failed', err?.message || 'Please try again.')
    } finally {
      setTriggeringReflection(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  useEffect(() => {
    loadInsights(selectedAgent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent])

  const totalGenerations = useMemo(() => 
    metrics.reduce((acc, m) => acc + m.total_generations, 0), [metrics])

  const timeSavedMinutes = useMemo(() => {
    return metrics.reduce((acc, m) => {
      const timePerGeneration = TIME_ESTIMATES[m.agent_type as keyof typeof TIME_ESTIMATES] || 60
      return acc + (m.total_generations * timePerGeneration)
    }, 0)
  }, [metrics])

  const strategiesCount = metrics.find(m => m.agent_type === 'strategy_planner')?.total_generations || 0
  const lessonsCount = metrics.find(m => m.agent_type === 'lesson_creator')?.total_generations || 0
  const activitiesCount = metrics.find(m => m.agent_type === 'activity_creator')?.total_generations || 0
  const timeSavedHours = Math.round(timeSavedMinutes / 60)

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Impact</h1>
            <p className="text-[var(--foreground-muted)] mt-1">
              See how TutorPilot is transforming your workflow
            </p>
          </div>
          <Select
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-40"
          />
        </div>

        {loadingAnalytics ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Hero Section - Awn Style */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl border border-[var(--card-border)] bg-white"
            >
              {/* Background decorations */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[var(--accent)]/10 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNEQzI2MjYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              
              <div className="relative z-10 p-8 md:p-10">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                  {/* Left - Main Stat */}
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                      <ClockIcon className="w-4 h-4" />
                      <span>Time Saved</span>
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-7xl md:text-8xl font-bold text-foreground">{timeSavedHours}</span>
                      <span className="text-2xl md:text-3xl font-medium text-[var(--foreground-muted)]">hours</span>
                    </div>
                    
                    <p className="mt-4 text-[var(--foreground-muted)] max-w-md">
                      Time you would have spent manually creating strategies, lessons, and activities
                    </p>
                  </div>

                  {/* Right - Badge */}
                  <div className="flex-shrink-0">
                    <div className="inline-flex items-center gap-4 px-6 py-5 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-xl shadow-primary/20">
                      <RocketLaunchIcon className="w-10 h-10" />
                      <div>
                        <p className="text-white/70 text-xs font-medium">Productivity</p>
                        <p className="text-3xl font-bold">10x faster</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Strategies', count: strategiesCount, icon: BookOpenIcon, color: 'primary' },
                { label: 'Lessons', count: lessonsCount, icon: AcademicCapIcon, color: 'purple-500' },
                { label: 'Activities', count: activitiesCount, icon: PuzzlePieceIcon, color: 'blue-500' },
                { label: 'Students', count: studentCount, icon: UserGroupIcon, color: 'emerald-500' },
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <GlassCard padding="lg" className="text-center h-full">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl bg-${stat.color}/10 flex items-center justify-center`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}`} />
                    </div>
                    <p className="text-3xl font-bold text-foreground">{stat.count}</p>
                    <p className="text-sm text-[var(--foreground-muted)] mt-1">{stat.label}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>

            {/* Content + AI Section */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Content Created */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2"
              >
                <GlassCard padding="lg" className="h-full">
                  <h2 className="text-lg font-bold text-foreground mb-6">Content Created</h2>
                  
                  <div className="space-y-5">
                    {[
                      { label: 'Strategies', count: strategiesCount, color: '#DC2626', icon: BookOpenIcon },
                      { label: 'Lessons', count: lessonsCount, color: '#7C3AED', icon: AcademicCapIcon },
                      { label: 'Activities', count: activitiesCount, color: '#2563EB', icon: PuzzlePieceIcon },
                    ].map((item) => {
                      const maxCount = Math.max(strategiesCount, lessonsCount, activitiesCount, 1)
                      const percentage = (item.count / maxCount) * 100

                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <item.icon className="w-4 h-4" style={{ color: item.color }} />
                              <span className="text-sm font-medium text-foreground">{item.label}</span>
                            </div>
                            <span className="text-lg font-bold text-foreground">{item.count}</span>
                          </div>
                          <div className="h-2 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--foreground-muted)]">Total content</span>
                      <span className="text-xl font-bold text-foreground">{totalGenerations}</span>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

              {/* AI Self-Improvement */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="lg:col-span-3"
              >
                <GlassCard padding="lg" className="h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <SparklesIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">AI Self-Improvement</h2>
                        <p className="text-xs text-[var(--foreground-muted)]">Learning from your preferences</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={triggerReflection}
                      loading={triggeringReflection}
                    >
                      Run Reflection
                    </Button>
                  </div>

                  <div className="mb-4">
                    <Select
                      options={[
                        { value: 'strategy_planner', label: 'Strategy Planner' },
                        { value: 'lesson_creator', label: 'Lesson Creator' },
                        { value: 'activity_creator', label: 'Activity Creator' },
                      ]}
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value as AgentType)}
                    />
                  </div>

                  {loadingInsights ? (
                    <div className="py-8 flex items-center justify-center">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : insights.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center">
                        <ArrowTrendingUpIcon className="w-8 h-8 text-[var(--foreground-muted)]" />
                      </div>
                      <p className="font-medium text-foreground">No insights yet</p>
                      <p className="text-sm text-[var(--foreground-muted)] mt-1">
                        Create and edit content to help the AI learn your style
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[280px] overflow-y-auto scrollbar-thin">
                      {insights.map((insight, idx) => (
                        <div key={insight.id || idx} className="p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--card-border)]">
                          <p className="font-medium text-foreground text-sm">{insight.insight}</p>
                          {insight.evidence && (
                            <p className="mt-1 text-xs text-[var(--foreground-muted)]">{insight.evidence}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            </div>

            {/* Quick Tips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {[
                { emoji: '🎯', title: 'Add student details', desc: 'Learning style, interests, and goals help create better content' },
                { emoji: '✏️', title: 'Edit & refine', desc: 'Your edits teach the AI your preferences over time' },
                { emoji: '🚀', title: 'Deploy activities', desc: 'Interactive activities engage students instantly' },
              ].map((tip) => (
                <div key={tip.title} className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)]">
                  <span className="text-2xl">{tip.emoji}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{tip.title}</p>
                    <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </AppShell>
  )
}
