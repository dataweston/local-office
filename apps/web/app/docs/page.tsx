import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@local-office/ui';

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">API & schema documentation</h1>
        <p className="max-w-2xl text-slate-600">
          Machine-readable OpenAPI specs, JSON schemas, and webhook contracts live in the @local-office/contracts
          package.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <Link className="text-brand-600 hover:underline" href="https://github.com">OpenAPI spec (local)</Link>
          </p>
          <CardDescription>
            The OpenAPI document is ready for bundling via <code>pnpm --filter @local-office/contracts bundle</code>.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
