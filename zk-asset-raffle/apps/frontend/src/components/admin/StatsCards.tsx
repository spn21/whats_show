import { Card } from '@/components/ui';
import { Activity, Users, Trophy } from 'lucide-react';

export function StatsCards({
  activeCount,
  totalTickets,
  completedCount,
}: {
  activeCount: number;
  totalTickets: number;
  completedCount: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card variant="glass" className="text-center">
        <div className="p-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold gradient-text">{activeCount}</div>
          <div className="text-muted-foreground">Active Raffles</div>
        </div>
      </Card>

      <Card variant="glass" className="text-center">
        <div className="p-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-secondary/10">
            <Users className="h-6 w-6 text-secondary" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold gradient-text">{totalTickets}</div>
          <div className="text-muted-foreground">Total Tickets</div>
        </div>
      </Card>

      <Card variant="glass" className="text-center">
        <div className="p-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10">
            <Trophy className="h-6 w-6 text-accent" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold gradient-text">{completedCount}</div>
          <div className="text-muted-foreground">Completed</div>
        </div>
      </Card>
    </div>
  );
}
