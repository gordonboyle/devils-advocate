# Devils Advocate – Execution Blueprint (v4.3)

## 1. Executive Summary
**System Goal:** Build a deterministic, human-governed AI planning engine.
**Core Philosophy:** "Agent-First, Human-Final."
**Architecture Style:** Directed Cyclic Graph (DCG) via LangGraph.
**Source of Truth:** `architecture_specs.md` (Version 4.3).

## 2. Core Architecture & Stack
### 2.1 Technology Stack
* **Orchestration:** LangGraph
* **Data Contracts:** Pydantic v2 (Strict Mode)
* **LLM Interface:** LiteLLM
* **Vector Logic:** `sentence-transformers` (all-MiniLM-L6-v2)
* **Safety:** Total Compute Cap + Defensive JSON Parsing

### 2.2 System Topology
`[START]` -> **Draft** (Generate + Normalize Objective) -> **Critique (A/B)** -> **Similarity_Check_Node**

* **Similarity Logic:**
    * **Input:** Concatenation of `flaws` and `recommendations` lists ONLY.
    * **IF DIVERSE:** -> **Synthesize (A+B)**
    * **IF SIMILAR (>0.90):** -> **Devil’s Advocate (C)** -> **Synthesize (A+B+C)**

**Synthesize** -> **Gatekeeper**

* **Gatekeeper Decisions:**
    * **IF FATAL FLAW TAGGED:** -> `Human_Review` (Safety Block)
    * **IF PASS:** -> `Human_Review`
    * **IF FAIL (Recoverable):** -> **Draft** (Loop)
    * **IF STAGNANT (Count >= 2):** -> `Human_Review`
    * **IF POLARIZED (Count >= 2):** -> `Human_Review`
    * **IF HUMAN INTERRUPT:** -> `Human_Injection_Node` -> **Synthesize**
    * **IF UNRECOVERABLE:** -> `Veto`

## 3. Data Contracts

### 3.1 ProjectPlan Schema
```python
class ProjectPlan(BaseModel):
    objective: str = Field(..., min_length=10)
    normalized_objective: Optional[str] = Field(None) # Fixed Anchor
    assumptions: List[str] = Field(..., min_items=1)
    constraints: List[str] = Field(..., min_items=0)
    steps: List[Dict[str, str]] = Field(..., min_items=1) 
    success_metrics: List[str] = Field(..., min_items=1)
    risks: List[Dict[str, str]] = Field(..., min_items=0)
    version: int
```

### 3.2 Critique Schema
```python
class Critique(BaseModel):
    critic_name: str 
    score: int = Field(..., ge=0, le=100)
    fatal_flaw: bool = Field(False) # The Veto Trigger
    flaws: List[str]
    missing_elements: List[str]
    recommendations: List[str] # Minimum 3 required
```

## 4. Agent Definitions
### 4.1 Synthesizer Agent
Mandate 1 (Devil's Advocate): "If Critic C is present, you MUST explicitly address their points."

Mandate 2 (Drift Guard): "Compare current plan against normalized_objective. If Cosine Distance > 0.3, reject changes."

Mandate 3 (Human Supremacy): "Human input overrides all scores."

### 4.2 Critic Agents
Directive: "If you find a structural error that makes the plan impossible, set fatal_flaw to True. This blocks the plan from passing."

## 5. The Gatekeeper (Hardened Logic)
### 5.1 The "Fatal Flaw" Block
Rule: IF any(c.fatal_flaw for c in critiques) is True -> Block PASS. Route to Human_Review.

### 5.2 Scoring Thresholds
Iteration 1: Avg > 70

Iteration 2: Avg > 75

Iteration 3: Avg > 80

Iteration 4+: Avg > 85

### 5.3 Extension Logic (Anti-Gaming)
Grant extension to Iteration 7 ONLY IF:

Score_Delta > 5

Score_Velocity > 3

Current_Score > 82

Flaw_Count_Current < Flaw_Count_Previous

### 5.4 Drift Metric
Anchor: Compare against normalized_objective.

Metric: Cosine Distance (1 - cosine_similarity).

## 6. Safety & Resource Limits
Total Compute Cap: TOTAL_CALLS = Iterations + Parser_Retries + Validation_Retries.

Limit: 15. (Triggers Veto).
