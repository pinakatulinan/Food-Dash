import { createUseSession } from '@food-dash/session';
import { supabase } from './supabase';

export const useSession = createUseSession(supabase);
