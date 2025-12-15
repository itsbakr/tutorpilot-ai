'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import {
  EnvelopeIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        setError(error.message)
        toast.error('Reset failed', error.message)
      } else {
        setSuccess(true)
        toast.success('Email sent!', 'Check your inbox for the reset link.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="gradient-mesh" />
        <div className="grid-pattern" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center max-w-md"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-[var(--success)] to-[var(--success-light)] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[var(--success)]/20">
            <CheckCircleIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Check your email</h2>
          <p className="text-[var(--foreground-muted)] mb-2">
            We've sent a password reset link to
          </p>
          <p className="text-primary font-semibold mb-6">{email}</p>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">
            Click the link in the email to reset your password. If you don't see it, check your spam folder.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-medium transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to login
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Gradient mesh background */}
      <div className="gradient-mesh" />
      <div className="grid-pattern" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <AcademicCapIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground">TutorPilot</span>
                <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-primary to-primary-dark text-white rounded-md">AI</span>
              </div>
              <p className="text-xs text-[var(--foreground-muted)]">Self-Improving Platform</p>
            </div>
          </Link>
        </div>

        {/* Reset Card */}
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <EnvelopeIcon className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Reset your password</h2>
            <p className="text-[var(--foreground-muted)]">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-[var(--error-bg)] border border-[var(--error)]/20 rounded-xl"
              >
                <p className="text-sm text-[var(--error)]">{error}</p>
              </motion.div>
            )}

            <Input
              label="Email address"
                  type="email"
              placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
              leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                  required
                />

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              fullWidth
              loading={loading}
              rightIcon={<PaperAirplaneIcon className="w-4 h-4" />}
            >
              Send Reset Link
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-[var(--foreground-muted)] hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to login
            </Link>
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
          <span>Secure password reset powered by Supabase</span>
        </motion.div>
      </motion.div>
    </div>
  )
}
