/**  
 * Secretary Capture Integration
 *
 * Bridges Finance capture flow to the Context domain model.
 *
 * Flow:
 *   User Input → parseCapture() → Evidence → ContextStore.createContext() → SecretaryContext
 *
 * Key principles:
 * - Original user input becomes Evidence (immutable proof)
 * - Parser-derived interpretation (category, account hint, etc.) does NOT become Fact
 * - Evidence / Fact / Inference remain strictly separated
 * - Judgment Boundary is respected via markPatternOnly()
 */

import { createId } from "@/lib/utils";
import { parseCapture } from "@/lib/finance/parser";
import type { Account } from "@/lib/finance/types";
import type {
  SecretaryContext,
  Evidence,
  EvidenceContent,
  SourceType,
  ConfidenceLevel,
  CreateContextInput,
  RecordIntent,
} from "./types";
import { useContextStore } from "./store";

/**
 * Convert a ParsedCapture into Evidence.
 *
 * IMPORTANT: We preserve the ORIGINAL user input as the evidence content.
 * Parser-derived interpretation (type, category, account hint, confidence)
 * is NOT added as Fact — it remains as metadata about the capture attempt.
 *
 * This respects the Judgment Boundary:
 * - Evidence = what was actually observed (the raw input)
 * - Parser output = interpretation/observation, not proven fact
 */
export function captureToEvidence(
  rawInput: string,
  parsed: ReturnType<typeof parseCapture>,
): Omit<Evidence, "id"> {
  const now = new Date().toISOString();

  // Build structured data from parse for reference, but NOT as facts
  // This is metadata about the capture, preserved for potential future use
  const structuredData: Record<string, unknown> = {
    parsedType: parsed.type,
    parsedTitle: parsed.title,
    parsedCategory: parsed.category,
    parsedAmount: parsed.amount,
    parsedAccountHint: parsed.accountHint,
    parsedToAccountHint: parsed.toAccountHint,
    parsedDate: parsed.date,
    parsedConfidence: parsed.confidence,
    // DO NOT include these as facts — they are parser guesses
  };

  return {
    sourceType: "user" as SourceType,
    sourceId: null, // No external source ID — this is direct user input
    content: {
      kind: "hybrid" as const,
      text: rawInput,
      data: structuredData,
    },
    capturedAt: now,
    confidence: mapParserConfidence(parsed.confidence) as ConfidenceLevel,
  };
}

/**
 * Map parser confidence to evidence confidence level.
 *
 * Parser confidence reflects how certain we are about the PARSE,
 * not about facts. This distinction is critical for the Judgment Boundary.
 */
function mapParserConfidence(
  parserConfidence: "high" | "medium" | "low",
): "high" | "medium" | "low" | "unknown" {
  return parserConfidence;
}

/**
 * Determine the Context type from the parsed capture.
 *
 * This is a TYPE LABEL, not a Fact. It describes what kind of context
 * we're creating, not a proven data point about the world.
 */
export function inferContextType(
  parsed: ReturnType<typeof parseCapture>,
): string {
  if (parsed.type === "income") {
    return "financial.transaction.income";
  }
  if (parsed.type === "expense") {
    return "financial.transaction.expense";
  }
  if (parsed.type === "transfer") {
    return "financial.transaction.transfer";
  }
  return "financial.transaction";
}

/**
 * Create a Context from a capture event.
 *
 * This is the core integration point: takes user input, parses it,
 * creates Evidence from the original input, and creates a Context
 * through the existing Context Store.
 *
 * The Context is created with:
 * - lifecycle = tentative (not confirmed)
 * - source = user
 * - evidence referencing the original input
 * - NO facts automatically derived from parser output
 *
 * Returns the created SecretaryContext.
 */
export function createContextFromCapture(
  rawInput: string,
  accounts: Account[],
): SecretaryContext {
  // Step 1: Parse the capture (existing Finance behavior)
  const parsed = parseCapture(rawInput, accounts);

  // Step 2: Create Evidence from the ORIGINAL user input
  // This is the immutable proof of what the user typed
  const evidenceData = captureToEvidence(rawInput, parsed);

  // Step 3: Determine context type (label only, not a fact)
  const contextType = inferContextType(parsed);

  // Step 4: Create Context through the existing Context Store
  const input: CreateContextInput = {
    evidence: evidenceData,
    type: contextType,
    source: "user" as SourceType,
    lifecycle: "tentative" as const, // Explicitly tentative — not confirmed
    tags: ["capture", parsed.type === "income" ? "income" : "expense"],
  };

  const context = useContextStore.getState().createContext(input);

  // Step 5: Mark as pattern-only (Judgment Boundary)
  // This capture is an observation, not a judgment
  useContextStore.getState().markPatternOnly(context.id);

  return context;
}

/**
 * Parse and create context in one step.
 * Convenience wrapper for capture bar integration.
 */
export function parseAndCreateContext(
  rawInput: string,
  accounts: Account[],
): { context: SecretaryContext; parsed: ReturnType<typeof parseCapture> } {
  const parsed = parseCapture(rawInput, accounts);
  const context = createContextFromCapture(rawInput, accounts);
  return { context, parsed };
}

/**
 * Get the RecordBoundary for a capture-derived context.
 *
 * This makes the Judgment Boundary explicit: a capture is a pattern
 * observation, not a judgment. The parser's interpretation is metadata,
 * not a proven fact.
 */
export function captureRecordBoundary(
  contextId: string,
): { intent: RecordIntent; created_at: string } {
  return {
    intent: {
      kind: "pattern",
      description: "Capture observation — user input parsed but not judged",
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Check if a context was created from a capture (pattern-only).
 */
export function isCaptureContext(contextId: string): boolean {
  return useContextStore.getState().isPatternOnly(contextId);
}
