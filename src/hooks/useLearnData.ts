import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from '@/hooks/useAuth';

export type LearningTopic = {
  id: string;
  title: string;
  icon: string;
  color: string;
};

export type LearningLesson = {
  id: string;
  topic_id: string;
  title: string;
  content: string;
  points: number;
};

const DEFAULT_TOPICS: LearningTopic[] = [
  { id: 'climate_change', title: 'Climate Change', icon: '🌡️', color: 'green' },
  { id: 'water', title: 'Water Conservation', icon: '💧', color: 'blue' },
];

let memoryTopics: LearningTopic[] = [...DEFAULT_TOPICS];
let memoryLessons: LearningLesson[] = [];

// Legacy teacher content utilities (kept for compatibility with TeacherContent page).
export function readTopicsFromStorage(): LearningTopic[] {
  return [...memoryTopics];
}

export function readLessonsFromStorage(): LearningLesson[] {
  return [...memoryLessons];
}

export function writeTopicsToStorage(topics: LearningTopic[]) {
  memoryTopics = [...topics];
}

export function writeLessonsToStorage(lessons: LearningLesson[]) {
  memoryLessons = [...lessons];
}

export const TOPIC_INFO: Record<string, { label: string; icon: string; color: string }> = {
  climate_change: { label: 'Climate Change', icon: '🌡️', color: 'green' },
  pollution: { label: 'Pollution & Waste', icon: '🏭', color: 'slate' },
  waste: { label: 'Waste Management', icon: '♻️', color: 'emerald' },
  energy: { label: 'Renewable Energy', icon: '⚡', color: 'orange' },
  water: { label: 'Water Conservation', icon: '💧', color: 'blue' },
  biodiversity: { label: 'Biodiversity', icon: '🦋', color: 'violet' },
};

export const TOPIC_GRADIENTS: Record<string, string> = {
  climate_change: 'from-[hsl(152,44%,15%)] to-[hsl(153,43%,30%)]',
  pollution: 'from-[hsl(210,24%,24%)] to-[hsl(208,27%,34%)]',
  waste: 'from-[hsl(153,43%,30%)] to-[hsl(153,41%,42%)]',
  energy: 'from-[hsl(27,100%,25%)] to-[hsl(30,89%,38%)]',
  water: 'from-[hsl(201,100%,36%)] to-[hsl(193,100%,43%)]',
  biodiversity: 'from-[hsl(264,81%,31%)] to-[hsl(267,63%,46%)]',
};

export function getTopicGradientClass(color: string): string {
  return TOPIC_GRADIENTS[color] || TOPIC_GRADIENTS.climate_change;
}

function mapLessonForUi(lesson: any) {
  const body = lesson.content_json?.body || lesson.content_json?.content || lesson.description || '';
  const summary = lesson.content_json?.summary || body.slice(0, 160) || 'This lesson is ready to explore.';
  const normalizedTopic = lesson.topic_id || lesson.topic || '';

  return {
    ...lesson,
    topic: normalizedTopic,
    topic_id: normalizedTopic,
    body,
    summary,
    estimated_minutes: lesson.estimated_minutes || 5,
    eco_points_reward: Number(lesson.eco_points_reward || 0),
    content_json: lesson.content_json || { body, summary },
    fact_boxes: lesson.fact_boxes || [],
    key_takeaways: lesson.key_takeaways || [],
  };
}

export function useLearningTopics() {
  return useQuery({
    queryKey: ['learning-topics'],
    queryFn: async () => {
      const topics = await supabaseQueries.learningTopics.getAll();
      return topics.map((topic: any) => ({
        id: topic.id,
        title: topic.title,
        icon: topic.icon || TOPIC_INFO[topic.id]?.icon || '📘',
        color: topic.color || TOPIC_INFO[topic.id]?.color || 'green',
      }));
    },
  });
}

export function useLessons(topic?: string) {
  return useQuery({
    queryKey: ['lessons', topic],
    queryFn: async () => {
      const lessons = topic
        ? await supabaseQueries.lessons.getByTopic(topic)
        : await supabaseQueries.lessons.getAll();
      return lessons.map(mapLessonForUi);
    },
  });
}

export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const lesson = await supabaseQueries.lessons.getById(lessonId);
      return lesson ? mapLessonForUi(lesson) : null;
    },
    enabled: !!lessonId,
  });
}

export function useUserCompletions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['lesson-completions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const lessonIds = await supabaseQueries.lessonCompletions.getUserCompletions(user.id);
      return lessonIds.map((lesson_id) => ({ lesson_id }));
    },
    enabled: !!user,
  });
}

export function useQuizAttempts(topic?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['quiz-attempts', user?.id, topic],
    queryFn: async () => {
      if (!user) return [];

      const [attempts, lessons] = await Promise.all([
        supabaseQueries.quizAttempts.getUserAttempts(user.id),
        supabaseQueries.lessons.getAll(),
      ]);

      const lessonTopicMap = new Map(lessons.map((l: any) => [l.id, l.topic]));

      let normalized = attempts.map((a: any) => ({
        ...a,
        topic: lessonTopicMap.get(a.lesson_id) || 'unknown',
      }));

      if (topic) {
        normalized = normalized.filter((a: any) => a.topic === topic);
      }

      return normalized.sort((a: any, b: any) => b.score - a.score);
    },
    enabled: !!user,
  });
}

export function useTopicProgress() {
  const { data: topics = [] } = useLearningTopics();
  const { data: lessons = [] } = useLessons();
  const { data: completions = [] } = useUserCompletions();

  const progressByTopic: Record<string, { completed: number; total: number; percentage: number }> = {};
  const completedIds = new Set(completions.map((c: any) => c.lesson_id));

  topics.forEach((topic) => {
    const topicLessons = lessons.filter((l: any) => l.topic === topic.id);
    const completedCount = topicLessons.filter((l: any) => completedIds.has(l.id)).length;
    progressByTopic[topic.id] = {
      completed: completedCount,
      total: topicLessons.length,
      percentage: topicLessons.length > 0 ? Math.round((completedCount / topicLessons.length) * 100) : 0,
    };
  });

  return progressByTopic;
}

export function useCompleteLesson() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, ecoPoints }: { lessonId: string; ecoPoints: number }) => {
      if (!user) throw new Error('Not authenticated');

      const completedIds = await supabaseQueries.lessonCompletions.getUserCompletions(user.id);
      if (completedIds.includes(lessonId)) {
        return { alreadyCompleted: true };
      }

      await supabaseQueries.lessonCompletions.markComplete(user.id, lessonId);
      await supabaseQueries.profiles.addEcoPoints(user.id, ecoPoints);

      const today = new Date().toISOString().split('T')[0];
      const existingDaily = await supabaseQueries.dailyPoints.getByUserAndDate(user.id, today);
      const nextPoints = (existingDaily?.points_earned || 0) + ecoPoints;
      await supabaseQueries.dailyPoints.recordPoints(user.id, nextPoints, today);

      return { alreadyCompleted: false, pointsAwarded: ecoPoints };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-completions'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-points'] });
      queryClient.invalidateQueries({ queryKey: ['rank'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void refreshProfile();
    },
  });
}

export function useSaveQuizAttempt() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ topic, score, totalQuestions }: { topic: string; score: number; totalQuestions: number }) => {
      if (!user) throw new Error('Not authenticated');

      const pointsEarned = Math.round((score / totalQuestions) * 30 / 10) * 10;

      const lessons = await supabaseQueries.lessons.getByTopic(topic);
      const lessonId = lessons[0]?.id;
      if (!lessonId) throw new Error(`No lesson found for topic: ${topic}`);

      await supabaseQueries.quizAttempts.create({
        user_id: user.id,
        lesson_id: lessonId,
        score,
        total_questions: totalQuestions,
        points_earned: pointsEarned,
      } as any);

      await supabaseQueries.profiles.addEcoPoints(user.id, pointsEarned);

      const today = new Date().toISOString().split('T')[0];
      const existingDaily = await supabaseQueries.dailyPoints.getByUserAndDate(user.id, today);
      const nextPoints = (existingDaily?.points_earned || 0) + pointsEarned;
      await supabaseQueries.dailyPoints.recordPoints(user.id, nextPoints, today);

      return { pointsEarned };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-points'] });
      queryClient.invalidateQueries({ queryKey: ['rank'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void refreshProfile();
    },
  });
}

export function useRecommendedLessons(limit: number = 3) {
  const { data: topics = [] } = useLearningTopics();
  const { data: lessons = [] } = useLessons();
  const { data: completions = [] } = useUserCompletions();
  const { data: attempts = [] } = useQuizAttempts();

  const completedIds = new Set(completions.map((c: any) => c.lesson_id));

  const lastAttemptByTopic = new Map<string, any>();
  attempts.forEach((attempt: any) => {
    if (!lastAttemptByTopic.has(attempt.topic)) {
      lastAttemptByTopic.set(attempt.topic, attempt);
    }
  });

  const recommendations = topics
    .map((topic) => {
      const topicLessons = lessons.filter((l: any) => l.topic === topic.id);
      const completed = topicLessons.filter((l: any) => completedIds.has(l.id)).length;
      const completionRate = topicLessons.length ? completed / topicLessons.length : 0;

      const topicQuiz = lastAttemptByTopic.get(topic.id);
      const quizScore = topicQuiz ? topicQuiz.score / Math.max(topicQuiz.total_questions || 1, 1) : 0;

      const priority = (1 - completionRate) * 0.65 + (1 - quizScore) * 0.35;
      const nextLesson = topicLessons.find((l: any) => !completedIds.has(l.id));

      return {
        topicId: topic.id,
        topicTitle: topic.title,
        lesson: nextLesson,
        priority,
      };
    })
    .filter((r) => !!r.lesson)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((r) => ({
      topicId: r.topicId,
      topicTitle: r.topicTitle,
      lessonId: (r.lesson as any).id,
      lessonTitle: (r.lesson as any).title,
      priority: Number(r.priority.toFixed(3)),
    }));

  return recommendations;
}
