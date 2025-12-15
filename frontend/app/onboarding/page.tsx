'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import {
  SparklesIcon,
  UserIcon,
  AcademicCapIcon,
  BookOpenIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  UserPlusIcon,
  LightBulbIcon,
  ChartBarIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline'

// Progress indicator component
function ProgressSteps({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div key={index} className="flex items-center">
          <motion.div
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index < currentStep
                ? 'bg-primary'
                : index === currentStep
                ? 'bg-primary ring-4 ring-primary/20'
                : 'bg-[var(--card-border)]'
            }`}
            initial={false}
            animate={{
              scale: index === currentStep ? 1.2 : 1,
            }}
          />
          {index < totalSteps - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 transition-all duration-300 ${
                index < currentStep ? 'bg-primary' : 'bg-[var(--card-border)]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Step 1: Welcome
function WelcomeStep({ name, onNext }: { name: string; onNext: () => void }) {
  const firstName = name?.split(' ')[0] || 'Tutor'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      {/* Animated welcome icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
        className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-primary-dark rounded-3xl flex items-center justify-center shadow-xl shadow-primary/30"
      >
        <SparklesIcon className="w-12 h-12 text-white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-foreground mb-3"
      >
        Welcome, {firstName}! 👋
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-lg text-[var(--foreground-muted)] mb-8 max-w-md mx-auto"
      >
        Let's set up your TutorPilot workspace and get you started with AI-powered tutoring.
      </motion.p>

      {/* Features preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
      >
        {[
          { icon: LightBulbIcon, title: 'Smart Strategies', desc: 'AI plans your teaching' },
          { icon: BookOpenIcon, title: 'Rich Lessons', desc: 'Multi-format content' },
          { icon: PuzzlePieceIcon, title: 'Live Activities', desc: 'Interactive practice' },
        ].map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            className="glass-card-sm p-4 text-center hover-lift cursor-default"
          >
            <feature.icon className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
            <p className="text-xs text-[var(--foreground-muted)]">{feature.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      <Button
        variant="gradient"
        size="lg"
        onClick={onNext}
        rightIcon={<ArrowRightIcon className="w-5 h-5" />}
      >
        Let's Get Started
      </Button>
    </motion.div>
  )
}

// Step 2: Teaching Profile
function TeachingProfileStep({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: { name: string; teaching_style: string; education_system: string; bio: string }
  onChange: (field: string, value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const teachingStyles = [
    { value: 'Socratic Method with guided discovery', label: 'Socratic Method', icon: '🤔', desc: 'Guide through questions' },
    { value: 'Direct instruction with scaffolding', label: 'Direct Instruction', icon: '📚', desc: 'Clear explanations' },
    { value: 'Inquiry-based learning', label: 'Inquiry-Based', icon: '🔬', desc: 'Explore and discover' },
    { value: 'Project-based learning', label: 'Project-Based', icon: '🎯', desc: 'Learn by doing' },
    { value: 'Adaptive and personalized', label: 'Adaptive', icon: '🎨', desc: 'Personalized to each student' },
  ]

  const educationSystems = [
    { value: 'IGCSE', label: 'IGCSE (Cambridge)' },
    { value: 'IB', label: 'IB (International Baccalaureate)' },
    { value: 'CBSE', label: 'CBSE (India)' },
    { value: 'Common Core', label: 'Common Core (US)' },
    { value: 'A-Levels', label: 'A-Levels (UK)' },
    { value: 'General', label: 'General / Other' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/20">
          <UserIcon className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Your Teaching Profile</h2>
        <p className="text-[var(--foreground-muted)]">Help us personalize your AI experience</p>
      </div>

      <div className="space-y-6">
        <Input
          label="Display Name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Dr. Sarah Johnson"
          leftIcon={<UserIcon className="w-5 h-5" />}
        />

        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Preferred Teaching Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teachingStyles.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => onChange('teaching_style', style.value)}
                className={`p-4 rounded-xl text-left transition-all duration-200 ${
                  data.teaching_style === style.value
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-[var(--background-secondary)] border-2 border-transparent hover:border-[var(--card-border)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{style.icon}</span>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{style.label}</h4>
                    <p className="text-xs text-[var(--foreground-muted)]">{style.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Education System
          </label>
          <select
            value={data.education_system}
            onChange={(e) => onChange('education_system', e.target.value)}
            className="w-full py-3 px-4 bg-[var(--background-secondary)] border-[1.5px] border-[var(--card-border)] rounded-xl text-foreground cursor-pointer focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10"
          >
            <option value="">Select your curriculum...</option>
            {educationSystems.map((system) => (
              <option key={system.value} value={system.value}>
                {system.label}
              </option>
            ))}
          </select>
        </div>

        <Textarea
          label="Short Bio (Optional)"
          value={data.bio}
          onChange={(e) => onChange('bio', e.target.value)}
          placeholder="Tell us about your teaching experience and subjects you specialize in..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 mt-8">
        <Button variant="secondary" onClick={onBack} leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
          Back
        </Button>
        <Button variant="gradient" fullWidth onClick={onNext} rightIcon={<ArrowRightIcon className="w-4 h-4" />}>
          Continue
        </Button>
      </div>
    </motion.div>
  )
}

// Step 3: First Student (Optional)
function FirstStudentStep({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
}: {
  data: { studentName: string; grade: string; subjects: string }
  onChange: (field: string, value: string) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const grades = [
    'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    'University', 'Adult Learner',
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 rounded-2xl flex items-center justify-center border border-[var(--accent)]/20">
          <UserPlusIcon className="w-8 h-8 text-[var(--accent)]" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Add Your First Student</h2>
        <p className="text-[var(--foreground-muted)]">You can always add more students later</p>
      </div>

      <div className="space-y-5">
        <Input
          label="Student Name"
          value={data.studentName}
          onChange={(e) => onChange('studentName', e.target.value)}
          placeholder="Alex Smith"
          leftIcon={<UserIcon className="w-5 h-5" />}
        />

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Grade Level
          </label>
          <select
            value={data.grade}
            onChange={(e) => onChange('grade', e.target.value)}
            className="w-full py-3 px-4 bg-[var(--background-secondary)] border-[1.5px] border-[var(--card-border)] rounded-xl text-foreground cursor-pointer focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10"
          >
            <option value="">Select grade level...</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Subjects"
          value={data.subjects}
          onChange={(e) => onChange('subjects', e.target.value)}
          placeholder="Math, Science, English..."
          hint="Comma-separated list of subjects you'll tutor"
        />
      </div>

      <div className="flex flex-col gap-3 mt-8">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack} leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
            Back
          </Button>
          <Button
            variant="gradient"
            fullWidth
            onClick={onNext}
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
            disabled={!data.studentName}
          >
            Add Student & Continue
          </Button>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[var(--foreground-muted)] hover:text-foreground transition-colors"
        >
          Skip for now →
        </button>
      </div>
    </motion.div>
  )
}

// Step 4: Ready to Go
function ReadyStep({ onComplete }: { onComplete: () => void }) {
  const highlights = [
    { icon: ChartBarIcon, title: 'Dashboard', desc: 'Track AI performance and view insights' },
    { icon: LightBulbIcon, title: 'Create Strategy', desc: 'Build teaching strategies with AI' },
    { icon: BookOpenIcon, title: 'Build Lessons', desc: 'Generate rich, multi-format lessons' },
    { icon: PuzzlePieceIcon, title: 'Design Activities', desc: 'Create interactive practice exercises' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
        className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-[var(--success)] to-[var(--success-light)] rounded-full flex items-center justify-center shadow-xl shadow-[var(--success)]/30"
      >
        <CheckCircleIcon className="w-12 h-12 text-white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-foreground mb-3"
      >
        You're All Set! 🎉
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg text-[var(--foreground-muted)] mb-8"
      >
        Your TutorPilot workspace is ready. Here's what you can do:
      </motion.p>

      {/* Quick tour */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-4 mb-8"
      >
        {highlights.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="glass-card-sm p-4 text-left hover-lift"
          >
            <item.icon className="w-6 h-6 text-primary mb-2" />
            <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
            <p className="text-xs text-[var(--foreground-muted)]">{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Button
          variant="gradient"
          size="lg"
          onClick={onComplete}
          rightIcon={<RocketLaunchIcon className="w-5 h-5" />}
        >
          Go to Dashboard
        </Button>
      </motion.div>
    </motion.div>
  )
}

// Main Onboarding Component
export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState({
    name: '',
    teaching_style: '',
    education_system: '',
    bio: '',
  })
  const [studentData, setStudentData] = useState({
    studentName: '',
    grade: '',
    subjects: '',
  })

  const { user, updateProfile } = useAuth()
  const router = useRouter()
  const toast = useToast()

  // Initialize with user data
  useEffect(() => {
    if (user) {
      setProfileData((prev) => ({
        ...prev,
        name: user.user_metadata?.name || user.email?.split('@')[0] || '',
        teaching_style: user.user_metadata?.teaching_style || '',
        education_system: user.user_metadata?.education_system || '',
      }))
    }
  }, [user])

  const totalSteps = 4

  const handleProfileChange = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }))
  }

  const handleStudentChange = (field: string, value: string) => {
    setStudentData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      await updateProfile({
        name: profileData.name,
        teaching_style: profileData.teaching_style,
        education_system: profileData.education_system,
        bio: profileData.bio,
      })
      setCurrentStep(2)
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStudent = async () => {
    setLoading(true)
    try {
      // Call API to add student
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentData.studentName,
          grade_level: studentData.grade,
          subjects: studentData.subjects.split(',').map((s) => s.trim()).filter(Boolean),
          tutor_id: user?.id,
        }),
      })

      if (response.ok) {
        toast.success('Student added!', `${studentData.studentName} has been added to your roster.`)
      }
      setCurrentStep(3)
    } catch (error: any) {
      // Continue even if student creation fails - they can add later
      console.error('Failed to add student:', error)
      setCurrentStep(3)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    // Mark onboarding as complete
    try {
      await updateProfile({ onboarding_completed: true })
    } catch (error) {
      // Continue even if this fails
    }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="gradient-mesh" />
      <div className="grid-pattern" />

      <div className="w-full max-w-2xl">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 mb-8"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <AcademicCapIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground">TutorPilot</span>
            <span className="px-1.5 py-0.5 text-xs font-bold bg-gradient-to-r from-primary to-primary-dark text-white rounded-md">
              AI
            </span>
          </div>
        </motion.div>

        {/* Progress Steps */}
        <ProgressSteps currentStep={currentStep} totalSteps={totalSteps} />

        {/* Card Container */}
        <motion.div
          layout
          className="glass-card p-8 md:p-10"
        >
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <WelcomeStep
                key="welcome"
                name={profileData.name}
                onNext={() => setCurrentStep(1)}
              />
            )}
            {currentStep === 1 && (
              <TeachingProfileStep
                key="profile"
                data={profileData}
                onChange={handleProfileChange}
                onNext={handleSaveProfile}
                onBack={() => setCurrentStep(0)}
              />
            )}
            {currentStep === 2 && (
              <FirstStudentStep
                key="student"
                data={studentData}
                onChange={handleStudentChange}
                onNext={handleAddStudent}
                onBack={() => setCurrentStep(1)}
                onSkip={() => setCurrentStep(3)}
              />
            )}
            {currentStep === 3 && (
              <ReadyStep
                key="ready"
                onComplete={handleComplete}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

