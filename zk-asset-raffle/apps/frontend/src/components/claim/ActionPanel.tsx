import { Alert, AlertDescription, Button } from "@/components/ui";
import { Loader2, Gift, RefreshCw, Ticket as TicketIcon } from "lucide-react";

export function ActionPanel({
  status,
  isProcessing,
  isChecking,
  onClaim,
  onRedeem,
  onRefresh,
  canClaim,
}: {
  status: { isClaimed: boolean; isRedeemed: boolean; canRedeem: boolean } | null;
  isProcessing: boolean;
  isChecking: boolean;
  onClaim: () => void;
  onRedeem: () => void;
  onRefresh: () => void;
  canClaim: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        {status ? (
          <div className="space-y-4">
            {status.isRedeemed ? (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800">
                  🎉 Prize already redeemed for this ticket.
                </AlertDescription>
              </Alert>
            ) : status.isClaimed && status.canRedeem ? (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">
                    Ready to redeem your prize.
                  </AlertDescription>
                </Alert>
                <Button onClick={onRedeem} disabled={isProcessing} variant="gradient" className="w-full h-11">
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Redeem...
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4 mr-2" /> Redeem Prize
                    </>
                  )}
                </Button>
              </div>
            ) : status.isClaimed ? (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  Ticket claimed. Waiting for reveal to redeem.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Claim your ticket to join the raffle.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={onClaim}
                  disabled={isProcessing || !canClaim}
                  variant="gradient"
                  className="w-full h-11"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Claim...
                    </>
                  ) : (
                    <>
                      <TicketIcon className="h-4 w-4 mr-2" /> Claim Ticket
                    </>
                  )}
                </Button>
              </div>
            )}

            <Button onClick={onRefresh} disabled={isChecking} variant="outline" className="w-full h-10">
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh Status
                </>
              )}
            </Button>
          </div>
        ) : (
          <Alert>
            <AlertDescription>Checking your ticket status on the blockchain. Please wait a moment.</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
