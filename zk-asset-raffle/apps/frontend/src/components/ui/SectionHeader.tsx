import { ReactNode } from "react";

export function SectionHeader({
  icon,
  title,
  colorClass = "primary",
}: {
  icon?: ReactNode;
  title: string;
  colorClass?: "primary" | "secondary" | "accent";
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    accent: "bg-accent/10 text-accent",
  };

  return (
    <div className="flex items-center gap-3 pb-3 sm:pb-4 border-b border-border/50">
      <div className={`p-2 rounded-lg ${colorMap[colorClass]}`}>
        {icon}
      </div>
      <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
    </div>
  );
}
