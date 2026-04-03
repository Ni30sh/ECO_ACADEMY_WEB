import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, BookOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabaseQueries } from '@/integrations/supabase/queries';
import {
  LearningLesson,
  LearningTopic,
} from '@/hooks/useLearnData';

const TOPIC_COLORS = ['green', 'blue', 'orange', 'purple', 'gray'];
const ICON_SUGGESTIONS = ['🌡️', '💧', '♻️', '⚡', '🌱', '🌍', '🌳', '🔥', '🏭', '🦋', '☀️', '🌊', '🧪', '🛰️', '🍃'];

const emptyTopicForm = { title: '', icon: '', color: 'green' };
const emptyLessonForm = { topic_id: '', title: '', content: '', points: 10 };

export default function TeacherContent() {
  const { toast } = useToast();
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [lessons, setLessons] = useState<LearningLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTopic, setSavingTopic] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);

  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const [topicForm, setTopicForm] = useState(emptyTopicForm);
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dbTopics, dbLessons] = await Promise.all([
        supabaseQueries.learningTopics.getAll(),
        supabaseQueries.lessons.getAll(),
      ]);

      const mappedTopics: LearningTopic[] = dbTopics.map((topic: any) => ({
        id: topic.id,
        title: topic.title,
        icon: topic.icon || '📘',
        color: topic.color || 'green',
      }));

      const mappedLessons: LearningLesson[] = dbLessons.map((lesson: any) => ({
        id: lesson.id,
        topic_id: lesson.topic_id || lesson.topic || '',
        title: lesson.title,
        content: lesson.content_json?.body || lesson.content_json?.content || lesson.body || lesson.summary || '',
        points: Number(lesson.eco_points_reward || 0),
      }));

      setTopics(mappedTopics);
      setLessons(mappedLessons);

      setLessonForm((prev) => {
        if (prev.topic_id || mappedTopics.length === 0) return prev;
        return { ...prev, topic_id: mappedTopics[0].id };
      });
    } catch (error: any) {
      toast({
        title: 'Failed to load content',
        description: error?.message || 'Could not fetch lessons and topics.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const lessonsByTopic = useMemo(() => {
    const map: Record<string, LearningLesson[]> = {};
    topics.forEach((t) => {
      map[t.id] = lessons.filter((l) => l.topic_id === t.id);
    });
    return map;
  }, [topics, lessons]);

  const openAddTopic = () => {
    setEditingTopicId(null);
    setTopicForm(emptyTopicForm);
    setTopicModalOpen(true);
  };

  const openEditTopic = (topic: LearningTopic) => {
    setEditingTopicId(topic.id);
    setTopicForm({ title: topic.title, icon: topic.icon, color: topic.color });
    setTopicModalOpen(true);
  };

  const saveTopic = () => {
    void (async () => {
      try {
        setSavingTopic(true);
        const payload = {
          title: topicForm.title.trim(),
          icon: topicForm.icon.trim(),
          color: topicForm.color,
        };

        if (editingTopicId) {
          await supabaseQueries.learningTopics.update(editingTopicId, payload as any);
          toast({ title: 'Topic updated' });
        } else {
          await supabaseQueries.learningTopics.create(payload as any);
          toast({ title: 'Topic created' });
        }

        setTopicModalOpen(false);
        setTopicForm(emptyTopicForm);
        setEditingTopicId(null);
        await loadData();
      } catch (error: any) {
        toast({
          title: 'Could not save topic',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSavingTopic(false);
      }
    })();
  };

  const deleteTopic = (id: string) => {
    void (async () => {
      try {
        const linkedLessons = await supabaseQueries.lessons.getByTopic(id);
        await Promise.all(linkedLessons.map((lesson: any) => supabaseQueries.lessons.delete(lesson.id)));
        await supabaseQueries.learningTopics.delete(id);
        toast({ title: 'Topic deleted' });
        await loadData();
      } catch (error: any) {
        toast({
          title: 'Could not delete topic',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    })();
  };

  const openAddLesson = (topicId?: string) => {
    setEditingLessonId(null);
    setLessonForm({ ...emptyLessonForm, topic_id: topicId || topics[0]?.id || '' });
    setLessonModalOpen(true);
  };

  const openEditLesson = (lesson: LearningLesson) => {
    setEditingLessonId(lesson.id);
    setLessonForm({
      topic_id: lesson.topic_id,
      title: lesson.title,
      content: lesson.content,
      points: lesson.points,
    });
    setLessonModalOpen(true);
  };

  const saveLesson = () => {
    void (async () => {
      try {
        setSavingLesson(true);
        const cleanTitle = lessonForm.title.trim();
        const cleanContent = lessonForm.content.trim();
        const points = Number(lessonForm.points || 0);
        const topicTitle = topics.find((topic) => topic.id === lessonForm.topic_id)?.title || null;

        const payload = {
          topic_id: lessonForm.topic_id,
          topic: topicTitle,
          title: cleanTitle,
          content_type: 'lesson',
          content_json: {
            body: cleanContent,
            summary: cleanContent.slice(0, 160),
          },
          eco_points_reward: points,
          estimated_minutes: 5,
          order_index: editingLessonId
            ? undefined
            : (lessons.filter((lesson) => lesson.topic_id === lessonForm.topic_id).length + 1),
        };

        if (editingLessonId) {
          await supabaseQueries.lessons.update(editingLessonId, payload as any);
          toast({ title: 'Lesson updated' });
        } else {
          await supabaseQueries.lessons.create(payload as any);
          toast({ title: 'Lesson created' });
        }

        setLessonModalOpen(false);
        setLessonForm(emptyLessonForm);
        setEditingLessonId(null);
        await loadData();
      } catch (error: any) {
        toast({
          title: 'Could not save lesson',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSavingLesson(false);
      }
    })();
  };

  const deleteLesson = (id: string) => {
    void (async () => {
      try {
        await supabaseQueries.lessons.delete(id);
        toast({ title: 'Lesson deleted' });
        await loadData();
      } catch (error: any) {
        toast({
          title: 'Could not delete lesson',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    })();
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-bold text-3xl text-jungle-deep">Learning Content</h1>
        <div className="flex gap-2">
          <Button onClick={openAddTopic} className="rounded-xl font-heading font-bold">
            <Plus className="w-4 h-4 mr-2" /> Add Topic
          </Button>
          <Button onClick={() => openAddLesson()} variant="outline" className="rounded-xl font-heading font-bold">
            <BookOpen className="w-4 h-4 mr-2" /> Add Lesson
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && (
          <div className="rounded-2xl bg-card shadow-card p-5 text-sm text-muted-foreground">Loading topics...</div>
        )}
        {topics.map((topic) => {
          const topicLessons = lessonsByTopic[topic.id] || [];
          return (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-card shadow-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl">{topic.icon}</p>
                  <h2 className="mt-2 font-heading font-bold text-foreground">{topic.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Layers className="inline h-3 w-3 mr-1" />
                    {topicLessons.length} lesson{topicLessons.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEditTopic(topic)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteTopic(topic.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {topicLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lessons yet.</p>
                ) : (
                  topicLessons.map((lesson) => (
                    <div key={lesson.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-heading font-semibold text-sm text-foreground">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{lesson.points} pts</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditLesson(lesson)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteLesson(lesson.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Button onClick={() => openAddLesson(topic.id)} variant="outline" className="mt-4 w-full rounded-xl font-heading font-bold">
                <Plus className="w-4 h-4 mr-2" /> Add Lesson
              </Button>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={topicModalOpen} onOpenChange={setTopicModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl text-jungle-deep">
              {editingTopicId ? 'Edit Topic' : 'Add Topic'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Topic title"
              value={topicForm.title}
              onChange={(e) => setTopicForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Input
              placeholder="Icon (example: 🌡️)"
              list="topic-icon-suggestions"
              value={topicForm.icon}
              onChange={(e) => setTopicForm((prev) => ({ ...prev, icon: e.target.value }))}
            />
            <datalist id="topic-icon-suggestions">
              {ICON_SUGGESTIONS.map((icon) => (
                <option key={icon} value={icon} />
              ))}
            </datalist>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={topicForm.color}
              onChange={(e) => setTopicForm((prev) => ({ ...prev, color: e.target.value }))}
            >
              {TOPIC_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <Button
              onClick={saveTopic}
              disabled={savingTopic || !topicForm.title.trim() || !topicForm.icon.trim()}
              className="w-full rounded-xl font-heading font-bold"
            >
              {savingTopic ? 'Saving...' : editingTopicId ? 'Update Topic' : 'Create Topic'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={lessonModalOpen} onOpenChange={setLessonModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl text-jungle-deep">
              {editingLessonId ? 'Edit Lesson' : 'Add Lesson'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={lessonForm.topic_id}
              onChange={(e) => setLessonForm((prev) => ({ ...prev, topic_id: e.target.value }))}
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
            <Input
              placeholder="Lesson title"
              value={lessonForm.title}
              onChange={(e) => setLessonForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <textarea
              className="w-full rounded-md border border-input bg-background p-3 text-sm min-h-[140px]"
              placeholder="Lesson content"
              value={lessonForm.content}
              onChange={(e) => setLessonForm((prev) => ({ ...prev, content: e.target.value }))}
            />
            <Input
              type="number"
              min={0}
              placeholder="Points"
              value={lessonForm.points}
              onChange={(e) => setLessonForm((prev) => ({ ...prev, points: Number(e.target.value || 0) }))}
            />
            <Button
              onClick={saveLesson}
              disabled={savingLesson || !lessonForm.topic_id || !lessonForm.title.trim() || !lessonForm.content.trim()}
              className="w-full rounded-xl font-heading font-bold"
            >
              {savingLesson ? 'Saving...' : editingLessonId ? 'Update Lesson' : 'Create Lesson'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
