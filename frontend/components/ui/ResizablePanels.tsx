'use client';

import { useState } from 'react';
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
} from 'react-resizable-panels';

interface ResizablePanelGroupProps extends Omit<GroupProps, 'orientation'> {
  direction?: 'horizontal' | 'vertical';
}

export function ResizablePanelGroup({
  children,
  className = '',
  direction = 'horizontal',
  ...props
}: ResizablePanelGroupProps) {
  return (
    <Group
      orientation={direction}
      className={`flex h-full w-full ${
        direction === 'vertical' ? 'flex-col' : 'flex-row'
      } ${className}`}
      {...props}
    >
      {children}
    </Group>
  );
}

export function ResizablePanel({ children, className = '', ...props }: PanelProps) {
  return (
    <Panel className={className} {...props}>
      {children}
    </Panel>
  );
}

interface ResizableHandleProps {
  direction?: 'horizontal' | 'vertical';
}

export function ResizableHandle({ direction = 'horizontal' }: ResizableHandleProps) {
  const isHorizontal = direction === 'horizontal';
  const [active, setActive] = useState(false);

  // react-resizable-panels v4 doesn't expose an active-drag data attribute,
  // so we track drag state locally via pointer events. The pointerup listener
  // is attached to the window so we still clear the state if the user releases
  // the pointer outside the handle.
  const handlePointerDown = () => {
    setActive(true);
    const handleUp = () => {
      setActive(false);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  return (
    <Separator
      onPointerDown={handlePointerDown}
      className={`
        group relative flex items-center justify-center
        ${isHorizontal ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'}
        bg-transparent transition-colors
        hover:bg-primary/20
        ${active ? 'bg-primary/40' : ''}
      `}
    >
      <div
        className={`
          ${isHorizontal ? 'h-12 w-1' : 'h-1 w-12'}
          rounded-full bg-[var(--card-border)]
          group-hover:bg-primary
          ${active ? 'bg-primary' : ''}
          transition-colors
        `}
      />
    </Separator>
  );
}
