import { ProgressBar } from "@/components/ui";

export function ProgressPanel({ step, percentage }: { step: string; percentage: number }) {
  return (
    <div className="space-y-4 p-6 bg-primary/5 border border-primary/20 rounded-xl">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
          <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">Processing</span>
        </div>
        <p className="text-sm text-muted-foreground">{step}</p>
      </div>
      <div className="max-w-md mx-auto w-full">
        <ProgressBar percent={percentage} />
        <div className="text-xs text-muted-foreground mt-1 text-right">{percentage}%</div>
      </div>
    </div>
  );
}
