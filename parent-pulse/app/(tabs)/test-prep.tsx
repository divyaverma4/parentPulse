import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAppTheme } from '@/contexts/app-theme-context';

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

type SubjectQuiz = {
  subject: string;
  questions: QuizQuestion[];
};

type AverageApiResponse = {
  allGrades?: any[];
};

const SUBJECT_ORDER = ['English', 'Algebra', 'Science', 'History', 'Spanish', 'PE', 'Art'];
const STUDENT_ID = '1';

function normalizeCourseName(raw: string) {
  const value = String(raw || '').toLowerCase();
  if (/(pre[- ]?algebra|algebra|alg\b)/.test(value)) return 'Algebra';
  if (/(english|language arts|ela|reading)/.test(value)) return 'English';
  if (/(science|biology|chemistry|physics)/.test(value)) return 'Science';
  if (/(social studies|history|civics|government|world history)/.test(value)) return 'History';
  if (/(world language|spanish|french|german|latin|mandarin|japanese)/.test(value)) return 'Spanish';
  if (/(physical education|pe|health|fitness)/.test(value)) return 'PE';
  if (/(drama|media|music|art|band|choir)/.test(value)) return 'Art';
  return '';
}

function genericQuestionsFor(subject: string): QuizQuestion[] {
  return [
    {
      id: `${subject.toLowerCase()}-g1`,
      prompt: `${subject}: Which study strategy is most effective before a quiz?`,
      options: ['Re-read once quickly', 'Practice retrieval with questions', 'Skip notes', 'Only highlight text'],
      correctIndex: 1,
    },
    {
      id: `${subject.toLowerCase()}-g2`,
      prompt: `${subject}: What should you do after getting a question wrong?`,
      options: ['Ignore it', 'Guess again only', 'Review why the correct answer works', 'Move on immediately'],
      correctIndex: 2,
    },
  ];
}

const SUBJECT_QUIZZES: SubjectQuiz[] = [
  {
    subject: 'Algebra',
    questions: [
      {
        id: 'alg-1',
        prompt: 'If 3x + 5 = 20, what is x?',
        options: ['3', '4', '5', '6'],
        correctIndex: 2,
      },
      {
        id: 'alg-2',
        prompt: 'What is the slope of y = 2x - 7?',
        options: ['-7', '2', '7', '-2'],
        correctIndex: 1,
      },
    ],
  },
  {
    subject: 'English',
    questions: [
      {
        id: 'eng-1',
        prompt: 'Which option is a complete sentence?',
        options: [
          'Because the bell rang.',
          'After lunch in the cafeteria.',
          'The students finished their project.',
          'Running down the hallway.',
        ],
        correctIndex: 2,
      },
      {
        id: 'eng-2',
        prompt: 'What is the main purpose of a thesis statement?',
        options: [
          'To summarize every paragraph',
          'To present the central claim of an essay',
          'To list references',
          'To add dialogue',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    subject: 'Science',
    questions: [
      {
        id: 'sci-1',
        prompt: 'What is the primary source of energy for Earth?',
        options: ['The Moon', 'The Sun', 'Wind', 'Ocean currents'],
        correctIndex: 1,
      },
      {
        id: 'sci-2',
        prompt: 'Which state of matter has a definite volume but no definite shape?',
        options: ['Solid', 'Liquid', 'Gas', 'Plasma'],
        correctIndex: 1,
      },
    ],
  },
  {
    subject: 'History',
    questions: [
      {
        id: 'his-1',
        prompt: 'Which document begins with "We the People"?',
        options: ['Declaration of Independence', 'Constitution', 'Bill of Rights', 'Emancipation Proclamation'],
        correctIndex: 1,
      },
      {
        id: 'his-2',
        prompt: 'A primary source is best described as:',
        options: [
          'A textbook summary',
          'A modern documentary',
          'A first-hand account from the time period',
          'A historical fiction novel',
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    subject: 'Spanish',
    questions: [
      {
        id: 'spa-1',
        prompt: 'What does "biblioteca" mean in English?',
        options: ['Book', 'Library', 'Classroom', 'Notebook'],
        correctIndex: 1,
      },
      {
        id: 'spa-2',
        prompt: 'Choose the correct translation for "I am studying."',
        options: ['Estoy estudiando.', 'Soy estudiante.', 'Estoy cansado.', 'Tengo estudio.'],
        correctIndex: 0,
      },
    ],
  },
  {
    subject: 'PE',
    questions: [
      {
        id: 'pe-1',
        prompt: 'How many minutes should you exercise daily?',
        options: ['10', '20', '30', '60'],
        correctIndex: 2,
      },
      {
        id: 'pe-2',
        prompt: 'Which activity improves cardiovascular health?',
        options: ['Running', 'Reading', 'Painting', 'Sleeping'],
        correctIndex: 0,
      },
    ],
  },
  {
    subject: 'Art',
    questions: [
      {
        id: 'art-1',
        prompt: 'Who painted the Mona Lisa?',
        options: ['Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Claude Monet'],
        correctIndex: 2,
      },
      {
        id: 'art-2',
        prompt: 'What is the primary medium used in watercolor painting?',
        options: ['Oil paints', 'Acrylic paints', 'Water-based paints', 'Charcoal'],
        correctIndex: 2,
      },
    ],
  }
];

export default function TestPrepScreen() {
  const { isDark } = useAppTheme();
  const [subjectQuizzes, setSubjectQuizzes] = useState<SubjectQuiz[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectQuiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  const expoExtra = (Constants.expoConfig?.extra as any) || {};
  const provided = expoExtra.apiBaseUrl;
  const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  const apiBaseUrl = provided || defaultHost;

  const colors = useMemo(
    () => ({
      bg: isDark ? '#0f172a' : '#f8fafc',
      card: isDark ? '#111827' : '#ffffff',
      text: isDark ? '#e5e7eb' : '#0f172a',
      subtleText: isDark ? '#94a3b8' : '#64748b',
      border: isDark ? '#334155' : '#e2e8f0',
      accent: isDark ? '#38bdf8' : '#0ea5e9',
      optionBg: isDark ? '#1f2937' : '#f1f5f9',
    }),
    [isDark]
  );

  const currentQuestion = selectedSubject ? selectedSubject.questions[questionIndex] : null;

  useEffect(() => {
    let active = true;

    async function loadEnrolledSubjects() {
      setLoadingSubjects(true);
      setSubjectsError(null);

      try {
        const res = await fetch(`${apiBaseUrl}/api/chat/average/${STUDENT_ID}`);
        if (!res.ok) {
          throw new Error('Failed to load enrolled subjects');
        }

        const payload = (await res.json()) as AverageApiResponse;
        const seen = new Set<string>();

        for (const grade of payload.allGrades || []) {
          const rawCourse =
            grade?.assignments?.courses?.name ||
            grade?.assignments?.courses?.course_code ||
            grade?.assignments?.name ||
            '';

          const normalized = normalizeCourseName(String(rawCourse));
          if (normalized) {
            seen.add(normalized);
          }
        }

        const enrolled = SUBJECT_ORDER.filter((subject) => seen.has(subject));
        const derivedSubjects = enrolled.length > 0 ? enrolled : SUBJECT_ORDER;

        const quizzes = derivedSubjects.map((subject) => {
          const existingQuiz = SUBJECT_QUIZZES.find((q) => q.subject === subject);
          return {
            subject,
            questions: existingQuiz?.questions || genericQuestionsFor(subject),
          };
        });

        if (active) {
          setSubjectQuizzes(quizzes);
          if (selectedSubject && !quizzes.some((q) => q.subject === selectedSubject.subject)) {
            setSelectedSubject(null);
            setQuestionIndex(0);
          }
        }
      } catch {
        if (active) {
          setSubjectsError('Could not load enrolled subjects right now.');
          setSubjectQuizzes(
            SUBJECT_QUIZZES.map((q) => ({
              subject: q.subject,
              questions: q.questions,
            }))
          );
        }
      } finally {
        if (active) {
          setLoadingSubjects(false);
        }
      }
    }

    loadEnrolledSubjects();

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  function openSubject(subjectQuiz: SubjectQuiz) {
    setSelectedSubject(subjectQuiz);
    setQuestionIndex(0);
  }

  function handleAnswerSelect(selectedIndex: number) {
    if (!currentQuestion || !selectedSubject) return;

    const isCorrect = selectedIndex === currentQuestion.correctIndex;
    Alert.alert(
      isCorrect ? 'Correct' : 'Incorrect',
      isCorrect
        ? 'Nice work. Keep going.'
        : `The right answer is: ${currentQuestion.options[currentQuestion.correctIndex]}`,
      [
        {
          text: questionIndex < selectedSubject.questions.length - 1 ? 'Next Question' : 'Done',
          onPress: () => {
            if (questionIndex < selectedSubject.questions.length - 1) {
              setQuestionIndex((prev) => prev + 1);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.heading, { color: colors.text }]}>Test Prep</Text>
        <Text style={[styles.subheading, { color: colors.subtleText }]}>Practice quick quizzes by subject.</Text>

        {loadingSubjects ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.stateText, { color: colors.subtleText }]}>Loading enrolled subjects...</Text>
          </View>
        ) : !selectedSubject ? (
          <View style={styles.subjectList}>
            {subjectsError ? (
              <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.errorText, { color: colors.subtleText }]}>{subjectsError}</Text>
              </View>
            ) : null}

            {subjectQuizzes.map((item) => (
              <Pressable
                key={item.subject}
                style={[styles.subjectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openSubject(item)}>
                <Text style={[styles.subjectTitle, { color: colors.text }]}>{item.subject}</Text>
                <Text style={[styles.subjectMeta, { color: colors.subtleText }]}>
                  {item.questions.length} sample questions
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[styles.quizCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.quizHeaderRow}>
              <Text style={[styles.quizSubject, { color: colors.accent }]}>{selectedSubject.subject}</Text>
              <Text style={[styles.quizProgress, { color: colors.subtleText }]}>
                {questionIndex + 1}/{selectedSubject.questions.length}
              </Text>
            </View>

            <Text style={[styles.questionText, { color: colors.text }]}>{currentQuestion?.prompt}</Text>

            <View style={styles.optionsWrap}>
              {currentQuestion?.options.map((option, index) => (
                <Pressable
                  key={option}
                  onPress={() => handleAnswerSelect(index)}
                  style={[styles.optionButton, { backgroundColor: colors.optionBg, borderColor: colors.border }]}>
                  <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={() => setSelectedSubject(null)}>
              <Text style={[styles.backButtonText, { color: colors.subtleText }]}>Back to Subjects</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
  },
  subheading: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 15,
  },
  subjectList: {
    gap: 12,
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  subjectButton: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  subjectMeta: {
    marginTop: 4,
    fontSize: 13,
  },
  quizCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  quizHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  quizSubject: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quizProgress: {
    fontSize: 13,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 31,
    marginBottom: 18,
  },
  optionsWrap: {
    gap: 10,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
