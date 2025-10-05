'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { Button } from '@local-office/ui';

import { useAuth } from '../lib/auth-context';

const links = [
  { href: '/employee', label: 'Employee' },
  { href: '/admin', label: 'Admin' },
  { href: '/provider', label: 'Provider' }
];

const inputClasses =
  'mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const authFormClasses =
  'absolute right-0 top-12 z-50 w-80 space-y-3 rounded-md border border-slate-200 bg-white p-4 shadow-xl';
const tokenFieldId = 'auth-token';
const emailFieldId = 'auth-email';
const baseUrlFieldId = 'auth-base-url';

export function SiteHeader() {
  const pathname = usePathname();
  const active = useMemo(() => pathname ?? '/', [pathname]);
  const { isAuthenticated, signIn, signOut, email, baseUrl } = useAuth();
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');

  const handleAuthSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tokenInput.trim()) {
      return;
    }

    signIn({ token: tokenInput.trim(), email: emailInput.trim() || null, baseUrl: baseUrlInput.trim() || baseUrl });
    setTokenInput('');
    setEmailInput('');
    setBaseUrlInput('');
    setAuthOpen(false);
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold text-brand-700">
          Local Office
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={active.startsWith(link.href) ? 'text-brand-700' : 'hover:text-brand-600'}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
            {isAuthenticated ? (
              <div className="flex flex-col items-end leading-tight">
                <span className="font-medium text-slate-700">Connected</span>
                <span>{email ?? 'API user'}</span>
              </div>
            ) : (
              <span className="font-medium text-slate-600">Not authenticated</span>
            )}
          </div>
          <div className="relative">
            {isAuthOpen ? (
              <form onSubmit={handleAuthSubmit} className={authFormClasses}>
                <div>
                  <label htmlFor={tokenFieldId} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    API token
                  </label>
                  <input
                    id={tokenFieldId}
                    value={tokenInput}
                    onChange={(event) => setTokenInput(event.target.value)}
                    className={inputClasses}
                    placeholder="demo-token"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor={emailFieldId} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </label>
                  <input
                    id={emailFieldId}
                    value={emailInput}
                    onChange={(event) => setEmailInput(event.target.value)}
                    className={inputClasses}
                    placeholder="you@example.com"
                    type="email"
                  />
                </div>
                <div>
                  <label htmlFor={baseUrlFieldId} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    API base URL
                  </label>
                  <input
                    id={baseUrlFieldId}
                    value={baseUrlInput}
                    onChange={(event) => setBaseUrlInput(event.target.value)}
                    className={inputClasses}
                    placeholder={baseUrl}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setAuthOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            ) : null}
            <Button
              variant="outline"
              onClick={() => (isAuthenticated ? signOut() : setAuthOpen((prev) => !prev))}
            >
              {isAuthenticated ? 'Sign out' : 'Sign in'}
            </Button>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/docs">API Docs</Link>
          </Button>
          <Button asChild>
            <Link href="/request-demo">Request demo</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
