'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef, ReactNode } from 'react';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  variant?: 'default' | 'small' | 'solid' | 'flat';
  hover?: boolean;
  glow?: 'none' | 'primary' | 'accent' | 'success';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantMap = {
  default: 'glass-card',
  small: 'glass-card-sm',
  solid: 'card',
  flat: 'card-flat',
};

const glowMap = {
  none: '',
  primary: 'glow-primary',
  accent: 'glow-accent',
  success: 'glow-success',
};

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      variant = 'default',
      hover = false,
      glow = 'none',
      padding = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const baseClasses = `${variantMap[variant]} ${paddingMap[padding]} ${glowMap[glow]}`;
    const hoverClasses = hover ? 'hover-lift cursor-pointer' : '';

    return (
      <motion.div
        ref={ref}
        className={`${baseClasses} ${hoverClasses} ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export { GlassCard };
export type { GlassCardProps };

