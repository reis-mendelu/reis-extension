import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
