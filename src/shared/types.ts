export type TopicStatus = "not_started" | "learning" | "reviewing" | "mastered";

export type ConfidenceLevel = "hard" | "medium" | "easy";

export interface StudyItem {
  id: string;
  title: string;
  prompt: string;
}

export interface Topic {
  id: string;
  moduleOrder: number;
  moduleTitle: string;
  moduleGoal: string;
  topicOrder: number;
  title: string;
  summary: string;
  keyConcepts: string[];
  studyItems: StudyItem[];
  suggestedPractice: string;
  status: TopicStatus;
  streak: number;
  intervalDays: number;
  nextReviewAt: string | null;
  practiceDone: boolean;
  lastScore: number | null;
  updatedAt: string;
}

export interface AiFeedback {
  whatYouGotRight: string[];
  gapsOrMistakes: string[];
  followUpQuestion: string;
}

export interface EvaluationResult extends AiFeedback {
  score: number;
  suggestedConfidence: ConfidenceLevel;
}

export interface Attempt {
  id: number;
  topicId: string;
  itemId: string | null;
  itemTitle: string | null;
  userExplanation: string;
  aiScore: number;
  aiFeedback: AiFeedback;
  confidence: ConfidenceLevel;
  createdAt: string;
}

export interface PracticeChallenge {
  title: string;
  scenario: string;
  language: "typescript" | "javascript" | "sql";
  code: string;
  hint: string;
  solution: string;
}

export interface DashboardSummary {
  totalTopics: number;
  startedCount: number;
  masteredCount: number;
  practiceDoneCount: number;
  dueReviewsCount: number;
  overdueCount: number;
  dueReviews: Array<Topic & { overdueDays: number }>;
  nextNewTopic: Topic | null;
}

export interface ModuleGroup {
  order: number;
  title: string;
  goal: string;
  topics: Topic[];
}

export interface RoadmapTopicJson {
  id: string;
  order: number;
  title: string;
  summary: string;
  keyConcepts: string[];
  studyItems: StudyItem[];
  suggestedPractice: string;
}

export interface RoadmapModuleJson {
  order: number;
  title: string;
  goal: string;
  topics: RoadmapTopicJson[];
}

export interface RoadmapJson {
  version: string;
  title: string;
  modules: RoadmapModuleJson[];
}
