'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import {
  LockClosedIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const router = useRouter()
  const toast = useToast()

  // Check if we have a valid session from the reset email
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    if (!hashParams.get('access_token') && !hashParams.get('type')) {
      // No valid reset token, redirect to forgot password
      router.push('/auth/forgot-password')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setError(error.message)
        toast.error('Reset failed', error.message)
      } else {
        setSuccess(true)
        toast.success('Password updated!', 'You can now sign in with your new password.')
        // Redirect after showing success message
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
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
          <h2 className="text-2xl font-bold text-foreground mb-2">Password Updated!</h2>
          <p className="text-[var(--foreground-muted)] mb-6">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <p className="text-sm text-primary animate-pulse">
            Redirecting to login...
          </p>
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

        {/* Reset Password Card */}
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <ShieldCheckIcon className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Set new password</h2>
            <p className="text-[var(--foreground-muted)]">
              Choose a strong password for your account
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
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<LockClosedIcon className="w-5 h-5" />}
              hint="Must be at least 6 characters"
              required
            />

            <Input
              label="Confirm New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<LockClosedIcon className="w-5 h-5" />}
              required
            />

            {/* Show password toggle */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              {showPassword ? 'Hide passwords' : 'Show passwords'}
            </button>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              fullWidth
              loading={loading}
              rightIcon={<ArrowRightIcon className="w-4 h-4" />}
            >
              Reset Password
            </Button>
          </form>
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

