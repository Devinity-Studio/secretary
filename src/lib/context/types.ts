/**
 * Secretary Context — Canonical Domain Model
 *
 * Architecture Principle:
 * "Context is the DOMAIN MODEL. UI (Context Card, Statement, Evidence panel)
 * are VIEWERS of Context, not the model itself."
 *
 *                    ┌──────────────┐
 *                    │   Sources   │
 *                    │             │
 *                    │ Voice       │
 *                    │ Email       │
 *                    │ Notification│
 *                    │ Calendar     │
 *                    │ User        │
 *                    └──────┬───────┘
 *                           ↓
 *                  ┌────────────────┐
 *                  │  Context     │
 *                  │  Canonical   │
 *                  └───────┬────────┘
 *                          ↓
 *                ┌──────────┴──────────┐
 *                ↓                    ↓
 *           Context Card            Statement
 *                ↓                    ↓
 *          Evidence/Detail      Evidence/Detail
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * KEY ARCHITECTURAL CONSTRAINTS:
 *
 * 1. Context is SOURCE OF TRUTH — UI is a viewer, not the model
 *    - `statement` (if present) is CACHED/DERIVED for display, not canonical
 *    - Statement can be regenerated from Facts at any time
 *
 * 2. Evidence / Fact / Inference are STRICTLY SEPARATED
 *    - Evidence → supports → Fact (provenance chain)
 *    - Evidence + Facts → produce → Inference (must trace to Evidence/Facts)
 *
 * 3. Lifecycle Status is SEPARATED from Change History
 *    - Lifecycle: tentative, confirmed, cancelled, completed (NO "changed")
 *    - Change History: separate event log for transitions and value changes
 *
 * 4. Record First, Identify Later — Context can exist with MINIMAL data
 *    - Enrichment happens through separate operations
 *    - No schema enforcement requiring all relations at creation
 *
 * 5. Source ≠ Evidence
 *    - Source = channel/pathway (user, voice, email, notification, calendar, external)
 *    - Evidence = specific proof items; multiple evidence can come from different sources
 *
 * 6. Related Context supports future Shared Context
 *    - Context ↔ Context relationships
 *    - Ready for future: Shared Context ↔ Participant / Secretary
 *
 * 7. Context Identity supports future Deduplication
 *    - Multiple evidence from multiple sources → one Context
 *    - Does not block future Entity Resolution
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ════════════════════════════════════════════════════════════════════════════════
// SOURCE — The channel/pathway through which information arrived
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Source represents the channel/pathway through which information arrived.
 * A Context can have ONE primary source and MULTIPLE contributing sources.
 *
 * Examples:
 * - User typed: source = "user"
 * - Voice input: source = "voice"
 * - Email content: source = "email"
 * - Bank notification: source = "external"
 */
export type SourceType =
  | "user"       // User manually entered
  | "voice"      // Voice input
  | "email"      // Email metadata/content
  | "notification" // Push/notification
  | "calendar"   // Calendar event
  | "external"   // External system (bank, LINE, etc.)
  | "ai";       // AI generated

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  user: "ผู้ใช้",
  voice: "เสียง",
  email: "อีเมล",
  notification: "แจ้งเตือน",
  calendar: "ปฏิทิน",
  external: "ระบบภายนอก",
  ai: "AI",
};

// ════════════════════════════════════════════════════════════════════════════════
// EVIDENCE — Immutable proof that something is true
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Evidence is the IMMUTABLE proof that something is true.
 *
 * Key principles:
 * - Evidence is NEVER created by AI inference
 * - Evidence is what was ACTUALLY OBSERVED or RECEIVED
 * - Evidence can come from any Source
 * - Multiple evidence from different sources can support the same Fact
 *
 * Evidence chain:
 *   Evidence (raw observation)
 *     ↓ supports
 *   Fact (proven data point)
 *     ↓ + Evidence
 *   Inference (AI assessment, traces back to Evidence/Facts)
 */
export interface Evidence {
  id: string;

  /** Which source channel this evidence came from */
  sourceType: SourceType;

  /** The actual source identifier (e.g., email ID, notification ID, bank TXN ID) */
  sourceId: string | null;

  /** The actual content that was observed/received */
  content: EvidenceContent;

  /** When this evidence was captured */
  capturedAt: string; // ISO timestamp

  /** Confidence in the evidence itself (not interpretation) */
  confidence: ConfidenceLevel;
}

/** Evidence content types */
export type EvidenceContent =
  | { kind: "text"; text: string }
  | { kind: "structured"; data: Record<string, unknown> }
  | { kind: "hybrid"; text: string; data: Record<string, unknown> };

/** Confidence levels */
export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "มั่นใจสูง",
  medium: "มั่นใจปานกลาง",
  low: "มั่นใจต่ำ",
  unknown: "ไม่ทราบ",
};

// ════════════════════════════════════════════════════════════════════════════════
// FACT — Proven data point backed by Evidence
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Fact is a data point that is PROVEN by Evidence.
 *
 * Key principles:
 * - Every Fact MUST be backed by at least one Evidence
 * - Fact traces back to Evidence (provenance chain)
 * - Fact is what we KNOW to be true
 */
export interface Fact {
  id: string;

  /** Which Evidence this Fact is based on */
  evidenceIds: string[];

  /** The field/property this Fact describes */
  field: string; // e.g., "amount", "date", "title", "person"

  /** The proven value */
  value: unknown;

  /** When this Fact was established */
  establishedAt: string; // ISO timestamp
}

// ════════════════════════════════════════════════════════════════════════════════
// INFERENCE — AI-generated assessment that traces back to Evidence/Facts
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Inference is an AI-generated assessment.
 *
 * Key principles:
 * - Every Inference MUST trace back to at least one Evidence or Fact
 * - Inference is NEVER the source of truth — it's an interpretation
 * - Inferences can be confirmed by user (converts to Fact) or rejected
 */
export interface Inference {
  id: string;

  /** Which Evidence this Inference is based on */
  evidenceIds: string[];

  /** Which Facts this Inference is based on */
  factIds: string[];

  /** The field/property this Inference describes */
  field: string;

  /** The inferred value */
  value: unknown;

  /** How confident the AI is in this inference */
  confidence: ConfidenceLevel;

  /** Why the AI made this inference (must reference evidence/facts) */
  reasoning: string;

  /** When this inference was made */
  inferredAt: string; // ISO timestamp;

  /** Can user confirm this to become a Fact? */
  confirmable: boolean;

  /** Has user confirmed this? */
  confirmed: boolean;
}

// ════════════════════════════════════════════════════════════════════════════════
// LIFECYCLE STATUS — Where in the lifecycle a Context is
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Lifecycle Status represents where in its lifecycle a Context is.
 *
 * IMPORTANT: This is NOT for tracking changes/updates.
 * Changes are tracked in ChangeHistory.
 *
 * - tentative: Created but not yet confirmed
 * - confirmed: Verified and reliable
 * - cancelled: No longer valid/relevant
 * - completed: Goal achieved or event passed
 */
export type LifecycleStatus =
  | "tentative"   // Created but not confirmed
  | "confirmed"   // Verified and reliable
  | "cancelled"   // No longer valid
  | "completed";  // Goal achieved or event passed

export const LIFECYCLE_STATUS_LABELS: Record<LifecycleStatus, string> = {
  tentative: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิก",
  completed: "เสร็จสิ้น",
};

/**
 * Valid Lifecycle Status transitions
 */
export const LIFECYCLE_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  tentative: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [], // Terminal
  completed: [], // Terminal
};

export function canTransitionLifecycle(
  from: LifecycleStatus,
  to: LifecycleStatus,
): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

// ════════════════════════════════════════════════════════════════════════════════
// CHANGE HISTORY — Track all changes to a Context (separate from lifecycle)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * ChangeHistory records all changes to a Context.
 * This is SEPARATE from Lifecycle Status.
 *
 * Examples of changes:
 * - "amount changed from 1000 to 1500"
 * - "time changed from 10:00 to 11:00"
 * - "status transitioned from tentative to confirmed"
 * - "person linked: คุณเอ"
 */
export type ChangeEventType =
  | "created"
  | "field_updated"
  | "status_transition"
  | "evidence_added"
  | "fact_added"
  | "inference_added"
  | "inference_confirmed"
  | "inference_rejected"
  | "link_added"
  | "link_removed"
  | "enriched"; // Any enrichment operation

export interface ChangeEvent {
  id: string;
  type: ChangeEventType;

  /** Human-readable description of the change */
  description: string;

  /** Who/what made the change */
  changedBy: "user" | "ai" | "system";

  /** When the change occurred */
  occurredAt: string; // ISO timestamp

  /** For field updates */
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;

  /** For status transitions */
  fromStatus?: LifecycleStatus;
  toStatus?: LifecycleStatus;

  /** For evidence/fact/inference changes */
  itemId?: string;
  itemType?: "evidence" | "fact" | "inference" | "link";

  /** For enrichment */
  enrichmentType?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// ENTITY LINKING — Connect Context to domain objects
// ════════════════════════════════════════════════════════════════════════════════

/**
 * EntityType represents the type of entity a Context can link to.
 *
 * These are intentionally generic to support future expansion.
 */
export type EntityType =
  | "person"
  | "account"
  | "project"
  | "event"
  | "goal"
  | "document"
  | "conversation"
  | "context"; // Link to another Context

/**
 * EntityLink connects a Context to a domain entity.
 *
 * Key principles:
 * - Links can be added AFTER Context creation (Record First)
 * - Links can be confirmed (verified) or inferred
 * - Links are NOT required at Context creation
 */
export interface EntityLink {
  id: string;

  /** The type of entity */
  entityType: EntityType;

  /** The entity ID (references external system) */
  entityId: string;

  /** Human-readable label */
  label: string;

  /** How this entity relates to the Context */
  relationship: string; // e.g., "sender", "recipient", "source", "target", "assignee"

  /** Source of this link (user stated vs AI inferred) */
  source: "user" | "ai";

  /** When this link was created */
  createdAt: string; // ISO timestamp
}

// ════════════════════════════════════════════════════════════════════════════════
// RELATED CONTEXT — Context-to-Context relationships (for future S2S)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * RelatedContext represents a relationship between two Contexts.
 *
 * This is designed to support future Shared Context / Secretary-to-Secretary:
 * - Context ↔ Context (local relationships)
 * - SharedContext ↔ Participant / Secretary (future S2S)
 *
 * The relationship type is intentionally generic.
 */
export type ContextRelationType =
  | "parent"       // Parent context (hierarchical)
  | "child"        // Child context
  | "related"      // General relationship
  | "derived"      // This context was derived from another
  | "converges";   // Multiple sources converged to this context

export interface RelatedContext {
  id: string;

  /** The related Context ID */
  relatedContextId: string;

  /** The type of relationship */
  relationType: ContextRelationType;

  /** Human-readable description */
  description: string;

  /** Source of this relationship (who created it) */
  source: "user" | "ai" | "system";

  /** When this relationship was created */
  createdAt: string; // ISO timestamp
}

// ════════════════════════════════════════════════════════════════════════════════
// CONTEXT — The Canonical Domain Model
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Context is the CANONICAL DOMAIN MODEL.
 *
 * Key principles:
 * 1. Context is SOURCE OF TRUTH — UI observes, doesn't define
 * 2. Evidence is IMMUTABLE proof — stored separately, referenced by ID
 * 3. Facts are PROVEN — always trace back to Evidence
 * 4. Inferences are AI ASSESSMENTS — always trace back to Evidence/Facts
 * 5. Lifecycle Status tracks WHERE in lifecycle, not CHANGES
 * 6. Change History tracks WHAT CHANGED, separately from lifecycle
 * 7. Entity Links are OPTIONAL at creation — supports Record First
 * 8. Related Contexts support future Shared Context / S2S
 *
 * UI Responsibility:
 * - UI generates Statement from Facts (cached if needed for perf)
 * - UI generates Context Card from Context (not the other way around)
 * - Context does NOT know about UI concerns
 */
export interface SecretaryContext {
  id: string;

  /**
   * Context type — the category/kind of this Context.
   * Examples: "financial.transaction", "calendar.event", "person.contact"
   */
  type: string;

  /**
   * Lifecycle Status — where in the lifecycle this Context is.
   * See: LIFECYCLE_STATUS_LABELS
   */
  lifecycle: LifecycleStatus;

  /**
   * Evidence IDs — references to Evidence that supports this Context.
   * Evidence is IMMUTABLE and stored separately.
   */
  evidenceIds: string[];

  /**
   * Facts — proven data points derived from Evidence.
   * Every Fact traces back to Evidence.
   */
  facts: Fact[];

  /**
   * Inferences — AI-generated assessments.
   * Every Inference traces back to Evidence and/or Facts.
   */
  inferences: Inference[];

  /**
   * Primary Source — the main channel through which this Context arrived.
   */
  primarySource: SourceType;

  /**
   * Contributing Sources — all sources that contributed to this Context.
   * Multiple sources can converge to one Context.
   */
  sources: SourceType[];

  /**
   * Entity Links — connections to domain entities.
   * These are OPTIONAL and can be added later.
   */
  links: EntityLink[];

  /**
   * Related Contexts — relationships to other Contexts.
   * Supports hierarchical and future Shared Context relationships.
   */
  relatedContexts: RelatedContext[];

  /**
   * Change History — chronological log of all changes.
   * SEPARATE from lifecycle status.
   */
  history: ChangeEvent[];

  /**
   * When this Context was first created
   */
  createdAt: string; // ISO timestamp

  /**
   * When this Context was last updated
   */
  updatedAt: string; // ISO timestamp

  /**
   * Who/what created this Context
   */
  createdBy: "user" | "ai" | "system";

  /**
   * When this Context expires (null = never)
   * Useful for tentative or temporary contexts
   */
  expiresAt: string | null;

  /**
   * Priority — for ordering and filtering (0-100)
   */
  priority: number;

  /**
   * Tags — for categorization
   */
  tags: string[];

  /**
   * Whether this Context is archived (soft delete)
   */
  archived: boolean;

  /**
   * For future: Shared Context support
   * When non-null, this Context is shared with specified user IDs
   */
  sharedWithUserIds: string[] | null;

  /**
   * For future: Canonical Shared Context ID (Secretary-to-Secretary)
   * All parties share the same canonical Context ID
   */
  canonicalId: string | null;
}

// ════════════════════════════════════════════════════════════════════════════════
// CONTEXT CREATION — Record First, Identify Later
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Minimal input to create a Context.
 * Follows "Record First, Identify Later" — only evidence is required.
 *
 * NO fields are mandatory except what's needed to establish existence.
 * Everything else can be added later through enrichment operations.
 */
export interface CreateContextInput {
  /**
   * Required — the primary evidence that establishes this Context
   */
  evidence: Omit<Evidence, "id">;

  /**
   * The Context type (e.g., "financial.transaction")
   * Can be inferred/enriched later
   */
  type?: string;

  /**
   * Primary source — defaults to "user" if not specified
   */
  source?: SourceType;

  /**
   * Initial lifecycle status — defaults to "tentative"
   */
  lifecycle?: LifecycleStatus;

  /**
   * Initial tags
   */
  tags?: string[];
}

// ════════════════════════════════════════════════════════════════════════════════
// CONTEXT OPERATIONS — How to modify a Context
// ════════════════════════════════════════════════════════════════════════════════

export interface AddEvidenceInput {
  evidence: Omit<Evidence, "id">;
  note?: string;
}

export interface AddFactInput {
  evidenceIds: string[];
  field: string;
  value: unknown;
}

export interface AddInferenceInput {
  evidenceIds: string[];
  factIds: string[];
  field: string;
  value: unknown;
  confidence: ConfidenceLevel;
  reasoning: string;
  confirmable?: boolean;
}

export interface AddLinkInput {
  entityType: EntityType;
  entityId: string;
  label: string;
  relationship: string;
  source?: "user" | "ai";
}

export interface AddRelatedContextInput {
  relatedContextId: string;
  relationType: ContextRelationType;
  description: string;
  source?: "user" | "ai" | "system";
}

// ════════════════════════════════════════════════════════════════════════════════
// DOMAIN TYPES — Predefined Context types for common domains
// ════════════════════════════════════════════════════════════════════════════════

export const CONTEXT_DOMAIN_TYPES = {
  FINANCIAL_TRANSACTION: "financial.transaction",
  FINANCIAL_ACCOUNT: "financial.account",
  FINANCIAL_GOAL: "financial.goal",
  CALENDAR_EVENT: "calendar.event",
  CALENDAR_REMINDER: "calendar.reminder",
  PERSON_CONTACT: "person.contact",
  PROJECT: "project",
  USER_NOTE: "user.note",
  AI_SUGGESTION: "ai.suggestion",
  AI_ALERT: "ai.alert",
  EMAIL: "email",
  NOTIFICATION: "notification",
} as const;

export type ContextDomainType =
  (typeof CONTEXT_DOMAIN_TYPES)[keyof typeof CONTEXT_DOMAIN_TYPES];

// ════════════════════════════════════════════════════════════════════════════════
// DERIVED TYPES — For UI convenience (NOT part of canonical model)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Statement is a DERIVED/PRESENTATION representation of Context.
 * It is NOT part of the canonical model — UI generates it from Facts.
 *
 * If stored, it should be treated as cached display optimization,
 * not source of truth.
 */
export interface Statement {
  text: string;
  generatedAt: string;
  basedOnFactIds: string[];
}

/**
 * ContextSummary is for list displays — derived from Context
 */
export interface ContextSummary {
  id: string;
  type: string;
  lifecycle: LifecycleStatus;
  primarySource: SourceType;
  factCount: number;
  inferenceCount: number;
  linkCount: number;
  createdAt: string;
  updatedAt: string;
  priority: number;
  tags: string[];
}
