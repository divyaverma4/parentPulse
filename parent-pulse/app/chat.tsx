import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';

type Status = 'Action Recommended' | 'Needs Attention' | 'On Track';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'error';
};

type ChatParams = {
  studentId?: string;
  source?: string;
  title?: string;
  subject?: string;
  status?: string;
  why?: string;
  lookingAhead?: string;
  signal?: string;
  aiAssessment?: string;
  suggested?: string;
  issues?: string;
};

type AssessmentCard = {
  status: Status;
  why: string;
  lookingAhead: string;
  aiAssessment: string;
  signal: string;
  subject: string;
  title: string;
  suggestedQuestions: string[];
  issues: string[];
};

type AverageApiResponse = {
  allGrades?: any[];
};

function normalizeStatus(raw?: string): Status {
  if (raw === 'Action Recommended' || raw === 'Needs Attention' || raw === 'On Track') {
    return raw;
  }
  return 'On Track';
}

function statusColor(status: Status) {
  if (status === 'Action Recommended') return '#ef4444';
  if (status === 'Needs Attention') return '#f59e0b';
  return '#22c55e';
}

function normalizeCourseName(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes('pre-algebra') || value.includes('algebra')) return 'Algebra';
  if (value.includes('english language arts') || value.includes('ela')) return 'English';
  if (value.includes('science')) return 'Science';
  if (value.includes('social studies') || value.includes('history')) return 'History';
  if (value.includes('world language') || value.includes('spanish')) return 'Spanish';
  if (value.includes('physical education') || value.includes('pe')) return 'PE';
  if (value.includes('drama') || value.includes('media') || value.includes('music') || value.includes('art')) {
    return 'Art';
  }
  return '';
}

function extractSubjectIssuesFromGrades(subject: string, allGrades: any[]) {
  const issues: string[] = [];

  for (const grade of allGrades || []) {
    const rawCourse =
      grade?.assignments?.courses?.name ||
      grade?.assignments?.courses?.course_code ||
      grade?.assignments?.name ||
      '';

    if (normalizeCourseName(String(rawCourse)) !== subject) continue;

    const missing = Boolean(grade?.missing);
    const excused = Boolean(grade?.excused);
    const score = Number(grade?.score);
    const max = Number(grade?.assignments?.points_possible);
    const assignmentName = grade?.assignments?.name || 'Assignment';

    if (missing) {
      issues.push(`${assignmentName}: Missing`);
      continue;
    }

    if (!excused && Number.isFinite(score) && Number.isFinite(max) && max > 0) {
      const pct = (score / max) * 100;
      if (pct < 75) {
        const dueDate = grade?.assignments?.due_at
          ? String(grade.assignments.due_at).slice(0, 10)
          : null;
        const dueSuffix = dueDate ? ` (due ${dueDate})` : '';
        issues.push(`${assignmentName}: ${Math.round(pct)}%${dueSuffix}`);
      }
    }
  }

  return [...new Set(issues)];
}

function buildAssessment(params: ChatParams): AssessmentCard {
  const status = normalizeStatus(params.status);
  const subject = params.subject || 'General';
  const signal = params.signal || 'No Events';

  const defaultWhy =
    status === 'Action Recommended'
      ? 'Recent signals suggest immediate intervention can prevent further decline.'
      : status === 'Needs Attention'
      ? 'Recent assessments indicate caution and active monitoring are needed.'
      : signal === 'Upcoming Test'
      ? 'Current performance is solid and readiness looks good for the scheduled test.'
      : 'No major risk patterns are present in the current context.';

  const defaultLookingAhead =
    status === 'Action Recommended'
      ? 'Contact the teacher and create a short recovery plan with checkpoints.'
      : status === 'Needs Attention'
      ? 'Talk with your child and monitor the next assessment closely.'
      : signal === 'Upcoming Test'
      ? 'Performance is strong. Test scheduled. Continue normal study routine.'
      : 'Everything looks good. No intervention recommended.';

  const defaultAssessment =
    status === 'Action Recommended'
      ? 'Action Recommended: Contact the teacher now and align on a targeted recovery plan.'
      : status === 'Needs Attention'
      ? 'Needs Attention: Start a supportive check-in routine and track the next grade signal.'
      : signal === 'Upcoming Test'
      ? 'On Track with Upcoming Test: Keep momentum and maintain routine prep.'
      : 'On Track: Maintain current habits and reinforce what is working.';

  const issues = params.issues?.split('||').filter(Boolean) || [];

  const suggestedQuestions =
    params.suggested?.split('||').filter(Boolean) ||
    [
      `What should I ask my child about ${subject} tonight?`,
      `What is the best next step for ${subject} this week?`,
      `Can you draft a parent action plan for ${subject}?`,
    ];

  return {
    status,
    why:
      params.why ||
      (issues.length > 0
        ? `${subject} has ${issues.length} active issue${issues.length > 1 ? 's' : ''}: ${issues.join('; ')}`
        : defaultWhy),
    lookingAhead: params.lookingAhead || defaultLookingAhead,
    aiAssessment: params.aiAssessment || defaultAssessment,
    signal,
    subject,
    title: params.title || `Discuss ${subject}`,
    suggestedQuestions,
    issues,
  };
}

export default function ChatScreen() {
  const { isDark, toggleTheme } = useAppTheme();
  const params = useLocalSearchParams<ChatParams>();
  const assessment = useMemo(() => buildAssessment(params), [params]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const studentId = params.studentId || '12345';
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [dynamicIssues, setDynamicIssues] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  const expoExtra = (Constants.expoConfig?.extra as any) || {};
  const provided = expoExtra.apiBaseUrl;
  const defaultHost =
    Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  const apiBaseUrl = provided || defaultHost;

  useEffect(() => {
    let active = true;

    const loadDynamicIssues = async () => {
      if (!assessment.subject || !studentId) {
        if (active) setDynamicIssues([]);
        return;
      }

      try {
        const res = await fetch(`${apiBaseUrl}/api/chat/average/${studentId}`);
        if (!res.ok) {
          throw new Error(`Failed to load DB grades: ${res.status}`);
        }

        const payload = (await res.json()) as AverageApiResponse;
        const issues = extractSubjectIssuesFromGrades(assessment.subject, payload.allGrades || []);

        if (active) {
          setDynamicIssues(issues);
        }
      } catch {
        if (active) {
          setDynamicIssues([]);
        }
      }
    };

    loadDynamicIssues();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, assessment.subject, studentId]);

  const resolvedIssues = useMemo(() => {
    if (dynamicIssues.length > 0) return dynamicIssues;
    return assessment.issues;
  }, [assessment.issues, dynamicIssues]);

  const palette = useMemo(
    () => ({
      screenBg: isDark ? '#020617' : '#f4f6ff',
      cardBg: isDark ? '#0f172a' : '#ffffff',
      border: isDark ? '#1e293b' : '#e5e7eb',
      title: isDark ? '#e2e8f0' : '#0f172a',
      subtitle: isDark ? '#94a3b8' : '#475569',
      text: isDark ? '#e2e8f0' : '#0f172a',
      infoText: isDark ? '#cbd5e1' : '#475569',
      chipBg: isDark ? '#1e3a8a' : '#dbeafe',
      chipText: isDark ? '#bfdbfe' : '#1d4ed8',
      inputBg: isDark ? '#111827' : '#f8fafc',
      inputBorder: isDark ? '#334155' : '#dbe2ea',
      divider: isDark ? '#1e293b' : '#e5e7eb',
      botBubble: isDark ? '#1f2937' : '#f1f5f9',
    }),
    [isDark]
  );

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, typing]);

  useEffect(() => {
    if (!params.title) return;

    setMessages((prev) => {
      const alreadySeeded = prev.some((m) => m.text.includes('Context received from dashboard'));
      if (alreadySeeded) return prev;

      return [
        ...prev,
        {
          id: `${Date.now()}-seed`,
          sender: 'bot',
          text: `Context received from dashboard. Focus: ${assessment.title}.`,
        },
      ];
    });
  }, [assessment.title, params.title]);

  const addMessage = (text: string, sender: Message['sender']) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, text, sender }]);
  };

  const showError = (msg: string) => {
    addMessage(msg, 'error');
  };

  const postToChatApi = async (question: string) => {
    const endpoint = `${apiBaseUrl}/api/chat/ask`;
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          studentUserId: parseInt(studentId, 10),
          courseId: null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
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
      const answer =
        (data.answer || data.message || data.response) ?? "I couldn't generate a response.";
      addMessage(answer, 'bot');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        showError('Request timed out. Try again.');
      } else if ((err?.message || '').includes('Network request failed')) {
        showError('Network request failed. Verify backend service and apiBaseUrl settings.');
      } else {
        showError(err?.message ?? 'Sorry, I encountered an error. Please try again.');
      }
      console.error('Chat API error:', err);
    }
  };

  const buildContextAwarePrompt = (question: string) => {
    return [
      'Parent Pulse context-aware chat request:',
      `Status: ${assessment.status}`,
      `Subject: ${assessment.subject}`,
      `Why: ${assessment.why}`,
      `Issues: ${resolvedIssues.length > 0 ? resolvedIssues.join(' | ') : 'None listed'}`,
      `Looking Ahead: ${assessment.lookingAhead}`,
      `AI Assessment: ${assessment.aiAssessment}`,
      `Context Signal: ${assessment.signal}`,
      'Instruction: Tell the parent what deserves attention, why, and what to do next, not only what happened.',
      `Parent question: ${question}`,
    ].join('\n');
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

    const prompt = buildContextAwarePrompt(trimmed);
    await postToChatApi(prompt);

    setTyping(false);
    setSending(false);
  };

  const askSuggestedQuestion = async (question: string) => {
    if (!studentId.trim()) {
      showError('Please enter a Student ID');
      return;
    }

    addMessage(question, 'user');
    setSending(true);
    setTyping(true);

    const prompt = buildContextAwarePrompt(question);
    await postToChatApi(prompt);

    setTyping(false);
    setSending(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.screenBg }]}> 
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topHeader}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, { color: palette.title }]}>Context-Aware AI Chat</Text>
                <Text style={[styles.subTitle, { color: palette.subtitle }]}>Parent Pulse Guidance</Text>
              </View>
              <TouchableOpacity
                style={[styles.themeToggleButton, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
                onPress={toggleTheme}
                activeOpacity={0.85}
              >
                <Text style={[styles.themeToggleText, { color: isDark ? '#e2e8f0' : '#334155' }]}>
                  {isDark ? 'Light' : 'Dark'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}> 
            <View style={styles.cardRow}>
              <Text style={[styles.sectionLabel, { color: palette.text }]}>Status</Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: `${statusColor(assessment.status)}22` },
                ]}
              >
                <Text style={[styles.statusPillText, { color: statusColor(assessment.status) }]}>
                  {assessment.status}
                </Text>
              </View>
            </View>

            <Text style={[styles.infoLabel, { color: palette.text }]}>Why?</Text>
            <Text style={[styles.infoText, { color: palette.infoText }]}>{assessment.why}</Text>

            {resolvedIssues.length > 0 ? (
              <>
                <Text style={[styles.infoLabel, { color: palette.text }]}>Current Issues</Text>
                {resolvedIssues.map((issue) => (
                  <Text key={issue} style={[styles.issueText, { color: palette.infoText }]}>{`• ${issue}`}</Text>
                ))}
              </>
            ) : null}

            <Text style={[styles.infoLabel, { color: palette.text }]}>Looking Ahead</Text>
            <Text style={[styles.infoText, { color: palette.infoText }]}>{assessment.lookingAhead}</Text>

            <Text style={[styles.infoLabel, { color: palette.text }]}>AI Assessment</Text>
            <Text style={[styles.infoText, { color: palette.infoText }]}>{assessment.aiAssessment}</Text>

            <Text style={[styles.infoLabel, { color: palette.text }]}>Suggested Questions</Text>
            <View style={styles.suggestedWrap}>
              {assessment.suggestedQuestions.slice(0, 5).map((q) => (
                <TouchableOpacity
                  key={q}
                  onPress={() => askSuggestedQuestion(q)}
                  style={[styles.questionChip, { backgroundColor: palette.chipBg }]}
                  disabled={sending}
                >
                  <Text style={[styles.questionChipText, { color: palette.chipText }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}> 
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Open Chat</Text>
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              const isError = m.sender === 'error';

              return (
                <View
                  key={m.id}
                  style={[
                    styles.message,
                    isUser ? styles.userMessage : styles.botMessage,
                    isError && styles.errorMessage,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : [styles.botBubble, { backgroundColor: palette.botBubble }],
                      isError && styles.errorBubble,
                    ]}
                  >
                    <Text style={[styles.messageText, { color: isUser ? '#fff' : palette.text }]}>{m.text}</Text>
                  </View>
                </View>
              );
            })}

            {typing && (
              <View style={[styles.message, styles.botMessage]}>
                <View style={[styles.messageBubble, styles.botBubble, { backgroundColor: palette.botBubble }]}>
                  <View style={styles.typingRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.typingText}>AI is generating guidance...</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.inputWrap, { borderTopColor: palette.divider, backgroundColor: palette.cardBg }]}> 
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about priorities, subjects, or next steps"
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.text }]}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendDisabled]}
            onPress={sendMessage}
            disabled={sending}
          >
            <Text style={styles.sendText}>{sending ? 'Sending...' : 'Send'}</Text>
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
    backgroundColor: '#f4f6ff',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 12,
  },
  topHeader: {
    marginBottom: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: '#0f172a',
  },
  subTitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#475569',
  },
  themeToggleButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 17,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  infoLabel: {
    marginTop: 8,
    color: '#1e293b',
    fontWeight: '800',
    fontSize: 14,
  },
  infoText: {
    marginTop: 3,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  issueText: {
    marginTop: 4,
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  suggestedWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  questionChip: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  questionChipText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
  },
  message: {
    marginBottom: 8,
  },
  messageBubble: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: '86%',
  },
  botMessage: {
    alignItems: 'flex-start',
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  botBubble: {
    backgroundColor: '#f1f5f9',
  },
  userBubble: {
    backgroundColor: '#2563eb',
  },
  errorMessage: {
    alignItems: 'flex-start',
  },
  errorBubble: {
    backgroundColor: '#fee2e2',
  },
  messageText: {
    color: '#0f172a',
    lineHeight: 20,
    fontSize: 14,
  },
  userMessageText: {
    color: '#fff',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    color: '#2563eb',
    marginLeft: 8,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    color: '#0f172a',
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#2563eb',
    borderRadius: 24,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  sendDisabled: {
    backgroundColor: '#94a3b8',
  },
  sendText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
