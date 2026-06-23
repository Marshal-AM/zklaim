import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface QrDisplayProps {
  value: string;
  label?: string;
}

export function QrDisplay({ value, label }: QrDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, { width: 220, margin: 2 });
    }
  }, [value]);

  async function copyLink() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-lg bg-white p-2" />
      {label && <p className="text-sm text-slate-400">{label}</p>}
      <button
        type="button"
        onClick={copyLink}
        className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:border-slate-500"
      >
        {copied ? "Copied!" : "Copy deep link"}
      </button>
    </div>
  );
}
