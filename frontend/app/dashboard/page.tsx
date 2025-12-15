'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/Button'
import { dataApi } from '@/lib/api'
import {
  UsersIcon,
  BookOpenIcon,
  DocumentTextIcon,
  PuzzlePieceIcon,
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
  ClockIcon,
  RocketLaunchIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  ChartBarIcon,
  PlusIcon,
  LightBulbIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'

interface Student {
  id: string
  name: string
  grade: string
  subject: string
  learning_style: string
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStrategies: 0,
    totalLessons: 0,
    totalActivities: 0,
    avgScore: 7.8,
    improvement: 12,
  })
  const [loadingData, setLoadingData] = useState(true)

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const studentsRes = await dataApi.getStudents()
        const studentsList = studentsRes.students || []
        setStudents(studentsList)

        // Calculate stats
        let strategies = 0,
          lessons = 0,
          activities = 0
        for (const student of studentsList.slice(0, 5)) {
          try {
            const [stratRes, lessonRes, actRes] = await Promise.all([
              dataApi.getStrategies(student.id),
              dataApi.getLessons(student.id),
              dataApi.getActivities(student.id),
            ])
            strategies += (stratRes.strategies || []).length
            lessons += (lessonRes.lessons || []).length
            activities += (actRes.activities || []).length
          } catch {
            // Ignore individual errors
          }
        }

        setStats({
          totalStudents: studentsList.length,
          totalStrategies: strategies,
          totalLessons: lessons,
          totalActivities: activities,
          avgScore: 7.8,
          improvement: 12,
        })
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoadingData(false)
      }
    }

    loadDashboardData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] || 'Tutor'

  const statsCards = [
    {
      label: 'Students',
      value: stats.totalStudents,
      icon: UsersIcon,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: 'Strategies',
      value: stats.totalStrategies,
      icon: LightBulbIcon,
      color: 'bg-primary',
      lightColor: 'bg-primary-50',
      textColor: 'text-primary',
    },
    {
      label: 'Lessons',
      value: stats.totalLessons,
      icon: BookOpenIcon,
      color: 'bg-[var(--accent)]',
      lightColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
    {
      label: 'Activities',
      value: stats.totalActivities,
      icon: PuzzlePieceIcon,
      color: 'bg-emerald-500',
      lightColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
  ]

  const quickActions = [
    {
      title: 'Create Strategy',
      description: 'Build a personalized 4-week learning plan',
      href: '/strategy',
      icon: LightBulbIcon,
      gradient: 'from-primary to-primary-dark',
    },
    {
      title: 'Build Lesson',
      description: 'Design rich, multi-format active lessons',
      href: '/lesson',
      icon: BookOpenIcon,
      gradient: 'from-[var(--accent)] to-[var(--accent-dark)]',
    },
    {
      title: 'Design Activity',
      description: 'Create interactive React-based exercises',
      href: '/activity',
      icon: PuzzlePieceIcon,
      gradient: 'from-emerald-500 to-emerald-600',
    },
  ]

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header - Premium Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-white border border-[var(--card-border)]"
        >
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-primary/8 via-primary/4 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[var(--accent)]/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/4" />

          <div className="relative z-10 p-8 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              {/* Left Content */}
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <ClockIcon className="w-4 h-4" />
                  <span>
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                    {getGreeting()}, {firstName}! 👋
                  </h1>
                  <p className="text-[var(--foreground-muted)] max-w-lg text-lg">
                    Your AI agents are ready to create personalized learning experiences.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/strategy">
                    <Button variant="gradient" rightIcon={<ArrowRightIcon className="w-4 h-4" />}>
                      Create Strategy
                    </Button>
                  </Link>
                  <Link href="/students/new">
                    <Button variant="secondary" leftIcon={<UserPlusIcon className="w-4 h-4" />}>
                      Add Student
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right - Stats Preview */}
              <div className="hidden lg:flex items-center gap-6">
                {/* Mini Stats */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)]">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <UsersIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{loadingData ? '—' : stats.totalStudents}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">Students</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)]">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <DocumentTextIcon className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{loadingData ? '—' : stats.totalStrategies + stats.totalLessons + stats.totalActivities}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">Content</p>
                    </div>
                  </div>
                </div>

                {/* Time Saved Badge */}
                <div className="relative">
                  <div className="px-6 py-5 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-xl shadow-primary/20">
                    <p className="text-white/70 text-xs font-medium mb-1">Time Saved</p>
                    <p className="text-3xl font-bold">
                      {Math.round((stats.totalStrategies * 4 + stats.totalLessons * 1.5 + stats.totalActivities * 1))}h
                    </p>
                    <p className="text-white/60 text-xs mt-1">10x faster</p>
                  </div>
                  <motion.div 
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-[var(--accent)] rounded-full flex items-center justify-center shadow-lg"
                  >
                    <SparklesIcon className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="glass-card p-6 hover-lift"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${stat.lightColor} rounded-xl flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{loadingData ? '—' : stat.value}</p>
              <p className="text-sm text-[var(--foreground-muted)]">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions - Takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <RocketLaunchIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Quick Actions</h2>
                  <p className="text-sm text-[var(--foreground-muted)]">Create AI-powered content</p>
                </div>
                </div>
                </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <Link key={action.title} href={action.href}>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    className="group p-5 rounded-2xl border-2 border-[var(--card-border)] hover:border-transparent bg-[var(--background-secondary)] hover:bg-gradient-to-br hover:from-[var(--background)] hover:to-[var(--background-secondary)] transition-all duration-300 cursor-pointer h-full"
                  >
                    <div
                      className={`w-12 h-12 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}
                    >
                      <action.icon className="w-6 h-6 text-white" />
                </div>
                    <h3 className="font-semibold text-foreground mb-1">{action.title}</h3>
                    <p className="text-sm text-[var(--foreground-muted)] line-clamp-2">{action.description}</p>
                    <div className="mt-3 flex items-center text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Get Started <ChevronRightIcon className="w-4 h-4 ml-1" />
                </div>
                  </motion.div>
              </Link>
              ))}
            </div>
          </motion.div>

          {/* Your Impact Card - Glass Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6 relative overflow-hidden"
          >
            {/* Subtle gradient accent */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClockIcon className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Your Impact</h2>
              </div>

              <div className="space-y-4">
                {/* Time Saved - Hero Stat */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white">
                  <p className="text-white/70 text-xs font-medium">Time Saved</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-bold">
                      {Math.round((stats.totalStrategies * 4 + stats.totalLessons * 1.5 + stats.totalActivities * 1))}
                    </span>
                    <span className="text-lg text-white/70">hours</span>
                  </div>
                  <p className="text-white/50 text-xs mt-1">From {stats.totalStrategies + stats.totalLessons + stats.totalActivities} content pieces</p>
                </div>

                {/* Productivity */}
                <div className="p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--card-border)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[var(--foreground-muted)] text-xs">Productivity</p>
                      <p className="text-xl font-bold text-emerald-500">10x faster</p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <RocketLaunchIcon className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                </div>

                <Link href="/analytics" className="block">
                  <Button variant="secondary" fullWidth leftIcon={<ChartBarIcon className="w-4 h-4" />}>
                    View Analytics
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Section - Students & Workflow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Students List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Your Students</h2>
              </div>
              <Link 
                href="/students"
                className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1 transition-colors"
              >
                View all <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>

            {loadingData ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : students.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-[var(--background-secondary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UsersIcon className="w-8 h-8 text-[var(--foreground-muted)]" />
                </div>
                <p className="text-[var(--foreground-muted)] mb-4">No students yet</p>
                <Link href="/students/new">
                  <Button variant="primary" size="sm">
                    <PlusIcon className="w-4 h-4 mr-2" />
                  Add First Student
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {students.slice(0, 5).map((student, index) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Link
                    href={`/students/${student.id}`}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-[var(--background-secondary)] transition-colors group"
                  >
                      <div className="avatar avatar-md bg-gradient-to-br from-blue-400 to-primary">
                        {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{student.name}</p>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          Grade {student.grade} · {student.subject}
                        </p>
                    </div>
                      <ChevronRightIcon className="w-5 h-5 text-[var(--foreground-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Content Creation Flow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                <AcademicCapIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Content Creation Flow</h2>
                <p className="text-sm text-[var(--foreground-muted)]">How AI agents work together</p>
          </div>
            </div>

            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary via-[var(--accent)] to-emerald-400" />
              
              <div className="space-y-6">
                {[
                  {
                    step: 1,
                    title: 'Strategy Planner',
                    desc: 'Create a personalized 4-week learning roadmap',
                    color: 'bg-primary',
                    lightColor: 'bg-primary-100',
                    textColor: 'text-primary',
                  },
                  {
                    step: 2,
                    title: 'Lesson Creator',
                    desc: 'Design rich, multi-format active lessons',
                    color: 'bg-[var(--accent)]',
                    lightColor: 'bg-amber-100',
                    textColor: 'text-amber-600',
                  },
                  {
                    step: 3,
                    title: 'Activity Builder',
                    desc: 'Generate interactive React activities',
                    color: 'bg-emerald-500',
                    lightColor: 'bg-emerald-100',
                    textColor: 'text-emerald-600',
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div
                      className={`w-12 h-12 ${item.lightColor} rounded-xl flex items-center justify-center flex-shrink-0 relative z-10 border-4 border-white`}
                    >
                      <span className={`font-bold ${item.textColor}`}>{item.step}</span>
                  </div>
                    <div className="pt-1">
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-[var(--foreground-muted)]">{item.desc}</p>
                </div>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/strategy" className="block mt-6">
              <Button variant="gradient" fullWidth rightIcon={<ArrowRightIcon className="w-4 h-4" />}>
              Start Creating
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </AppShell>
  )
}
