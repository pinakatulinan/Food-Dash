import { createUseSession } from '@kaon/session';
import { supabase } from './supabase';

export const useSession = createUseSession(supabase);
