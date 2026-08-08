# VOR-074 Agents SDK shadow proof

Status: **isolated experiment only**. This directory is not part of the production Ask Vorta import graph, build path or root dependency set.

## Purpose

Assess whether the official OpenAI Agents SDK for TypeScript can replace only Ask Vorta's generic iterative model/tool loop while Vorta keeps every domain-specific trust and decision control that already works.

The assessment is intentionally biased toward preserving the current working product. SDK adoption is justified only by measured simplification with no material quality, evidence, latency, cost or safety regression.

## Current SDK basis

The isolated experiment pins `@openai/agents` 0.14.0. Official SDK documentation confirms the relevant primitives used by this assessment: `Agent`, `Runner`, raw JSON-schema function tools, structured `outputType`, per-tool timeouts, custom model providers and configurable tracing. Tracing is enabled by default in supported server runtimes, so this proof explicitly disables it and disables sensitive-data inclusion.

References:

- https://openai.github.io/openai-agents-js/
- https://openai.github.io/openai-agents-js/guides/running-agents/
- https://openai.github.io/openai-agents-js/guides/tools/
- https://openai.github.io/openai-agents-js/guides/tracing/
- https://www.npmjs.com/package/@openai/agents

## Responsibility map

| Current Ask Vorta responsibility | Owner during VOR-074 | SDK role |
| --- | --- | --- |
| HTTP request parsing and `/api/ask-vorta` contract | Vorta | None |
| Authentication and verified user/site access | Vorta | None |
| Organisation/site/role/record isolation | Vorta/Supabase RLS | None |
| Conversation-context sanitisation and reference resolution | Vorta | Input only |
| Deterministic routing | Vorta | Bypassed |
| Semantic planning | Vorta initially | Possible later comparison only |
| Tool names/descriptions/JSON schemas | Vorta | Wrapped as SDK function tools |
| Tool argument/date/equipment normalisation | Vorta | Pre-execution validation |
| Evidence retrieval and RPC selection | Vorta | Calls existing executor only |
| Decision-pack compaction/de-duplication | Vorta | None |
| Iterative model → tool → model loop | Candidate for SDK | Primary candidate |
| Structured final output transport | Vorta schema | SDK `outputType` may enforce same schema |
| Evidence completeness/contradiction repair | Vorta | None |
| Confidence calibration | Vorta | None |
| Return-to-service and read-only safety repair | Vorta | None |
| Evidence links and Vorta navigation | Vorta | None |
| Telemetry and product feedback | Vorta | SDK trace export disabled |
| Sessions/persistent memory | Vorta existing conversation system | Disabled for assessment |
| Handoffs / agents-as-tools | Not used | Not authorised |

## Candidate architecture

`authenticate → Vorta deterministic/semantic plan → Vorta tool definitions → SDK runner for generic model/tool turns → Vorta evidence/output validation → existing response contract`

The SDK never becomes an authorization layer, evidence source, risk engine or operational action layer.

## Shadow adapter

`sdk-shadow.mjs` is dependency-injected. A credentialled runner must supply:

1. the model/model provider;
2. the existing Ask Vorta instructions;
3. the existing answer JSON schema;
4. the existing Vorta tool definitions;
5. the existing site-scoped Vorta tool executor;
6. a Vorta pre-tool validator;
7. the existing Vorta final-output validator.

The adapter disables tracing, limits turns to 8 and applies the existing 15-second evidence/tool timeout boundary. It does not contain Supabase credentials or a Vorta service-role path.

## Proof stages

### Stage A — isolation and static compatibility

- Root production dependencies do not include `@openai/agents`.
- No production Ask Vorta source imports this experiment.
- Existing JSON-schema tool definitions can be wrapped without changing their schema authority.
- Existing answer schema remains authoritative.
- Tracing and SDK sessions are disabled.

### Stage B — structural shadow proof

Using a deterministic/custom model provider, prove SDK loop behaviour for strict tool invocation, invalid arguments, timeout, missing evidence and output validation. This stage does **not** claim production answer quality or latency.

### Stage C — credentialled A/B proof

Run the current implementation and SDK candidate against the same permanent authenticated scenario sets listed in `proof-contract.json`. Record pass/fail, evidence integrity, route, tool calls/rounds, p50/p95 latency, token/model cost and failure behaviour.

Deterministic routes act as controls: when the current Vorta router resolves them, SDK executions must remain zero.

## Decision rule

Current provisional result: **partial-adopt candidate**.

A production migration is not authorised by this branch. VOR-074 can recommend partial adoption only if Stage C meets every safety/evidence gate and stays within the latency/cost limits in `proof-contract.json`. Any production migration must be a separate bounded VOR with an explicit rollback to the current loop.

If Stage C is unavailable, inconclusive or worse than the current implementation, keep the present orchestration. "New library exists" is not an engineering acceptance criterion.
