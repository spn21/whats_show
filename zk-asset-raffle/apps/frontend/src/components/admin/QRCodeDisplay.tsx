'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui';
import { Download } from 'lucide-react';
import { saveAs } from 'file-saver';

interface QRCodeDisplayProps {
  data: string;
  size?: number;
  title?: string;
  downloadable?: boolean;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ 
  data, 
  size = 128, 
  title,
  downloadable = false
}) => {
  const downloadQRCode = () => {
    const svg = document.getElementById(`qr-code-${data}`) as HTMLElement;
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `qrcode-${title || data}.png`);
        }
      });
    };
    
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="border border-gray-200 rounded-lg p-2 bg-white">
        <QRCodeSVG
          id={`qr-code-${data}`}
          value={data}
          size={size}
          level="H"
          includeMargin={true}
        />
      </div>
      {title && <p className="text-sm font-medium mt-1">{title}</p>}
      {downloadable && (
        <Button
          variant="outline"
          size="icon"
          onClick={downloadQRCode}
          className="mt-1 h-8 w-8 p-0"
          aria-label="Download QR"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default QRCodeDisplay;
