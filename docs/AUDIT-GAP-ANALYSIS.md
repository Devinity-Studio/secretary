# Secretary — Audit & Gap Analysis Report

**Branch:** MiniMaxM2.7
**Date:** 5 September 2026
**Status:** Ready for Co-Founder Review

---

## Part 1: Current State Snapshot

### Repository Structure

```
secretary/
├── src/
│   ├── routes/           # 6 routes (index, finance, goals, calendar, accounts, login)
│   ├── components/       # 16 components
│   │   ├── ui/           # 3 base UI components
│   │   └── calendar/     # 3 calendar components
│   ├── lib/
│   │   ├── finance/      # Types + Store (Zustand)
│   │   ├── goals/        # Types + Store (Zustand)
│   │   ├── calendar/     # Types + Store (Zustand)
│   │   ├── auth/         # Better Auth + Gate identity
│   │   ├── supabase/     # Sync layer
│   │   └── app-data/     # App data connectors
│   └── router.tsx
├── migrations/
│   ├── auth/0001_auth.sql
│   └── 0002_supabase_sync.sql
├── artifacts/
│   ├── docs/             # 10 legacy planning docs
│   └── mobile/           # Expo app (unmaintained)
├── docs/
│   └── SECRETARY-ARCHITECTURE.md  # NEW — Product definition
└── package.json
```

### Technology Stack (Confirmed in package.json)

| Layer | Technology | Status |
|-------|-----------|--------|
| Framework | React 19 + TanStack Start/Router | ✅ |
| State | Zustand + React Query | ✅ |
| Database | Supabase SSR + Kysely + PGlite | ✅ |
| Auth | Better Auth | ✅ |
| UI | Radix UI + Tailwind v4 | ✅ |
| Workspace | react-resizable-panels | ✅ |
| Charts | Recharts | ✅ |
| Voice | ❌ Not installed | 🔴 |
| Push Notifications | ❌ Not installed | 🔴 |

---

## Part 2: Feature Gap Analysis

### Legend
- ✅ **Already Exists** — Implemented and functional
- 🟡 **Partial / Needs Refactor** — Exists but not aligned with Architecture
- 🔴 **Missing** — Not implemented
- ⚠️ **Architecture Risk** — Implemented but may conflict with Architecture direction

---

### 2.1 Context Layer

| Feature | Architecture Definition | Current State | Gap |
|---------|----------------------|---------------|-----|
| **Context Model** | Core Primitive with: Current Situation, User Intent, Time, Device, Relevant People, Projects, Accounts, Goals, Decisions, Actions, Previous Events, Current State, Next Action, Relevant External Information | ❌ No unified Context type. Domain types (Transaction, CalendarEvent, Goal) exist in isolation | 🔴 |
| **Context Card** | Universal Primitive: Statement → Evidence/Source → Related Context. Multiple visibility levels | ❌ No ContextCard component. TransactionList is a flat list item, not a Card | 🔴 |
| **Statement/Detail View** | Expandable: Statement + Related Data + History | 🟡 GoalCard has progress detail, but no unified Statement component | 🔴 |
| **Context Linking** | Scoped, Retrieved, Linked, Updated, Expired, Prioritized, Expanded/Collapsed | ❌ No linking engine | 🔴 |
| **Evidence System** | FACT / INFERENCE / ALERT separation | 🟡 CaptureBar has `confidence` on ParsedCapture, but no Evidence type | 🔴 |

---

### 2.2 Intelligence Layer

| Feature | Architecture Definition | Current State | Gap |
|---------|----------------------|---------------|-----|
| **Memory Engine** | User/Project/Relationship/Decision/Preference/Historical Memory. "เราเคยผ่านอะไรมาด้วยกัน" | ❌ No Memory store. Only Zustand persistence (localStorage) | 🔴 |
| **Relationship Engine** | Separate from Personality. Tracks closeness level, adaptive behavior | ❌ No Relationship state | 🔴 |
| **Relevance Engine** | Signal Classification → Context Matching → User Interest → Priority → Timing | ❌ No Relevance scoring | 🔴 |
| **Notification Intelligence** | Notification → Understand → Classify → Context Match → Relevance → Priority → "Should I bother boss?" | ❌ No notification processing | 🔴 |
| **Email Intelligence** | Metadata-based classification. "What is this? Does my boss care? Does boss need to know now?" | ⚠️ App-data has Gmail connector, but not integrated into Secretary flow | 🔴 |
| **Personal Relevance Engine** | Prioritizes external information based on Current Situation + User Interest + Topic Relevance | ❌ No Personal Relevance Engine | 🔴 |
| **Observed Behavior ≠ Judgement** | Store patterns, not personality judgments | ❌ No behavior observation system | 🔴 |
| **Adaptive Behavior** | Learns: communication style, detail level, when to speak/silence, importance ranking | ❌ No adaptive system | 🔴 |

---

### 2.3 Workspace Layer

| Feature | Architecture Definition | Current State | Gap |
|---------|----------------------|---------------|-----|
| **Workspace Shell** | Main Area + Context Panel + Secondary Panel | 🟡 AppShell has nav + content layout, but no panel system | 🟡 |
| **Dynamic Workspace** | Context Card (large) ↔ Card (small) + Statement (large) ↔ Statement + Related Data + History ↔ Context View | ❌ No resizable panel implementation | 🔴 |
| **Context Inertia** | Workspace shouldn't change on every sidebar conversation topic shift | ❌ No separation between Conversation layer and Workspace Context layer | 🔴 |
| **Desktop = Thinking Surface** | "เห็นอะไรบ้าง / กำลังทำอะไรอยู่" | 🟡 Desktop is just larger mobile view | 🟡 |
| **react-resizable-panels** | Technology is installed and available | ✅ Installed but unused | 🟡 |

---

### 2.4 Interaction Layer

| Feature | Architecture Definition | Current State | Gap |
|---------|----------------------|---------------|-----|
| **Voice / Ambient Interaction** | Mic States: OFF / READY / LISTENING / PROCESSING / SPEAKING. READY ≠ Record Everything | ❌ No voice capture | 🔴 |
| **Capture Bar** | Quick capture with NLP parsing | ✅ Implemented in capture-bar.tsx | ✅ |
| **Conversation** | Human gives intent, Secretary manages details | 🟡 Capture bar parses text, but no AI conversation layer | 🔴 |
| **Notifications** | Filtered, prioritized, "Should I bother boss?" | ❌ No notification layer | 🔴 |

---

### 2.5 Continuity Layer

| Feature | Architecture Definition | Current State | Gap |
|---------|----------------------|---------------|-----|
| **Multi-device** | One Secretary, Every Device, Continuous Context. Device = Interface/Body | 🟡 Supabase sync exists, but no true continuity layer | 🟡 |
| **Secretary-to-Secretary** | Canonical Shared Context for meetings/events | ❌ No S2S network | 🔴 |
| **Sync Architecture** | localStorage source of truth, Supabase durable backup | ✅ Implemented in sync.ts | ✅ |

---

### 2.6 Domain Modules

| Module | Architecture Definition | Current State | Gap |
|--------|----------------------|---------------|-----|
| **Finance Context** | Direction, Transaction Type, Source/Dest Account, Person/Entity, Category, Purpose, Project, Goal, Budget, Constraint, Evidence, Confidence | 🟡 Transaction has basic fields. Missing: Purpose, Project, Goal link, Evidence, Confidence separation | 🟡 |
| **Calendar** | Events with shared context support | ✅ Basic calendar implemented | 🟡 |
| **Goals** | Progress tracking with contributions | ✅ Implemented | ✅ |
| **Accounts** | Multiple account types | ✅ Implemented | ✅ |

---

### 2.7 Business Model & Principles

| Principle | Status |
|-----------|--------|
| Record First, Identify Later | 🟡 CaptureBar does quick parse, but no "record now, identify later" flow |
| Core Data Philosophy (Fact/Inference/Context/Memory/Relationship) | ❌ No distinction between FACT/INFERENCE/ALERT |
| Information Diet | ❌ No filtering or priority system |
| The Secretary Principle ("Should I bother my boss?") | ❌ No internal question system |
| Premium Philosophy | ❌ No tier system |

---

## Part 3: Summary Matrix

| Category | ✅ | 🟡 | 🔴 |
|----------|----|----|-----|
| Context Model | 0 | 0 | 1 |
| Context Card | 0 | 0 | 1 |
| Intelligence (Memory, Relevance, Relationship) | 0 | 0 | 6 |
| Workspace (Shell, Dynamic, Inertia) | 0 | 1 | 2 |
| Interaction (Voice, Conversation) | 1 | 1 | 2 |
| Continuity (Multi-device, S2S) | 0 | 1 | 1 |
| Domain Modules | 2 | 2 | 0 |
| Business Principles | 0 | 2 | 5 |
| **TOTAL** | **3** | **7** | **20** |

---

## Part 4: Recommended Implementation Roadmap

### Phase 1: Context Foundation (Weeks 1-4)

#### Step 1.1: Context Model
**Goal:** Define unified Context schema as the core primitive

**Files to Create:**
- `src/lib/context/types.ts` — Context, Statement, Evidence, RelatedContext types
- `src/lib/context/store.ts` — Zustand store for active context

**Files to Refactor:**
- `src/lib/finance/types.ts` — Add Evidence, Confidence, Source fields
- `src/lib/calendar/types.ts` — Align with Context interface
- `src/lib/goals/types.ts` — Align with Context interface

**Definition of Done:**
- [ ] Context type covers: Current Situation, User Intent, Time, Device, Relevant People, Projects, Accounts, Goals, Decisions, Actions, Previous Events, Current State, Next Action, Relevant External Information
- [ ] Evidence type separates FACT / INFERENCE / ALERT
- [ ] Context store has: setActive, getActive, addRelated, expire, prioritize

**Risk:** Medium — Requires refactoring existing types
**Dependency:** None

---

#### Step 1.2: ContextCard Primitive
**Goal:** Universal Card component for Mobile + Desktop

**Files to Create:**
- `src/components/context-card.tsx` — Base ContextCard
- `src/components/statement-view.tsx` — Expanded statement view
- `src/components/evidence-badge.tsx` — FACT/INFERENCE/ALERT indicator

**Definition of Done:**
- [ ] ContextCard shows: Statement, Source, Confidence indicator
- [ ] Desktop expands to Statement + Related Data + History
- [ ] Mobile shows condensed view
- [ ] Works for Transaction, CalendarEvent, Goal contexts

**Risk:** Low
**Dependency:** Step 1.1

---

#### Step 1.3: Statement / Detail View
**Goal:** Rich detail view that links Context to Related Data

**Files to Create:**
- `src/components/detail-panel.tsx` — Right panel for detail view

**Files to Refactor:**
- `src/components/transaction-list.tsx` → Use ContextCard
- `src/components/goal-card.tsx` → Use ContextCard pattern

**Definition of Done:**
- [ ] Clicking ContextCard opens Statement view
- [ ] Statement shows: all fields, Related Events, History
- [ ] Statement can collapse back to ContextCard

**Risk:** Low
**Dependency:** Step 1.2

---

### Phase 2: Workspace Shell (Weeks 5-8)

#### Step 2.1: Workspace Layout with react-resizable-panels
**Goal:** Implement Main Area + Context Panel + Secondary Panel layout

**Files to Create:**
- `src/components/workspace.tsx` — Main workspace container
- `src/components/context-panel.tsx` — Left/right context panel
- `src/components/secondary-panel.tsx` — Detail/analysis panel

**Files to Refactor:**
- `src/components/app-shell.tsx` → Use Workspace layout

**Definition of Done:**
- [ ] react-resizable-panels used for panel layout
- [ ] Panels resize proportionally
- [ ] Mobile collapses to single panel view
- [ ] Panels persist size in localStorage

**Risk:** Medium — Resizable panels need careful mobile handling
**Dependency:** Step 1.3

---

#### Step 2.2: Context Inertia
**Goal:** Separate Conversation layer from Workspace Context layer

**Files to Create:**
- `src/lib/conversation/store.ts` — Conversation state (separate from Context)

**Files to Refactor:**
- `src/router.tsx` — Add conversation state to route context
- Capture bar to update Conversation state, not Workspace

**Definition of Done:**
- [ ] Quick questions in chat don't change Workspace
- [ ] Only explicit "show me X" changes Workspace context
- [ ] Topic continuity threshold before Workspace updates

**Risk:** High — Requires clear mental model
**Dependency:** Step 2.1

---

#### Step 2.3: Dynamic Workspace
**Goal:** Workspace rearranges based on Cognitive Task

**States:**
- กำลังดู → Context Card ใหญ่
- กำลังตรวจสอบ → Card เล็ก + Statement ใหญ่
- กำลังวิเคราะห์ → Statement + Related Data + History

**Files to Refactor:**
- `src/components/workspace.tsx` — Add cognitive state machine
- `src/lib/context/store.ts` — Add cognitiveMode state

**Definition of Done:**
- [ ] Cognitive modes: viewing, inspecting, analyzing, done
- [ ] Panel layout changes per cognitive mode
- [ ] Smooth transitions between modes

**Risk:** Medium
**Dependency:** Step 2.2

---

### Phase 3: Intelligence Layer (Weeks 9-16)

#### Step 3.1: Memory Engine
**Goal:** Long-term memory for User, Project, Decision, Preference patterns

**Files to Create:**
- `src/lib/memory/types.ts` — Memory types
- `src/lib/memory/store.ts` — Memory Zustand store
- `src/lib/memory/engine.ts` — Memory operations (add, retrieve, link, expire)

**Definition of Done:**
- [ ] Memory types: UserMemory, ProjectMemory, RelationshipMemory, DecisionMemory, PreferenceMemory
- [ ] Memory survives sessions (persisted to Supabase)
- [ ] Memory retrieval based on context relevance
- [ ] Memory decay/priority system

**Risk:** Medium — Memory scope creep
**Dependency:** Step 2.3

---

#### Step 3.2: Relationship Engine
**Goal:** Track relationship closeness separate from personality

**Files to Create:**
- `src/lib/relationship/types.ts`
- `src/lib/relationship/store.ts`
- `src/lib/relationship/engine.ts` — Interaction pattern tracking

**Definition of Done:**
- [ ] Relationship state: personality ≠ closeness level
- [ ] Tracks: interaction frequency, communication style, trust level
- [ ] Adapts responses based on relationship state
- [ ] Trust can decrease (not just increase)

**Risk:** Medium
**Dependency:** Step 3.1

---

#### Step 3.3: Notification Intelligence
**Goal:** Filter notifications before bothering user

**Files to Create:**
- `src/lib/notification/classifier.ts` — Notification classification
- `src/lib/notification/prioritizer.ts` — Priority scoring
- `src/lib/notification/store.ts`

**Definition of Done:**
- [ ] Notification → Classify → Context Match → Priority → "Should I bother boss?"
- [ ] Classification: Noise, Candidate, Event, Relevant Information
- [ ] Priority threshold configurable
- [ ] Batch notifications intelligently

**Risk:** Low
**Dependency:** Step 3.1

---

#### Step 3.4: Email Intelligence
**Goal:** Email analysis using metadata + optional body parsing

**Files to Create:**
- `src/lib/email/classifier.ts`
- `src/lib/email/relevance.ts`
- `src/lib/email/store.ts`

**Definition of Done:**
- [ ] Classification: Personal, Work, Project, Meeting, Finance, Invoice, Receipt, Security, Newsletter, Promotion, Social, Spam
- [ ] "What is this? Does my boss care? Does boss need to know now?"
- [ ] Integration with App-data Gmail connector
- [ ] Email context extraction

**Risk:** Medium — Email privacy considerations
**Dependency:** Step 3.3

---

#### Step 3.5: Personal Relevance Engine
**Goal:** Filter external information based on relevance to current situation

**Files to Create:**
- `src/lib/relevance/engine.ts` — Relevance scoring
- `src/lib/relevance/types.ts`

**Definition of Done:**
- [ ] Signal Classification → Context Matching → User Interest → Current Situation → Priority → Timing
- [ ] Topic Relevance, Project Relevance, User Interest scoring
- [ ] "มีเรื่องหนึ่งที่ผมคิดว่าน่าจะเป็นประโยชน์" notification style

**Risk:** Medium
**Dependency:** Steps 3.3, 3.4

---

### Phase 4: Interaction Layer (Weeks 17-20)

#### Step 4.1: Voice / Ambient Interaction
**Goal:** Desktop voice with Mic Lock / Always Ready Mode

**Files to Create:**
- `src/lib/voice/types.ts` — MicState enum
- `src/lib/voice/hooks.ts` — useVoice hook
- `src/components/voice-indicator.tsx` — Mic state UI

**Definition of Done:**
- [ ] Mic states: OFF, READY, LISTENING, PROCESSING, SPEAKING
- [ ] READY ≠ Record Everything
- [ ] Wake word or button activation
- [ ] Speech-to-text integration
- [ ] Text-to-speech for responses

**Risk:** High — Voice quality and latency
**Dependency:** Step 2.3

---

#### Step 4.2: Conversation → Context Bridge
**Goal:** Connect conversation intent to Context updates

**Files to Create:**
- `src/lib/conversation/intent-parser.ts` — Parse user intent
- `src/lib/conversation/context-bridge.ts` — Update context from conversation

**Definition of Done:**
- [ ] Natural language intent extraction
- [ ] Context updates from conversation
- [ ] Conversation history as Context source

**Risk:** Medium
**Dependency:** Step 4.1

---

### Phase 5: Continuity Layer (Weeks 21-24)

#### Step 5.1: Multi-device Continuity
**Goal:** True continuity — same Secretary, different devices

**Files to Refactor:**
- `src/lib/supabase/sync.ts` → Add context sync
- `src/lib/context/store.ts` → Add cross-device context state

**Definition of Done:**
- [ ] Active context syncs across devices
- [ ] Conversation continuity on device switch
- [ ] "Secretary doesn't disappear" experience

**Risk:** High — Conflict resolution complexity
**Dependency:** Phase 3 complete

---

#### Step 5.2: Secretary-to-Secretary Network
**Goal:** Canonical Shared Context for meetings/events with other users

**Files to Create:**
- `src/lib/s2s/types.ts`
- `src/lib/s2s/store.ts`
- `src/lib/s2s/network.ts` — S2S communication

**Definition of Done:**
- [ ] Secretary-to-Secretary communication protocol
- [ ] Canonical Shared Context for meetings
- [ ] Both parties see same canonical event
- [ ] Conversation → Agreement → Memory flow

**Risk:** High — Network effects and trust model
**Dependency:** Step 5.1

---

## Part 5: Immediate Next Steps for Co-Founders

### Decision Required: Starting Point

Based on the architecture, we recommend starting with **Step 1.1 (Context Model)** because:

1. **Context is the core primitive** — everything builds on it
2. **Low risk** — starts with type definitions
3. **No existing code needs to change** — additive only initially
4. **Unblocks all subsequent steps**

### Alternative Starting Points

If Finance domain priority is higher:
- Start with **Finance Context Enhancement** (add Evidence, Confidence, Purpose, Project, Goal fields to Transaction)
- Then wrap in ContextCard

If Workspace priority is higher:
- Start with **Step 2.1 (Workspace Layout)** using react-resizable-panels
- Then backfill Context Model

### Recommended Order

```
1.1 Context Model → 1.2 ContextCard → 1.3 Statement View → 2.1 Workspace Layout → 2.2 Context Inertia → 2.3 Dynamic Workspace → 3.1 Memory → 3.2 Relationship → 3.3 Notification → 3.4 Email → 3.5 Relevance → 4.1 Voice → 4.2 Conversation Bridge → 5.1 Multi-device → 5.2 S2S
```

---

## Appendix: Files Reference

### Existing Files (Do Not Break)

| File | Purpose | Risk if Changed |
|------|---------|-----------------|
| `src/lib/finance/store.ts` | Finance Zustand store | High — all finance features depend |
| `src/lib/goals/store.ts` | Goals Zustand store | High |
| `src/lib/calendar/store.ts` | Calendar Zustand store | High |
| `src/lib/supabase/sync.ts` | Sync layer | High |
| `src/components/capture-bar.tsx` | Quick capture | Medium — well-isolated |
| `src/routes/*.tsx` | Route pages | Medium |

### New Files to Create (Priority Order)

1. `src/lib/context/types.ts`
2. `src/lib/context/store.ts`
3. `src/components/context-card.tsx`
4. `src/components/statement-view.tsx`
5. `src/components/workspace.tsx`
6. `src/lib/memory/types.ts`
7. `src/lib/memory/store.ts`
8. `src/lib/relationship/types.ts`
9. `src/lib/relationship/store.ts`
10. `src/lib/notification/classifier.ts`
