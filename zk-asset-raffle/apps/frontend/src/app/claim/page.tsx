import React, { Suspense } from 'react';
import type { Metadata } from 'next/types';
import { ClaimForm } from '@/components/claim';

export const metadata: Metadata = {
  title: 'Scan QR Code | ZK Asset Raffle',
  description: 'Scan QR code to claim your asset using zero-knowledge proofs',
};

// Force dynamic rendering to avoid SSR issues with browser APIs
export const dynamic = 'force-dynamic';

export default function ClaimPage() {
  return (
    <div>
      <div className="max-w-md mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            <span className="gradient-text">Claim</span> Asset
          </h1>
          <p className="text-muted-foreground">
            Scan the QR code to claim your asset
          </p>
        </div>

        <Suspense fallback={<div className="glass-effect h-[400px] w-full rounded-xl animate-pulse" />}>
          <ClaimForm />
        </Suspense>
      </div>
    </div>
  );
}
