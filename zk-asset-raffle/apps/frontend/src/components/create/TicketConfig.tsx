import { Input, SectionHeader } from "@/components/ui";
import { Users } from "lucide-react";

export function TicketConfig({
  ticketCount,
  onChange,
  error,
}: {
  ticketCount: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Users className="h-5 w-5" />} title="Ticket Configuration" colorClass="accent" />
      <div className="w-full">
        <div className="space-y-2">
          <label className="text-sm font-medium">Number of Tickets/QR Codes</label>
          <Input
            type="number"
            min={1}
            max={10000}
            placeholder="100"
            value={ticketCount}
            onChange={(e) => onChange(e.target.value)}
            required
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              This will determine the number of proofs and QR codes generated (1-10,000)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
