import { useState, useEffect } from 'react';
import { logError } from '../utils/reportError';
import { getUserParams } from '../utils/userParams';
import type { UserParams } from '../utils/userParams';

export function useUserParams() {
    const [params, setParams] = useState<UserParams | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchParams() {
            try {
                const data = await getUserParams();
                if (mounted) {
                    setParams(data);
                }
            } catch (error) {
                logError('useUserParams', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchParams();

        return () => {
            mounted = false;
        };
    }, []);

    return { params, loading };
}
