import React, { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	NativeSyntheticEvent,
	Platform,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TextInputSubmitEditingEventData,
	TouchableOpacity,
	View,
} from 'react-native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';

type Status = 'Action Recommended' | 'Needs Attention' | 'On Track';

type ChatParams = {
	studentId?: string;
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

type Message = {
	id: string;
	sender: 'user' | 'bot' | 'error';
	text: string;
};

type Assessment = {
	status: Status;
	subject: string;
	title: string;
	why: string;
	lookingAhead: string;
	aiAssessment: string;
	signal: string;
	issues: string[];
	suggestedQuestions: string[];
};

type AverageApiResponse = {
	allGrades?: any[];
};

function normalizeStatus(value?: string): Status {
	if (value === 'Action Recommended' || value === 'Needs Attention' || value === 'On Track') {
		return value;
	}
	return 'On Track';
}

function normalizeCourseName(raw: string) {
	const value = String(raw || '').toLowerCase();
	if (/(pre[- ]?algebra|algebra|alg\b)/.test(value)) return 'Pre-Algebra';
	if (/(english|language arts|ela|reading)/.test(value)) return 'English Language Arts';
	if (/(religion|theology|faith)/.test(value)) return 'Religion';
	if (/(science|biology|chemistry|physics)/.test(value)) return 'Science';
	if (/(social studies|history|civics|government|world history)/.test(value)) return 'Social Studies';
	if (/(world language|spanish|french|german|latin|mandarin|japanese)/.test(value)) return 'World Language';
	if (/(physical education|\bpe\b|health|fitness)/.test(value)) return 'Physical Education';
	if (/(drama|media|music|art|band|choir)/.test(value)) return 'Art';
	return '';
}

function deriveAssessmentFromParams(params: ChatParams): Assessment {
	const status = normalizeStatus(params.status);
	const subject = params.subject || 'General';
	const signal = params.signal || 'No Events';
	const issues = params.issues?.split('||').filter(Boolean) || [];

	return {
		status,
		subject,
		title: params.title || `Discuss ${subject}`,
		why:
			params.why ||
			(issues.length
				? `${subject} has ${issues.length} active issue${issues.length > 1 ? 's' : ''}.`
				: 'No major risk patterns are present in the current context.'),
		lookingAhead:
			params.lookingAhead ||
			(status === 'Action Recommended'
				? 'Contact the teacher and create a short recovery plan with checkpoints.'
				: status === 'Needs Attention'
				? 'Talk with your child and monitor the next assessment closely.'
				: 'Everything looks good. No intervention recommended.'),
		aiAssessment:
			params.aiAssessment ||
			(status === 'Action Recommended'
				? 'Action Recommended: Contact the teacher now and align on a targeted recovery plan.'
				: status === 'Needs Attention'
				? 'Needs Attention: Start a supportive check-in routine and track the next grade signal.'
				: 'On Track: Maintain current habits and reinforce what is working.'),
		signal,
		issues,
		suggestedQuestions:
			params.suggested?.split('||').filter(Boolean) ||
			[
				`What should I ask my child about ${subject} tonight?`,
				`What is the best next step for ${subject} this week?`,
				`Can you draft a parent action plan for ${subject}?`,
			],
	};
}

function deriveFallbackParamsFromGrades(allGrades: any[]): ChatParams | null {
	const buckets: Record<string, { scores: number[]; missing: number; issues: string[] }> = {};

	for (const grade of allGrades || []) {
		const rawCourse =
			grade?.assignments?.courses?.name ||
			grade?.assignments?.courses?.course_code ||
			grade?.assignments?.name ||
			'';
		const subject = normalizeCourseName(rawCourse);
		if (!subject) continue;

		if (!buckets[subject]) buckets[subject] = { scores: [], missing: 0, issues: [] };

		const score = Number(grade?.score);
		const max = Number(grade?.assignments?.points_possible);
		const missing = Boolean(grade?.missing);
		const excused = Boolean(grade?.excused);
		const assignmentName = grade?.assignments?.name || 'Assignment';

		if (missing) {
			buckets[subject].missing += 1;
			buckets[subject].issues.push(`${assignmentName}: Missing`);
			continue;
		}

		if (!excused && Number.isFinite(score) && Number.isFinite(max) && max > 0) {
			const pct = (score / max) * 100;
			buckets[subject].scores.push(pct);
			if (pct < 75) {
				buckets[subject].issues.push(`${assignmentName}: ${Math.round(pct)}%`);
			}
		}
	}

	const ranked = Object.entries(buckets)
		.map(([subject, b]) => {
			const avg = b.scores.length ? b.scores.reduce((s, x) => s + x, 0) / b.scores.length : 100;
			const uniqueIssues = [...new Set(b.issues)];
			const risk = b.missing * 3 + uniqueIssues.length * 2 + (avg < 80 ? 2 : avg < 90 ? 1 : 0);
			return { subject, avg, missing: b.missing, issues: uniqueIssues, risk };
		})
		.sort((a, b) => b.risk - a.risk || a.avg - b.avg);

	const top = ranked[0];
	if (!top) return null;

	const status: Status =
		top.missing > 0 || top.avg < 80
			? 'Action Recommended'
			: top.issues.length >= 2 || top.avg < 90
			? 'Needs Attention'
			: 'On Track';

	return {
		title: `Discuss ${top.subject}`,
		subject: top.subject,
		status,
		signal: 'Grade Trend',
		why:
			top.issues.length > 0
				? `${top.subject} has ${top.issues.length} active issue${top.issues.length > 1 ? 's' : ''}: ${top.issues.join('; ')}`
				: `${top.subject} should be monitored based on current grade signals.`,
		lookingAhead:
			status === 'Action Recommended'
				? 'Contact the teacher and create a short recovery plan with weekly checkpoints.'
				: status === 'Needs Attention'
				? 'Talk with your child and monitor the next assessment closely.'
				: 'Everything looks good. Maintain current routines and check in weekly.',
		aiAssessment:
			status === 'Action Recommended'
				? `Action Recommended: ${top.subject} needs a targeted recovery plan.`
				: status === 'Needs Attention'
				? `Needs Attention: ${top.subject} should be monitored closely this week.`
				: `On Track: ${top.subject} is stable and should keep momentum.`,
		issues: top.issues.slice(0, 5).join('||'),
		suggested: [
			`What should I ask my child about ${top.subject} tonight?`,
			`What is the best next step for ${top.subject} this week?`,
			`Can you draft a parent action plan for ${top.subject}?`,
		].join('||'),
	};
}

function buildPrompt(assessment: Assessment, question: string, issues: string[]) {
	return [
		'Parent Pulse context-aware chat request:',
		`Status: ${assessment.status}`,
		`Subject: ${assessment.subject}`,
		`Why: ${assessment.why}`,
		`Issues: ${issues.length > 0 ? issues.join(' | ') : 'None listed'}`,
		`Looking Ahead: ${assessment.lookingAhead}`,
		`AI Assessment: ${assessment.aiAssessment}`,
		`Context Signal: ${assessment.signal}`,
		'Instruction: Tell the parent what deserves attention, why, and what to do next, not only what happened.',
		`Parent question: ${question}`,
	].join('\n');
}

export default function ExploreChatScreen() {
	const params = useLocalSearchParams<ChatParams>();
	const { isDark, toggleTheme } = useAppTheme();
	const [fallbackParams, setFallbackParams] = useState<ChatParams | null>(null);
	const [dynamicIssues, setDynamicIssues] = useState<string[]>([]);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [sending, setSending] = useState(false);
	const [typing, setTyping] = useState(false);

	const expoExtra = (Constants.expoConfig?.extra as any) || {};
	const studentId = String(params.studentId || '1');
	const provided = expoExtra.apiBaseUrl;
	const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
	const apiBaseUrl = provided || defaultHost;

	const hasRouteContext = Boolean(params.title || params.subject || params.status || params.why);

	useEffect(() => {
		let active = true;

		const loadFallback = async () => {
			if (hasRouteContext) {
				if (active) setFallbackParams(null);
				return;
			}

			try {
				const res = await fetch(`${apiBaseUrl}/api/chat/average/${studentId}`);
				if (!res.ok) throw new Error('Average endpoint failed');
				const payload = (await res.json()) as AverageApiResponse;
				if (active) {
					setFallbackParams(deriveFallbackParamsFromGrades(payload.allGrades || []));
				}
			} catch {
				if (active) setFallbackParams(null);
			}
		};

		loadFallback();
		return () => {
			active = false;
		};
	}, [apiBaseUrl, hasRouteContext, studentId]);

	const effectiveParams = useMemo(
		() => ({ ...(fallbackParams || {}), ...params, studentId }),
		[fallbackParams, params, studentId]
	);
	const assessment = useMemo(() => deriveAssessmentFromParams(effectiveParams), [effectiveParams]);
	const showTestPrepLink = hasRouteContext && assessment.subject && assessment.subject !== 'General';

	useEffect(() => {
		let active = true;

		const loadIssues = async () => {
			if (!assessment.subject || !studentId) {
				if (active) setDynamicIssues([]);
				return;
			}

			try {
				const res = await fetch(`${apiBaseUrl}/api/chat/average/${studentId}`);
				if (!res.ok) throw new Error('Average endpoint failed');
				const payload = (await res.json()) as AverageApiResponse;
				const issues: string[] = [];

				for (const grade of payload.allGrades || []) {
					const rawCourse =
						grade?.assignments?.courses?.name ||
						grade?.assignments?.courses?.course_code ||
						grade?.assignments?.name ||
						'';
					if (normalizeCourseName(rawCourse) !== assessment.subject) continue;

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
						if (pct < 75) issues.push(`${assignmentName}: ${Math.round(pct)}%`);
					}
				}

				if (active) setDynamicIssues([...new Set(issues)]);
			} catch {
				if (active) setDynamicIssues([]);
			}
		};

		loadIssues();
		return () => {
			active = false;
		};
	}, [apiBaseUrl, assessment.subject, studentId]);

	useEffect(() => {
		setMessages((prev) => {
			if (prev.some((m) => m.text.includes('Context ready. Focus:'))) return prev;
			return [...prev, { id: `${Date.now()}-seed`, sender: 'bot', text: `Context ready. Focus: ${assessment.title}.` }];
		});
	}, [assessment.title]);

	const resolvedIssues = dynamicIssues.length > 0 ? dynamicIssues : assessment.issues;

	const palette = {
		screenBg: isDark ? '#020617' : '#f4f6ff',
		cardBg: isDark ? '#0f172a' : '#ffffff',
		border: isDark ? '#1e293b' : '#e5e7eb',
		text: isDark ? '#e2e8f0' : '#0f172a',
		subText: isDark ? '#94a3b8' : '#475569',
		chipBg: isDark ? '#1e3a8a' : '#dbeafe',
		chipText: isDark ? '#bfdbfe' : '#1d4ed8',
		bubbleBg: isDark ? '#1f2937' : '#f1f5f9',
		inputBg: isDark ? '#111827' : '#f8fafc',
		errorBubble: isDark ? '#7f1d1d' : '#fee2e2',
		errorText: isDark ? '#fecaca' : '#991b1b',
	};

	const addMessage = (sender: Message['sender'], text: string) => {
		setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, sender, text }]);
	};

	const askApi = async (question: string) => {
		const prompt = buildPrompt(assessment, question, resolvedIssues);
		const endpoint = `${apiBaseUrl}/api/chat/ask`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 15000);

		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ question: prompt, studentUserId: parseInt(studentId, 10), courseId: null }),
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(text || `API error ${res.status}`);
			}

			const data = await res.json();
			addMessage('bot', data.answer || data.message || data.response || "I couldn't generate a response.");
		} catch (err: any) {
			if (err?.name === 'AbortError') addMessage('error', 'Request timed out. Try again.');
			else if ((err?.message || '').includes('Network request failed')) {
				addMessage('error', 'Network request failed. Verify backend service and apiBaseUrl settings.');
			} else {
				addMessage('error', err?.message || 'Sorry, I encountered an error. Please try again.');
			}
		}
	};

	const onSend = async (question: string) => {
		const text = question.trim();
		if (!text || sending) return;
		addMessage('user', text);
		setInput('');
		setSending(true);
		setTyping(true);
		await askApi(text);
		setTyping(false);
		setSending(false);
	};

	const onInputSubmit = (event?: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
		event?.preventDefault?.();
		void onSend(input);
	};

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: palette.screenBg }]}> 
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				keyboardVerticalOffset={84}
			>
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					<View style={styles.headerRow}>
						<View style={styles.headerTextWrap}>
							<Text style={[styles.title, { color: palette.text }]}>Context-Aware AI Chat</Text>
							<Text style={[styles.subTitle, { color: palette.subText }]}>{assessment.title}</Text>
						</View>
						<TouchableOpacity
							style={[styles.themeToggleButton, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
							onPress={toggleTheme}
						>
							<Text style={[styles.themeToggleText, { color: isDark ? '#e2e8f0' : '#334155' }]}>
								{isDark ? 'Light' : 'Dark'}
							</Text>
						</TouchableOpacity>
					</View>

					<View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}> 
						<Text style={[styles.cardTitle, { color: palette.text }]}>{assessment.status}</Text>
						<Text style={[styles.paragraph, { color: palette.subText }]}>{assessment.why}</Text>
						<Text style={[styles.label, { color: palette.text }]}>Looking Ahead</Text>
						<Text style={[styles.paragraph, { color: palette.subText }]}>{assessment.lookingAhead}</Text>
						{resolvedIssues.length > 0 && (
							<>
								<Text style={[styles.label, { color: palette.text }]}>Current Issues</Text>
								{resolvedIssues.map((issue) => (
									<Text key={issue} style={[styles.issueItem, { color: palette.subText }]}>{`• ${issue}`}</Text>
								))}
							</>
						)}
						<View style={styles.suggestedWrap}>
							{assessment.suggestedQuestions.slice(0, 3).map((q) => (
								<TouchableOpacity
									key={q}
									style={[styles.questionChip, { backgroundColor: palette.chipBg }]}
									onPress={() => onSend(q)}
									disabled={sending}
								>
									<Text style={[styles.questionChipText, { color: palette.chipText }]}>{q}</Text>
								</TouchableOpacity>
							))}
							{showTestPrepLink && (
								<TouchableOpacity
									style={[styles.testPrepChip, { backgroundColor: palette.chipBg }]}
									onPress={() =>
										router.push({
											pathname: '/(tabs)/test-prep' as never,
											params: { subject: assessment.subject },
										} as never)
									}
								>
									<Text style={[styles.testPrepChipText, { color: palette.chipText }]}>Exam/Quiz Prep</Text>
								</TouchableOpacity>
							)}
						</View>
					</View>

					<View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}> 
						<Text style={[styles.label, { color: palette.text }]}>Open Chat</Text>
						{messages.map((m) => (
							<View
								key={m.id}
								style={[styles.msgRow, m.sender === 'user' ? styles.msgRight : styles.msgLeft]}
							>
								<View
									style={[
										styles.msgBubble,
										m.sender === 'user'
											? styles.msgUser
											: m.sender === 'error'
											? [styles.msgError, { backgroundColor: palette.errorBubble }]
											: { backgroundColor: palette.bubbleBg },
									]}
								>
										<Text
											style={[
												styles.msgText,
												{ color: m.sender === 'user' ? '#fff' : m.sender === 'error' ? palette.errorText : palette.text },
											]}
										>
										{m.text}
									</Text>
								</View>
							</View>
						))}
						{typing && (
							<View style={[styles.msgRow, styles.msgLeft]}>
								<View style={[styles.msgBubble, { backgroundColor: palette.bubbleBg }]}> 
									<View style={styles.typingRow}>
										<ActivityIndicator size="small" color="#2563eb" />
										<Text style={styles.typingText}>AI is generating guidance...</Text>
									</View>
								</View>
							</View>
						)}
					</View>
				</ScrollView>

				<View style={[styles.inputWrap, { backgroundColor: palette.cardBg, borderTopColor: palette.border }]}> 
					<TextInput
						value={input}
						onChangeText={setInput}
						onSubmitEditing={onInputSubmit}
						placeholder="Ask about priorities, subjects, or next steps"
						placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
						style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text }]}
						multiline={false}
						returnKeyType="send"
						blurOnSubmit
						editable={!sending}
					/>
					<TouchableOpacity style={[styles.sendButton, sending && styles.sendButtonDisabled]} onPress={() => onSend(input)}>
						<Text style={styles.sendText}>{sending ? 'Sending...' : 'Send'}</Text>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	flex: { flex: 1 },
	content: { padding: 14, gap: 12, paddingBottom: 18 },
	headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
	headerTextWrap: { flex: 1 },
	title: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
	subTitle: { marginTop: 2, fontSize: 14 },
	themeToggleButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
	themeToggleText: { fontSize: 12, fontWeight: '800' },
	card: {
		borderRadius: 16,
		borderWidth: 1,
		padding: 14,
		shadowColor: '#0f172a',
		shadowOpacity: 0.05,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	cardTitle: { fontSize: 18, fontWeight: '900' },
	label: { marginTop: 8, fontSize: 14, fontWeight: '800' },
	paragraph: { marginTop: 4, fontSize: 14, lineHeight: 20 },
	issueItem: { marginTop: 4, fontSize: 13, lineHeight: 18 },
	suggestedWrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	questionChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
	questionChipText: { fontSize: 12, fontWeight: '700' },
	testPrepChip: {
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: '#2563eb22',
	},
	testPrepChipText: { fontSize: 12, fontWeight: '800' },
	msgRow: { marginTop: 8 },
	msgLeft: { alignItems: 'flex-start' },
	msgRight: { alignItems: 'flex-end' },
	msgBubble: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, maxWidth: '86%' },
	msgUser: { backgroundColor: '#2563eb' },
	msgError: { backgroundColor: '#fee2e2' },
	msgText: { fontSize: 14, lineHeight: 20 },
	typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	typingText: { color: '#2563eb', marginLeft: 8, fontWeight: '600' },
	inputWrap: {
		flexDirection: 'row',
		alignItems: 'center',
		borderTopWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	input: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 24,
		paddingHorizontal: 14,
		paddingVertical: 10,
		maxHeight: 120,
		fontSize: 15,
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
	sendButtonDisabled: { backgroundColor: '#94a3b8' },
	sendText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
