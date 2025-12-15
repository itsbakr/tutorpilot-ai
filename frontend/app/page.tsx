'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { 
  Brain, 
  Sparkles, 
  ArrowRight, 
  CheckCircle, 
  BookOpen, 
  FileText, 
  Activity,
  Zap,
  Target,
  BarChart3,
  Users,
  Star,
  Play,
  Clock,
  TrendingUp,
  Award,
  Shield,
  Globe,
  MessageCircle,
  ChevronRight,
  Check,
  X,
  HelpCircle,
  Lightbulb,
  GraduationCap,
  Calculator,
  Languages,
  FlaskConical,
  Quote
} from 'lucide-react';

// Animated Counter Component
function AnimatedCounter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

// TutorPilot Agent Icon
const TutorAgentIcon = ({ className = '' }: { className?: string }) => (
  <Brain className={className} />
);

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [visibleTasks, setVisibleTasks] = useState<Array<{
    type: string;
    message: string;
    status?: string;
    result?: {
      title: string;
      stats?: Array<{ label: string; value: string; change?: string }>;
      items?: string[];
    };
  }>>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // AI Agent demo tasks
  const agentTasks = [
    { type: 'user', message: 'Create a 4-week math strategy for Emma, grade 10' },
    { type: 'agent', message: 'Analyzing student profile and researching best practices...', status: 'thinking' },
    { type: 'agent', message: 'Strategy created using academic research!', status: 'complete',
      result: { title: 'Personalized Strategy', items: ['4 weekly learning goals', 'Quadratic equations focus', 'Visual learning activities'] }
    },
    { type: 'user', message: 'Generate a lesson plan for Week 2: Quadratics' },
    { type: 'agent', message: 'Building lesson with active learning framework...', status: 'thinking' },
    { type: 'agent', message: 'Lesson plan ready with activities!', status: 'complete',
      result: { title: 'Lesson Components', items: ['Pre-class video assignment', 'Interactive simulation', 'Practice problems'] }
    },
  ];

  // Auto-advance through tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTaskIndex((prev) => {
        const next = (prev + 1) % agentTasks.length;
        if (next === 0) setVisibleTasks([]);
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [agentTasks.length]);

  useEffect(() => {
    const task = agentTasks[currentTaskIndex];
    const timer = setTimeout(() => {
      setVisibleTasks((prev) => [...prev, task].slice(-4));
    }, 0);
    return () => clearTimeout(timer);
  }, [currentTaskIndex]);

  // Auto-scroll chat to bottom when new messages appear
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [visibleTasks]);

  // Neural network animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < 50; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
        nodes.forEach((otherNode, j) => {
          if (i === j) return;
          const dx = node.x - otherNode.x;
          const dy = node.y - otherNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(otherNode.x, otherNode.y);
            ctx.strokeStyle = `rgba(220, 38, 38, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 38, 38, 0.3)';
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();

    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const faqs = [
    { q: 'How does the AI personalize content for each student?', a: 'TutorPilot analyzes student profiles including grade level, learning style, interests, and cultural background. It then generates content tailored to their specific needs, powered by academic research and educational best practices.' },
    { q: 'Is my data and my students\' data secure?', a: 'Yes! We use enterprise-grade encryption and never share your data. All content is stored securely in your private workspace.' },
    { q: 'How does the self-improvement work?', a: 'Every piece of content goes through a self-evaluation process scoring it on 5 criteria. When you edit content, the AI learns from your changes and adapts future generations to match your preferences.' },
    { q: 'What subjects and grade levels are supported?', a: 'TutorPilot works with any subject and grade level. Whether you teach elementary math, high school physics, or SAT prep, the AI adapts to your curriculum.' },
    { q: 'Do I need technical skills to use interactive activities?', a: 'Not at all! The Activity Builder generates ready-to-use interactive React applications. Just click deploy and share the link with your students.' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background Effects */}
      <div className="gradient-mesh" />
      <div className="grid-pattern" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-foreground">TutorPilot</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-primary to-primary-dark text-white rounded-md">AI</span>
                </div>
                <p className="text-[10px] text-[var(--foreground-muted)]">Self-Improving Agents</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--foreground-muted)]">
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a>
              <a href="#testimonials" className="hover:text-primary transition-colors">Testimonials</a>
              <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="px-5 py-2.5 text-foreground hover:text-primary transition-colors font-medium text-sm">
                Sign In
              </Link>
              <Link href="/auth/signup" className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold text-sm">
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 sm:pt-32 pb-16 sm:pb-20">
        <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/5 rounded-full blur-3xl float" />
        <div className="absolute bottom-1/4 right-1/4 w-52 sm:w-80 h-52 sm:h-80 bg-[var(--accent)]/5 rounded-full blur-3xl float-delayed" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center lg:text-left">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-6">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-[var(--foreground-muted)]">🎉 Free for early adopters — No credit card required</span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
                Create a Week of<br />
                <span className="text-gradient">Lessons in</span>{' '}
                <span className="text-gradient-gold">30 Minutes</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="text-base sm:text-lg md:text-xl text-[var(--foreground-muted)] max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                Stop spending hours on lesson planning. Let AI agents create <strong className="text-foreground">personalized strategies, engaging lessons, and interactive activities</strong> that get better with every use.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }} className="flex flex-col sm:flex-row gap-4 mb-8 justify-center lg:justify-start">
                <Link href="/auth/signup" className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-gradient-to-r from-primary to-primary-dark hover:shadow-xl hover:shadow-primary/30 rounded-xl font-semibold text-white text-lg transition-all duration-200 hover:-translate-y-0.5">
                  Start Creating for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
                <a href="#how-it-works" className="group inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-[var(--foreground-muted)] hover:text-foreground text-base transition-all duration-200 glass-card-sm">
              <Play className="w-5 h-5" />
                  See How It Works
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-[var(--foreground-muted)]">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Research-backed content</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Self-improving AI</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right - App Demo */}
            <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.4, type: "spring", stiffness: 50 }} className="hidden lg:flex justify-center items-center" style={{ perspective: '1500px' }}>
              <div className="relative" style={{ transform: 'rotateY(-8deg) rotateX(2deg)', transformStyle: 'preserve-3d' }}>
                <div className="relative rounded-[32px] p-[2px] overflow-hidden" style={{ background: 'linear-gradient(145deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)', boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.15), 0 30px 60px -30px rgba(0, 0, 0, 0.1)' }}>
                  <div className="rounded-[30px] p-[6px]" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                    <div className="relative rounded-[26px] overflow-hidden bg-white" style={{ width: '320px' }}>
                      <div className="bg-gradient-to-r from-primary/5 to-[var(--accent)]/5 px-4 py-3 border-b border-[var(--card-border)]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/30">
                            <TutorAgentIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="text-foreground font-semibold text-sm">TutorPilot AI</div>
                            <div className="text-[var(--foreground-muted)] text-[10px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                              Creating personalized content...
                            </div>
                          </div>
                        </div>
                      </div>
                      <div ref={chatContainerRef} className="h-[340px] overflow-y-auto px-3 py-3 bg-[var(--background-secondary)] scrollbar-thin">
                        <div className="space-y-3">
                          {visibleTasks.map((task, index) => (
                            <motion.div key={`${currentTaskIndex}-${index}`} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex ${task.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {task.type === 'user' ? (
                                <div className="bg-gradient-to-r from-primary to-primary-dark text-white px-3.5 py-2 rounded-2xl rounded-br-md max-w-[85%] shadow-sm">
                                  <p className="text-[11px] leading-relaxed">{task.message}</p>
                                </div>
                              ) : (
                                <div className="flex gap-2 max-w-[90%]">
                                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <TutorAgentIcon className="w-3.5 h-3.5 text-white" />
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="bg-white px-3.5 py-2 rounded-2xl rounded-tl-md shadow-sm border border-[var(--card-border)]">
                                      <p className="text-[11px] text-foreground">{task.message}</p>
                                    </div>
                                    {task.result && (
                                      <div className="bg-gradient-to-br from-primary/5 to-[var(--accent)]/5 border border-primary/20 px-3 py-2 rounded-xl">
                                        <div className="text-[9px] font-semibold text-primary mb-1.5 flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" />
                                          {task.result.title}
                                        </div>
                                        {task.result.items && (
                                          <div className="space-y-1 mt-1">
                                            {task.result.items.map((item, i) => (
                                              <div key={i} className="flex items-center gap-1.5 text-[9px] text-foreground">
                                                <div className="w-1 h-1 bg-primary rounded-full" />
                                                {item}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      {/* Chat Input */}
                      <div className="px-3 py-3 bg-white border-t border-[var(--card-border)]">
                        <div className="flex items-center gap-2 bg-[var(--background-secondary)] rounded-full px-4 py-2.5">
                          <span className="flex-1 text-[11px] text-[var(--foreground-muted)]">Ask TutorPilot anything...</span>
                          <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary to-primary-dark flex items-center justify-center">
                            <ArrowRight className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating badges */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2, type: "spring" }} className="absolute -right-20 top-16 bg-white rounded-2xl px-4 py-3 shadow-xl border border-[var(--card-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">Strategy Ready</div>
                      <div className="text-[10px] text-[var(--foreground-muted)]">Personalized for Emma</div>
                    </div>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4, type: "spring" }} className="absolute -left-24 bottom-28 bg-white rounded-2xl px-4 py-3 shadow-xl border border-[var(--card-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">Self-Improving AI</div>
                      <div className="text-[10px] text-[var(--foreground-muted)]">Learns from your edits</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Metrics Banner */}
      <section className="py-20 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-4 text-sm text-[var(--foreground-muted)]">
              <BarChart3 className="w-4 h-4 text-primary" />
              Real Impact
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Why Tutors Love TutorPilot</h2>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { value: '15+', label: 'Hours Saved', sublabel: 'Every Week', icon: Clock, gradient: 'from-primary to-primary-dark', shadowColor: 'shadow-primary/20' },
              { value: '10x', label: 'Faster', sublabel: 'Than Manual Planning', icon: Zap, gradient: 'from-amber-500 to-orange-500', shadowColor: 'shadow-amber-500/20' },
              { value: '∞', label: 'Unlimited', sublabel: 'Students & Lessons', icon: Users, gradient: 'from-emerald-500 to-green-500', shadowColor: 'shadow-emerald-500/20' },
              { value: '100%', label: 'Personalized', sublabel: 'To Each Student', icon: Target, gradient: 'from-violet-500 to-purple-500', shadowColor: 'shadow-violet-500/20' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="group">
                <div className="glass-card p-6 md:p-8 text-center h-full hover-lift relative overflow-hidden">
                  {/* Decorative gradient circle */}
                  <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
                  
                  <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg ${stat.shadowColor}`}>
                    <stat.icon className="w-7 h-7 text-white" />
          </div>
          
                  <div className={`text-4xl md:text-5xl font-bold mb-1 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                    {stat.value}
              </div>
                  
                  <div className="text-foreground font-semibold mb-0.5">{stat.label}</div>
                  <div className="text-xs text-[var(--foreground-muted)]">{stat.sublabel}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-4 text-sm text-[var(--foreground-muted)]">
              <Lightbulb className="w-4 h-4 text-[var(--accent)]" />
              The Problem We Solve
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Stop Wasting Time on Lesson Planning</h2>
            <p className="text-[var(--foreground-muted)] text-lg max-w-2xl mx-auto">See how TutorPilot transforms your workflow</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Before */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="glass-card p-8 border-red-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">The Old Way</h3>
                  <p className="text-sm text-red-500">Frustrating & Time-Consuming</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  'Spend 5-10 hours/week on lesson planning',
                  'Generic content that doesn\'t engage students',
                  'No way to track what actually works',
                  'Endless searching for quality resources',
                  'Same mistakes repeated over and over',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[var(--foreground-muted)]">
                    <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* After */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="glass-card p-8 border-green-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">With TutorPilot</h3>
                  <p className="text-sm text-green-500">Effortless & Effective</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  'Create a full week of content in 30 minutes',
                  'Personalized lessons for each student',
                  'Research-backed using academic sources',
                  'AI tracks what works and optimizes',
                  'AI learns from your feedback and improves',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[var(--foreground-muted)]">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
              </div>
            </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-[var(--background-secondary)]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-4 text-sm text-[var(--foreground-muted)]">
              <Sparkles className="w-4 h-4 text-primary" />
              Simple Process
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Start in 3 Simple Steps</h2>
            <p className="text-[var(--foreground-muted)] text-lg max-w-xl mx-auto">From student profile to personalized lesson in minutes</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Add Your Student', desc: 'Enter student details like grade, subject, learning style, and interests. The more info, the better the personalization.', icon: Users, color: 'primary' },
              { step: '2', title: 'AI Creates Content', desc: 'Our agents research, plan, and generate strategies, lessons, and interactive activities tailored to your student.', icon: Brain, color: '[var(--accent)]' },
              { step: '3', title: 'Refine & Improve', desc: 'Edit content collaboratively. The AI learns from your changes and improves future generations automatically.', icon: TrendingUp, color: 'green-500' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="relative">
                <div className="glass-card p-8 h-full hover-lift">
                  <div className={`w-16 h-16 rounded-2xl bg-${item.color}/10 flex items-center justify-center mb-6 relative`}>
                    <item.icon className={`w-8 h-8 text-${item.color}`} />
                    <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-${item.color} text-white font-bold text-sm flex items-center justify-center`}>
                      {item.step}
                    </div>
              </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground">{item.title}</h3>
                  <p className="text-[var(--foreground-muted)]">{item.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ChevronRight className="w-8 h-8 text-[var(--foreground-muted)]/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-4 text-sm text-[var(--foreground-muted)]">
              <Zap className="w-4 h-4 text-[var(--accent)]" />
              Powerful Features
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Three AI Agents Working For You</h2>
            <p className="text-[var(--foreground-muted)] text-lg max-w-xl mx-auto">Each agent self-evaluates, learns from feedback, and improves over time</p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: BookOpen, title: 'Strategy Planner', desc: 'Generate personalized 4-week learning strategies backed by academic research and best practices.', features: ['Perplexity-powered research', 'Personalized learning paths', 'Collaborative editing'], gradient: 'from-primary to-primary-dark', shadow: 'shadow-primary/20' },
              { icon: FileText, title: 'Lesson Creator', desc: 'Design comprehensive lesson plans with pre-class work, in-class activities, and homework.', features: ['Agent handoff from strategy', 'Active learning framework', 'Version history tracking'], gradient: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/20' },
              { icon: Activity, title: 'Activity Builder', desc: 'Generate interactive React activities that deploy instantly to live sandboxes.', features: ['Auto-debugging (3 attempts)', 'Chat-based refinement', 'Instant deployment'], gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/20' },
            ].map((agent, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="glass-card p-8 hover-lift group">
                <div className={`w-16 h-16 bg-gradient-to-br ${agent.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg ${agent.shadow}`}>
                  <agent.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">{agent.title}</h3>
                <p className="text-[var(--foreground-muted)] mb-6">{agent.desc}</p>
                <ul className="space-y-3">
                  {agent.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 px-6 bg-[var(--background-secondary)]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-4 text-sm text-[var(--foreground-muted)]">
              <GraduationCap className="w-4 h-4 text-primary" />
              For Every Subject
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Perfect for Any Tutor</h2>
            <p className="text-[var(--foreground-muted)] text-lg max-w-xl mx-auto">From math to languages, elementary to college prep</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Calculator, label: 'Mathematics', examples: 'Algebra, Calculus, Statistics' },
              { icon: FlaskConical, label: 'Sciences', examples: 'Physics, Chemistry, Biology' },
              { icon: Languages, label: 'Languages', examples: 'ESL, French, Spanish' },
              { icon: BookOpen, label: 'Test Prep', examples: 'SAT, ACT, IGCSE' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass-card p-6 text-center hover-lift">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{item.label}</h3>
                <p className="text-xs text-[var(--foreground-muted)]">{item.examples}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-4 text-sm text-[var(--foreground-muted)]">
              <MessageCircle className="w-4 h-4 text-primary" />
              Testimonials
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Loved by Tutors</h2>
            <p className="text-[var(--foreground-muted)] text-lg max-w-xl mx-auto">See what educators are saying</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "TutorPilot cut my lesson planning time in half. The personalized strategies it creates for each student are incredible.", name: 'Sarah Chen', role: 'Math Tutor, 8 years', avatar: '👩‍🏫' },
              { quote: "The interactive activities are a game-changer. My students are finally engaged and excited to learn!", name: 'Michael Rodriguez', role: 'Science Teacher', avatar: '👨‍🔬' },
              { quote: "I love how the AI learns from my edits. Every week, the content gets better and more aligned with my teaching style.", name: 'Emily Johnson', role: 'SAT Prep Specialist', avatar: '👩‍💼' },
            ].map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="glass-card p-8 relative">
                <Quote className="absolute top-6 right-6 w-10 h-10 text-primary/10" />
                <p className="text-foreground mb-6 leading-relaxed relative z-10">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-[var(--accent)]/20 flex items-center justify-center text-2xl">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{t.name}</div>
                    <div className="text-sm text-[var(--foreground-muted)]">{t.role}</div>
              </div>
            </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Self-Improvement Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-[var(--background-secondary)] to-background">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex items-center px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-full text-sm font-medium mb-8">
            <Zap className="w-4 h-4 mr-2 text-[var(--accent)]" />
            <span className="text-[var(--accent)]">Self-Improving AI</span>
          </motion.div>
          
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-5xl font-bold mb-6 text-foreground">
            AI That Gets Better With Every Use
          </motion.h2>
          
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xl text-[var(--foreground-muted)] mb-12">
            Our agents don't just generate content — they evaluate themselves, learn from your edits, and adapt. The more you use TutorPilot, the better it gets at matching your teaching style.
          </motion.p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🎯', title: 'Self-Evaluation', desc: '5 criteria scoring' },
              { icon: '🔄', title: 'Reflection Loop', desc: 'Pattern recognition' },
              { icon: '📝', title: 'Learn from Edits', desc: 'Tutor feedback loop' },
              { icon: '🔧', title: 'Auto-Debugging', desc: 'Self-fixing code' },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass-card p-6">
                <div className="text-4xl mb-3">{f.icon}</div>
                <h4 className="font-semibold mb-1 text-foreground">{f.title}</h4>
                <p className="text-sm text-[var(--foreground-muted)]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
              </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm mb-4 text-sm text-[var(--foreground-muted)]">
              <HelpCircle className="w-4 h-4 text-primary" />
              FAQ
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Common Questions</h2>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="glass-card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left">
                  <span className="font-semibold text-foreground pr-4">{faq.q}</span>
                  <ChevronRight className={`w-5 h-5 text-[var(--foreground-muted)] transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="px-6 pb-6">
                    <p className="text-[var(--foreground-muted)]">{faq.a}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-[var(--accent)]/5" />
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-sm font-medium mb-6">
            <Award className="w-4 h-4 text-green-500" />
            <span className="text-green-600">Free for Early Adopters</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground">
            Ready to Transform Your Tutoring?
          </h2>
          <p className="text-xl text-[var(--foreground-muted)] mb-8 max-w-2xl mx-auto">
            Join hundreds of tutors who are saving time and creating better learning experiences with AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/auth/signup" className="group inline-flex items-center justify-center gap-2 px-10 py-5 bg-gradient-to-r from-primary to-primary-dark rounded-xl hover:shadow-2xl hover:shadow-primary/30 transition-all font-bold text-lg text-white">
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--foreground-muted)]">
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> No credit card required</span>
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Free forever for early users</span>
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Cancel anytime</span>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[var(--card-border)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-foreground">TutorPilot</span>
          </div>
          <p className="text-sm text-[var(--foreground-muted)]">
            Built for WaveHacks 2025 · Best Self-Improving Agent Track
          </p>
          <div className="flex items-center gap-6 text-sm text-[var(--foreground-muted)]">
            <a href="https://github.com/itsbakr/weave-tutor" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">GitHub</a>
            <a href="https://wandb.ai" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Weave Traces</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
