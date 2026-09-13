import React from 'react';
import { Button, Card } from '@/components/ui';
import { Calendar, Users, Activity, Eye, CheckCircle, QrCode, Trash2 } from 'lucide-react';
import { getRaffleStateText, shortHash } from '@/utils/raffle';

export interface ActivityRow {
  id: string;
  name: string;
  chainState?: number;
  createdAt?: string;
  totalItems?: number;
}

export function ActivityCard({
  entry,
  onLoadQR,
  onOpenQR,
  onOpenReveal,
  onDelete,
}: {
  entry: ActivityRow;
  onLoadQR: () => void;
  onOpenQR: () => void;
  onOpenReveal: () => void;
  onDelete: () => void;
}) {
  const stateText = getRaffleStateText(entry.chainState ?? null);
  const statusInfo = (() => {
    switch (entry.chainState) {
      case 0: return { label: stateText, icon: Activity, desc: 'Ready to commit' };
      case 1: return { label: stateText, icon: Activity, desc: 'Participants can claim' };
      case 2: return { label: stateText, icon: Eye, desc: 'Results available' };
      case 3: return { label: stateText, icon: CheckCircle, desc: 'Raffle ended' };
      default: return { label: stateText, icon: Activity, desc: 'Status unclear' };
    }
  })();
  const StatusIcon = statusInfo.icon;

  // Colorful status pill styles (bigger, with clear state colors)
  const statusClasses = (() => {
    switch (entry.chainState) {
      case 0: // Created
        return 'bg-slate-100 border border-slate-200 text-slate-800';
      case 1: // Committed
        return 'bg-amber-100 border border-amber-200 text-amber-800';
      case 2: // Revealed
        return 'bg-emerald-100 border border-emerald-200 text-emerald-800';
      case 3: // Closed
        return 'bg-violet-100 border border-violet-200 text-violet-800';
      default:
        return 'bg-slate-100 border border-slate-200 text-slate-800';
    }
  })();

  const accentBarClasses = (() => {
    switch (entry.chainState) {
      case 0:
        return 'from-slate-300 to-slate-200';
      case 1:
        return 'from-amber-300 to-amber-200';
      case 2:
        return 'from-emerald-300 to-emerald-200';
      case 3:
        return 'from-violet-300 to-violet-200';
      default:
        return 'from-slate-300 to-slate-200';
    }
  })();

  return (
    <Card
      variant="glass"
      className="relative h-full w-full flex flex-col p-3 rounded-xl border border-border/60 bg-gradient-to-b from-background/80 to-muted/30 hover:border-primary/30 hover:shadow-md transition"
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${accentBarClasses}`} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-sm md:text-base font-semibold truncate">{entry.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-[11px] md:text-xs text-muted-foreground">
            <span className="font-mono">{shortHash(entry.id, 12)}</span>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] md:text-xs font-medium tracking-wide uppercase ${statusClasses}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusInfo.label}
        </div>
      </div>

      {/* Middle: centered stats to balance vertical space */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="grid grid-cols-2 gap-2 w-full">
          <div className="flex flex-col items-center justify-center rounded-lg px-1.5 py-2 bg-muted/60 border border-border/60 text-center">
            <div className="text-[11px] md:text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Tickets
            </div>
            <div className="text-sm md:text-base font-semibold">{entry.totalItems ?? '—'}</div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg px-1.5 py-2 bg-muted/60 border border-border/60 text-center">
            <div className="text-[11px] md:text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Created
            </div>
            <div className="text-sm md:text-base font-semibold">
              {entry.createdAt
                ? new Date(entry.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="h-9 sm:h-8 px-2 text-[11px] sm:text-xs w-full"
          onClick={() => {
            onLoadQR();
            onOpenQR();
          }}
          aria-label="Open QR codes"
        >
          <QrCode className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">QR Codes</span>
        </Button>
        <Button
          variant="gradient"
          className="h-9 sm:h-8 px-2 text-[11px] sm:text-xs w-full"
          onClick={() => onOpenReveal()}
          aria-label="Reveal raffle key"
        >
          <Eye className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Reveal</span>
        </Button>
        <Button
          variant="outline"
          className="h-9 sm:h-8 px-2 text-[11px] sm:text-xs w-full text-destructive border-destructive/40 hover:bg-destructive/10"
          onClick={onDelete}
          aria-label="Delete raffle"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Delete</span>
        </Button>
      </div>
    </Card>
  );
}
