'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import {
  HomeIcon,
  UserGroupIcon,
  BookOpenIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  FolderIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  BellIcon,
  Bars3Icon,
  XMarkIcon,
  SparklesIcon,
  BoltIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline'
import { 
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BookOpenIcon as BookOpenIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  RocketLaunchIcon as RocketLaunchIconSolid,
  FolderIcon as FolderIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid'

interface AppShellProps {
  children: React.ReactNode
}

const navItems = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  { 
    name: 'Students', 
    href: '/students', 
    icon: UserGroupIcon,
    iconSolid: UserGroupIconSolid,
  },
  { 
    name: 'Create Content', 
    icon: SparklesIcon,
    children: [
      { name: 'Strategy Planner', href: '/strategy', icon: BookOpenIcon, iconSolid: BookOpenIconSolid, color: 'bg-gradient-to-br from-primary to-primary-dark' },
      { name: 'Lesson Creator', href: '/lesson', icon: DocumentTextIcon, iconSolid: DocumentTextIconSolid, color: 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)]' },
      { name: 'Activity Builder', href: '/activity', icon: RocketLaunchIcon, iconSolid: RocketLaunchIconSolid, color: 'bg-gradient-to-br from-[var(--info)] to-blue-700' },
    ]
  },
  { 
    name: 'Content Library', 
    href: '/library', 
    icon: FolderIcon,
    iconSolid: FolderIconSolid,
  },
  { 
    name: 'Analytics', 
    href: '/analytics', 
    icon: ChartBarIcon,
    iconSolid: ChartBarIconSolid,
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Cog6ToothIcon,
    iconSolid: Cog6ToothIconSolid,
  },
]

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(true)
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const isActive = (href: string) => pathname === href
  const isCreateActive = ['/strategy', '/lesson', '/activity'].includes(pathname)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Gradient mesh background */}
      <div className="gradient-mesh" />
      <div className="grid-pattern" />

      {/* Mobile menu overlay */}
      <AnimatePresence>
      {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen transition-all duration-300 ease-out
        ${sidebarOpen ? 'w-64' : 'w-20'}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col glass-card m-3 mr-0 lg:mr-3 rounded-2xl border border-[var(--card-border)] overflow-hidden">
        {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--card-border)]">
            <Link href="/dashboard" className="flex items-center gap-2.5" title="TutorPilot">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <AcademicCapIcon className="w-5 h-5 text-white" />
            </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[var(--success)] rounded-full border-2 border-white" />
              </div>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">TutorPilot</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gradient-to-r from-primary to-primary-dark text-white rounded-md">
                      AI
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--foreground-muted)] -mt-0.5">Self-Improving Platform</p>
                </motion.div>
            )}
          </Link>
          <button 
            onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)]"
          >
              <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => (
            <div key={item.name}>
              {item.children ? (
                // Dropdown menu
                  <div className="space-y-1">
                  <button
                    onClick={() => setCreateMenuOpen(!createMenuOpen)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${isCreateActive
                          ? 'bg-primary/10 text-primary' 
                          : 'text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-foreground'
                      }
                    `}
                  >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{item.name}</span>
                          <motion.div
                            animate={{ rotate: createMenuOpen ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRightIcon className="w-4 h-4" />
                          </motion.div>
                      </>
                    )}
                  </button>
                    <AnimatePresence>
                  {createMenuOpen && sidebarOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-3 pl-4 border-l-2 border-[var(--card-border)] space-y-1 overflow-hidden"
                        >
                          {item.children.map((child) => {
                            const Icon = isActive(child.href) ? child.iconSolid : child.icon
                            return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`
                                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all
                            ${isActive(child.href)
                                    ? 'bg-white shadow-sm text-foreground font-medium border border-[var(--card-border)]'
                                    : 'text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-foreground'
                            }
                          `}
                        >
                                <div className={`w-7 h-7 ${child.color} rounded-lg flex items-center justify-center`}>
                                  <Icon className="w-3.5 h-3.5 text-white" />
                                </div>
                          <span>{child.name}</span>
                        </Link>
                            )
                          })}
                        </motion.div>
                  )}
                    </AnimatePresence>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive(item.href)
                        ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/20'
                        : 'text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-foreground'
                    }
                  `}
                    title={!sidebarOpen ? item.name : undefined}
                >
                    {isActive(item.href) ? (
                      <item.iconSolid className="w-5 h-5 flex-shrink-0" />
                    ) : (
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                    )}
                  {sidebarOpen && <span>{item.name}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User section */}
          <div className="p-3 border-t border-[var(--card-border)]">
          {sidebarOpen ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-md shadow-primary/20">
                {user?.name?.charAt(0).toUpperCase() || 'T'}
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.name || 'Tutor'}</p>
                  <p className="text-xs text-[var(--foreground-muted)] truncate">{user?.email}</p>
              </div>
              <button 
                onClick={() => signOut()}
                  className="p-2 text-[var(--foreground-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                title="Sign out"
              >
                  <ArrowLeftOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-primary/20">
                  {user?.name?.charAt(0).toUpperCase() || 'T'}
                </div>
            <button 
              onClick={() => signOut()}
                  className="p-2 text-[var(--foreground-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Sign out"
            >
                  <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            </button>
              </div>
          )}
          </div>
        </div>

        {/* Collapse button - Desktop only */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-1.5 top-24 w-7 h-7 bg-white border border-[var(--card-border)] rounded-full shadow-md hidden lg:flex items-center justify-center hover:bg-[var(--background-secondary)] hover:border-primary/30 transition-all z-50"
        >
          {sidebarOpen ? (
            <ChevronLeftIcon className="w-4 h-4 text-[var(--foreground-muted)]" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-[var(--foreground-muted)]" />
          )}
        </button>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-[268px]' : 'lg:pl-[92px]'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30">
          <div className="mx-3 mt-3 lg:mx-0 lg:mt-0 lg:mr-3">
            <div className="glass-card lg:rounded-none lg:rounded-tr-2xl lg:border-t-0 lg:border-l-0 px-4 py-3 flex items-center justify-between gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-[var(--foreground-muted)] hover:text-foreground hover:bg-[var(--background-secondary)] rounded-xl transition-colors"
            >
                <Bars3Icon className="w-6 h-6" />
            </button>

            {/* Search */}
              <div className="flex-1 max-w-xl hidden sm:block">
              <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  placeholder="Search students, content, activities..."
                    className="w-full pl-11 pr-4 py-2.5 bg-[var(--background-secondary)] border border-[var(--card-border)] rounded-xl text-sm placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
                {/* Quick create button */}
              <Link
                href="/strategy"
                  className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all"
              >
                  <BoltIcon className="w-4 h-4" />
                <span>Create</span>
              </Link>

              {/* Notifications */}
                <button className="relative p-2.5 text-[var(--foreground-muted)] hover:text-foreground hover:bg-[var(--background-secondary)] rounded-xl transition-colors">
                  <BellIcon className="w-5 h-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-white"></span>
                </button>

                {/* Mobile search */}
                <button className="sm:hidden p-2.5 text-[var(--foreground-muted)] hover:text-foreground hover:bg-[var(--background-secondary)] rounded-xl transition-colors">
                  <MagnifyingGlassIcon className="w-5 h-5" />
              </button>

              {/* Profile */}
              <Link
                href="/settings"
                  className="hidden sm:flex items-center gap-3 p-1.5 hover:bg-[var(--background-secondary)] rounded-xl transition-colors"
              >
                  <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-primary/20">
                  {user?.name?.charAt(0).toUpperCase() || 'T'}
                </div>
              </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-3 lg:p-6 lg:pr-6 lg:pt-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
          {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
