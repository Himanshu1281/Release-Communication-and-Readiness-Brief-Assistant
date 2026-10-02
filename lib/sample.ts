import type { ReleasePackage } from "./package";

/** Sample with deliberately planted problems (see README). */
export const SAMPLE_PACKAGE: ReleasePackage = {
  features: [
    { id: "F-1", text: "Bulk CSV export for invoices, 3x faster than before" },
    { id: "F-2", text: "Dark mode for dashboard" },
  ],
  bugFixes: [{ id: "B-1", text: "Fixed timezone offset in monthly reports" }],
  changedBehaviour: [{ id: "C-1", text: "Sessions now expire after 30 minutes idle (previously 2 hours)" }],
  qaSummary: [
    { id: "QA-1", text: "Export tested with 10k rows on staging; passed. No performance benchmark run.", covers: ["F-1"] },
    { id: "QA-2", text: "Timezone fix verified for IST and UTC only", covers: ["B-1"] },
  ],
  knownLimitations: [{ id: "L-1", text: "Export capped at 50k rows" }],
  migrationNotes: [],
  affectedGroups: [
    { id: "G-1", text: "Finance admins" },
    { id: "G-2", text: "All logged-in users" },
  ],
};

/**
 * Two-version sample for the Compare tab. v1 → v2:
 * F-1 modified (unsupported "7 days" claim corrected), F-3 removed, F-4 added,
 * QA-3/QA-4 added (B-1 and F-4 now covered), L-2 added, M-1 filled in.
 */
export const COMPARE_SAMPLE_V1: ReleasePackage = {
  features: [
    { id: "F-1", text: "Offline mode for order history, works for 7 days without network" },
    { id: "F-2", text: "Biometric login with Face ID and fingerprint" },
    { id: "F-3", text: "In-app chat with support agents" },
  ],
  bugFixes: [{ id: "B-1", text: "Fixed crash when uploading photos larger than 10MB" }],
  changedBehaviour: [{ id: "C-1", text: "Push notifications are now opt-in on first launch (previously on by default)" }],
  qaSummary: [
    { id: "QA-1", text: "Offline mode tested on Android 14 for 24 hours; passed", covers: ["F-1"] },
    { id: "QA-2", text: "Biometric login tested on iPhone 15 and Pixel 8", covers: ["F-2"] },
  ],
  knownLimitations: [{ id: "L-1", text: "Offline mode is read-only; new orders need a connection" }],
  migrationNotes: [],
  affectedGroups: [
    { id: "G-1", text: "All mobile app users" },
    { id: "G-2", text: "Support team" },
  ],
};

export const COMPARE_SAMPLE_V2: ReleasePackage = {
  ...COMPARE_SAMPLE_V1,
  features: [
    { id: "F-1", text: "Offline mode for order history, works for 24 hours without network" },
    { id: "F-2", text: "Biometric login with Face ID and fingerprint" },
    { id: "F-4", text: "Order tracking map with live courier location" },
  ],
  qaSummary: [
    ...COMPARE_SAMPLE_V1.qaSummary,
    { id: "QA-3", text: "Photo upload tested with 10–25MB images on iOS and Android", covers: ["B-1"] },
    { id: "QA-4", text: "Tracking map tested on staging with a simulated courier", covers: ["F-4"] },
  ],
  knownLimitations: [
    ...COMPARE_SAMPLE_V1.knownLimitations,
    { id: "L-2", text: "Live map requires location permission" },
  ],
  migrationNotes: [
    { id: "M-1", text: "Existing users see the notification permission prompt on next launch; support macro updated" },
  ],
};
