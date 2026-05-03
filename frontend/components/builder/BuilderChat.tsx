'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  MicrophoneIcon,
  SparklesIcon,
  StopIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { activityApi, transcribeApi, type ActivityChatStreamEvent } from '@/lib/api';
import type { ActivityChatMessage } from '@/lib/types';
import { QuickActions } from './QuickActions';
import { AdjustmentDial } from './AdjustmentDial';
import { SavedPromptsBar } from './SavedPromptsBar';
import type { DeployStage } from './PreviewPane';

export interface BuilderChatHandle {
  send: (prompt: string) => void;
}

interface BuilderChatProps {
  activityId: string;
  tutorId: string;
  studentId: string;
  tutorName?: string;
  onStageChange?: (stage: DeployStage) => void;
  onCodeUpdate?: (newCode: string, sandboxUrl?: string) => void;
  onVersionSnapshot?: (versionNumber: number) => void;
  onError?: (message: string) => void;
  chatRef?: React.MutableRefObject<BuilderChatHandle | null>;
}

const STAGE_LABELS: Record<string, string> = {
  thinking: 'Thinking',
  editing: 'Editing code',
  debugging: 'Debugging',
  deploying: 'Deploying',
};

const SUGGESTIONS = [
  {
    title: 'Make it more challenging',
    prompt: 'Make the questions harder and add a faster pace to keep the student engaged.',
  },
  {
    title: 'Add a leaderboard',
    prompt: 'Add a celebratory end screen with the student’s score, time, and accuracy.',
  },
  {
    title: 'Make it more visual',
    prompt: 'Add subtle animations, color transitions, and visual feedback for correct answers.',
  },
  {
    title: 'Add hints',
    prompt: 'Give the student a hint button that nudges them without revealing the full answer.',
  },
];

export function BuilderChat({
  activityId,
  tutorId,
  studentId,
  tutorName,
  onStageChange,
  onCodeUpdate,
  onVersionSnapshot,
  onError,
  chatRef,
}: BuilderChatProps) {
  const [messages, setMessages] = useState<ActivityChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [activeStage, setActiveStage] = useState<DeployStage>('idle');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micState, setMicState] = useState<'idle' | 'denied' | 'unavailable'>(
    'idle'
  );

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicState('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicState('idle');
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorderChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recorderChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recorderChunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const text = await transcribeApi.transcribe(blob);
          if (text) {
            setInput((prev) => (prev.trim() ? prev + ' ' + text : text));
            textareaRef.current?.focus();
          }
        } catch (err) {
          console.error('Transcription failed', err);
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err: any) {
      // NotAllowedError = user denied; NotFoundError = no device
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setMicState('denied');
      } else {
        setMicState('unavailable');
      }
      console.error('Mic access denied', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  // Load chat history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await activityApi.getChatHistory(activityId);
        if (cancelled) return;
        if (res?.success && Array.isArray(res.chat_history)) {
          const mapped: ActivityChatMessage[] = res.chat_history.map((m: any) => ({
            id: m.id,
            role: m.message_type === 'tutor_request' ? 'tutor' : 'agent',
            content: m.message_content || '',
            created_at: m.created_at || new Date().toISOString(),
            sandbox_url: m.sandbox_url || undefined,
          }));
          setMessages(mapped);
        }
      } catch (err) {
        console.error('Failed to load chat history', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 120);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll on new messages if user is near bottom
  useEffect(() => {
    if (!showScrollButton) {
      scrollToBottom('smooth');
    }
  }, [messages, showScrollButton, scrollToBottom]);

  // Auto-resize textarea
  const autosize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => {
    autosize();
  }, [input, autosize]);

  const setStage = useCallback(
    (stage: DeployStage) => {
      setActiveStage(stage);
      onStageChange?.(stage);
    },
    [onStageChange]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStage('idle');
  }, [setStage]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setInput('');
      setStreaming(true);
      setStage('thinking');

      const tutorMessage: ActivityChatMessage = {
        role: 'tutor',
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      const agentPlaceholder: ActivityChatMessage = {
        role: 'agent',
        content: '',
        created_at: new Date().toISOString(),
        isStreaming: true,
        stage: 'thinking',
      };
      setMessages((prev) => [...prev, tutorMessage, agentPlaceholder]);

      const controller = new AbortController();
      abortRef.current = controller;

      const updateLastAgent = (patch: Partial<ActivityChatMessage>) => {
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'agent' && next[i].isStreaming) {
              next[i] = { ...next[i], ...patch };
              break;
            }
          }
          return next;
        });
      };

      try {
        await activityApi.chatStream(
          {
            activity_id: activityId,
            tutor_id: tutorId,
            student_id: studentId,
            message: trimmed,
          },
          (evt: ActivityChatStreamEvent) => {
            if (evt.type === 'stage') {
              setStage(evt.stage);
              updateLastAgent({ stage: evt.stage });
            } else if (evt.type === 'explanation') {
              updateLastAgent({ content: evt.text });
            } else if (evt.type === 'ready') {
              updateLastAgent({
                content: evt.explanation || 'Activity updated.',
                sandbox_url: evt.sandbox_url,
                isStreaming: false,
                stage: 'ready',
                version_number: evt.version_number,
              });
              if (evt.new_code) {
                onCodeUpdate?.(evt.new_code, evt.sandbox_url);
              }
              if (typeof evt.version_number === 'number') {
                onVersionSnapshot?.(evt.version_number);
              }
              setStage('ready');
              // Drop back to idle after a moment so the preview overlay clears
              setTimeout(() => setStage('idle'), 800);
            } else if (evt.type === 'error') {
              updateLastAgent({
                content: 'Sorry — that didn’t work. ' + (evt.message || ''),
                isStreaming: false,
                stage: 'error',
                error: evt.message,
              });
              setStage('error');
              onError?.(evt.message);
              setTimeout(() => setStage('idle'), 1200);
            }
          },
          controller.signal
        );
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          updateLastAgent({
            content: '⏸ Stopped before completion.',
            isStreaming: false,
            stage: 'error',
          });
        } else {
          console.error('Chat stream failed', err);
          updateLastAgent({
            content: 'Sorry — the request failed. Please try again.',
            isStreaming: false,
            stage: 'error',
            error: err?.message,
          });
          onError?.(err?.message || 'Stream failed');
        }
        setStage('idle');
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activityId, tutorId, studentId, streaming, setStage, onCodeUpdate, onVersionSnapshot, onError]
  );

  // Expose imperative API
  useEffect(() => {
    if (!chatRef) return;
    chatRef.current = { send: (prompt: string) => sendMessage(prompt) };
    return () => {
      if (chatRef) chatRef.current = null;
    };
  }, [chatRef, sendMessage]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape' && streaming) {
      e.preventDefault();
      handleStop();
    }
  };

  const tutorInitial = useMemo(
    () => (tutorName?.trim()?.charAt(0) || 'T').toUpperCase(),
    [tutorName]
  );

  return (
    <div className="flex flex-col h-full bg-white border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/60 backdrop-blur-sm">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
          <SparklesIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Activity Chat</p>
          <p className="text-[11px] text-[var(--foreground-muted)]">
            Powered by Gemini · iterates on the live activity
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 relative">
        {messages.length === 0 ? (
          <EmptyState onPick={(prompt) => sendMessage(prompt)} disabled={streaming} />
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, idx) => (
                <Message
                  key={(m.id || idx) + ':' + idx}
                  message={m}
                  tutorInitial={tutorInitial}
                />
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll-to-bottom pill */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => scrollToBottom('smooth')}
              className="sticky bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-white text-xs font-medium shadow-lg hover:bg-foreground/90"
            >
              <ArrowDownIcon className="w-3.5 h-3.5" />
              New messages
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--card-border)] bg-white px-4 py-3 space-y-2">
        {/* Single toolbar with strong primary affordance (Adjust),
            then saved prompts, then quick actions in a scrolling row. */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
          <AdjustmentDial onApply={(prompt) => sendMessage(prompt)} disabled={streaming} />
          <SavedPromptsBar
            tutorId={tutorId}
            draftPrompt={input}
            onPick={(prompt) => sendMessage(prompt)}
            disabled={streaming}
          />
          <span className="hidden sm:block w-px h-4 bg-[var(--card-border)] flex-shrink-0" />
          <div className="hidden sm:block flex-shrink-0">
            <QuickActions
              onPick={(prompt) => {
                setInput((cur) => (cur.trim() ? cur + '\n' + prompt : prompt));
                textareaRef.current?.focus();
              }}
              disabled={streaming}
            />
          </div>
        </div>
        {/* Quick actions on their own row only when below sm so the chip strip
            remains tappable on mobile without crowding the toolbar above. */}
        <div className="sm:hidden">
          <QuickActions
            onPick={(prompt) => {
              setInput((cur) => (cur.trim() ? cur + '\n' + prompt : prompt));
              textareaRef.current?.focus();
            }}
            disabled={streaming}
          />
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                streaming
                  ? 'Working on it… press Esc to stop'
                  : 'Ask Gemini to change the activity… (⏎ to send, ⇧⏎ for newline)'
              }
              rows={1}
              className="w-full resize-none rounded-xl border border-[var(--card-border)] bg-[var(--background-secondary)]/40 px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              disabled={streaming}
            />
            {input && !streaming && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="absolute top-2 right-2 p-1 rounded-md text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)]"
                title="Clear"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mic */}
          <button
            type="button"
            onClick={() => {
              if (micState === 'denied') {
                // re-prompt: opening browser permissions varies by browser, so
                // we just retry — most browsers will prompt again unless the
                // user explicitly blocked.
                setMicState('idle');
              }
              recording ? stopRecording() : startRecording();
            }}
            disabled={streaming || transcribing || micState === 'unavailable'}
            className={`
              flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-all relative
              ${
                recording
                  ? 'border-red-300 bg-red-50 text-red-600 animate-pulse'
                  : transcribing
                  ? 'border-[var(--card-border)] bg-[var(--background-secondary)] text-[var(--foreground-muted)]'
                  : micState === 'denied'
                  ? 'border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100'
                  : 'border-[var(--card-border)] bg-white text-[var(--foreground-muted)] hover:text-primary hover:border-primary/40'
              }
              ${streaming || transcribing || micState === 'unavailable' ? 'opacity-60 cursor-not-allowed' : ''}
            `}
            title={
              micState === 'unavailable'
                ? 'Voice input not supported in this browser'
                : micState === 'denied'
                ? 'Microphone access blocked. Click to retry, or enable it in your browser settings.'
                : recording
                ? 'Click to stop recording'
                : transcribing
                ? 'Transcribing…'
                : 'Click to record voice input. Your browser will ask for microphone permission.'
            }
          >
            <MicrophoneIcon className="w-4 h-4" />
            {micState === 'denied' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
            )}
          </button>

          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-foreground text-white hover:bg-foreground/90 transition-colors"
              title="Stop (Esc)"
            >
              <StopIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm hover:shadow-md hover:shadow-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Send (⏎)"
            >
              <ArrowUpIcon className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Live stage strip */}
        <AnimatePresence>
          {streaming && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-muted)] pt-1">
                {(['thinking', 'editing', 'debugging', 'deploying'] as DeployStage[]).map(
                  (s, idx) => {
                    const order = ['thinking', 'editing', 'debugging', 'deploying'];
                    const currentIndex = order.indexOf(activeStage);
                    const done = idx < currentIndex;
                    const active = idx === currentIndex;
                    return (
                      <div key={s} className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            done
                              ? 'bg-[var(--success)]'
                              : active
                              ? 'bg-primary animate-pulse'
                              : 'bg-[var(--card-border)]'
                          }`}
                        />
                        <span
                          className={
                            done
                              ? 'text-foreground/50'
                              : active
                              ? 'text-foreground font-semibold'
                              : ''
                          }
                        >
                          {STAGE_LABELS[s as string]}
                        </span>
                        {idx < 3 && <span className="opacity-30">›</span>}
                      </div>
                    );
                  }
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-2">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-[var(--accent)]/20 border border-primary/20 flex items-center justify-center mb-3">
        <SparklesIcon className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-base font-bold text-foreground">Iterate on this activity</h3>
      <p className="text-xs text-[var(--foreground-muted)] mt-1 max-w-[260px]">
        Ask Gemini to change the activity. It will rewrite the code and redeploy automatically.
      </p>
      <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.prompt)}
            className="text-left px-3.5 py-2.5 rounded-xl border border-[var(--card-border)] bg-white hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <p className="text-xs font-semibold text-foreground">{s.title}</p>
            <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5 line-clamp-1">
              {s.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({
  message,
  tutorInitial,
}: {
  message: ActivityChatMessage;
  tutorInitial: string;
}) {
  const isTutor = message.role === 'tutor';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2.5 ${isTutor ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className="flex-shrink-0">
        {isTutor ? (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white text-xs font-bold flex items-center justify-center shadow-sm">
            {tutorInitial}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white flex items-center justify-center shadow-sm">
            <SparklesIcon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className={`flex-1 min-w-0 ${isTutor ? 'flex justify-end' : ''}`}>
        <div
          className={`
            inline-block max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm
            ${
              isTutor
                ? 'bg-gradient-to-br from-primary to-primary-dark text-white rounded-tr-sm'
                : 'bg-[var(--background-secondary)] text-foreground border border-[var(--card-border)] rounded-tl-sm'
            }
          `}
        >
          {message.isStreaming && !message.content ? (
            <StagePill stage={message.stage} />
          ) : isTutor ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}

          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-3.5 bg-primary/60 align-middle ml-0.5 animate-pulse" />
          )}

          {message.role === 'agent' && !message.isStreaming && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {typeof message.version_number === 'number' && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[10px] font-semibold text-[var(--accent-dark)]"
                  title="A snapshot of this version was saved automatically"
                >
                  Saved as v{message.version_number}
                </span>
              )}
              {message.sandbox_url && (
                <a
                  href={message.sandbox_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[var(--card-border)] text-[11px] font-medium text-[var(--foreground-muted)] hover:text-primary hover:border-primary/40 transition-colors"
                >
                  View updated sandbox →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StagePill({ stage }: { stage?: ActivityChatMessage['stage'] }) {
  const label = stage && STAGE_LABELS[stage] ? STAGE_LABELS[stage] : 'Working';
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" />
        <span
          className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse"
          style={{ animationDelay: '0.15s' }}
        />
        <span
          className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse"
          style={{ animationDelay: '0.3s' }}
        />
      </span>
      <span>{label}…</span>
    </span>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-foreground leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_pre]:my-2">
      <ReactMarkdown
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            if (!inline && match) {
              return <CodeBlock language={match[1]} code={codeString} />;
            }
            return (
              <code
                className="px-1 py-0.5 rounded-md bg-[var(--background)] border border-[var(--card-border)] text-[12px] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group rounded-lg border border-[var(--card-border)] bg-white overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/60">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--foreground-muted)]">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--foreground-muted)] hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" />
              Copied
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: '12px',
          fontSize: '12px',
          background: 'transparent',
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
