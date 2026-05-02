'use client';

import { motion } from 'framer-motion';
import {
  ClockIcon,
  FireIcon,
  SpeakerWaveIcon,
  PaintBrushIcon,
  LightBulbIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';

const actions = [
  { label: 'Add a timer', prompt: 'Add a countdown timer that adds urgency to the activity.', Icon: ClockIcon },
  { label: 'Make it harder', prompt: 'Make the activity more challenging with harder questions or faster pacing.', Icon: FireIcon },
  { label: 'Add sound effects', prompt: 'Add subtle sound effects for correct/incorrect answers and milestones.', Icon: SpeakerWaveIcon },
  { label: 'Make it more visual', prompt: 'Make the activity more visually engaging with animations and color.', Icon: PaintBrushIcon },
  { label: 'Add hints', prompt: 'Add a hint button that gives the student a small nudge without giving away the answer.', Icon: LightBulbIcon },
  { label: 'Add scoring', prompt: 'Add a scoring system with a leaderboard-style reveal at the end.', Icon: TrophyIcon },
];

interface QuickActionsProps {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onPick, disabled = false }: QuickActionsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {actions.map((a, idx) => (
        <motion.button
          key={a.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(a.prompt)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03 }}
          whileHover={disabled ? undefined : { scale: 1.04, y: -1 }}
          whileTap={disabled ? undefined : { scale: 0.97 }}
          className={`
            flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
            text-xs font-medium border transition-colors
            ${
              disabled
                ? 'opacity-40 cursor-not-allowed border-[var(--card-border)] text-[var(--foreground-muted)]'
                : 'border-[var(--card-border)] bg-white text-[var(--foreground-muted)] hover:border-primary/40 hover:text-primary hover:bg-primary/5 cursor-pointer'
            }
          `}
        >
          <a.Icon className="w-3.5 h-3.5" />
          {a.label}
        </motion.button>
      ))}
    </div>
  );
}
