'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import {
  EnvelopeIcon,
  LockClosedIcon,
  AcademicCapIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { signIn } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

      const result = await signIn(email, password)
      
      if (result.success) {
      toast.success('Welcome back!', 'Successfully signed in')
        router.push('/dashboard')
      } else {
      setError(result.error || 'Failed to sign in')
      toast.error('Sign in failed', result.error)
    }
    
      setLoading(false)
    }

  const features = [
    'AI-powered strategy planning',
    'Interactive lesson creation',
    'Self-improving activity builder',
    'Real-time performance analytics',
  ]

  return (
    <div className="min-h-screen flex">
      {/* Gradient mesh background */}
      <div className="gradient-mesh" />
      <div className="grid-pattern" />

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-[var(--foreground)]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[var(--accent)]/20 rounded-full blur-3xl" />
      </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <AcademicCapIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold">TutorPilot</span>
                <span className="px-2 py-0.5 text-xs font-bold bg-white/20 rounded-md">AI</span>
              </div>
              <p className="text-xs text-white/70">Self-Improving Platform</p>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            <div>
              <h1 className="text-4xl font-bold leading-tight mb-4">
                AI That Gets Better<br />
                <span className="text-[var(--accent)]">With Every Use</span>
              </h1>
              <p className="text-lg text-white/80 max-w-md">
                Create personalized learning experiences with self-evaluating AI agents that improve over time.
              </p>
            </div>

            <div className="space-y-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <span className="text-white/90">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex gap-8"
          >
            <div>
              <p className="text-3xl font-bold">7.8/10</p>
              <p className="text-sm text-white/70">Avg AI Score</p>
            </div>
            <div>
              <p className="text-3xl font-bold">+12%</p>
              <p className="text-sm text-white/70">Improvement</p>
            </div>
            <div>
              <p className="text-3xl font-bold">150+</p>
              <p className="text-sm text-white/70">Sources/Strategy</p>
            </div>
          </motion.div>
        </div>
          </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <AcademicCapIcon className="w-7 h-7 text-white" />
              </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground">TutorPilot</span>
                <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-primary to-primary-dark text-white rounded-md">AI</span>
              </div>
              </div>
            </div>

          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome back</h2>
              <p className="text-[var(--foreground-muted)]">Sign in to continue to TutorPilot</p>
                </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                leftIcon={<LockClosedIcon className="w-5 h-5" />}
                  required
                />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-[var(--error-bg)] border border-[var(--error)]/20 rounded-xl"
                >
                  <p className="text-sm text-[var(--error)]">{error}</p>
                </motion.div>
              )}

            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-[var(--card-border)] text-primary focus:ring-primary" />
                  <span className="text-sm text-[var(--foreground-muted)]">Remember me</span>
              </label>
              <Link
                href="/auth/forgot-password"
                  className="text-sm text-primary hover:text-primary-dark font-medium"
              >
                Forgot password?
              </Link>
            </div>

              <Button
              type="submit"
                variant="gradient"
                size="lg"
                fullWidth
                loading={loading}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                Sign In
              </Button>
          </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">
              Don't have an account?{' '}
                <Link href="/auth/signup" className="text-primary hover:text-primary-dark font-semibold">
                  Sign up free
              </Link>
            </p>
          </div>
        </div>

          {/* Trust badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex items-center justify-center gap-2 text-xs text-[var(--foreground-muted)]"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Powered by self-improving AI agents</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
