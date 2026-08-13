import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCodeBox({ url, size = 140 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 1,
        color: { dark: '#111827', light: '#FFFFFF' },
      });
    }
  }, [url, size]);

  return (
    <div className="inline-flex flex-col items-center gap-2 bg-white border rounded-xl p-4" style={{ borderColor: '#E5E7EB' }}>
      <canvas ref={canvasRef} />
      <p className="text-[11px] text-center" style={{ color: '#6B7280' }}>Scan to view this profile</p>
    </div>
  );
}
