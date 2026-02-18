import { useState, useEffect, useCallback } from 'react';
import { IndexedDBService } from '../services/storage'; 
import { FACULTY_TO_ASSOCIATION } from '../services/spolky/config';
import { getUserParams } from '../utils/userParams';

// New key for full list
const STORAGE_KEY = 'reis_subscribed_associations';

export function useSpolkySettings() {
  const [subscribedAssociations, setSubscribedAssociations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const loadSettings = useCallback(async () => {
      try {
          // 1. Try to get new full list
          let saved = await IndexedDBService.get('meta', STORAGE_KEY) as string[] | undefined;
          
          if (!saved) {
              // Determine defaults
              const userParams = await getUserParams();
              
              if (userParams) {
                  const defaults: string[] = [];
                  const facultyId = userParams.facultyId;
                  const erasmus = userParams.isErasmus;

                  if (facultyId && FACULTY_TO_ASSOCIATION[facultyId]) {
                    defaults.push(FACULTY_TO_ASSOCIATION[facultyId]);
                  }
                  
                  if (erasmus) {
                    defaults.push('esn');
                    await IndexedDBService.set('meta', 'reis_erasmus_auto_subscribed', true);
                  }
                  
                  saved = defaults;
                  // Save defaults only if we had userParams to determine them
                  await IndexedDBService.set('meta', STORAGE_KEY, saved);
              }
          }
          
          if (saved) {
              setSubscribedAssociations(saved);
              
              // NEW: Robust auto-subscription for existing users who haven't been auto-subscribed yet
              const userParams = await getUserParams();
              if (userParams?.isErasmus && !saved.includes('esn')) {
                  const autoSubscribedFlag = await IndexedDBService.get('meta', 'reis_erasmus_auto_subscribed');
                  if (!autoSubscribedFlag) {
                      const updated = [...saved, 'esn'];
                      setSubscribedAssociations(updated);
                      await IndexedDBService.set('meta', STORAGE_KEY, updated);
                      await IndexedDBService.set('meta', 'reis_erasmus_auto_subscribed', true);
                      console.log('[useSpolkySettings] Auto-subscribed Erasmus/foreign student to ESN');
                  }
              }
          }
      } catch (err) {
          console.error('[useSpolkySettings] Failed to load settings:', err);
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Listen for changes from other tabs/components
  useEffect(() => {
    const handleStorageChange = () => {
        // Re-load from IndexedDB when notified of changes
        loadSettings();
    };
    
    window.addEventListener('reis-spolky-settings-changed', handleStorageChange);
    return () => {
      window.removeEventListener('reis-spolky-settings-changed', handleStorageChange);
    };
  }, [loadSettings]);

  const toggleAssociation = async (associationId: string) => {
    const newSettings = subscribedAssociations.includes(associationId)
      ? subscribedAssociations.filter((id: string) => id !== associationId)
      : [...subscribedAssociations, associationId];
    
    setSubscribedAssociations(newSettings);
    
    try {
        await IndexedDBService.set('meta', STORAGE_KEY, newSettings);
        // Dispatch event for other hooks in the same tab
        window.dispatchEvent(new Event('reis-spolky-settings-changed'));
    } catch (err) {
        console.error('[useSpolkySettings] Failed to save setting:', err);
    }
  };

  const isSubscribed = (associationId: string) => {
    return subscribedAssociations.includes(associationId);
  };

  return {
    subscribedAssociations,
    toggleAssociation,
    isSubscribed,
    isLoading
  };
}
