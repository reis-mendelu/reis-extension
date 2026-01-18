import { useState, useEffect } from 'react';
import { StorageService } from '../services/storage/StorageService';
import { getFacultySync, getErasmusSync } from '../utils/userParams';
import { FACULTY_TO_ASSOCIATION } from '../services/spolky/config';

// Old key for migration
const LEGACY_STORAGE_KEY = 'reis_opted_in_associations';
// New key for full list
const STORAGE_KEY = 'reis_subscribed_associations';

export function useSpolkySettings() {
  // Initialize state synchronously from storage
  const [subscribedAssociations, setSubscribedAssociations] = useState<string[]>(() => {
    // 1. Try to get new full list
    const saved = StorageService.get<string[]>(STORAGE_KEY);
    
    if (saved) {
      return saved;
    }

    // 2. If no new list, check for migration or first run
    const legacyOptIns = StorageService.get<string[]>(LEGACY_STORAGE_KEY) || [];
    
    // Determine defaults
    const defaults: string[] = [];
    
    // Add home faculty association
    const facultyId = getFacultySync();
    if (facultyId && FACULTY_TO_ASSOCIATION[facultyId]) {
      defaults.push(FACULTY_TO_ASSOCIATION[facultyId]);
    }
    
    // Add ESN for Erasmus students
    if (getErasmusSync()) {
      defaults.push('esn');
    }

    // Combine defaults with any legacy opt-ins
    const initialList = Array.from(new Set([...defaults, ...legacyOptIns]));
    
    // Save immediately so subsequent reads find it
    StorageService.set(STORAGE_KEY, initialList);
    
    // Clean up legacy if it existed
    if (StorageService.has(LEGACY_STORAGE_KEY)) {
      StorageService.remove(LEGACY_STORAGE_KEY);
    }

    return initialList;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Listen for changes from other components/hooks
  useEffect(() => {
    const loadSettings = () => {
      const saved = StorageService.get<string[]>(STORAGE_KEY);
      if (saved) {
        setSubscribedAssociations(saved);
      }
    };

    const handleStorageChange = () => loadSettings();
    window.addEventListener('reis-spolky-settings-changed', handleStorageChange);
    
    return () => {
      window.removeEventListener('reis-spolky-settings-changed', handleStorageChange);
    };
  }, []);

  const toggleAssociation = (associationId: string) => {
    setSubscribedAssociations(current => {
      const newSettings = current.includes(associationId)
        ? current.filter(id => id !== associationId)
        : [...current, associationId];
      
      StorageService.set(STORAGE_KEY, newSettings);
      
      // Dispatch event to notify other components
      window.dispatchEvent(new Event('reis-spolky-settings-changed'));
      
      return newSettings;
    });
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
