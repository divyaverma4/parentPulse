// File: `app/chat.tsx` (TypeScript / React Native)
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'error';
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [studentId, setStudentId] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  // prefer manifest extra value; fallback based on platform (Android emulator, iOS simulator)
  const expoExtra = (Constants.manifest?.extra as any) || {};
  const provided = expoExtra.apiBaseUrl;
  const defaultHost =
    Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  // If testing on a physical device, set `extra.apiBaseUrl` in `app.json` to "http://YOUR_MACHINE_IP:3000"
  const apiBaseUrl = provided || defaultHost;

  useEffect(() => {
    // no-op
  }, []);

  const addMessage = (text: string, sender: Message['sender']) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, text, sender },
    ]);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  const showError = (msg: string) => {
    addMessage(msg, 'error');
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!studentId.trim()) {
      showError('Please enter a Student ID');
      return;
    }

    addMessage(trimmed, 'user');
    setInput('');
    setSending(true);
    setTyping(true);

    const endpoint = `${apiBaseUrl}/api/chat/ask`;
    console.log('[chat] POST ->', endpoint);

    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          studentUserId: parseInt(studentId, 10),
          courseId: null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        // try to read JSON error first, fallback to text
        const bodyText = await res.text().catch(() => '');
        let serverMessage: string | null = null;
        try {
          const parsed = JSON.parse(bodyText);
          serverMessage = parsed?.error || parsed?.message || JSON.stringify(parsed);
        } catch {
          serverMessage = bodyText;
        }
        throw new Error(serverMessage || `API error ${res.status}`);
      }

      const data = await res.json();

      // Always show the full API response from the chatbot
      const answer = (data.answer || data.message || data.response) ?? "I couldn't generate a response.";
      addMessage(answer, 'bot');

      setTyping(false);
    } catch (err: any) {
      clearTimeout(timeoutId);
      setTyping(false);

      // More informative error shown to user
      if (err?.name === 'AbortError') {
        showError('Request timed out. Try again.');
      } else if ((err?.message || '').includes('Network request failed')) {
        showError('Network request failed — check that the backend is running and `apiBaseUrl` is correct.');
      } else {
        showError(err?.message ?? 'Sorry, I encountered an error. Please try again.');
      }

      console.error('Chat API error:', err);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    const isError = item.sender === 'error';
    return (
      <View
        style={[
          styles.message,
          isUser ? styles.userMessage : styles.botMessage,
          isError && styles.errorMessage,
        ]}
      >
        <View style={styles.messageContent}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Parent Pulse</Text>
        <View style={styles.userInfo}>
          <Text style={styles.label}>Student ID</Text>
          <TextInput
            value={studentId}
            onChangeText={setStudentId}
            placeholder="e.g. 12345"
            keyboardType="numeric"
            style={styles.studentInput}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContent}
        >
          {messages.map((m) => (
            <View key={m.id} style={[styles.messageWrapper]}>
              {renderMessage({ item: m })}
            </View>
          ))}

          {typing && (
            <View style={[styles.message, styles.botMessage]}>
              <View style={styles.messageContent}>
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color="#667eea" />
                  <Text style={styles.typingText}>Bot is typing...</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message"
            style={styles.input}
            multiline
            editable={!sending}
            onSubmitEditing={() => {
              // send on native submit, not on web
              if (Platform.OS === 'web') return;
              sendMessage();
            }}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={sending}
          >
            <Text style={styles.sendButtonText}>{sending ? 'Sending...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, color: '#333', fontWeight: '600' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, marginRight: 8 },
  studentInput: {
    width: 100,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  chatContainer: { flex: 1, paddingHorizontal: 12 },
  chatContent: { paddingVertical: 12 },
  messageWrapper: { marginBottom: 8 },
  message: { flexDirection: 'row' },
  messageContent: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  messageText: { color: '#333', lineHeight: 20 },
  botMessage: { justifyContent: 'flex-start' },
  userMessage: { justifyContent: 'flex-end', alignSelf: 'flex-end' },
  userMessageText: { color: '#fff' },
  sendButton: {
    backgroundColor: '#667eea',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 25,
    marginLeft: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#ccc' },
  sendButtonText: { color: '#fff', fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    backgroundColor: '#fff',
    fontSize: 16,
    maxHeight: 120,
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { marginLeft: 8, color: '#667eea' },
  errorMessage: {
    borderColor: '#ffcccc',
    backgroundColor: '#ffecec',
  },
});

