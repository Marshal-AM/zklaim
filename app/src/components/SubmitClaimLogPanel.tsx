import { ActivityLogPanel } from "./ActivityLogPanel";
import type { ActivityLogEntry } from "../lib/activityLog";

interface SubmitClaimLogPanelProps {
  entries: ActivityLogEntry[];
}

/** Submit-claim flow activity log (wrapper). */
export function SubmitClaimLogPanel({ entries }: SubmitClaimLogPanelProps) {
  return (
    <ActivityLogPanel
      entries={entries}
      title="Submit activity log"
    />
  );
}
