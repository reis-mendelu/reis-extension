import { useState, useEffect, useCallback } from 'react';
import { IndexedDBService } from '../services/storage'; 
import { FACULTY_TO_ASSOCIATION } from '../services/spolky/config';

// New key for full list
const STORAGE_KEY = 'reis_subscribed_associations';

export function useSpolkySettings() {
  const [subscribedAssociations, setSubscribedAssociations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const loadSettings = useCallback(async () => {
      try {
          // 1. Try to get new full list
          let saved = await IndexedDBService.get('meta', STORAGE_KEY) as string[];
          
          if (!saved) {
              // Determine defaults
              const defaults: string[] = [];
              const userParams = await IndexedDBService.get('meta', 'reis_user_params') as any;
              const facultyId = userParams?.faculty;
              const erasmus = userParams?.isErasmus;

              if (facultyId && FACULTY_TO_ASSOCIATION[facultyId]) {
                defaults.push(FACULTY_TO_ASSOCIATION[facultyId]);
              }
              
              if (erasmus) {
                defaults.push('esn');
              }
              
              saved = defaults;
              // Save defaults
              await IndexedDBService.set('meta', STORAGE_KEY, saved);
          }
          
          setSubscribedAssociations(saved);
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
      ? subscribedAssociations.filter(id => id !== associationId)
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
