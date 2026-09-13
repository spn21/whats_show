import React, { useState } from 'react';
import { Alert, AlertDescription, Badge, Button } from '@/components/ui';
import QRCodeDisplay from './QRCodeDisplay';
import { QrCode, RefreshCw, Download, ChevronRight } from 'lucide-react';

export function QRCodeSection({
  activityId,
  items,
  onDownload,
  onRefresh,
}: {
  activityId: string;
  items: { sid: string; encrypted_data: string }[];
  onDownload: () => void;
  onRefresh: () => void;
}) {
  const [displayCount, setDisplayCount] = useState(10);

  if (!items || items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-lg">QR Codes</h4>
          </div>
          <Button variant="outline" className="h-9 px-3 w-full sm:w-auto" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
        <Alert>
          <AlertDescription>No QR codes found. Click refresh to load items.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-lg">QR Codes</h4>
          <Badge variant="secondary">{items.length} total</Badge>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" className="h-9 px-3 w-full sm:w-auto" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button variant="default" className="h-9 px-3 w-full sm:w-auto" onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" /> Download All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.slice(0, displayCount).map((item, index) => {
          const qrData = {
            sid: item.sid,
            encrypted_data: item.encrypted_data,
            raffleId: activityId,
          };
          const qrDataString = JSON.stringify(qrData);
          return (
            <div key={item.sid} className="flex flex-col items-center p-3 bg-card border border-border rounded-lg hover-lift transition-all duration-200">
              <QRCodeDisplay data={qrDataString} title={`#${index + 1}`} downloadable size={100} />
              <div className="mt-2 text-center space-y-1">
                <Badge className="font-mono text-xs">{item.sid.substring(0, 6)}...</Badge>
              </div>
            </div>
          );
        })}
      </div>

      {items.length > displayCount && (
        <div className="text-center">
          <Button
            variant="outline"
            className="h-9 px-3"
            onClick={() => setDisplayCount((prev) => Math.min(prev + 12, items.length))}
          >
            <ChevronRight className="h-4 w-4 mr-1" /> Show More ({items.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
