'use client';

import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
}

const variantClasses = {
  primary: 'bg-[var(--primary-100)] text-[var(--primary-dark)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  error: 'bg-[var(--error-bg)] text-[var(--error)]',
  info: 'bg-[var(--info-bg)] text-[var(--info)]',
  neutral: 'bg-[var(--background-tertiary)] text-[var(--foreground-muted)]',
};

const dotColors = {
  primary: 'bg-primary',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  error: 'bg-[var(--error)]',
  info: 'bg-[var(--info)]',
  neutral: 'bg-[var(--foreground-muted)]',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold rounded-full
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// Status Badge with animated dot
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  label?: string;
  showDot?: boolean;
  className?: string;
}

const statusConfig = {
  online: {
    color: 'bg-[var(--success)]',
    bgColor: 'bg-[var(--success-bg)]',
    textColor: 'text-[var(--success)]',
    label: 'Online',
    animate: true,
  },
  offline: {
    color: 'bg-[var(--foreground-muted)]',
    bgColor: 'bg-[var(--background-tertiary)]',
    textColor: 'text-[var(--foreground-muted)]',
    label: 'Offline',
    animate: false,
  },
  busy: {
    color: 'bg-[var(--error)]',
    bgColor: 'bg-[var(--error-bg)]',
    textColor: 'text-[var(--error)]',
    label: 'Busy',
    animate: true,
  },
  away: {
    color: 'bg-[var(--warning)]',
    bgColor: 'bg-[var(--warning-bg)]',
    textColor: 'text-[var(--warning)]',
    label: 'Away',
    animate: false,
  },
};

export function StatusBadge({
  status,
  label,
  showDot = true,
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${config.bgColor} ${config.textColor}
        ${className}
      `}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {config.animate && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${config.color}`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`}
          />
        </span>
      )}
      {label || config.label}
    </span>
  );
}

// Score Badge for self-evaluation scores
interface ScoreBadgeProps {
  score: number;
  maxScore?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScoreBadge({
  score,
  maxScore = 10,
  size = 'md',
  className = '',
}: ScoreBadgeProps) {
  const percentage = (score / maxScore) * 100;
  
  let variant: 'success' | 'warning' | 'error' = 'success';
  if (percentage < 60) variant = 'error';
  else if (percentage < 80) variant = 'warning';

  return (
    <Badge variant={variant} size={size} className={className}>
      {score.toFixed(1)}/{maxScore}
    </Badge>
  );
}

export type { BadgeProps, StatusBadgeProps, ScoreBadgeProps };

