import React from 'react';
import { CreateRaffleForm } from '@/components/create';
import { Card, CardContent } from '@/components/ui';


export default function CreatePage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Launch Your Asset Raffle</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Set up a verifiable raffle for real-world assets using zero-knowledge proofs.
          Configure prizes, ticket counts, and deployment to blockchain.
        </p>
      </div>
      <Card variant="glass" className="max-w-4xl mx-auto">
        <CardContent>
          <CreateRaffleForm />
        </CardContent>
      </Card>
    </div>
  );
}
