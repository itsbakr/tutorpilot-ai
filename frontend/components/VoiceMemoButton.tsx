'use client';

import { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { dataApi, voiceMemoApi } from '@/lib/api';

interface StudentOption {
  id: string;
  name: string;
}

export function VoiceMemoButton() {
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open && students.length === 0) {
      dataApi.getStudents().then((r) => setStudents(r.students || [])).catch(() => undefined);
    }
  }, [open, students.length]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = handleStop;
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      toast.error('Mic blocked', err?.message || 'Allow microphone access in your browser.');
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  const handleStop = async () => {
    if (!tutorId) return;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const file = new File([blob], `memo-${Date.now()}.webm`, { type: 'audio/webm' });
    setUploading(true);
    try {
      await voiceMemoApi.upload({
        tutor_id: tutorId,
        student_id: studentId || undefined,
        duration_seconds: seconds,
        file,
      });
      toast.success('Memo uploaded', 'Findings will appear in your notifications.');
      setOpen(false);
      setStudentId('');
      setSeconds(0);
    } catch (err: any) {
      toast.error('Upload failed', err?.response?.data?.detail || err?.message || 'Try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!tutorId) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-xl shadow-primary/30 flex items-center justify-center z-40 hover:scale-105 transition-transform"
        aria-label="Quick voice memo"
        title="Quick voice memo"
      >
        <MicrophoneIcon className="w-6 h-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => !recording && !uploading && setOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground">Quick voice memo</h3>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">About which student?</label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={recording || uploading}
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
              >
                <option value="">— general / no student —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col items-center py-4">
              {recording ? (
                <button
                  onClick={stop}
                  className="w-20 h-20 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xl animate-pulse"
                >
                  <StopIcon className="w-8 h-8" />
                </button>
              ) : (
                <button
                  onClick={start}
                  disabled={uploading}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shadow-xl"
                >
                  <MicrophoneIcon className="w-8 h-8" />
                </button>
              )}
              <p className="mt-3 text-sm text-[var(--foreground-muted)]">
                {recording ? `Recording… ${seconds}s` : uploading ? 'Uploading…' : 'Tap to start'}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => !recording && !uploading && setOpen(false)}
                disabled={recording || uploading}
                className="px-3 py-2 text-sm rounded-xl text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
