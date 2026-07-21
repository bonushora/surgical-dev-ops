# 📦 BH-SDP — BônusHora Snapshot & Delivery Protocol

The **BH-SDP (Snapshot & Delivery Protocol)** is a state encapsulation protocol designed to mitigate context loss in Artificial Intelligence-assisted software development sessions.

Its purpose is to transform temporary session knowledge into a structured artifact, enabling safe continuity between different sessions, agents, or developers.

BH-SDP preserves:

- current objectives;
- architectural decisions;
- involved files;
- established contracts;
- important constraints;
- safe next steps.

---

# 🏛️ Principles of State Preservation

## 1. Background Tracking

During project evolution, relevant session state must be continuously monitored.

This state includes:

- active objectives;
- implemented changes;
- inspected files;
- decisions made;
- established contracts.

This tracking enables the generation of a consistent Snapshot whenever required.

---

## 2. Context & Definition Interception

The Snapshot should be generated when relevant events occur, such as:

- file or work context changes;
- planned development pauses;
- definition of important business rules;
- API contract changes;
- creation or modification of data models;
- relevant architectural decisions.

The goal is preventing critical knowledge from remaining only inside temporary conversation history.

---

## 3. Context Exhaustion Protection

Long sessions may suffer from context degradation.

BH-SDP establishes that when there is a risk of losing important information due to session length, the current state must be consolidated into a Snapshot before continuing.

---

## 4. Self-Correction Alert

New requests must be compared against previously established critical definitions.

If there is a conflict between:

- a new request;
- a validated business rule;
- an existing contract;
- an architectural decision;

the conflict must be identified before implementation.

---

## 5. Pure Code Block

The Snapshot must be produced inside an isolated markdown block.

This enables:

- direct copying;
- storage;
- transfer to a new session;
- fast context recovery.

---

## 6. Self-Starting Instruction

Every Snapshot must end with a clear continuation instruction.

The next session must know:

- where the work stopped;
- which file must be inspected;
- which micro-step must be executed.

---

# 🤖 Artifact: AI System Prompt

Whenever starting a session where context continuity must be preserved:

```text
Also operate under the complementary BH-SDP (Snapshot & Delivery Protocol).

Maintain the current session state organized with:

- central objective;
- involved files;
- critical decisions;
- constraints;
- safe next step.

Generate a Snapshot when:

1. The user requests [SNAPSHOT].
2. A critical project definition is established.
3. A relevant context change occurs.
4. The session is approaching important information loss.
5. A conflict exists between a new request and a previously validated decision.

Required format:

### 📦 BH-SDP SNAPSHOT

- Current Central Objective:
- Latest Files Modified/Inspected:
- Critical Established Definitions:
- Current Status:
- Next Steps:

Always finish with:

"CONTINUATION DIRECTIVE:
Based on this Snapshot, execute the next listed step following safe evolution rules."

