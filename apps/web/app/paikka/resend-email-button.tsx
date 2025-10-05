'use client';

import { useState } from 'react';

import { Button } from '@local-office/ui';

import type { Order } from '../../lib/types';

type Props = {
  order: Order;
  jwt: string;
};

type Status = 'idle' | 'loading' | 'success' | 'error';

export function ResendEmailButton({ order, jwt }: Props) {
  const [status, setStatus] = useState<Status>('idle');

  const handleClick = async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/paikka/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order, jwt })
      });

      if (!response.ok) {
        throw new Error('Failed to resend email');
      }

      setStatus('success');
    } catch (error) {
      console.error('Resend email failed', error);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" onClick={handleClick} disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending…' : status === 'success' ? 'Email resent' : 'Resend email'}
      </Button>
      {status === 'error' && <p className="text-sm text-red-600">We couldn&apos;t resend the email. Try again shortly.</p>}
      {status === 'success' && <p className="text-sm text-green-600">Email sent. Check your inbox in a moment.</p>}
    </div>
  );
}
