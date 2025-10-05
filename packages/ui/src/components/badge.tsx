import * as React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'success' | 'warning';
}

const VARIANT_MAP: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-brand-100 text-brand-800 border-transparent',
  outline: 'border border-brand-200 text-brand-700',
  success: 'bg-emerald-100 text-emerald-800 border-transparent',
  warning: 'bg-amber-100 text-amber-800 border-transparent'
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        VARIANT_MAP[variant],
        className
      )}
      {...props}
    />
  )
);

Badge.displayName = 'Badge';
