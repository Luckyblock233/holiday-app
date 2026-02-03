const BASE_MINUTES = 30;
const DAILY_CAP = 60;
const SCREEN_LIMIT = 90; // 1.5 hours

// 计算某天的“获得分钟数”（只计算 earned，不包含兑现）
export function calcEarnedMinutes({
  todayRecord,
  todayNotesCount,
  isParentChecked, // 是否家长检查通过（用于奖励）
  yesterdayScreenViolated, // 昨天是否超屏幕时长 -> 次日基础-10
}) {
  if (!todayRecord) return { earned: 0, breakdown: {} };

  const screenOk = todayRecord.screen_minutes <= SCREEN_LIMIT;
  const homeworkOk = !!todayRecord.homework_done;
  const readingOk = todayRecord.reading_minutes >= 30 && todayNotesCount >= 1;
  const exerciseOk = todayRecord.exercise_minutes >= 25;

  // 若当天屏幕超时：当天无任何游戏时间（含奖励）
  if (!screenOk) {
    return {
      earned: 0,
      breakdown: {
        base: 0,
        bonusReading: 0,
        bonusExercise: 0,
        capApplied: false,
        screenViolated: true,
      },
    };
  }

  // 基础达标才有基础 30（否则 0）
  let base =
    homeworkOk && readingOk && exerciseOk && screenOk ? BASE_MINUTES : 0;

  // 次日基础扣减 10：只影响 base
  if (base > 0 && yesterdayScreenViolated) {
    base = Math.max(0, base - 10);
  }

  let bonusReading = 0;
  let bonusExercise = 0;

  // 奖励：需家长检查
  if (isParentChecked) {
    // 额外阅读≥20 且多写1条笔记，可重复累计
    // “多写1条”理解为：超过最低要求的笔记数（>=2）且超出的阅读分钟数支持多次累计
    const extraReading = Math.max(0, todayRecord.reading_minutes - 30);
    const extraNotes = Math.max(0, todayNotesCount - 1);
    const readingTimes = Math.min(Math.floor(extraReading / 20), extraNotes);
    bonusReading = readingTimes * 15;

    // 额外运动≥10，可重复累计
    const extraExercise = Math.max(0, todayRecord.exercise_minutes - 25);
    bonusExercise = Math.floor(extraExercise / 10) * 5;
  }

  let earned = base + bonusReading + bonusExercise;
  const capApplied = earned > DAILY_CAP;
  earned = Math.min(earned, DAILY_CAP);

  return {
    earned,
    breakdown: {
      base,
      bonusReading,
      bonusExercise,
      capApplied,
      screenViolated: false,
    },
  };
}

export function isScreenViolated(record) {
  return !!record && record.screen_minutes > SCREEN_LIMIT;
}
