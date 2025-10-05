'use client';

import { FormEvent, useState } from 'react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@local-office/ui';

export default function RequestDemoPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <Badge variant="outline">Get in touch</Badge>
          <CardTitle>Schedule a Local Office walkthrough</CardTitle>
          <CardDescription>
            Tell us about your lunch program needs and we&apos;ll share access to the employee, admin, and provider demos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <p className="text-sm text-emerald-600">
              Thanks! We&apos;ll reach out within one business day.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="company">
                  Company
                </label>
                <input
                  id="company"
                  name="company"
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <Button type="submit">Request demo</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
