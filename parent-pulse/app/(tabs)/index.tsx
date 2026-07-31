import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';

type Status = 'Action Recommended' | 'Needs Attention' | 'On Track';
type ContextSignal =
  | 'Upcoming Test'
  | 'Upcoming Project'
  | 'Missing Work'
  | 'Grade Trend'
  | 'Teacher Comments'
  | 'Recent Improvement'
  | 'No Events';

type PriorityItem = {
  id: string;
  title: string;
  subject: string;
  status: Status;
  why: string;
  lookingAhead: string;
  signal: ContextSignal;
  issues: string[];
};

type SubjectItem = {
  id: string;
  subject: string;
  status: Status;
  signal: ContextSignal;
  why: string;
  lookingAhead: string;
  issues: string[];
};

type BackendReport = {
  sampleReport?: {
    entries?: Array<{
      subjects?: Record<string, any>;
      exam_schedule?: Record<string, string>;
      upcoming_dates?: string[];
    }>;
  } | null;
  gradesSamir?: {
    student?: string;
    classes?: Record<string, any>;
  } | null;
};

type AverageApiResponse = {
  allGrades?: any[];
};

const STATUS_STYLES: Record<Status, { dot: string; chipBg: string; chipText: string }> = {
  'Action Recommended': { dot: '#ef4444', chipBg: '#fee2e2', chipText: '#b91c1c' },
  'Needs Attention': { dot: '#f59e0b', chipBg: '#fef3c7', chipText: '#b45309' },
  'On Track': { dot: '#22c55e', chipBg: '#dcfce7', chipText: '#15803d' },
};

const SUBJECT_ORDER = ['English', 'Algebra', 'Science', 'History', 'Spanish', 'PE', 'Art'];

const SUBJECT_COLORS: Record<string, string> = {
  English: '#ef4444',
  Algebra: '#f59e0b',
  Science: '#22c55e',
  History: '#16a34a',
  Spanish: '#14b8a6',
  PE: '#3b82f6',
  Art: '#8b5cf6',
};

const SAMIR_STUDENT_ID = '1';

function normalizeCourseName(raw: string) {
  const value = raw.toLowerCase();
  if (/(pre[- ]?algebra|algebra|alg\b)/.test(value)) return 'Algebra';
  if (/(english|language arts|ela|reading)/.test(value)) return 'English';
  if (/(science|biology|chemistry|physics)/.test(value)) return 'Science';
  if (/(social studies|history|civics|government|world history)/.test(value)) return 'History';
  if (/(world language|spanish|french|german|latin|mandarin|japanese)/.test(value)) return 'Spanish';
  if (/(physical education|pe|health|fitness)/.test(value)) return 'PE';
  if (/(drama|media|music|art|band|choir)/.test(value)) return 'Art';
  return '';
}

function titleForSubject(subject: string, status: Status) {
  if (status === 'Action Recommended') return `${subject}: Immediate follow-up needed`;
  if (status === 'Needs Attention') return `${subject}: Needs parent check-in`;
  return `${subject}: Keep momentum`;
}

function iconForStatus(status: Status) {
  if (status === 'Action Recommended') return 'alert-circle';
  if (status === 'Needs Attention') return 'help-circle';
  return 'checkmark-circle';
}

function signalFromReport(reportSubject: any): ContextSignal {
  const text = JSON.stringify(reportSubject || {}).toLowerCase();
  if (text.includes('missing')) return 'Missing Work';
  if (text.includes('test') || text.includes('exam')) return 'Upcoming Test';
  if (text.includes('project')) return 'Upcoming Project';
  if (text.includes('comment') || text.includes('note') || text.includes('stream')) return 'Teacher Comments';
  if (text.includes('improv')) return 'Recent Improvement';
  return 'No Events';
}

function extractIssues(assignments: any[]) {
  return (assignments || [])
    .filter(
      (a) =>
        typeof a?.pts === 'number' &&
        typeof a?.max === 'number' &&
        a.max > 0 &&
        (a.pts / a.max) * 100 < 75
    )
    .map((a) => `${a.name}: ${Math.round((a.pts / a.max) * 100)}%`);
}

function summarizeIssueList(issues: string[]) {
  const deduped = [...new Set(issues)];
  if (deduped.length <= 3) return deduped;
  return [...deduped.slice(0, 3), `+${deduped.length - 3} more low-scoring assignments`];
}

function buildSubjectChatParams(subjectItem: SubjectItem) {
  return {
    studentId: SAMIR_STUDENT_ID,
    source: 'home-subject',
    title: `Discuss ${subjectItem.subject}`,
    subject: subjectItem.subject,
    status: subjectItem.status,
    why: subjectItem.why,
    lookingAhead: subjectItem.lookingAhead,
    signal: subjectItem.signal,
    aiAssessment:
      subjectItem.status === 'Action Recommended'
        ? `Action Recommended: ${subjectItem.subject} needs a targeted recovery plan.`
        : subjectItem.status === 'Needs Attention'
        ? `Needs Attention: ${subjectItem.subject} should be monitored closely this week.`
        : `On Track: ${subjectItem.subject} is stable and should keep momentum.`,
    issues: subjectItem.issues.join('||'),
    suggested: [
      `What should I ask my child about ${subjectItem.subject} tonight?`,
      `What is the best next step for ${subjectItem.subject} this week?`,
      `Can you draft a parent action plan for ${subjectItem.subject}?`,
    ].join('||'),
  };
}

function summarizeData(
  data: BackendReport | null,
  dbGrades: any[]
): { subjects: SubjectItem[]; priorities: PriorityItem[] } {
  const classes = data?.gradesSamir?.classes || {};
  const reportEntry = data?.sampleReport?.entries?.[0] || {};
  const reportSubjects = reportEntry.subjects || {};

  const subjectBuckets: Record<
    string,
    { grades: number[]; lowIssues: string[]; missingCount: number; signal: ContextSignal }
  > = {};

  if (dbGrades.length > 0) {
    for (const grade of dbGrades) {
      const rawCourse =
        grade?.assignments?.courses?.name ||
        grade?.assignments?.courses?.course_code ||
        grade?.assignments?.name ||
        '';
      const subject = normalizeCourseName(String(rawCourse));
      if (!subject) continue;

      if (!subjectBuckets[subject]) {
        subjectBuckets[subject] = {
          grades: [],
          lowIssues: [],
          missingCount: 0,
          signal: 'No Events',
        };
      }

      const score = Number(grade?.score);
      const max = Number(grade?.assignments?.points_possible);
      const missing = Boolean(grade?.missing);
      const excused = Boolean(grade?.excused);

      if (missing) {
        subjectBuckets[subject].missingCount += 1;
      }

      if (!missing && !excused && Number.isFinite(score) && Number.isFinite(max) && max > 0) {
        const pct = (score / max) * 100;
        subjectBuckets[subject].grades.push(pct);

        if (pct < 75) {
          const issueName = grade?.assignments?.name || 'Assignment';
          const dueDate = grade?.assignments?.due_at
            ? String(grade.assignments.due_at).slice(0, 10)
            : null;
          const dueSuffix = dueDate ? ` (due ${dueDate})` : '';
          subjectBuckets[subject].lowIssues.push(`${issueName}: ${Math.round(pct)}%${dueSuffix}`);
        }
      }
    }
  }

  // Fallback to report file grades when DB grades are unavailable.
  if (dbGrades.length === 0) {
    for (const [className, classData] of Object.entries(classes)) {
      const subject = normalizeCourseName(className);
      if (!subject) continue;

      if (!subjectBuckets[subject]) {
        subjectBuckets[subject] = {
          grades: [],
          lowIssues: [],
          missingCount: 0,
          signal: 'No Events',
        };
      }

      const terms = classData?.terms || {};
      for (const term of Object.values(terms) as any[]) {
        if (typeof term?.termGrade === 'number') {
          subjectBuckets[subject].grades.push(term.termGrade);
        }

        const assignments = term?.assignments || [];
        subjectBuckets[subject].lowIssues.push(...extractIssues(assignments));
        subjectBuckets[subject].missingCount += assignments.filter((a: any) =>
          String(a?.status || '').toLowerCase().includes('missing')
        ).length;
      }
    }
  }

  for (const [name, details] of Object.entries(reportSubjects)) {
    const subject = normalizeCourseName(name);
    if (!subject || !subjectBuckets[subject]) continue;

    const reportSignal = signalFromReport(details);
    if (subjectBuckets[subject].signal === 'No Events' || reportSignal !== 'No Events') {
      subjectBuckets[subject].signal = reportSignal;
    }
  }

  const subjects: SubjectItem[] = SUBJECT_ORDER.map((subject, index) => {
    const bucket = subjectBuckets[subject] || {
      grades: [],
      lowIssues: [],
      missingCount: 0,
      signal: 'No Events' as ContextSignal,
    };

    const avgGrade =
      bucket.grades.length > 0
        ? bucket.grades.reduce((sum, g) => sum + g, 0) / bucket.grades.length
        : null;

    const dedupedIssues = summarizeIssueList(bucket.lowIssues);

    let status: Status = 'On Track';
    if (bucket.missingCount > 0 || (avgGrade !== null && avgGrade < 80)) {
      status = 'Action Recommended';
    } else if (dedupedIssues.length >= 2 || (avgGrade !== null && avgGrade < 90)) {
      status = 'Needs Attention';
    }

    const hasUpcoming = bucket.signal === 'Upcoming Test' || bucket.signal === 'Upcoming Project';
    const issueLabel =
      dedupedIssues.length > 0
        ? dedupedIssues.length > 3
          ? 'multiple current issues'
          : `${dedupedIssues.length} current issue${dedupedIssues.length > 1 ? 's' : ''}`
        : '';

    const why =
      issueLabel
        ? `${subject} has ${issueLabel}.`
        : hasUpcoming
        ? `${subject} performance is stable with upcoming checkpoints.`
        : `${subject} is stable with no active risk flags.`;

    const lookingAhead =
      status === 'Action Recommended'
        ? 'Contact teacher; create a recovery plan with weekly checkpoints.'
        : status === 'Needs Attention'
        ? 'Talk with child; monitor the next assessment.'
        : bucket.signal === 'Upcoming Test'
        ? 'Performance strong. Test scheduled. Continue normal study routine.'
        : 'Everything looks good. No intervention recommended.';

    return {
      id: `s${index + 1}`,
      subject,
      status,
      signal: bucket.signal,
      why,
      lookingAhead,
      issues: dedupedIssues,
    };
  });

  const ranked = [...subjects].sort((a, b) => {
    const severity = (s: Status) =>
      s === 'Action Recommended' ? 0 : s === 'Needs Attention' ? 1 : 2;
    if (severity(a.status) !== severity(b.status)) {
      return severity(a.status) - severity(b.status);
    }
    return b.issues.length - a.issues.length;
  });

  const priorities = ranked
    .filter((s) => s.status !== 'On Track' || s.signal === 'Upcoming Test' || s.signal === 'Upcoming Project')
    .slice(0, 3)
    .map((s, idx) => ({
      id: `p${idx + 1}`,
      title: titleForSubject(s.subject, s.status),
      subject: s.subject,
      status: s.status,
      why: s.why,
      lookingAhead: s.lookingAhead,
      signal: s.signal,
      issues: s.issues,
    }));

  return { subjects, priorities };
}

export default function HomeScreen() {
  const { isDark, toggleTheme } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reportData, setReportData] = useState<BackendReport | null>(null);
  const [dbGrades, setDbGrades] = useState<any[]>([]);

  const expoExtra = (Constants.expoConfig?.extra as any) || {};
  const provided = expoExtra.apiBaseUrl;
  const defaultHost = 'http://localhost:3000';
  const apiBaseUrl = provided || defaultHost;

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [reportResult, averageResult] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/api/report/latest`),
          fetch(`${apiBaseUrl}/api/chat/average/${SAMIR_STUDENT_ID}`),
        ]);

        let data: BackendReport | null = null;
        let grades: any[] = [];

        if (reportResult.status === 'fulfilled' && reportResult.value.ok) {
          data = (await reportResult.value.json()) as BackendReport;
        }

        if (averageResult.status === 'fulfilled' && averageResult.value.ok) {
          const avgData = (await averageResult.value.json()) as AverageApiResponse;
          grades = avgData.allGrades || [];
        }

        if (!data && grades.length === 0) {
          throw new Error('Failed to load backend report and DB grades.');
        }

        if (active) {
          setReportData(data);
          setDbGrades(grades);
        }
      } catch (err: any) {
        if (active) {
          setLoadError(err?.message || 'Unable to load Samir data from backend/DB.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const computed = useMemo(() => {
    if (!reportData && dbGrades.length === 0) {
      return { subjects: [] as SubjectItem[], priorities: [] as PriorityItem[] };
    }
    return summarizeData(reportData, dbGrades);
  }, [reportData, dbGrades]);

  const priorities = computed.priorities;
  const subjects = computed.subjects;

  const summary = useMemo(() => {
    const actionRecommended = subjects.filter((s) => s.status === 'Action Recommended').length;
    const needAttention = subjects.filter((s) => s.status === 'Needs Attention').length;
    const onTrack = subjects.filter((s) => s.status === 'On Track').length;
    return [
      { label: 'Action Recommended', count: actionRecommended, status: 'Action Recommended' as const },
      { label: 'Need Attention', count: needAttention, status: 'Needs Attention' as const },
      { label: 'On Track', count: onTrack, status: 'On Track' as const },
    ];
  }, [subjects]);

  const openSubjectChat = (item: SubjectItem) => {
    router.push({ pathname: '/(tabs)/explore', params: buildSubjectChatParams(item) as any });
  };

  const palette = useMemo(
    () => ({
      screenBg: isDark ? '#020617' : '#f4f6ff',
      cardBg: isDark ? '#0f172a' : '#ffffff',
      border: isDark ? '#1e293b' : '#e5e7eb',
      text: isDark ? '#e2e8f0' : '#0f172a',
      subText: isDark ? '#94a3b8' : '#475569',
      rowBg: isDark ? '#111827' : '#ffffff',
      rowBorder: isDark ? '#273449' : '#f1f5f9',
      summaryBg: isDark ? '#111827' : '#f8fafc',
      loadingText: isDark ? '#cbd5e1' : '#334155',
      errorBg: isDark ? '#3f1d1d' : '#fee2e2',
      errorBorder: isDark ? '#7f1d1d' : '#fecaca',
      errorText: isDark ? '#fecaca' : '#991b1b',
      avatarBg: isDark ? '#2563eb' : '#1d4ed8',
    }),
    [isDark]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.screenBg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: palette.text }]}>Good evening, Mark</Text>
            <Text style={[styles.subtitle, { color: palette.subText }]}>Here is how Samir is doing today.</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.themeToggleButton, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
              onPress={toggleTheme}
              activeOpacity={0.85}
            >
              <Text style={[styles.themeToggleText, { color: isDark ? '#e2e8f0' : '#334155' }]}>
                {isDark ? 'Light' : 'Dark'}
              </Text>
            </TouchableOpacity>
            <View style={[styles.avatar, { backgroundColor: palette.avatarBg }]}>
              <Text style={styles.avatarText}>S</Text>
            </View>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={[styles.loadingText, { color: palette.loadingText }]}>Loading Samir&apos;s latest data...</Text>
          </View>
        )}

        {!loading && loadError ? (
          <View style={[styles.errorWrap, { backgroundColor: palette.errorBg, borderColor: palette.errorBorder }]}>
            <Text style={[styles.errorText, { color: palette.errorText }]}>{loadError}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}> 
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Overall Student Summary</Text>
          <View style={styles.summaryGrid}>
            {summary.map((entry) => {
              const style = STATUS_STYLES[entry.status];
              return (
                <View key={entry.label} style={[styles.summaryItem, { backgroundColor: palette.summaryBg }]}> 
                  <View style={[styles.summaryDot, { backgroundColor: style.dot }]} />
                  <Text style={[styles.summaryCount, { color: palette.text }]}>{entry.count}</Text>
                  <Text style={[styles.summaryLabel, { color: palette.subText }]}>{entry.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}> 
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Today&apos;s Priorities</Text>
            <Text style={styles.sectionHint}>Top recommendations</Text>
          </View>

          {priorities.map((item) => {
            const style = STATUS_STYLES[item.status];
            const subjectColor = SUBJECT_COLORS[item.subject] || style.dot;
            return (
              <View
                key={item.id}
                style={[styles.priorityRow, { backgroundColor: palette.rowBg, borderColor: palette.rowBorder }]}
              >
                <Ionicons
                  name={iconForStatus(item.status)}
                  size={18}
                  color={style.dot}
                  style={styles.priorityIcon}
                />
                <View style={[styles.leftAccent, { backgroundColor: subjectColor }]} />
                <View style={styles.priorityTextWrap}>
                  <Text style={[styles.priorityTitle, { color: palette.text }]}>{item.title}</Text>
                  <Text style={[styles.priorityBody, { color: palette.subText }]}>{item.why}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: style.chipBg }]}>
                  <Text style={[styles.statusChipText, { color: style.chipText }]}>{item.status}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}> 
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Subject Health Summary</Text>

          {subjects.map((item) => {
            const style = STATUS_STYLES[item.status];
            const subjectColor = SUBJECT_COLORS[item.subject] || style.dot;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.subjectRow, { borderTopColor: palette.rowBorder }]}
                onPress={() => openSubjectChat(item)}
                activeOpacity={0.8}
              >
                <View style={styles.subjectLeft}>
                  <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
                  <Text style={[styles.subjectText, { color: palette.text }]}>{item.subject}</Text>
                </View>
                <View style={styles.subjectRight}>
                  <View style={[styles.statusChip, { backgroundColor: style.chipBg }]}>
                    <Text style={[styles.statusChipText, { color: style.chipText }]}>{item.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6ff',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 26,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  greeting: {
    fontSize: 33,
    lineHeight: 38,
    fontWeight: '800',
    color: '#111827',
    maxWidth: 270,
  },
  subtitle: {
    marginTop: 4,
    color: '#475569',
    fontSize: 15,
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  loadingText: {
    color: '#334155',
    fontWeight: '600',
  },
  errorWrap: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#991b1b',
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionHint: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  summaryDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginBottom: 8,
  },
  summaryCount: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111827',
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
    fontWeight: '700',
  },
  priorityRow: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
  },
  leftAccent: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  priorityIcon: {
    marginLeft: 2,
  },
  priorityTextWrap: {
    flex: 1,
  },
  priorityTitle: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 16,
  },
  priorityBody: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 13,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subjectRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
  subjectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
