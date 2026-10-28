import type { AppState } from "./model";
import { validatePlan, type Suggestion } from "./schedule";
import { at, localInput } from "./time";

export const receiptFor = (plan: Suggestion, activityId: string) =>
  `${plan.id}:${activityId}`;
export const acceptedActivityId = (plan: Suggestion, activityId: string) =>
  `proposal:${receiptFor(plan, activityId)}`;

/** Run inside the repository's read/write transaction against the latest saved state. */
export function acceptProposal(
  state: AppState,
  plan: Suggestion,
  selectedIds?: string[],
  now = new Date(),
): AppState {
  const selected = selectedIds
    ? plan.activities.filter((a) => selectedIds.includes(a.id))
    : plan.activities;
  if (!selected.some((a) => a.category === "study"))
    throw new Error("Select at least one study session to accept.");
  const pending = selected.filter(
    (a) =>
      !state.acceptedSuggestionIds.includes(receiptFor(plan, a.id)) &&
      !state.activities.some(
        (saved) => saved.id === acceptedActivityId(plan, a.id),
      ),
  );
  if (!pending.length) return state;
  const error = validatePlan({ ...plan, activities: pending }, state, now);
  if (error) throw new Error(error);
  return {
    ...state,
    activities: [
      ...state.activities,
      ...pending.map((a) => ({ ...a, id: acceptedActivityId(plan, a.id) })),
    ],
    acceptedSuggestionIds: [
      ...new Set([
        ...state.acceptedSuggestionIds,
        ...pending.map((a) => receiptFor(plan, a.id)),
      ]),
    ],
  };
}

export function modifyProposal(
  plan: Suggestion,
  id: string,
  field: "start" | "end",
  local: string,
  timezone: string,
): Suggestion {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Enter a complete date and time.");
  const iso = at(local.slice(0, 10), local.slice(11), timezone);
  if (!Number.isFinite(Date.parse(iso)) || localInput(iso, timezone) !== local)
    throw new Error(
      "This local time does not exist in your timezone (daylight-saving transition). Choose another time.",
    );
  return {
    ...plan,
    activities: plan.activities.map((a) =>
      a.id === id ? { ...a, [field]: iso } : a,
    ),
  };
}
