import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@local-office/ui';

const highlights = [
  {
    title: 'Cutoffs & batching',
    description:
      'Automated nightly batching locks orders at T-48h and prepares manifests, labels, and courier requests.'
  },
  {
    title: 'Loyalty & referrals',
    description:
      'Tiered loyalty automatically discounts invoices while referral credits apply to the next billing cycle.'
  },
  {
    title: 'Delivery confirmation',
    description:
      'Dispatch, Uber Direct, and Olo adapters capture proof and notify admins the moment meals arrive.'
  }
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="space-y-6">
          <Badge variant="success">Beta partners welcome</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Corporate lunch programs that run themselves.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Local Office connects employees, admins, and providers with transparent workflows from ordering to
            delivery confirmation. Build recurring programs, enforce cutoffs, generate labels, and reconcile invoices in
            one place.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" asChild>
              <Link href="/employee">Explore employee flow</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/admin">See admin controls</Link>
            </Button>
          </div>
        </div>
        <Card className="border-brand-200 bg-white/60 backdrop-blur">
          <CardHeader>
            <CardTitle>Today&apos;s batches</CardTitle>
            <CardDescription>Providers see a concise prep manifest by site, window, and provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-500">Downtown HQ · 11:45 – 12:15 · Provider A</p>
              <div className="mt-3 space-y-1 text-sm">
                <p>Margherita Pizza × 12</p>
                <p>Pepperoni Pizza × 18</p>
                <p>Veg Sandwich × 20</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-500">North Loop · 12:30 – 1:00 · Provider B</p>
              <div className="mt-3 space-y-1 text-sm">
                <p>Turkey Sandwich × 14</p>
                <p>Veg Sandwich × 11</p>
                <p>Roast Beef Sandwich × 9</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{item.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
