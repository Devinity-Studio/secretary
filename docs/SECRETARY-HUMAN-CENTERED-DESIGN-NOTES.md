# Secretary — Human-Centered Design Notes

> **Captured:** 2026-09-18  
> **Purpose:** Preserve the design insight from the human-centered discussion so it is not lost between implementation steps.

## Core Insight

Secretary should not be designed around the assumption that AI must always understand correctly on the first attempt.

Human communication is inherently imperfect:
- people use ambiguous words and pronouns;
- meanings depend on context;
- people shorten words, invent new words, switch language/register, or speak incompletely;
- people can hesitate, change their minds, or correct themselves.

**Human imperfection is not noise to eliminate. It is part of the environment Secretary is designed to work with.**

## Uncertainty Is a Valid State

When Secretary is not sufficiently confident about what a person means, uncertainty should be represented explicitly rather than silently converted into a Fact.

A useful interaction model is:

```
User speaks
   ↓
Secretary interprets
   ↓
Context Card + Voice
   ↓
"ผมเข้าใจแบบนี้ ถูกไหมครับ?"
   ↓
Confirm / Correct / Add context
   ↓
Only then take the consequential action
```

The system should be comfortable asking back.

> **การถามกลับไม่ใช่ความล้มเหลวของ AI แต่เป็นกลไกป้องกันความผิดพลาด**

## Confirmation Friction vs. Irreversible Error

A small amount of user friction (being asked to confirm) can be preferable to an incorrect action that is difficult or impossible to undo.

Design principle:

> **When uncertainty has a higher cost than confirmation friction, ask.**

This does not mean asking for every trivial action. The amount of confirmation should be related to both:
1. how uncertain the interpretation is; and
2. how consequential or irreversible the resulting action is.

The dangerous pattern is:

```
Command → silent interpretation → silent action → user discovers the mistake later
```

The safer pattern is:

```
Command → interpretation → visible context → confirmation/correction → action
```

## Context Card + Voice

Context Card is not merely a UI component.

It can serve as a **shared checkpoint of understanding between human and AI**.

Voice makes that checkpoint conversational:

> "ผมเข้าใจว่าคุณหมายถึงแบบนี้นะครับ..."

The user can:
- confirm;
- correct;
- add missing information;
- change their mind.

The canonical Context should therefore remain editable until the relevant understanding is sufficiently established.

## Human + AI, Not AI Replacing the Conversation

Secretary should not aim only for:

```
Human → command
AI → understand → decide → act
```

The intended model is closer to:

```
Human → express intent
AI → form an understanding
AI → show what it understood
Human → confirm / correct / add
AI → act with shared understanding
```

This is **Human + AI in the conversation**, rather than simply Human-in-the-loop as a final reviewer.

The goal is not to remove human participation from the process. The goal is to make human-AI understanding clearer and safer.

## Product Philosophy

Secretary does not need to compete by being the most automated or by eliminating every moment of uncertainty.

Its differentiating direction is to put **the human way of communicating** into the product itself:
- ambiguity is expected;
- uncertainty can be expressed;
- clarification is normal;
- correction is part of the workflow;
- changing one's mind is allowed;
- the user remains the owner of consequential decisions.

> **"ถ้าผมยังไม่เข้าใจ ผมจะไม่แกล้งทำเป็นเข้าใจครับ"**

## Relationship to Existing Secretary Principles

This discussion reinforces the existing contract:

- **Context = Canonical**
- **UI = Viewer**
- **Statement = Derived**
- **Evidence / Fact / Inference = Separate**

In particular, an interpretation that has not been confirmed should not silently become a Fact.

## Direction, Not Yet an Implementation Specification

These notes capture the product/design philosophy discovered during discussion.

They are **not** permission to immediately add UI, Voice behavior, confirmation rules, or new dependencies.

Implementation should continue through the existing project gates and should translate these principles into concrete requirements only when the relevant Secretary slice is reached.

---

### Guiding sentence

> **ความไม่สมบูรณ์แบบนี่แหละ คือความสมบูรณ์แบบในความเป็นมนุษย์**

Secretary should be designed to work with that reality, not pretend it does not exist.
