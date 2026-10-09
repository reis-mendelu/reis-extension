import { useEffect, useRef } from 'react';
import { fitWithin } from '../../utils/societies/encodePartnerMark';

const W = 192;
const H = 48;

/**
 * Wide preview of a picked partner mark, aspect kept, on whatever background
 * the caller paints (light or dark mode). Canvas rather than an object-URL
 * <img>, for the same CodeQL reason as LogoPreview; the effect only paints.
 */
export function MarkPreview({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bitmap = await createImageBitmap(file);
        const ctx = canvasRef.current?.getContext('2d');
        if (!cancelled && ctx) {
          const { w, h } = fitWithin(bitmap.width, bitmap.height, W, H);
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(bitmap, (W - w) / 2, (H - h) / 2, w, h);
        }
        bitmap.close();
      } catch {
        // Unreadable image: blank preview; Save reports it through the encoder.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  return <canvas ref={canvasRef} width={W} height={H} aria-hidden="true" className="h-12 w-48" />;
}
