'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
    </ThemeProvider>
  );
}
