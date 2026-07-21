# 📦 BH-SDP — BônusHora Snapshot & Delivery Protocol

The **BH-SDP** is a state encapsulation protocol designed to mitigate context loss in AI-assisted software development sessions.

It requires the language model to continuously monitor and register, in the background, the assumed objectives, contracts, and project progress, proactively generating the updated artifact when necessary.

---

## 🏛️ Principles of Proactive Automation

1. **Background Tracking:**  
At every iteration of the conversation, the AI must maintain an internal representation of the current project state, including objectives, modified files, architectural decisions, contracts, and relevant progress, without necessarily printing this information in every response.

2. **Context & Definition Interception:**  
The AI must actively monitor the conversation and automatically generate the Snapshot whenever:

- The user changes files or indicates a pause.
- A critical project definition is established or modified, such as:
  - complex business rules;
  - API contracts;
  - new data models;
  - important architectural decisions.

3. **Context Exhaustion Autonomy:**  
The AI must proactively monitor conversation length and context usage. If it detects that the session is becoming too large and there is an imminent risk of short-term memory loss or abrupt interruption, it must independently generate the Snapshot in the last viable response and alert the user that a new chat session should be opened.

4. **Self-Correction Alert:**  
The AI must compare new user instructions against critical definitions already stored in the current Snapshot. If a requested change directly conflicts with an established premise or validated contract, the AI must generate the Snapshot and highlight the contradiction before producing code.

5. **Pure Code Block:**  
The Snapshot must be generated strictly inside an isolated markdown code block to allow fast copying and hydration into a new chat session.

6. **Self-Starting Instruction:**  
The Snapshot must always end with a clear and imperative continuation instruction for the next AI, enabling immediate workflow continuation without redundant questions.

---

## 🤖 Artifact: AI System Prompt

Whenever starting a session where context persistence must be guaranteed, attach the instructions below to the initial prompt:

```text
Also operate under the complementary BH-SDP (Snapshot & Delivery Protocol), active in the background. Your responses must strictly follow the following state automation directive:

From now on, maintain the current session state in cache. In a 100% AUTOMATIC manner and by your OWN INITIATIVE, print the block below (filled with real data) whenever:

1. The user indicates a pause or change of focus.
2. A critical project definition is established or modified (business rules, contracts, models, or complex architectural logic). Protect this progress by generating the Snapshot immediately.
3. The user's command directly conflicts with a previously established definition or contract (highlight the discrepancy before generating code).
4. You detect that the conversation is becoming too long and your context window is approaching its limit.
5. The user types "[SNAPSHOT]".

### 📦 BH-SDP AUTOMATIC SNAPSHOT

- **Current Central Objective:** [What we are solving now]

- **Latest Files Modified/Inspected:**
  - `file/path.ext`: [Brief summary of current state/change]

- **Critical Established Definitions (Protected State):**
  - [Mapping of crucial rules or contracts recently defined]

- **Stopping Point Status:**
  [Example: Code compiling, waiting for navigation test / ALERT: Conflict detected with rule X]

- **Suggested Next Steps for New Chat:**
  1. [Immediate micro-task 1]
  2. [Immediate micro-task 2]

---

**CONTINUATION DIRECTIVE FOR THE NEW AI:**

"Based on the Snapshot above and under BH-SEP rules, immediately execute the listed Next Step 1, requesting the necessary file for inspection."

