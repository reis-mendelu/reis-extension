import { useEffect, useMemo } from 'react';

/** Square preview of the picked file; the object URL is revoked when it changes. */
export function LogoPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <img src={url} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-base-300" />
  );
}
