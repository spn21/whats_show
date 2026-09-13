import { Button, Card, Input, SectionHeader } from "@/components/ui";
import { Target, PlusCircle, Trash2 } from "lucide-react";

export interface PrizeTier {
  name: string;
  quantity: string;
  winningPercentage: string;
}

export function PrizeTierList({
  prizeTiers,
  error,
  onAdd,
  onInsertAfter,
  onRemove,
  onUpdate,
}: {
  prizeTiers: PrizeTier[];
  error?: string;
  onAdd: () => void;
  onInsertAfter?: (index: number) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof PrizeTier, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Target className="h-5 w-5" />} title="Prize Configuration" colorClass="secondary" />
      {/* Single card containing header + all rows for perfect alignment */}
      <Card className="overflow-hidden">
        {/* Header row */}
        <div className="hidden md:grid gap-4 px-6 py-4 text-xs uppercase tracking-wide text-muted-foreground md:[grid-template-columns:1.5fr_0.6fr_0.6fr_1fr]">
          <div>Prize Name</div>
          <div>Quantity</div>
          <div>Win Rate (%)</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Data rows */}
        <div className="divide-y divide-border/50">
          {prizeTiers.map((tier, index) => (
            <div
              key={index}
              className="px-4 sm:px-6 py-4 grid grid-cols-1 gap-4 items-center md:[grid-template-columns:1.5fr_0.6fr_0.6fr_1fr]"
            >
              <div className="space-y-2 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 md:hidden">
                  Prize Name
                </div>
                <Input
                  placeholder="e.g., iPhone 15"
                  value={tier.name}
                  onChange={(e) => onUpdate(index, 'name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 md:hidden">
                  Quantity
                </div>
                <Input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={tier.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
                  className="w-full md:w-24"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 md:hidden">
                  Win Rate (%)
                </div>
                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={tier.winningPercentage}
                  onChange={(e) => onUpdate(index, 'winningPercentage', e.target.value)}
                  placeholder="5.0"
                  className="w-full md:w-24"
                  required
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 md:justify-end md:flex-nowrap w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onRemove(index)}
                  className="h-9 px-3 w-full sm:w-auto"
                  disabled={prizeTiers.length === 1}
                  title={prizeTiers.length === 1 ? 'At least one tier required' : 'Remove this tier'}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Remove
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (onInsertAfter ? onInsertAfter(index) : onAdd())}
                  className="h-9 px-3 w-full sm:w-auto"
                  title="Add a new tier below"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Below
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
