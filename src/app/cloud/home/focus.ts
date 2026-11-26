// Focus's exam countdown on Home (planning/v1/02 §5.1 Home row: "exam
// countdown and study-day strip"), from the exam dates asked at onboarding.
// Pure, so the day counting is tested without a clock. The study-day strip is
// still a seam.

const DAY = 86_400_000;

export interface ExamCountdown {
  /** YYYY-MM-DD, as stored. */
  date: string;
  /** Whole days from today to the exam, in the person's own time zone; 0 is today. */
  days: number;
  /** Exams after this one. */
  later: number;
}

/** Local midnight of a YYYY-MM-DD date; null when it isn't one. */
function localDay(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** The next exam from today on, and how many follow it; null when none is ahead. */
export function nextExam(examDates: readonly string[], now: Date): ExamCountdown | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ahead = examDates
    .map((date) => ({ date, at: localDay(date) }))
    .filter((e): e is { date: string; at: number } => e.at !== null && e.at >= today)
    .sort((a, b) => a.at - b.at);
  if (ahead.length === 0) return null;
  // Round, not floor: a daylight-saving change makes one day 23 or 25 hours.
  return { date: ahead[0].date, days: Math.round((ahead[0].at - today) / DAY), later: ahead.length - 1 };
}

/** "Exam today.", "Exam tomorrow.", "Exam in 19 days." */
export function examLine(exam: ExamCountdown): string {
  if (exam.days === 0) return "Exam today.";
  if (exam.days === 1) return "Exam tomorrow.";
  return `Exam in ${exam.days} days.`;
}
