export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-primary/20 h-2 rounded-full overflow-hidden">
      <div className="h-2 bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

