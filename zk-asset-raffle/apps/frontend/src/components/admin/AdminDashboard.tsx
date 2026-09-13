'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card, Modal, Skeleton, useToast } from '@/components/ui';
import { useAccount } from 'wagmi';
import { useActivityItemsFetcher, useActivitiesByCreator, useDeleteActivity } from '@/hooks/useActivityApi';
import { useChainAdapter } from '@/chains/useChainAdapter';
// child components are composed inside ActivityCard
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Plus, Activity } from 'lucide-react';
//
import { ActivityCard } from './ActivityCard';
import RevealKeyDialog from './RevealKeyDialog';
import { QRCodeSection } from './QRCodeSection';

interface ActivityRow {
  id: string;            // activity_id
  name: string;          // activity name
  chainState?: number;   // 0=Created,1=Committed,2=Revealed,3=Closed
  createdAt?: string;    // creation timestamp
  totalItems?: number;   // total ticket count
}

export default function AdminDashboard({
  onStatsChange,
}: {
  onStatsChange?: (stats: { activeCount: number; totalTickets: number; completedCount: number }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ActivityRow[]>([]);
  // Read-only user activities; reveal actions removed to avoid confusion with ZkAssetRaffle flow
  
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const { adapter } = useChainAdapter();
  const { data: activitiesResp, isLoading: isActivitiesLoading } = useActivitiesByCreator(
    address ? address.toLowerCase() : undefined,
    isConnected
  );
  const { fetchActivityItems } = useActivityItemsFetcher();
  const { deleteActivity } = useDeleteActivity();
  // Inline expanders removed; actions open in modal from ActivityCard
  type ActivityItem = { sid: string; encrypted_data: string };
  const [qrCodeItems, setQrCodeItems] = useState<Record<string, ActivityItem[]>>({});
  // No chain interactions here; use the dedicated RevealKey tab instead

  // Global modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<null | 'qr' | 'reveal' | 'delete'>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(isActivitiesLoading);
    if (!activitiesResp) return;
    if (activitiesResp.status === 'success') {
      const rows: ActivityRow[] = ((activitiesResp.activities || []) as Array<{ activity_id: string; name?: string; created_at?: string; total_items?: number }>).map((a) => ({
        id: a.activity_id,
        name: a.name || `Raffle ${a.activity_id.substring(0, 8)}`,
        createdAt: a.created_at,
        totalItems: a.total_items,
      }));
      setEntries(rows);

      // Fetch on-chain state for each activity (best-effort)
      Promise.all(rows.map(async (row) => {
        try {
          const raffle = await adapter.getRaffle(row.id);
          const stateNum = raffle.state ?? 0;
          return { ...row, chainState: stateNum } as ActivityRow;
        } catch {
          return row;
        }
      })).then((updated) => setEntries(updated));
    } else if (activitiesResp.status === 'error') {
      toast({ title: 'Error', description: activitiesResp.message || 'Failed to load activities', variant: 'destructive' });
    }
  }, [isConnected, address, adapter, toast, activitiesResp, isActivitiesLoading]);

  // Notify parent about stats when entries change
  React.useEffect(() => {
    if (!onStatsChange) return;
    const activeCount = entries.length;
    const totalTickets = entries.reduce((sum, e) => sum + (e.totalItems || 0), 0);
    const completedCount = entries.filter((e) => e.chainState === 2 || e.chainState === 3).length;
    onStatsChange({ activeCount, totalTickets, completedCount });
  }, [entries, onStatsChange]);

  // Function to load QR code items for a specific activity
  const loadQRCodeItems = async (activityId: string) => {
    try {
      const resp = await fetchActivityItems(activityId);
      if (resp.status === 'success' && resp.items) {
        setQrCodeItems(prev => ({ ...prev, [activityId]: resp.items }));
      } else {
        toast({ 
          title: 'Error', 
          description: resp.message || 'Failed to load QR code items', 
          variant: 'destructive' 
        });
      }
    } catch (e) {
      console.error(e);
      toast({ 
        title: 'Error', 
        description: 'Failed to load QR code items', 
        variant: 'destructive' 
      });
    }
  };

  // Function to download all QR codes as ZIP
  const downloadQRCodes = async (activityId: string) => {
    const items = qrCodeItems[activityId];
    if (!items || items.length === 0) {
      toast({
        title: 'Error',
        description: 'No QR code items available to download',
        variant: 'destructive'
      });
      return;
    }

    try {
      const zip = new JSZip();
      const qrFolder = zip.folder('qrcodes');
      
      if (!qrFolder) return;
      
      let infoText = `Raffle ID: ${activityId}\n`;
      infoText += `Total QR Codes: ${items.length}\n`;
      infoText += `Created: ${new Date().toLocaleString()}\n\n`;
      infoText += `QR Code Information:\n`;
      
      items.forEach((item, index) => {
        // Create QR data in ZkAssetRaffle format
        const qrData = {
          sid: item.sid,
          encrypted_data: item.encrypted_data,
          raffleId: activityId
        };
        
        const qrDataString = JSON.stringify(qrData);
        
        infoText += `${index + 1}. SID: ${item.sid}\n`;
        
        // Save QR code data as JSON file
        qrFolder.file(`qr_${item.sid}.json`, qrDataString);
        
        // Save as claim URL
        const claimUrl = `${window.location.origin}/claim?data=${encodeURIComponent(qrDataString)}`;
        qrFolder.file(`qr_${item.sid}_url.txt`, claimUrl);
      });
      
      zip.file('raffle_info.txt', infoText);
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `raffle_${activityId}_qrcodes.zip`);
      
      toast({
        title: 'Success',
        description: 'QR codes downloaded successfully!',
        variant: 'default'
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to download QR codes',
        variant: 'destructive'
      });
    }
  };

  const openQRModal = async (activityId: string) => {
    setActiveId(activityId);
    setModalType('qr');
    await loadQRCodeItems(activityId);
    setModalOpen(true);
  };

  const openRevealModal = (activityId: string) => {
    setActiveId(activityId);
    setModalType('reveal');
    setModalOpen(true);
  };

  const openDeleteModal = (activityId: string) => {
    setActiveId(activityId);
    setModalType('delete');
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!activeId) return;
    setIsDeleting(true);
    try {
      const resp = await deleteActivity(activeId);
      if (resp.status === 'success') {
        setEntries(prev => prev.filter(e => e.id !== activeId));
        setQrCodeItems(prev => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [activeId]: _, ...rest } = prev;
          return rest;
        });
        toast({ title: 'Deleted', description: `Activity ${activeId} removed from backend.` });
        setModalOpen(false);
      } else {
        toast({ title: 'Error', description: resp.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // no date display for now

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card variant="glass" className="p-8">
          <div className="space-y-6">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {entries.length === 0 ? (
        <div>
          <Card variant="glass" className="text-center py-16">
            <div className="space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-muted/20 rounded-full">
                <Activity className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold">No raffles found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You haven’t created any raffles yet. Create your first raffle to get started with managing QR codes and results!
                </p>
              </div>
              <Button
                variant="gradient"
                className="h-11 px-6 w-full sm:w-auto"
                onClick={() => window.location.href = '/create'}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Raffle
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => (
            <div key={entry.id} className="w-full min-h-[240px]">
              <ActivityCard
                entry={entry}
                onLoadQR={() => loadQRCodeItems(entry.id)}
                onOpenQR={() => openQRModal(entry.id)}
                onOpenReveal={() => openRevealModal(entry.id)}
                onDelete={() => openDeleteModal(entry.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Global Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalType === 'qr' ? 'QR Codes' : modalType === 'reveal' ? 'Reveal Encryption Key' : modalType === 'delete' ? 'Delete Activity' : ''}
        maxWidthClass={modalType === 'qr' ? 'max-w-6xl' : 'max-w-3xl'}
      >
        {modalType === 'qr' && activeId && (
          <QRCodeSection
            activityId={activeId}
            items={qrCodeItems[activeId] || []}
            onDownload={() => downloadQRCodes(activeId)}
            onRefresh={() => loadQRCodeItems(activeId)}
          />
        )}
        {modalType === 'reveal' && activeId && (
          <RevealKeyDialog
            raffleId={activeId}
            onRevealSuccess={() =>
              toast({ title: 'Success', description: 'Encryption key revealed on-chain', variant: 'default' })
            }
          />
        )}
        {modalType === 'delete' && activeId && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently remove the activity and all its items from the backend database. On‑chain data is not affected.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <Button variant="outline" className="h-9 px-3 w-full sm:w-auto" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-9 px-3 w-full sm:w-auto"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}



// QR Code Section Component
/*
function QRCodeSection({ 
  activityId, 
  items, 
  onDownload, 
  onRefresh 
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-lg">QR Codes</h4>
          </div>
          <Button 
            variant="outline" 
            className="h-9 px-3"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
        <Alert>
          <AlertDescription>
            No QR codes found. Click refresh to load items.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-lg">QR Codes</h4>
          <Badge variant="secondary">{items.length} total</Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            className="h-9 px-3"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button 
            variant="default"
            className="h-9 px-3"
            onClick={onDownload}
          >
            <Download className="h-4 w-4 mr-2" /> Download All
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.slice(0, displayCount).map((item, index) => {
          const qrData = {
            sid: item.sid,
            encrypted_data: item.encrypted_data,
            raffleId: activityId
          };
          
          const qrDataString = JSON.stringify(qrData);
          
          return (
            <div
              key={item.sid}
              className="flex flex-col items-center p-3 bg-card border border-border rounded-lg hover-lift transition-all duration-200"
            >
              <QRCodeDisplay 
                data={qrDataString}
                title={`#${index + 1}`}
                downloadable
                size={100}
              />
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
            onClick={() => setDisplayCount(prev => Math.min(prev + 12, items.length))}
          >
            <ChevronRight className="h-4 w-4 mr-1" /> Show More ({items.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
*/
