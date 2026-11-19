// Thesis work: progress comes from thesis tasks (interviews, revisions, document checks, the
// supervisor's confirmation, the final version) and from free work sessions that stop at a limit.
// Used in the schedule overlay and in the laptop's Thesis tab. Other deadlines keep running.
import React from "react";
import { GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ThesisTaskView } from "../../../game/narrative/world";
import { UI } from "../theme";
import { formatDuration, type DurationText } from "./formatDuration";

export interface ThesisPanelProps {
  progress: number;
  /** Minutes of one session and the percent it adds. */
  sessionMinutes: number;
  sessionPercent: number;
  /** Free work stops at this percent. */
  freeWorkMaxPercent: number;
  timeLeftMinutes: number;
  tasks: readonly ThesisTaskView[];
  onWork: (minutes: number) => void;
  onTask: (taskId: string) => void;
}

export const ThesisPanel: React.FC<ThesisPanelProps> = ({
  progress,
  sessionMinutes,
  sessionPercent,
  freeWorkMaxPercent,
  timeLeftMinutes,
  tasks,
  onWork,
  onTask,
}) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as DurationText;
  const complete = progress >= 100;
  const timeUp = timeLeftMinutes <= 0;
  const atLimit = progress >= freeWorkMaxPercent;
  const blocked = complete || timeUp || atLimit || sessionPercent < 1;
  return (
    <section aria-labelledby="thesis-panel-heading" data-testid="thesis-panel" className={UI.card}>
      <h3 id="thesis-panel-heading" className={`${UI.label} flex items-center gap-2`}>
        <GraduationCap className="h-4 w-4" aria-hidden="true" />
        {t("planner.thesis.heading")}
      </h3>
      <p className="mt-2 text-sm text-[#f7f5ff]" data-testid="thesis-progress">
        {t("planner.thesis.progress", { value: progress })}
      </p>
      <p className={`${UI.body} mt-1`}>
        {t("planner.thesis.session", { time: formatDuration(text, sessionMinutes), percent: sessionPercent })}
      </p>
      <p className={`${UI.body} mt-1`} data-testid="thesis-limit">
        {t("planner.thesis.limit", { percent: freeWorkMaxPercent })}
      </p>
      <button
        type="button"
        className={`${UI.buttonPrimary} mt-3`}
        disabled={blocked}
        data-testid="thesis-work"
        onClick={() => onWork(sessionMinutes)}
      >
        {t("planner.thesis.work", { time: formatDuration(text, sessionMinutes) })}
      </button>
      {complete && <p className={`${UI.body} mt-2`}>{t("planner.thesis.complete")}</p>}
      {!complete && timeUp && <p className={`${UI.body} mt-2`}>{t("planner.thesis.timeUp")}</p>}

      <h4 className={`${UI.label} mt-4`}>{t("planner.thesis.tasksHeading")}</h4>
      {tasks.length === 0 ? (
        <p className={`${UI.body} mt-1`}>{t("planner.thesis.noTasks")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="space-y-1">
              {task.description && <p className={UI.body}>{task.description}</p>}
              <button
                type="button"
                className={UI.buttonSecondary}
                disabled={task.blocked !== null}
                aria-describedby={task.blocked === null ? undefined : `thesis-task-${task.id}-blocked`}
                data-testid={`thesis-task-${task.id}`}
                onClick={() => onTask(task.id)}
              >
                {task.timeCostMinutes > 0
                  ? t("planner.thesis.taskCost", { label: task.label, time: formatDuration(text, task.timeCostMinutes), percent: task.progressGain })
                  : t("planner.thesis.taskGain", { label: task.label, percent: task.progressGain })}
              </button>
              {task.blocked !== null && (
                <p id={`thesis-task-${task.id}-blocked`} className="text-xs text-[#a9a4c4]">
                  {t(`planner.thesis.blocked.${task.blocked}`)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};