/**
 * Builds order-chat functions bound to one app's Supabase client.
 *
 * The customer and rider apps talk to the exact same table (order_messages,
 * migration 013) with the exact same shape, so the query logic lives here
 * once rather than being copied — same reasoning as createUseSession in
 * @food-dash/session.
 *
 *   export const { fetchMessages, sendMessage, subscribeToMessages } =
 *     createOrderChat(supabase);
 */
export function createOrderChat(supabase) {
  function toMessage(row) {
    return {
      id: row.id,
      orderId: row.order_id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
    };
  }

  return {
    /** The whole thread for one order. RLS scopes this to its two parties. */
    async fetchMessages(orderId) {
      const { data, error } = await supabase
        .from('order_messages')
        .select('id, order_id, sender_id, body, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data.map(toMessage);
    },

    /**
     * Sends a message. The database is the authority on whether the window is
     * still open (rider assigned, not yet delivered) — a rejection here means
     * the order moved on while this screen was sitting idle, not a bug.
     */
    async sendMessage(orderId, body) {
      const trimmed = body.trim();
      if (!trimmed) return null;

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { data, error } = await supabase
        .from('order_messages')
        .insert({ order_id: orderId, sender_id: auth.user.id, body: trimmed })
        .select('id, order_id, sender_id, body, created_at')
        .single();

      if (error) throw error;
      return toMessage(data);
    },

    /** Pushes every new message on this order — the live thread. */
    subscribeToMessages(orderId, onInsert) {
      const channel = supabase
        .channel(`order-chat:${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'order_messages',
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => onInsert(toMessage(payload.new)),
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    },
  };
}
