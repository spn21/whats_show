'use client';

import React from 'react';
import { AdminDashboard, StatsCards } from '@/components/admin';

export default function Page() {
  const [stats, setStats] = React.useState({ activeCount: 0, totalTickets: 0, completedCount: 0 });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Raffle Management</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          View and manage your on-chain raffles, download QR codes, and handle reveals.
        </p>
      </div>

      <StatsCards
        activeCount={stats.activeCount}
        totalTickets={stats.totalTickets}
        completedCount={stats.completedCount}
      />

      <AdminDashboard onStatsChange={setStats} />
    </div>
  );
}
