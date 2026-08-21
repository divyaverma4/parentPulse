import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
  status: Status;
};

type SubjectQuizTemplate = {
  subject: string;
  questions: QuizQuestion[];
};

type QuizAnswer = {
  question: QuizQuestion;
  selectedIndex: number;
  isCorrect: boolean;
};

type Status = 'Action Recommended' | 'Needs Attention' | 'On Track';

type AverageApiResponse = {
  allGrades?: any[];
};

type BackendReport = {
  sampleReport?: {
    entries?: Array<{
      subjects?: Record<string, any>;
    }>;
  } | null;
};

const SUBJECT_ORDER = [
  'English Language Arts',
  'Pre-Algebra',
  'Religion',
  'Science',
  'Social Studies',
  'World Language',
  'Physical Education',
  'Art',
];
const STUDENT_ID = '1';
const STATUS_STYLES: Record<Status, { dot: string; chipBg: string; chipText: string }> = {
  'Action Recommended': { dot: '#ef4444', chipBg: '#fee2e2', chipText: '#b91c1c' },
  'Needs Attention': { dot: '#f59e0b', chipBg: '#fef3c7', chipText: '#b45309' },
  'On Track': { dot: '#22c55e', chipBg: '#dcfce7', chipText: '#15803d' },
};

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

function orderedUniqueSubjects(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

const QUIZ_LENGTH = 5;

function genericQuestionsFor(subject: string): QuizQuestion[] {
  const slug = subject.toLowerCase().replace(/\s+/g, '-');
  return [
    {
      id: `${slug}-g1`,
      prompt: `${subject}: Which study strategy is most effective before a quiz?`,
      options: ['Re-read once quickly', 'Practice retrieval with questions', 'Skip notes', 'Only highlight text'],
      correctIndex: 1,
    },
    {
      id: `${slug}-g2`,
      prompt: `${subject}: What should you do after getting a question wrong?`,
      options: ['Ignore it', 'Guess again only', 'Review why the correct answer works', 'Move on immediately'],
      correctIndex: 2,
    },
    {
      id: `${slug}-g3`,
      prompt: `${subject}: How far in advance should you start studying for a test?`,
      options: ['The night before', 'Several days ahead', 'Never', 'During the test'],
      correctIndex: 1,
    },
    {
      id: `${slug}-g4`,
      prompt: `${subject}: What is a good way to check your own understanding?`,
      options: ['Explain it in your own words', 'Copy the textbook', 'Avoid questions', 'Memorize without meaning'],
      correctIndex: 0,
    },
    {
      id: `${slug}-g5`,
      prompt: `${subject}: Which habit best supports long-term retention?`,
      options: ['Cramming once', 'Spaced repetition over time', 'Studying only once', 'Skipping review'],
      correctIndex: 1,
    },
    {
      id: `${slug}-g6`,
      prompt: `${subject}: When should you ask a teacher for help?`,
      options: ['Never', 'Only after failing', 'As soon as you are confused', 'At the end of the year'],
      correctIndex: 2,
    },
  ];
}

function shuffleQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const SUBJECT_QUIZZES: SubjectQuizTemplate[] = [
  {
    subject: 'Pre-Algebra',
    questions: [
      { id: 'alg-1', prompt: 'If 3x + 5 = 20, what is x?', options: ['3', '4', '5', '6'], correctIndex: 2 },
      { id: 'alg-2', prompt: 'What is the slope of y = 2x - 7?', options: ['-7', '2', '7', '-2'], correctIndex: 1 },
      { id: 'alg-3', prompt: 'What is the value of 4^2?', options: ['8', '12', '16', '20'], correctIndex: 2 },
      { id: 'alg-4', prompt: 'Solve for x: x/3 = 9', options: ['3', '12', '27', '6'], correctIndex: 2 },
      { id: 'alg-5', prompt: 'What is the greatest common factor of 12 and 18?', options: ['2', '3', '6', '9'], correctIndex: 2 },
      { id: 'alg-6', prompt: 'Which of these is an equivalent fraction to 2/3?', options: ['4/9', '6/9', '3/4', '5/6'], correctIndex: 1 },
      { id: 'alg-7', prompt: 'What is -5 + 8?', options: ['-13', '-3', '3', '13'], correctIndex: 2 },
      { id: 'alg-8', prompt: 'What is the perimeter of a square with side length 6?', options: ['12', '18', '24', '36'], correctIndex: 2 },
    ],
  },
  {
    subject: 'English Language Arts',
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
        options: ['To summarize every paragraph', 'To present the central claim of an essay', 'To list references', 'To add dialogue'],
        correctIndex: 1,
      },
      {
        id: 'eng-3',
        prompt: 'Which word is a synonym for "happy"?',
        options: ['Joyful', 'Furious', 'Tired', 'Confused'],
        correctIndex: 0,
      },
      {
        id: 'eng-4',
        prompt: 'What type of word is "quickly"?',
        options: ['Noun', 'Verb', 'Adverb', 'Pronoun'],
        correctIndex: 2,
      },
      {
        id: 'eng-5',
        prompt: 'Which sentence uses correct punctuation?',
        options: ['I like apples oranges, and pears.', 'I like apples, oranges, and pears.', 'I like apples oranges and pears', 'I like, apples, oranges and pears.'],
        correctIndex: 1,
      },
      {
        id: 'eng-6',
        prompt: 'What is the plural form of "child"?',
        options: ['Childs', 'Childes', 'Children', 'Child\'s'],
        correctIndex: 2,
      },
      {
        id: 'eng-7',
        prompt: 'In a story, the "setting" refers to:',
        options: ['The characters', 'The time and place', 'The theme', 'The conflict'],
        correctIndex: 1,
      },
    ],
  },
  {
    subject: 'Science',
    questions: [
      { id: 'sci-1', prompt: 'What is the primary source of energy for Earth?', options: ['The Moon', 'The Sun', 'Wind', 'Ocean currents'], correctIndex: 1 },
      { id: 'sci-2', prompt: 'Which state of matter has a definite volume but no definite shape?', options: ['Solid', 'Liquid', 'Gas', 'Plasma'], correctIndex: 1 },
      { id: 'sci-3', prompt: 'What gas do plants absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 2 },
      { id: 'sci-4', prompt: 'Which organ pumps blood through the body?', options: ['Lungs', 'Heart', 'Liver', 'Kidney'], correctIndex: 1 },
      { id: 'sci-5', prompt: 'What force pulls objects toward Earth?', options: ['Friction', 'Magnetism', 'Gravity', 'Tension'], correctIndex: 2 },
      { id: 'sci-6', prompt: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], correctIndex: 1 },
      { id: 'sci-7', prompt: 'What is the smallest unit of life?', options: ['Atom', 'Molecule', 'Cell', 'Tissue'], correctIndex: 2 },
    ],
  },
  {
    subject: 'Social Studies',
    questions: [
      { id: 'his-1', prompt: 'Which document begins with "We the People"?', options: ['Declaration of Independence', 'Constitution', 'Bill of Rights', 'Emancipation Proclamation'], correctIndex: 1 },
      {
        id: 'his-2',
        prompt: 'A primary source is best described as:',
        options: ['A textbook summary', 'A modern documentary', 'A first-hand account from the time period', 'A historical fiction novel'],
        correctIndex: 2,
      },
      { id: 'his-3', prompt: 'What is the capital of the United States?', options: ['New York City', 'Washington, D.C.', 'Philadelphia', 'Boston'], correctIndex: 1 },
      { id: 'his-4', prompt: 'Which branch of government makes laws?', options: ['Executive', 'Judicial', 'Legislative', 'Military'], correctIndex: 2 },
      { id: 'his-5', prompt: 'What continent is Egypt located on?', options: ['Asia', 'Africa', 'Europe', 'South America'], correctIndex: 1 },
      { id: 'his-6', prompt: 'Who was the first President of the United States?', options: ['Thomas Jefferson', 'Abraham Lincoln', 'George Washington', 'John Adams'], correctIndex: 2 },
    ],
  },
  {
    subject: 'World Language',
    questions: [
      { id: 'spa-1', prompt: 'What does "biblioteca" mean in English?', options: ['Book', 'Library', 'Classroom', 'Notebook'], correctIndex: 1 },
      { id: 'spa-2', prompt: 'Choose the correct translation for "I am studying."', options: ['Estoy estudiando.', 'Soy estudiante.', 'Estoy cansado.', 'Tengo estudio.'], correctIndex: 0 },
      { id: 'spa-3', prompt: 'What does "gracias" mean?', options: ['Please', 'Sorry', 'Thank you', 'Hello'], correctIndex: 2 },
      { id: 'spa-4', prompt: 'Which word means "school" in Spanish?', options: ['Escuela', 'Casa', 'Tienda', 'Parque'], correctIndex: 0 },
      { id: 'spa-5', prompt: 'How do you say "good morning" in Spanish?', options: ['Buenas noches', 'Buenos dias', 'Buenas tardes', 'Hasta luego'], correctIndex: 1 },
      { id: 'spa-6', prompt: 'What does "amigo" mean in English?', options: ['Enemy', 'Teacher', 'Friend', 'Family'], correctIndex: 2 },
    ],
  },
  {
    subject: 'Physical Education',
    questions: [
      { id: 'pe-1', prompt: 'How many minutes should you exercise daily?', options: ['10', '20', '30', '60'], correctIndex: 2 },
      { id: 'pe-2', prompt: 'Which activity improves cardiovascular health?', options: ['Running', 'Reading', 'Painting', 'Sleeping'], correctIndex: 0 },
      { id: 'pe-3', prompt: 'What should you do before intense exercise?', options: ['Eat a large meal', 'Warm up', 'Skip stretching', 'Sit down'], correctIndex: 1 },
      { id: 'pe-4', prompt: 'Which of these is a team sport?', options: ['Basketball', 'Swimming laps alone', 'Solo jogging', 'Solo yoga'], correctIndex: 0 },
      { id: 'pe-5', prompt: 'Why is stretching important?', options: ['It has no benefit', 'It increases flexibility and reduces injury', 'It tires you out', 'It slows your heart rate'], correctIndex: 1 },
      { id: 'pe-6', prompt: 'What should you drink to stay hydrated during exercise?', options: ['Soda', 'Water', 'Coffee', 'Juice only'], correctIndex: 1 },
    ],
  },
  {
    subject: 'Religion',
    questions: [
      { id: 'rel-1', prompt: 'In class discussion, what does reflection usually help strengthen?', options: ['Memory and understanding', 'Only handwriting', 'Only speed', 'Only attendance'], correctIndex: 0 },
      { id: 'rel-2', prompt: 'What is the best first step when reviewing a religion study guide?', options: ['Skip definitions', 'Review key concepts and vocabulary', 'Memorize one sentence only', 'Ignore class notes'], correctIndex: 1 },
      { id: 'rel-3', prompt: 'Why are class discussions valuable in religion class?', options: ['They waste time', 'They build understanding through different perspectives', 'They replace studying', 'They are optional'], correctIndex: 1 },
      { id: 'rel-4', prompt: 'What is a good way to remember key vocabulary terms?', options: ['Flashcards and repetition', 'Reading once', 'Ignoring definitions', 'Guessing on tests'], correctIndex: 0 },
      { id: 'rel-5', prompt: 'What should you do if you do not understand a concept in class?', options: ['Stay silent', 'Ask a question', 'Skip the assignment', 'Guess randomly'], correctIndex: 1 },
    ],
  },
  {
    subject: 'Art',
    questions: [
      { id: 'art-1', prompt: 'Who painted the Mona Lisa?', options: ['Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Claude Monet'], correctIndex: 2 },
      { id: 'art-2', prompt: 'What is the primary medium used in watercolor painting?', options: ['Oil paints', 'Acrylic paints', 'Water-based paints', 'Charcoal'], correctIndex: 2 },
      { id: 'art-3', prompt: 'Which colors are considered primary colors?', options: ['Red, blue, yellow', 'Green, orange, purple', 'Black, white, gray', 'Pink, teal, brown'], correctIndex: 0 },
      { id: 'art-4', prompt: 'What art technique uses light and dark contrast?', options: ['Chiaroscuro', 'Collage', 'Pointillism', 'Sculpting'], correctIndex: 0 },
      { id: 'art-5', prompt: 'What is a "still life" in art?', options: ['A moving scene', 'An artwork of inanimate objects', 'A self-portrait', 'A landscape only'], correctIndex: 1 },
      { id: 'art-6', prompt: 'Which tool is commonly used for sketching?', options: ['Pencil', 'Hammer', 'Scissors', 'Ruler only'], correctIndex: 0 },
    ],
  },
];

export default function TestPrepScreen() {
  const params = useLocalSearchParams<{ subject?: string | string[] }>();
  const { isDark } = useAppTheme();
  const [subjectQuizzes, setSubjectQuizzes] = useState<SubjectQuiz[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectQuiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [autoOpenedRouteSubject, setAutoOpenedRouteSubject] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
  const [aiFeedbackError, setAiFeedbackError] = useState('');

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
      success: isDark ? '#22c55e' : '#16a34a',
      danger: isDark ? '#f87171' : '#dc2626',
    }),
    [isDark]
  );

  const currentQuestion = selectedSubject ? selectedSubject.questions[questionIndex] : null;
  const requestedSubject = useMemo(() => {
    const raw = Array.isArray(params.subject) ? params.subject[0] : params.subject;
    return raw ? String(raw) : '';
  }, [params.subject]);

  useEffect(() => {
    let active = true;

    async function loadEnrolledSubjects() {
      setLoadingSubjects(true);
      setSubjectsError(null);

      try {
        const [reportResult, gradesResult] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/api/report/latest`),
          fetch(`${apiBaseUrl}/api/chat/average/${STUDENT_ID}`),
        ]);

        let reportSubjects: Record<string, any> = {};
        if (reportResult.status === 'fulfilled' && reportResult.value.ok) {
          const reportPayload = (await reportResult.value.json()) as BackendReport;
          reportSubjects = reportPayload.sampleReport?.entries?.[0]?.subjects || {};
        }

        if (gradesResult.status !== 'fulfilled' || !gradesResult.value.ok) {
          throw new Error('Failed to load enrolled subjects');
        }

        const payload = (await gradesResult.value.json()) as AverageApiResponse;
        const seen = new Set<string>();
        const buckets: Record<string, { grades: number[]; missingCount: number }> = {};

        for (const grade of payload.allGrades || []) {
          const rawCourse =
            grade?.assignments?.courses?.name ||
            grade?.assignments?.courses?.course_code ||
            grade?.assignments?.name ||
            '';

          const normalized = normalizeCourseName(String(rawCourse));
          if (normalized) {
            seen.add(normalized);

            if (!buckets[normalized]) {
              buckets[normalized] = { grades: [], missingCount: 0 };
            }

            const score = Number(grade?.score);
            const max = Number(grade?.assignments?.points_possible);
            const missing = Boolean(grade?.missing);
            const excused = Boolean(grade?.excused);

            if (missing) {
              buckets[normalized].missingCount += 1;
            }

            if (!missing && !excused && Number.isFinite(score) && Number.isFinite(max) && max > 0) {
              buckets[normalized].grades.push((score / max) * 100);
            }
          }
        }

        const derivedSubjects = orderedUniqueSubjects([
          ...Object.keys(reportSubjects).map((name) => normalizeCourseName(name)),
          ...SUBJECT_ORDER.filter((subject) => seen.has(subject)),
          ...Array.from(seen),
        ]);

        const subjectsToRender = derivedSubjects.length > 0 ? derivedSubjects : SUBJECT_ORDER;

        const quizzes = subjectsToRender.map((subject) => {
          const bucket = buckets[subject] || { grades: [], missingCount: 0 };
          const avgGrade =
            bucket.grades.length > 0
              ? bucket.grades.reduce((sum, g) => sum + g, 0) / bucket.grades.length
              : null;

          let status: Status = 'On Track';
          if (bucket.missingCount > 0 || (avgGrade !== null && avgGrade < 80)) {
            status = 'Action Recommended';
          } else if (avgGrade !== null && avgGrade < 90) {
            status = 'Needs Attention';
          }

          const existingQuiz = SUBJECT_QUIZZES.find((q) => q.subject === subject);
          return {
            subject,
            questions: existingQuiz?.questions || genericQuestionsFor(subject),
            status,
          };
        });

        if (active) {
          setSubjectQuizzes(quizzes);
        }
      } catch {
        if (active) {
          setSubjectsError('Could not load enrolled subjects right now.');
          setSubjectQuizzes(
            SUBJECT_QUIZZES.map((q) => ({
              subject: q.subject,
              questions: q.questions,
              status: 'On Track' as Status,
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

  useEffect(() => {
    if (!requestedSubject) {
      setAutoOpenedRouteSubject(null);
      return;
    }

    if (autoOpenedRouteSubject === requestedSubject) return;
    if (loadingSubjects || subjectQuizzes.length === 0) return;

    const matchingQuiz = subjectQuizzes.find(
      (q) => q.subject.toLowerCase() === requestedSubject.toLowerCase()
    );

    if (matchingQuiz) {
      openSubject(matchingQuiz);
      setAutoOpenedRouteSubject(requestedSubject);
    }
  }, [autoOpenedRouteSubject, loadingSubjects, requestedSubject, subjectQuizzes]);

  function openSubject(subjectQuiz: SubjectQuiz) {
    const pool = shuffleQuestions(subjectQuiz.questions);
    setSelectedSubject({
      ...subjectQuiz,
      questions: pool.slice(0, Math.min(QUIZ_LENGTH, pool.length)),
    });
    setQuestionIndex(0);
    setScore(0);
    setQuizAnswers([]);
    setQuizComplete(false);
    setAiFeedback('');
    setAiFeedbackError('');
  }

  function retakeQuiz() {
    if (selectedSubject) {
      const original = subjectQuizzes.find((q) => q.subject === selectedSubject.subject);
      if (original) openSubject(original);
    }
  }

  function exitQuiz() {
    setSelectedSubject(null);
    setQuestionIndex(0);
    setFeedbackVisible(false);
    setQuizComplete(false);
    setAiFeedback('');
    setAiFeedbackError('');
  }

  function handleAnswerSelect(selectedIndex: number) {
    if (!currentQuestion || !selectedSubject) return;

    const isCorrect = selectedIndex === currentQuestion.correctIndex;
    setScore((prev) => (isCorrect ? prev + 1 : prev));
    setQuizAnswers((prev) => [...prev, { question: currentQuestion, selectedIndex, isCorrect }]);
    setFeedbackTitle(isCorrect ? 'Correct' : 'Incorrect');
    setFeedbackMessage(
      isCorrect
        ? 'Nice work. Keep going.'
        : `The right answer is: ${currentQuestion.options[currentQuestion.correctIndex]}`
    );
    setFeedbackVisible(true);
  }

  function handleFeedbackContinue() {
    setFeedbackVisible(false);

    if (selectedSubject && questionIndex < selectedSubject.questions.length - 1) {
      setQuestionIndex((prev) => prev + 1);
      return;
    }

    setQuizComplete(true);
    requestAiFeedback();
  }

  async function requestAiFeedback() {
    if (!selectedSubject) return;

    setAiFeedbackLoading(true);
    setAiFeedbackError('');

    const missed = quizAnswers.filter((a) => !a.isCorrect);
    const summaryLines = quizAnswers
      .map((a, idx) => {
        const yourAnswer = a.question.options[a.selectedIndex];
        const correctAnswer = a.question.options[a.question.correctIndex];
        return `${idx + 1}. ${a.question.prompt}\nStudent answered: ${yourAnswer} (${a.isCorrect ? 'correct' : 'incorrect, correct answer: ' + correctAnswer})`;
      })
      .join('\n');

    const question = `A student just finished a ${selectedSubject.subject} practice quiz and scored ${score}/${quizAnswers.length}. Here are the results:\n${summaryLines}\n\nBased on the questions missed (${missed.length}), give 2-3 short, encouraging, actionable tips for how the student can improve in ${selectedSubject.subject}.`;

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, studentUserId: STUDENT_ID }),
      });

      if (!response.ok) throw new Error('Request failed');

      const payload = await response.json();
      const text = payload?.response || payload?.answer || payload?.message || '';
      if (!text) throw new Error('No feedback returned');
      setAiFeedback(text);
    } catch {
      setAiFeedbackError('Could not load personalized feedback right now.');
    } finally {
      setAiFeedbackLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
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
                onPress={() => openSubject(item)}
              >
                <View style={styles.subjectRow}>
                  <View>
                    <Text style={[styles.subjectTitle, { color: colors.text }]}>{item.subject}</Text>
                    <Text style={[styles.subjectMeta, { color: colors.subtleText }]}>
                      {Math.min(QUIZ_LENGTH, item.questions.length)}-question shuffled quiz
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: STATUS_STYLES[item.status].chipBg },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: STATUS_STYLES[item.status].dot },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: STATUS_STYLES[item.status].chipText },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : quizComplete ? (
          <View style={[styles.quizCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.quizSubject, { color: colors.accent }]}>{selectedSubject.subject} Results</Text>
            <Text style={[styles.scoreText, { color: colors.text }]}>
              {score}/{selectedSubject.questions.length}
            </Text>
            <Text style={[styles.scoreSubtext, { color: colors.subtleText }]}>
              {score === selectedSubject.questions.length
                ? 'Perfect score! Great job.'
                : 'Keep practicing to improve your score.'}
            </Text>

            <View style={styles.resultsList}>
              {quizAnswers.map((answer, idx) => (
                <View
                  key={answer.question.id}
                  style={[
                    styles.resultItem,
                    { borderColor: colors.border, backgroundColor: colors.optionBg },
                  ]}
                >
                  <Text style={[styles.resultPrompt, { color: colors.text }]}>
                    {idx + 1}. {answer.question.prompt}
                  </Text>
                  <Text
                    style={[
                      styles.resultAnswer,
                      { color: answer.isCorrect ? colors.success : colors.danger },
                    ]}
                  >
                    {answer.isCorrect ? 'Correct' : 'Incorrect'} — your answer: {answer.question.options[answer.selectedIndex]}
                  </Text>
                  {!answer.isCorrect ? (
                    <Text style={[styles.resultReasoning, { color: colors.subtleText }]}>
                      Correct answer: {answer.question.options[answer.question.correctIndex]}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>

            <View
              style={[
                styles.aiFeedbackCard,
                { borderColor: colors.border, backgroundColor: colors.optionBg },
              ]}
            >
              <Text style={[styles.aiFeedbackTitle, { color: colors.text }]}>How to improve</Text>
              {aiFeedbackLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : aiFeedbackError ? (
                <Text style={[styles.resultReasoning, { color: colors.subtleText }]}>{aiFeedbackError}</Text>
              ) : (
                <Text style={[styles.aiFeedbackText, { color: colors.subtleText }]}>{aiFeedback}</Text>
              )}
            </View>

            <View style={styles.summaryButtonRow}>
              <Pressable
                style={[styles.retakeButton, { backgroundColor: colors.accent }]}
                onPress={retakeQuiz}
              >
                <Text style={styles.modalButtonText}>Retake Quiz</Text>
              </Pressable>
              <Pressable
                style={[styles.backButton, { borderColor: colors.border }]}
                onPress={exitQuiz}
              >
                <Text style={[styles.backButtonText, { color: colors.subtleText }]}>Back to Subjects</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.quizCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.quizHeaderRow}>
              <View>
                <Text style={[styles.quizSubject, { color: colors.accent }]}>{selectedSubject.subject}</Text>
                <View
                  style={[
                    styles.quizStatusChip,
                    { backgroundColor: STATUS_STYLES[selectedSubject.status].chipBg },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_STYLES[selectedSubject.status].dot },
                    ]}
                  />
                  <Text
                    style={[
                      styles.quizStatusText,
                      { color: STATUS_STYLES[selectedSubject.status].chipText },
                    ]}
                  >
                    {selectedSubject.status}
                  </Text>
                </View>
              </View>
              <View style={styles.progressWrap}>
                <Text style={[styles.quizProgress, { color: colors.subtleText }]}>
                  Question {questionIndex + 1}/{selectedSubject.questions.length}
                </Text>
                <Text style={[styles.quizScoreLabel, { color: colors.subtleText }]}>Score: {score}</Text>
              </View>
            </View>

            <Text style={[styles.questionText, { color: colors.text }]}>{currentQuestion?.prompt}</Text>

            <View style={styles.optionsWrap}>
              {currentQuestion?.options.map((option, index) => (
                <Pressable
                  key={option}
                  disabled={feedbackVisible}
                  onPress={() => handleAnswerSelect(index)}
                  style={[styles.optionButton, { backgroundColor: colors.optionBg, borderColor: colors.border }]}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={exitQuiz}
            >
              <Text style={[styles.backButtonText, { color: colors.subtleText }]}>
                Exit Quiz
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={feedbackVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedbackVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{feedbackTitle}</Text>
            <Text style={[styles.modalMessage, { color: colors.subtleText }]}>{feedbackMessage}</Text>

            <Pressable
              style={[styles.modalButton, { backgroundColor: colors.accent }]}
              onPress={handleFeedbackContinue}
            >
              <Text style={styles.modalButtonText}>
                {selectedSubject && questionIndex < selectedSubject.questions.length - 1
                  ? 'Next Question'
                  : 'See Results'}
              </Text>
            </Pressable>
          </View>

        </View>
      </Modal>
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
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  subjectMeta: {
    marginTop: 4,
    fontSize: 13,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quizCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  quizHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  quizSubject: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quizStatusChip: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  quizStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressWrap: {
    alignItems: 'flex-end',
  },
  quizProgress: {
    fontSize: 13,
    fontWeight: '600',
  },
  quizScoreLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  scoreText: {
    marginTop: 10,
    fontSize: 40,
    fontWeight: '800',
  },
  scoreSubtext: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 14,
  },
  resultsList: {
    gap: 10,
    marginBottom: 16,
  },
  resultItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  resultPrompt: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  resultAnswer: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultReasoning: {
    marginTop: 4,
    fontSize: 13,
  },
  aiFeedbackCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  aiFeedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  aiFeedbackText: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryButtonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  retakeButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 16,
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

