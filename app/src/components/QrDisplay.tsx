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
      <div className="rounded-xl bg-white p-3">
        <canvas ref={canvasRef} />
      </div>
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : null}
      <button type="button" onClick={copyLink} className="btn-outline-primary text-xs">
        {copied ? "Copied!" : "Copy deep link"}
      </button>
    </div>
  );
}
