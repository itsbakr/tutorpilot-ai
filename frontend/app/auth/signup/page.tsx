'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import {
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  AcademicCapIcon,
  SparklesIcon,
  CheckCircleIcon,
  BookOpenIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    teaching_style: '',
    education_system: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const { signUp } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        teaching_style: formData.teaching_style,
        education_system: formData.education_system,
      })
      
      if (result.success) {
        setSuccess(true)
        toast.success('Account created!', 'Please check your email to verify your account.')
        // Redirect after showing success message
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setError(result.error || 'Failed to create account')
        toast.error('Sign up failed', result.error)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    'AI-powered strategy planning',
    'Interactive lesson creation',
    'Self-improving activity builder',
    'Real-time performance analytics',
  ]

  const teachingStyleOptions = [
    { value: 'Socratic Method with guided discovery', label: 'Socratic Method' },
    { value: 'Direct instruction with scaffolding', label: 'Direct Instruction' },
    { value: 'Inquiry-based learning', label: 'Inquiry-based Learning' },
    { value: 'Project-based learning', label: 'Project-based Learning' },
    { value: 'Adaptive and personalized', label: 'Adaptive & Personalized' },
  ]

  const educationSystemOptions = [
    { value: 'IGCSE', label: 'IGCSE (Cambridge)' },
    { value: 'IB', label: 'IB (International Baccalaureate)' },
    { value: 'CBSE', label: 'CBSE (India)' },
    { value: 'Common Core', label: 'Common Core (US)' },
    { value: 'A-Levels', label: 'A-Levels (UK)' },
    { value: 'General', label: 'General / Other' },
  ]

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
          <h2 className="text-2xl font-bold text-foreground mb-2">Account Created!</h2>
          <p className="text-[var(--foreground-muted)] mb-6">
            Your account has been created successfully. Please check your email to verify your account.
          </p>
          <p className="text-sm text-primary animate-pulse">
            Redirecting to dashboard...
          </p>
        </motion.div>
      </div>
    )
  }

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
                Join the Future of<br />
                <span className="text-[var(--accent)]">Smart Tutoring</span>
              </h1>
              <p className="text-lg text-white/80 max-w-md">
                Create your account and start building personalized learning experiences with AI that evolves with you.
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
              <p className="text-3xl font-bold">Free</p>
              <p className="text-sm text-white/70">To get started</p>
            </div>
            <div>
              <p className="text-3xl font-bold">∞</p>
              <p className="text-sm text-white/70">AI Generations</p>
            </div>
            <div>
              <p className="text-3xl font-bold">24/7</p>
              <p className="text-sm text-white/70">AI Support</p>
            </div>
          </motion.div>
        </div>
        </div>

      {/* Right Panel - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
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
              <h2 className="text-2xl font-bold text-foreground mb-2">Create your account</h2>
              <p className="text-[var(--foreground-muted)]">Start building smarter learning experiences</p>
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
                label="Full Name"
                  type="text"
                placeholder="Dr. Sarah Johnson"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                leftIcon={<UserIcon className="w-5 h-5" />}
                  required
                />

              <Input
                label="Email address"
                  type="email"
                placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                  required
                />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    leftIcon={<LockClosedIcon className="w-5 h-5" />}
                    required
                  />
                </div>
                <Input
                  label="Confirm Password"
                    type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  leftIcon={<LockClosedIcon className="w-5 h-5" />}
                    required
                  />
            </div>

            {/* Show password toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                {showPassword ? 'Hide passwords' : 'Show passwords'}
              </button>

              <Select
                label="Teaching Style"
                options={teachingStyleOptions}
                placeholder="Select your teaching style..."
                  value={formData.teaching_style}
                  onChange={(e) => setFormData({ ...formData, teaching_style: e.target.value })}
                hint="Optional - helps personalize your experience"
              />

              <Select
                label="Education System"
                options={educationSystemOptions}
                placeholder="Select education system..."
                  value={formData.education_system}
                  onChange={(e) => setFormData({ ...formData, education_system: e.target.value })}
                hint="Optional - helps tailor content to your curriculum"
              />

              <Button
              type="submit"
                variant="gradient"
                size="lg"
                fullWidth
                loading={loading}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                  Create Account
              </Button>
          </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">
              Already have an account?{' '}
                <Link href="/auth/login" className="text-primary hover:text-primary-dark font-semibold">
                Sign in
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
            <span>Join 1,000+ educators using AI-powered tutoring</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
