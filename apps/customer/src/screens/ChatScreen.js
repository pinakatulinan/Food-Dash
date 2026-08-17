import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ScreenHeader, Input, Button, ErrorText } from '@food-dash/ui';
import { colors, browse, spacing, typography, radius } from '@food-dash/theme';
import { fetchMessages, sendMessage, subscribeToMessages } from '../lib/chat';
import { useSession } from '../lib/useSession';
import { Loading } from '../components/states';

// One thread per order, open only while a rider is actually carrying it —
// the database enforces that window (migration 013), this screen just
// reflects it. The call button on Tracking is still there for whoever would
// rather talk than type.
export default function ChatScreen({ route, navigation }) {
  const { orderId, orderNumber, peerName } = route.params;
  const { session } = useSession();
  const myId = session?.user?.id;

  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchMessages(orderId)
      .then((rows) => { if (active) setMessages(rows); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [orderId]);

  // Live: a reply from the rider appears with no polling and no refresh.
  useEffect(() => subscribeToMessages(orderId, (msg) => {
    setMessages((prev) => {
      if (!prev) return [msg];
      // The sender's own message already landed via the insert's response,
      // so the realtime echo of it is a duplicate, not a second message.
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }), [orderId]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(orderId, body);
      setMessages((prev) => (prev ? [...prev, msg] : [msg]));
    } catch (e) {
      // e.g. the order was marked delivered while this screen sat open.
      setError(e.message);
    }
    setSending(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={peerName || 'Chat'}
        subtitle={`Order #${orderNumber}`}
      />

      {messages === null ? (
        <Loading />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Say hello — {peerName || 'your rider'} will see it here.
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === myId;
            return (
              <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <ErrorText>{error}</ErrorText>
        <View style={styles.composerRow}>
          <View style={styles.composerInput}>
            <Input
              placeholder="Message…"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              returnKeyType="send"
              maxLength={500}
            />
          </View>
          <Button label="Send" onPress={send} disabled={sending || !draft.trim()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  list: { padding: spacing.screenPadding, gap: spacing.sm, flexGrow: 1 },
  empty: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleTheirs: { backgroundColor: browse.sectionBg, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.coralDeep, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: typography.body, color: colors.textPrimary },
  bubbleTextMine: { fontSize: typography.body, color: colors.white },
  composer: {
    padding: spacing.screenPadding,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: browse.pageBg,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  composerInput: { flex: 1 },
});
