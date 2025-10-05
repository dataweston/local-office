import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';
import { SiteHeader } from '../components/site-header';
import { AppThemeProvider } from '../components/app-theme-provider';
import { Providers } from '../components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Local Office — Corporate Lunch Programs Simplified',
  description:
    'Employees choose meals, admins track programs, and providers receive clear prep manifests with Local Office.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <AppThemeProvider>
            <div className="min-h-screen bg-slate-50">
              <SiteHeader />
              <main className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">{children}</main>
            </div>
          </AppThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
