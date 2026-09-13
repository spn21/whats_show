'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Alert, AlertDescription, Button } from '@/components/ui';
import { Camera, X, AlertCircle, Keyboard } from 'lucide-react';
import ClaimTicketPanel from './ClaimTicketPanel';
import { ManualInputPanel } from './ManualInputPanel';

interface QRCodeScannerProps {
  onScan?: (data: { plaintext: string, encrypted: string }) => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [scanResult, setScanResult] = useState<{ plaintext: string, encrypted: string } | null>(null);
  const scannerRef = useRef<unknown>(null);
  const [qrData, setQrData] = useState<{
    sid: string;
    encrypted_data: string;
    raffleId: string;
    activity_id?: string;
  } | null>(null);

  // Manual input mode state
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('scan');
  const [manualInput, setManualInput] = useState('');

  // 停止扫描
  const stopScanning = useCallback(() => {
    if (scannerRef.current) {
      try {
        (scannerRef.current as { stop: () => void }).stop();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Parse and handle scanned QR data
  const handleQRData = useCallback((data: string) => {
    try {
      const parsedData = JSON.parse(data);

      // Validate required fields for ZkAssetRaffle format
      if (parsedData.sid && parsedData.encrypted_data) {
        const raffleId = parsedData.raffleId || parsedData.activity_id;

        if (!raffleId) {
          setError('Invalid QR code format - missing raffleId');
          return;
        }

        const enrichedData = {
          ...parsedData,
          raffleId: raffleId
        };

        setQrData(enrichedData);
        setScanResult({
          plaintext: `SID: ${parsedData.sid}`,
          encrypted: `Raffle: ${raffleId}`
        });
        // Show claim panel immediately after processing data
        stopScanning();
      } else {
        setError('Invalid QR code format - missing sid or encrypted_data');
      }
    } catch (err) {
      console.error('Failed to parse QR data:', err);
      setError('Invalid QR code data');
    }
  }, [stopScanning]);

  // Handle manual input submission
  const handleManualSubmit = useCallback(() => {
    setError(null);

    if (!manualInput.trim()) {
      setError('Please enter QR code JSON data');
      return;
    }

    try {
      JSON.parse(manualInput);
      handleQRData(manualInput);
    } catch (err) {
      console.error('Failed to parse manual input:', err);
      setError('Invalid JSON format. Please enter valid QR code data.');
    }
  }, [manualInput, handleQRData]);

  // Reset form
  const resetForm = useCallback(() => {
    setQrData(null);
    setScanResult(null);
    setError(null);
    setManualInput('');
  }, []);

  // Handle check status button click
  // 开始扫描
  const startScanning = useCallback(async () => {
    if (typeof window === 'undefined') {
      setError('Camera access not available');
      return;
    }

    setError(null);
    setIsScanning(true);

    try {
      // 动态导入html5-qrcode
      const { Html5QrcodeScanner } = await import('html5-qrcode');

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      scannerRef.current = new Html5QrcodeScanner('qr-scanner', config, false);

      scannerRef.current.render(
        (decodedText: string) => {
          handleQRData(decodedText);
        },
        () => {
          // 静默处理扫描错误，这些在没有QR码时很正常
        }
      );
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setError('Failed to initialize QR scanner. Please try manual input.');
      setIsScanning(false);
    }
  }, [handleQRData]);

  // 检查摄像头可用性
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const checkCamera = async () => {
      try {
        // 检查是否在安全上下文中
        if (window.location.protocol !== 'https:' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1') {
          setError('Camera access requires a secure connection (HTTPS).');
          setHasCamera(false);
          return;
        }

        // 检查浏览器是否支持getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Your browser does not support camera access.');
          setHasCamera(false);
          return;
        }

        // 测试摄像头权限
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setHasCamera(true);
      } catch (err) {
        console.error('Camera access error:', err);
        setError('Unable to access camera. Please ensure camera permissions are granted.');
        setHasCamera(false);
      }
    };

    checkCamera();

    // 清理函数
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {/* Mode Selection */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 w-full">
        <Button
          variant={inputMode === 'scan' ? 'default' : 'outline'}
          onClick={() => {
            setInputMode('scan');
            resetForm();
          }}
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Camera className="h-4 w-4" />
          Scan QR Code
        </Button>
        <Button
          variant={inputMode === 'manual' ? 'default' : 'outline'}
          onClick={() => {
            setInputMode('manual');
            resetForm();
            stopScanning();
          }}
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Keyboard className="h-4 w-4" />
          Manual Input
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="w-full max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Scan Mode */}
      {inputMode === 'scan' && (
        <div className="w-full flex flex-col items-center">
          <div id="qr-scanner" className="w-full max-w-sm"></div>
          <div className="mt-4 w-full max-w-sm">
            {isScanning ? (
              <Button variant="secondary" onClick={stopScanning} className="w-full">
                <X className="h-4 w-4 mr-2" />
                Stop Scanning
              </Button>
            ) : (
              <Button onClick={startScanning} disabled={!hasCamera} className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Start Scanner
              </Button>
            )}
          </div>
          {scanResult && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg w-full max-w-sm">
              <p className="text-sm font-medium text-green-800">QR Code Scanned Successfully</p>
              <p className="text-xs text-green-700 mt-1">
                {scanResult.plaintext.substring(0, 50)}
                {scanResult.plaintext.length > 50 ? '...' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Manual Input Mode */}
      {inputMode === 'manual' && (
        <ManualInputPanel
          value={manualInput}
          onChange={setManualInput}
          onSubmit={handleManualSubmit}
          onClear={resetForm}
          disabled={!manualInput.trim()}
        />
      )}

      {/* QR Code Data Display and Check/Claim Component */}
      {qrData && scanResult && (
        <div className="w-full max-w-md mt-4">
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">Ticket Data Ready</p>
            <div className="text-xs text-green-700 space-y-1">
              <p><strong>SID:</strong> {qrData.sid}</p>
              <p><strong>Raffle ID:</strong> {qrData.raffleId || 'N/A'}</p>
              <p><strong>Activity ID:</strong> {qrData.activity_id || 'N/A'}</p>
              <p><strong>Encrypted Data:</strong> {qrData.encrypted_data.substring(0, 30)}...</p>
            </div>
          </div>

          <div className="space-y-3">
            <ClaimTicketPanel
              qrData={qrData}
              autoCheckStatus
              onClaimSuccess={() => {
                // Allow user to see result
              }}
            />
            <Button
              onClick={resetForm}
              variant="outline"
              className="w-full"
            >
              Scan Another QR Code
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeScanner;
