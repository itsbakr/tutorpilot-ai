'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { AppShell } from '@/components/AppShell'
import { dataApi } from '@/lib/api'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { CardSkeleton } from '@/components/ui/LoadingSpinner'
import {
  BookOpenIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'

type ContentType = 'all' | 'strategy' | 'lesson' | 'activity'

interface ContentItem {
  id: string
  title: string
  type: ContentType
  created_at: string
  student_id?: string
  student_name?: string
  self_evaluation?: {
    overall_score: number
  }
  sandbox_url?: string
}

export default function LibraryPage() {
  const { user, isLoading } = useAuth()
  const [content, setContent] = useState<ContentItem[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selectedType, setSelectedType] = useState<ContentType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')

  useEffect(() => {
    const loadContent = async () => {
      try {
        const studentsRes = await dataApi.getStudents()
        const studentsList = studentsRes.students || []
        setStudents(studentsList)

        const allContent: ContentItem[] = []

        for (const student of studentsList) {
          const [strategies, lessons, activities] = await Promise.all([
            dataApi.getStrategies(student.id).catch(() => ({ strategies: [] })),
            dataApi.getLessons(student.id).catch(() => ({ lessons: [] })),
            dataApi.getActivities(student.id).catch(() => ({ activities: [] }))
          ])

          for (const s of strategies.strategies || []) {
            allContent.push({
              ...s,
              type: 'strategy' as ContentType,
              student_name: student.name,
              student_id: student.id
            })
          }
          for (const l of lessons.lessons || []) {
            allContent.push({
              ...l,
              type: 'lesson' as ContentType,
              student_name: student.name,
              student_id: student.id
            })
          }
          for (const a of activities.activities || []) {
            allContent.push({
              ...a,
              type: 'activity' as ContentType,
              student_name: student.name,
              student_id: student.id
            })
          }
        }

        // Sort by created_at
        allContent.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setContent(allContent)
      } catch (error) {
        console.error('Failed to load content:', error)
      } finally {
        setLoadingData(false)
      }
    }

    loadContent()
  }, [])

  const filteredContent = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return content.filter((item) => {
      const matchesType = selectedType === 'all' || item.type === selectedType
      const matchesSearch = !q || (item.title || '').toLowerCase().includes(q)
      const matchesStudent = !selectedStudent || item.student_id === selectedStudent
      return matchesType && matchesSearch && matchesStudent
    })
  }, [content, searchQuery, selectedStudent, selectedType])

  const getTypeLink = (item: ContentItem) => {
    switch (item.type) {
      case 'strategy': return `/content/strategy/${item.id}`
      case 'lesson': return `/content/lesson/${item.id}`
      case 'activity': return `/content/activity/${item.id}`
      default: return '#'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const counts = {
    all: content.length,
    strategy: content.filter((c) => c.type === 'strategy').length,
    lesson: content.filter((c) => c.type === 'lesson').length,
    activity: content.filter((c) => c.type === 'activity').length,
  }

  const studentFilterOptions = [
    { value: '', label: 'All students' },
    ...students.map((s) => ({ value: s.id, label: s.name })),
  ]

  const badgeForType = (t: ContentType) => {
    if (t === 'strategy') return 'badge badge-primary'
    if (t === 'lesson') return 'badge badge-warning'
    if (t === 'activity') return 'badge badge-success'
    return 'badge badge-neutral'
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Squares2X2Icon className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Content Library</h1>
            </div>
            <p className="text-[var(--foreground-muted)] mt-1">
              Browse strategies, lessons, and activities across students.
            </p>
          </div>

          <Link href="/strategy">
            <Button variant="gradient" rightIcon={<ChevronRightIcon className="w-4 h-4" />}>
              Create Content
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              { key: 'all', label: 'All', value: counts.all },
              { key: 'strategy', label: 'Strategies', value: counts.strategy },
              { key: 'lesson', label: 'Lessons', value: counts.lesson },
              { key: 'activity', label: 'Activities', value: counts.activity },
            ] as Array<{ key: ContentType; label: string; value: number }>
          ).map((t) => (
            <button key={t.key} type="button" onClick={() => setSelectedType(t.key)} className="text-left">
              <GlassCard hover padding="md" className={selectedType === t.key ? 'glow-primary' : ''}>
                <p className="text-3xl font-bold text-foreground">{t.value}</p>
                <p className="text-sm text-[var(--foreground-muted)]">{t.label}</p>
              </GlassCard>
            </button>
          ))}
        </div>

        {/* Filters */}
        <GlassCard padding="md">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="w-5 h-5 text-primary" />
            <p className="font-semibold text-foreground">Search & Filters</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search titles…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            />

            <Select
              options={studentFilterOptions}
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            />

            <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
              <UserGroupIcon className="w-5 h-5" />
              <span>{filteredContent.length} results</span>
            </div>
          </div>
        </GlassCard>

        {/* Content grid */}
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredContent.length === 0 ? (
          <GlassCard padding="lg" className="text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <BookOpenIcon className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-2">No content found</p>
            <p className="text-[var(--foreground-muted)] mb-6">Try changing filters or create new content.</p>
            <Link href="/strategy">
              <Button variant="gradient">Start Creating</Button>
            </Link>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContent.map((item) => {
              const href = getTypeLink(item)
              const score = item.self_evaluation?.overall_score
              return (
                <Link key={`${item.type}-${item.id}`} href={href}>
                  <GlassCard hover padding="md" className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground line-clamp-2">{item.title || 'Untitled'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={badgeForType(item.type)}>{item.type}</span>
                          {item.student_name && <span className="badge badge-neutral">{item.student_name}</span>}
                        </div>
                      </div>
                      {typeof score === 'number' && (
                        <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--background-secondary)] border border-[var(--card-border)]">
                          <StarIcon className="w-4 h-4 text-[var(--accent)]" />
                          <span className="text-sm font-bold text-foreground">{score.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex items-center justify-between">
                      <span className="text-xs text-[var(--foreground-muted)]">{formatDate(item.created_at)}</span>
                      <div className="flex items-center gap-2">
                        {item.type === 'activity' && item.sandbox_url && (
                          <a
                            href={item.sandbox_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
                            aria-label="Open sandbox"
                          >
                            <ArrowTopRightOnSquareIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
                          </a>
                        )}
                        <span className="text-xs text-[var(--foreground-muted)]">Open →</span>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}




