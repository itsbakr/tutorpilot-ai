'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { AppShell } from '@/components/AppShell'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import {
  User,
  Mail,
  BookOpen,
  GraduationCap,
  Lock,
  Save,
  Settings,
  Bell,
  Palette,
  Shield,
  Trash2,
  Eye,
  EyeOff,
  Brain,
  Sparkles,
  ChevronRight
} from 'lucide-react'

type TabId = 'profile' | 'account' | 'preferences'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  { id: 'account', label: 'Account', icon: <Shield className="w-5 h-5" /> },
  { id: 'preferences', label: 'Preferences', icon: <Settings className="w-5 h-5" /> },
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

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    teaching_style: '',
    education_system: '',
    bio: ''
  })
  
  // Password state
  const [passwords, setPasswords] = useState({
    new: '',
    confirm: ''
  })
  const [showPasswords, setShowPasswords] = useState(false)
  
  // Preferences state
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    weeklyDigest: true,
    aiSuggestions: true,
    autoSave: true
  })

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        teaching_style: '',
        education_system: '',
        bio: ''
      })
      loadTutorProfile()
    }
  }, [user])

  const loadTutorProfile = async () => {
    if (!user?.tutor_id && !user?.id) return
    
    try {
      const tutorId = user.tutor_id || user.id
      const { data, error } = await supabase
        .from('tutors')
        .select('*')
        .eq('id', tutorId)
        .single()
      
      if (data) {
        setProfile(prev => ({
          ...prev,
          teaching_style: data.teaching_style || '',
          education_system: data.education_system || '',
          bio: data.bio || ''
        }))
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const tutorId = user?.tutor_id || user?.id
      if (tutorId) {
        const { error: updateError } = await supabase
          .from('tutors')
          .update({
            name: profile.name,
            teaching_style: profile.teaching_style,
            education_system: profile.education_system,
            bio: profile.bio
          })
          .eq('id', tutorId)

        if (updateError) throw updateError
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: { name: profile.name }
      })

      if (authError) throw authError

      toast.success('Profile Updated', 'Your changes have been saved successfully.')
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwords.new !== passwords.confirm) {
      toast.error('Password Mismatch', 'New passwords do not match')
      return
    }

    if (passwords.new.length < 6) {
      toast.error('Password Too Short', 'Password must be at least 6 characters')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      })

      if (error) throw error

      toast.success('Password Changed', 'Your password has been updated successfully.')
      setPasswords({ new: '', confirm: '' })
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = () => {
    toast.warning('Demo Mode', 'Account deletion is disabled in demo mode')
    setShowDeleteModal(false)
  }

  if (isLoading) {
    return <PageLoader message="Loading settings..." />
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-[var(--foreground-muted)]">
            Manage your account settings and preferences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <GlassCard className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200
                      ${activeTab === tab.id
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'text-foreground hover:bg-[var(--background-secondary)]'
                      }
                    `}
                  >
                    {tab.icon}
                    <span className="font-medium">{tab.label}</span>
                    {activeTab === tab.id && (
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    )}
                  </button>
                ))}
              </nav>
            </GlassCard>

            {/* AI Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4"
            >
              <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">AI Personalization</p>
                    <p className="text-xs text-white/70">Powered by your profile</p>
                  </div>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">
                  Your teaching style and education system help our AI create better personalized content.
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">Profile Information</h2>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          Update your personal details and teaching preferences
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Input
                          label="Full Name"
                          leftIcon={<User className="w-5 h-5" />}
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          placeholder="Dr. Sarah Johnson"
                        />
                        
                        <Input
                          label="Email Address"
                          leftIcon={<Mail className="w-5 h-5" />}
                          value={profile.email}
                          disabled
                          hint="Email cannot be changed"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Select
                          label="Teaching Style"
                          options={teachingStyleOptions}
                          value={profile.teaching_style}
                          onChange={(e) => setProfile({ ...profile, teaching_style: e.target.value })}
                          placeholder="Select your teaching style..."
                        />
                        
                        <Select
                          label="Education System"
                          options={educationSystemOptions}
                          value={profile.education_system}
                          onChange={(e) => setProfile({ ...profile, education_system: e.target.value })}
                          placeholder="Select education system..."
                        />
                      </div>

                      <Textarea
                        label="Bio (Optional)"
                        value={profile.bio}
                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        placeholder="Tell us about your teaching experience and philosophy..."
                        rows={4}
                        hint="This helps personalize AI-generated content"
                      />

                      <div className="flex justify-end pt-4 border-t border-[var(--card-border)]">
                        <Button
                          type="submit"
                          variant="gradient"
                          loading={saving}
                          leftIcon={<Save className="w-4 h-4" />}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  </GlassCard>
                </motion.div>
              )}

              {activeTab === 'account' && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Change Password */}
                  <GlassCard className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-[var(--warning)]/10 rounded-xl flex items-center justify-center">
                        <Lock className="w-6 h-6 text-[var(--warning)]" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">Change Password</h2>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          Update your password to keep your account secure
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-5">
                      <Input
                        label="New Password"
                        type={showPasswords ? 'text' : 'password'}
                        leftIcon={<Lock className="w-5 h-5" />}
                        rightIcon={
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="hover:text-foreground transition-colors"
                          >
                            {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        }
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        placeholder="••••••••"
                        hint="Minimum 6 characters"
                      />
                      
                      <Input
                        label="Confirm New Password"
                        type={showPasswords ? 'text' : 'password'}
                        leftIcon={<Lock className="w-5 h-5" />}
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        placeholder="••••••••"
                        error={passwords.confirm && passwords.new !== passwords.confirm ? 'Passwords do not match' : undefined}
                      />

                      <div className="flex justify-end pt-4 border-t border-[var(--card-border)]">
                        <Button
                          type="submit"
                          variant="primary"
                          loading={saving}
                          disabled={!passwords.new || !passwords.confirm}
                        >
                          Update Password
                        </Button>
                      </div>
                    </form>
                  </GlassCard>

                  {/* Danger Zone */}
                  <GlassCard className="p-6 sm:p-8 border-red-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                        <Trash2 className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-red-600">Danger Zone</h2>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          Irreversible and destructive actions
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--foreground-muted)] mb-4 pl-15">
                      Once you delete your account, there is no going back. All your data, students, 
                      strategies, lessons, and activities will be permanently removed.
                    </p>
                    
                    <Button
                      variant="danger"
                      onClick={() => setShowDeleteModal(true)}
                      leftIcon={<Trash2 className="w-4 h-4" />}
                    >
                      Delete Account
                    </Button>
                  </GlassCard>
                </motion.div>
              )}

              {activeTab === 'preferences' && (
                <motion.div
                  key="preferences"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Notifications */}
                  <GlassCard className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <Bell className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">Notifications</h2>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          Configure how you receive updates
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <PreferenceToggle
                        label="Email Notifications"
                        description="Receive updates about your students and content"
                        checked={preferences.emailNotifications}
                        onChange={(checked) => setPreferences({ ...preferences, emailNotifications: checked })}
                      />
                      <PreferenceToggle
                        label="Weekly Digest"
                        description="Get a summary of AI performance and insights"
                        checked={preferences.weeklyDigest}
                        onChange={(checked) => setPreferences({ ...preferences, weeklyDigest: checked })}
                      />
                    </div>
                  </GlassCard>

                  {/* AI Features */}
                  <GlassCard className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">AI Features</h2>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          Customize your AI experience
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <PreferenceToggle
                        label="AI Suggestions"
                        description="Show smart suggestions while creating content"
                        checked={preferences.aiSuggestions}
                        onChange={(checked) => setPreferences({ ...preferences, aiSuggestions: checked })}
                      />
                      <PreferenceToggle
                        label="Auto-save Drafts"
                        description="Automatically save your work as you type"
                        checked={preferences.autoSave}
                        onChange={(checked) => setPreferences({ ...preferences, autoSave: checked })}
                      />
                    </div>
                  </GlassCard>

                  {/* Theme */}
                  <GlassCard className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                        <Palette className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">Appearance</h2>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          Customize the look and feel
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <ThemeOption label="Light" active={true} />
                      <ThemeOption label="Dark" active={false} disabled />
                      <ThemeOption label="System" active={false} disabled />
                    </div>
                    <p className="text-xs text-[var(--foreground-muted)] mt-3">
                      Dark mode coming soon!
                    </p>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account?"
        message="This action cannot be undone. All your data will be permanently deleted."
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
      />
    </AppShell>
  )
}

// Preference Toggle Component
function PreferenceToggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--background-secondary)] rounded-xl">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-[var(--foreground-muted)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`
          relative w-12 h-7 rounded-full transition-colors duration-200
          ${checked ? 'bg-primary' : 'bg-gray-300'}
        `}
      >
        <motion.div
          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm"
          animate={{ left: checked ? '24px' : '4px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )
}

// Theme Option Component
function ThemeOption({
  label,
  active,
  disabled = false
}: {
  label: string
  active: boolean
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      className={`
        p-4 rounded-xl border-2 text-center transition-all duration-200
        ${active
          ? 'border-primary bg-primary/5 text-primary'
          : disabled
            ? 'border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
            : 'border-[var(--card-border)] text-foreground hover:border-primary/50'
        }
      `}
    >
      <p className="font-medium">{label}</p>
    </button>
  )
}
