'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import {
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

interface SelfEvaluationProps {
  evaluation: {
    overall_score: number;
    criteria: {
      [key: string]: {
        score: number;
        reasoning: string;
      };
    };
    weaknesses?: string[];
    improvements?: string[];
  };
  agentName?: string;
}

export function SelfEvaluationCard({ evaluation, agentName = "AI Agent" }: SelfEvaluationProps) {
  // Force hot reload - agentName is properly defined
  if (!evaluation) return null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-[var(--success)]';
    if (score >= 6) return 'text-[var(--warning)]';
    return 'text-[var(--error)]';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 8) return 'bg-[var(--success)]';
    if (score >= 6) return 'bg-[var(--warning)]';
    return 'bg-[var(--error)]';
  };

  return (
    <div className="mt-8">
      <GlassCard padding="lg">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
              <h2 className="text-2xl font-bold text-foreground">{agentName} Self‑Evaluation</h2>
              <p className="text-sm text-[var(--foreground-muted)]">The agent scores its own output and explains why.</p>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--background-secondary)] border border-[var(--card-border)]">
              <StarIcon className="w-4 h-4 text-[var(--accent)]" />
              <span className={`text-sm font-bold ${getScoreColor(evaluation.overall_score)}`}>
                {evaluation.overall_score.toFixed(1)}/10
              </span>
            </div>
        </div>
      </div>

      {/* Overall Score */}
        <div className="mb-8 p-6 bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]">
        <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-foreground">Overall Score</span>
          <span className={`text-4xl font-black ${getScoreColor(evaluation.overall_score)}`}>
              {evaluation.overall_score.toFixed(1)}
          </span>
        </div>
          <div className="w-full bg-[var(--background-tertiary)] rounded-full h-3 overflow-hidden">
          <div
              className={`h-3 rounded-full ${getScoreBarColor(evaluation.overall_score)} transition-all duration-500`}
            style={{ width: `${(evaluation.overall_score / 10) * 100}%` }}
          />
        </div>
          <p className="mt-3 text-xs text-[var(--foreground-muted)]">
            Scored across multiple criteria (clarity, alignment, pedagogy, etc).
          </p>
      </div>

      {/* Criteria Breakdown */}
      <div className="space-y-4 mb-8">
          <h3 className="text-lg font-bold text-foreground">Criteria Breakdown</h3>
        {Object.entries(evaluation.criteria).map(([key, value]) => {
          // Handle both object format {score, reasoning} and direct number format
          const score = typeof value === 'object' && value !== null && 'score' in value ? value.score : (typeof value === 'number' ? value : 0);
          const reasoning = typeof value === 'object' && value !== null && 'reasoning' in value ? value.reasoning : '';
          const scoreNum = typeof score === 'number' ? score : parseFloat(score) || 0;
          
          return (
            <div key={key} className="bg-white p-5 rounded-2xl border border-[var(--card-border)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4 mb-2">
                <span className="font-semibold text-foreground capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className={`text-2xl font-bold ${getScoreColor(scoreNum)}`}>
                  {scoreNum.toFixed(1)}/10
                </span>
              </div>
              {reasoning && <p className="text-sm text-[var(--foreground-secondary)] mb-3">{reasoning}</p>}
              <div className="w-full bg-[var(--background-tertiary)] rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getScoreBarColor(scoreNum)} transition-all duration-500`}
                  style={{ width: `${(scoreNum / 10) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Weaknesses */}
      {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)]" />
            <h3 className="text-lg font-bold text-foreground">Identified Weaknesses</h3>
          </div>
          <div className="space-y-3">
            {evaluation.weaknesses.map((weakness, index) => (
              <div
                key={index}
                className="bg-[var(--warning-bg)] border-l-4 border-[var(--warning)] p-4 rounded-r-xl"
              >
                <p className="text-sm text-foreground">{weakness}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvements */}
      {evaluation.improvements && evaluation.improvements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircleIcon className="w-5 h-5 text-[var(--success)]" />
            <h3 className="text-lg font-bold text-foreground">Improvement Suggestions</h3>
          </div>
          <div className="space-y-3">
            {evaluation.improvements.map((improvement, index) => (
              <div
                key={index}
                className="bg-[var(--success-bg)] border-l-4 border-[var(--success)] p-4 rounded-r-xl"
              >
                <p className="text-sm text-foreground">{improvement}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      </GlassCard>
    </div>
  );
}
