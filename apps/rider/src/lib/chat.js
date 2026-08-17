import { createOrderChat } from '@food-dash/chat';
import { supabase } from './supabase';

export const { fetchMessages, sendMessage, subscribeToMessages } = createOrderChat(supabase);
