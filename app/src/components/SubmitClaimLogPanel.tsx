import { ActivityLogPanel } from "./ActivityLogPanel";
import type { ActivityLogEntry } from "../lib/activityLog";

interface SubmitClaimLogPanelProps {
  entries: ActivityLogEntry[];
  autoScroll?: boolean;
}

/** Submit-claim flow activity log (wrapper). */
export function SubmitClaimLogPanel({
  entries,
  autoScroll,
}: SubmitClaimLogPanelProps) {
  return (
    <ActivityLogPanel
      entries={entries}
      title="Submit activity log"
      autoScroll={autoScroll}
    />
  );
}
