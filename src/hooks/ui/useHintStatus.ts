import { useState, useEffect, useCallback } from 'react';
import { HintService } from '../../services/hints/HintService';

/**
 * useHintStatus
 *
 * Hook to manage the lifecycle of a discovery hint.
 * Automatically loads status on mount and provides a markSeen callback.
 *
 * @param hintId Unique identifier for the hint
 */
export function useHintStatus(hintId: string) {
  const [isSeen, setIsSeen] = useState<boolean>(true); // Default to seen to avoid flash
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    HintService.isSeen(hintId).then((seen) => {
      if (mounted) {
        setIsSeen(seen);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [hintId]);

  const markSeen = useCallback(async () => {
    setIsSeen(true);
    await HintService.markSeen(hintId);
  }, [hintId]);

  return { isSeen, markSeen, isLoading };
}
