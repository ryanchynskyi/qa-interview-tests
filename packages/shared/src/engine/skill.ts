/**
 * Skill measurement, ported from the legacy dashboard so numbers stay the same:
 *  - topic skill = (quiz correct / all quiz questions + recall score) / 2
 *  - chapter score = mean of (quiz accuracy on answered, if ≥2 answered) and
 *    (average recall rating mapped to 0..1, if any card rated); weak below 0.7.
 */
import { isCardDue, type CardProgress } from './items';

export interface SkillContent {
  topics: readonly { id: string }[];
  sections: readonly { id: string; topicId: string }[];
  questions: readonly { id: string; sectionId: string; chapterId: string }[];
  recallCards: readonly { id: string; topicId: string; chapterId: string }[];
}

export interface SkillProgress {
  /** Latest result per question id (1 correct, 0 wrong/skipped). */
  questions: Readonly<Record<string, 0 | 1>>;
  cards: Readonly<Record<string, CardProgress>>;
}

export interface QuizStat {
  /** Questions in scope. */
  total: number;
  correct: number;
  answered: number;
}
export interface RecallStat {
  total: number;
  rated: number;
  /** Average rating 1..5 over rated cards (0 when none). */
  avg: number;
  /** Sum of (rating-1)/4 over all cards in scope / total: unrated count as 0. */
  score: number;
  due: number;
}
export interface TopicSkill {
  topicId: string;
  quiz: QuizStat;
  recall: RecallStat;
  tested: boolean;
  /** 0..1 */
  skill: number;
}
export interface ChapterScore {
  chapterId: string;
  topicId: string;
  quiz: QuizStat;
  recall: RecallStat;
  /** 0..1 */
  score: number;
}

export const WEAK_THRESHOLD = 0.7;

const emptyQuiz = (): QuizStat => ({ total: 0, correct: 0, answered: 0 });
interface RecallAcc {
  total: number;
  rated: number;
  sum: number;
  scoreSum: number;
  due: number;
}
const emptyRecall = (): RecallAcc => ({ total: 0, rated: 0, sum: 0, scoreSum: 0, due: 0 });
const finishRecall = (r: RecallAcc): RecallStat => ({
  total: r.total,
  rated: r.rated,
  avg: r.rated ? r.sum / r.rated : 0,
  score: r.total ? r.scoreSum / r.total : 0,
  due: r.due,
});

function getOr<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let v = map.get(key);
  if (v === undefined) map.set(key, (v = make()));
  return v;
}

/** One pass over content; returns per-topic and per-chapter aggregates. */
function aggregate(content: SkillContent, progress: SkillProgress, now: number) {
  const topicOfSection = new Map(content.sections.map((s) => [s.id, s.topicId]));
  const topicOfChapter = new Map<string, string>();
  const quizByTopic = new Map<string, QuizStat>();
  const quizByChapter = new Map<string, QuizStat>();
  const recallByTopic = new Map<string, RecallAcc>();
  const recallByChapter = new Map<string, RecallAcc>();

  for (const q of content.questions) {
    const topicId = topicOfSection.get(q.sectionId);
    if (!topicId) continue;
    topicOfChapter.set(q.chapterId, topicId);
    const v = progress.questions[q.id];
    for (const s of [
      getOr(quizByTopic, topicId, emptyQuiz),
      getOr(quizByChapter, q.chapterId, emptyQuiz),
    ]) {
      s.total++;
      if (v === 1) s.correct++;
      if (v === 0 || v === 1) s.answered++;
    }
  }
  for (const c of content.recallCards) {
    topicOfChapter.set(c.chapterId, c.topicId);
    const p = progress.cards[c.id];
    for (const r of [
      getOr(recallByTopic, c.topicId, emptyRecall),
      getOr(recallByChapter, c.chapterId, emptyRecall),
    ]) {
      r.total++;
      if (p) {
        r.rated++;
        r.sum += p.rating;
        r.scoreSum += (p.rating - 1) / 4;
        if (isCardDue(p, now)) r.due++;
      }
    }
  }
  return { topicOfChapter, quizByTopic, quizByChapter, recallByTopic, recallByChapter };
}

export function topicSkills(
  content: SkillContent,
  progress: SkillProgress,
  now: number,
): TopicSkill[] {
  const a = aggregate(content, progress, now);
  return content.topics.map((t) => {
    const quiz = a.quizByTopic.get(t.id) ?? emptyQuiz();
    const recall = finishRecall(a.recallByTopic.get(t.id) ?? emptyRecall());
    const quizPart = quiz.total ? quiz.correct / quiz.total : 0;
    return {
      topicId: t.id,
      quiz,
      recall,
      tested: quiz.answered > 0 || recall.rated > 0,
      skill: (quizPart + recall.score) / 2,
    };
  });
}

/** Chapters with enough signal to score, weakest first. */
export function chapterScores(
  content: SkillContent,
  progress: SkillProgress,
  now: number,
): ChapterScore[] {
  const a = aggregate(content, progress, now);
  const out: ChapterScore[] = [];
  for (const [chapterId, topicId] of a.topicOfChapter) {
    const quiz = a.quizByChapter.get(chapterId) ?? emptyQuiz();
    const recall = finishRecall(a.recallByChapter.get(chapterId) ?? emptyRecall());
    const parts: number[] = [];
    if (quiz.answered >= 2) parts.push(quiz.correct / quiz.answered);
    if (recall.rated) parts.push((recall.avg - 1) / 4);
    if (parts.length) {
      out.push({
        chapterId,
        topicId,
        quiz,
        recall,
        score: parts.reduce((x, y) => x + y, 0) / parts.length,
      });
    }
  }
  return out.sort((x, y) => x.score - y.score || x.chapterId.localeCompare(y.chapterId));
}

export function weakChapters(
  content: SkillContent,
  progress: SkillProgress,
  now: number,
): ChapterScore[] {
  return chapterScores(content, progress, now).filter((c) => c.score < WEAK_THRESHOLD);
}

export function dueCardIds(progress: SkillProgress, now: number): string[] {
  return Object.entries(progress.cards)
    .filter(([, c]) => isCardDue(c, now))
    .map(([id]) => id);
}

export type TopicBadge = 'bronze' | 'silver' | 'gold';

/** Topic mastery badge from the 0..1 skill score: 60% bronze, 75% silver, 90% gold. */
export function topicBadge(skill: number): TopicBadge | null {
  if (skill >= 0.9) return 'gold';
  if (skill >= 0.75) return 'silver';
  if (skill >= 0.6) return 'bronze';
  return null;
}
