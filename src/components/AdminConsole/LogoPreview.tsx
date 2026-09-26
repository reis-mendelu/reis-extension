import { useEffect, useRef } from 'react';
import { squareCrop } from '../../utils/societies/encodeSocietyLogo';

const SIDE = 64;

/**
 * Square preview of the picked file, drawn with the same centred crop the
 * upload gets, so what the admin sees is what students will see.
 *
 * Drawn on a canvas rather than handed to an <img> as an object URL: the file
 * never becomes a URL the DOM parses, which is the sink CodeQL's
 * "DOM text reinterpreted as HTML" rule flags. The effect only paints; it
 * fetches nothing.
 */
export function LogoPreview({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bitmap = await createImageBitmap(file);
        const ctx = canvasRef.current?.getContext('2d');
        if (!cancelled && ctx) {
          const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
          ctx.clearRect(0, 0, SIDE, SIDE);
          ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIDE, SIDE);
        }
        bitmap.close();
      } catch {
        // Unreadable image: the preview stays blank and Save reports the
        // failure through the encoder, which reads the same file.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <canvas
      ref={canvasRef}
      width={SIDE}
      height={SIDE}
      aria-hidden="true"
      className="h-16 w-16 rounded-md ring-1 ring-base-300"
    />
  );
}
