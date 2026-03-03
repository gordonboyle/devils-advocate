from typing import Annotated, List, Dict, Optional, Literal, Union
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from pydantic import BaseModel, Field
import operator

# Internal Imports
from src.utils.llm_client import call_agent, ResourceLimitExceeded
from src.utils.similarity import check_similarity
from src.utils.gatekeeper import evaluate_plan, GatekeeperResult

# --- 1. Data Contracts (Matches v4.3 Spec) ---
class Step(BaseModel):
    step: str
    description: str

class Risk(BaseModel):
    risk: str
    mitigation: str

class ProjectPlan(BaseModel):
    objective: str
    normalized_objective: Optional[str] = None # The Frozen Anchor
    assumptions: List[str]
    constraints: List[str]
    steps: List[Step]
    success_metrics: List[str]
    risks: List[Risk]
    version: int

class Critique(BaseModel):
    critic_name: str
    score: int
    fatal_flaw: bool = False # The Veto Trigger
    flaws: List[str]
    missing_elements: List[str]
    recommendations: List[str]

# --- 2. System State ---
class AgentState(TypedDict):
    user_objective: str
    plan: Optional[ProjectPlan]
    critiques: List[Critique]
    iteration: int
    stagnation_count: int
    polarization_count: int
    total_calls: int
    human_interrupt_active: bool
    human_feedback_text: Optional[str]
    devil_advocate_triggered: bool
    human_action: Optional[str] # "approve" | "reject"
    status: str
    feedback_loop_count: int
    previous_score: float       # For extension logic and stagnation detection
    previous_flaw_count: int    # For extension logic
    # Interrogator Node fields (v5.1)
    interrogator_questions: Optional[List[str]]
    user_answers: Optional[str]
    combined_context: Optional[str]

def ensure_plan_object(plan_data):
    if plan_data is None:
        return None
    if isinstance(plan_data, dict):
        return ProjectPlan(**plan_data)
    return plan_data

# --- 3. Node Logic ---

# Schema for Interrogator questions output
class InterrogatorQuestions(BaseModel):
    """Schema for the interrogator's clarifying questions."""
    questions: List[str] = Field(
        ...,
        min_length=3,
        max_length=5,
        description="3-5 painful clarifying questions to uncover hidden constraints, budget limits, or 'why' motivations"
    )

def interrogator_node(state: AgentState):
    """
    Interrogator Node (v5.1): Asks clarifying questions BEFORE drafting.

    Flow:
    1. First run: Generate questions, call interrupt() which pauses execution
    2. Resume: interrupt() returns user's answers (via Command(resume=...))
    3. Build combined_context and pass to draft
    """
    print("--- Node: Interrogator ---")
    current_calls = state.get("total_calls", 0)
    user_objective = state["user_objective"]

    print("Interrogator: Generating clarifying questions...")

    system_prompt = (
        "You are the INTERROGATOR AGENT for the Devils Advocate system. "
        "Your job is to ask PAINFUL but necessary clarifying questions that will "
        "dramatically improve the quality of the plan we create.\n\n"
        "Focus on uncovering:\n"
        "- Hidden constraints (time, resources, dependencies)\n"
        "- Budget or cost limitations\n"
        "- The deeper 'WHY' behind the objective\n"
        "- Success criteria that aren't obvious\n"
        "- Potential blockers or dealbreakers\n\n"
        "Ask 3-5 pointed questions. Be direct. Don't be afraid to challenge assumptions."
    )

    user_prompt = f"The user wants to: {user_objective}\n\nGenerate clarifying questions."

    try:
        result = call_agent(system_prompt, user_prompt, InterrogatorQuestions, current_call_count=current_calls)
        questions = result.questions
        print(f"Interrogator: Generated {len(questions)} questions")

        # INTERRUPT: Pause execution and wait for user answers.
        # When resumed via Command(resume=answers), interrupt() returns the answers.
        user_answers = interrupt({"questions": questions})

        # This code runs AFTER resume - build combined context
        print("Interrogator: Building combined context from user answers...")
        combined_context = (
            f"OBJECTIVE: {user_objective}\n\n"
            f"CLARIFYING ANSWERS FROM USER:\n{user_answers}"
        )

        return {
            "interrogator_questions": questions,
            "user_answers": user_answers,
            "combined_context": combined_context,
            "total_calls": current_calls + 1
        }

    except ResourceLimitExceeded:
        print("Interrogator: Resource limit exceeded, skipping questions")
        return {"status": "VETO", "total_calls": current_calls + 1}


def draft_node(state: AgentState):
    print(f"--- Node: Drafter (Iteration {state.get('iteration', 0)}) ---")
    current_calls = state.get("total_calls", 0)

    # Prefer enriched context from Interrogator if available
    combined_context = state.get("combined_context")
    raw_objective = state["user_objective"]
    objective_context = combined_context if combined_context else raw_objective

    current_plan = ensure_plan_object(state.get("plan"))
    critiques = state.get("critiques", [])

    system_prompt = (
        "You are the DRAFT AGENT for the Devils Advocate system. "
        "Your goal is to create a comprehensive ProjectPlan based on the user's objective."
    )

    if combined_context:
        system_prompt += (
            "\n\nIMPORTANT: The user has answered clarifying questions. "
            "Use their answers to create a more precise and tailored plan. "
            "Their answers reveal constraints, motivations, and success criteria."
        )

    user_prompt = f"Context:\n{objective_context}\n"
    if current_plan:
        system_prompt += " Refine the existing plan based on usage feedback."
        user_prompt += f"\nCurrent Plan Version: {current_plan.version}\n"
        user_prompt += f"Critiques to address: {critiques}\n"

    try:
        new_plan = call_agent(system_prompt, user_prompt, ProjectPlan, current_call_count=current_calls)

        # Preserve normalized_objective anchor
        if not new_plan.normalized_objective and current_plan:
            new_plan.normalized_objective = current_plan.normalized_objective
        elif not new_plan.normalized_objective:
            new_plan.normalized_objective = raw_objective

        return {
            "plan": new_plan,
            "iteration": state.get("iteration", 0) + 1,
            "total_calls": current_calls + 1,
            "critiques": []
        }
    except ResourceLimitExceeded:
        return {"status": "VETO", "total_calls": current_calls + 1}

def critique_node(state: AgentState):
    print("--- Node: Parallel Critique ---")
    current_calls = state.get("total_calls", 0)
    plan = state["plan"]

    sys_prompt_base = (
        "You are a CRITIC AGENT. Analyze the plan for flaws, missing elements, and risks. "
        "Return a Critique object. "
        "Directive: If you find a structural error that makes the plan impossible, set fatal_flaw to True."
    )

    try:
        crit_a = call_agent(
            sys_prompt_base + " You are Critic A - Focus on Feasibility.",
            f"Plan: {plan.model_dump_json()}",
            Critique,
            current_call_count=current_calls
        )
        crit_a.critic_name = "Critic A"

        crit_b = call_agent(
            sys_prompt_base + " You are Critic B - Focus on Efficiency and Risks.",
            f"Plan: {plan.model_dump_json()}",
            Critique,
            current_call_count=current_calls + 1
        )
        crit_b.critic_name = "Critic B"

        return {
            "critiques": [crit_a, crit_b],
            "total_calls": current_calls + 2
        }
    except ResourceLimitExceeded:
        return {"status": "VETO", "total_calls": current_calls + 2}

def similarity_check_node(state: AgentState):
    print("--- Node: Similarity Check ---")
    critiques = state.get("critiques", [])
    if len(critiques) < 2:
        return {"devil_advocate_triggered": False}

    # Similarity Logic: Concatenation of flaws and recommendations lists ONLY.
    text_a = " ".join(critiques[0].flaws + critiques[0].recommendations)
    text_b = " ".join(critiques[1].flaws + critiques[1].recommendations)

    sim_score = check_similarity(text_a, text_b)
    print(f"Critique Similarity: {sim_score:.4f}")

    # IF SIMILAR (>0.90) -> Devil's Advocate
    is_too_similar = sim_score > 0.90

    return {"devil_advocate_triggered": is_too_similar}

def devil_advocate_node(state: AgentState):
    print("--- Node: Devil's Advocate (Critic C) ---")
    current_calls = state.get("total_calls", 0)
    plan = state["plan"]

    sys_prompt = (
        "You are the DEVIL'S ADVOCATE (Critic C). "
        "The previous critics were too similar. You must find a completely different angle. "
        "Challenge the core assumptions. Be contrarian."
    )

    try:
        crit_c = call_agent(
            sys_prompt,
            f"Plan: {plan.model_dump_json()}",
            Critique,
            current_call_count=current_calls
        )
        crit_c.critic_name = "Devil's Advocate"

        return {
            "critiques": state["critiques"] + [crit_c],
            "total_calls": current_calls + 1
        }
    except ResourceLimitExceeded:
        return {"status": "VETO", "total_calls": current_calls + 1}

def human_injection_node(state: AgentState):
    print("--- Node: Human Injection ---")
    # Clears the interrupt flag; human_feedback_text is picked up by synthesize via state
    return {"human_interrupt_active": False}

def synthesize_node(state: AgentState):
    print("--- Node: Synthesizer ---")
    current_calls = state.get("total_calls", 0)
    plan = ensure_plan_object(state["plan"])
    critiques = state["critiques"]

    sys_prompt = (
        "You are the SYNTHESIZER AGENT. "
        "Your job is to update the ProjectPlan specifically addressing the critiques provided. "
        "\nMandate 1: If Critic C (Devil's Advocate) is present, you MUST explicitly address their points. "
        "\nMandate 2: Ensure the normalized_objective is respected."
    )

    user_prompt = f"Original Plan: {plan.model_dump_json()}\nCritiques: {critiques}"

    try:
        new_plan = call_agent(sys_prompt, user_prompt, ProjectPlan, current_call_count=current_calls)

        # Preserve anchor and increment version
        new_plan.normalized_objective = plan.normalized_objective
        new_plan.version = plan.version + 1

        return {
            "plan": new_plan,
            "total_calls": current_calls + 1
        }
    except ResourceLimitExceeded:
        return {"status": "VETO", "total_calls": current_calls + 1}

def gatekeeper_node(state: AgentState):
    print("--- Node: Gatekeeper ---")
    plan = ensure_plan_object(state["plan"])
    critiques = state["critiques"]
    iteration = state["iteration"]
    normalized_obj = plan.normalized_objective

    stagnation_count = state.get("stagnation_count", 0)
    polarization_count = state.get("polarization_count", 0)
    previous_score = state.get("previous_score", 0.0)
    previous_flaw_count = state.get("previous_flaw_count", 999)

    # Build plan text for drift check (objective + step descriptions only, to avoid JSON noise)
    step_descriptions = " ".join([s.description for s in plan.steps])
    plan_text = f"Objective: {plan.objective}. Steps: {step_descriptions}"

    result = evaluate_plan(
        critiques=critiques,
        iteration=iteration,
        current_plan_text=plan_text,
        normalized_objective=normalized_obj,
        previous_score=previous_score,
        previous_flaw_count=previous_flaw_count,
        stagnation_count=stagnation_count,
        polarization_count=polarization_count,
    )

    print(f"Gatekeeper Decision: {result.status} | {result.message}")

    # Persist current score/flaw count for the next iteration's stagnation/extension checks
    avg_score = sum(c.score for c in critiques) / len(critiques) if critiques else 0.0
    flaw_count = sum(len(c.flaws) for c in critiques)

    return {
        "status": result.status,
        "stagnation_count": result.stagnation_count,
        "polarization_count": result.polarization_count,
        "previous_score": avg_score,
        "previous_flaw_count": flaw_count,
    }


# --- 4. Conditional Edges ---
def route_similarity(state: AgentState):
    if state.get("devil_advocate_triggered"):
        return "devil_advocate"
    return "synthesize"

def route_gatekeeper(state: AgentState):
    status = state.get("status", "")

    # Safety: total compute cap (spec section 6: limit 15)
    if state.get("total_calls", 0) > 15:
        return "veto"

    # Mid-loop human interrupt takes priority over all status routing
    if state.get("human_interrupt_active"):
        return "human_injection"

    if status in ("PASS", "FATAL_FLAW", "STAGNANT", "POLARIZED"):
        return "human_review"
    elif status == "RECOVERABLE_FAIL":
        return "draft"
    else:
        return "veto"

def route_after_human(state: AgentState):
    status = state.get("status", "")
    iteration = state.get("iteration", 0)

    # Exit conditions
    if status == "APPROVED":
        print("Plan approved by human. Ending.")
        return "end"
    if status == "MAX_LOOPS_REACHED":
        print("Max feedback loops reached. Forcing end.")
        return "end"
    if status == "VETO":
        print("Veto status detected. Ending.")
        return "end"

    # Safety limits
    if state.get("total_calls", 0) > 45:
        print("Total calls exceeded. Forcing end.")
        return "end"
    if iteration >= 5:
        print(f"Max iterations ({iteration}) reached. Forcing end.")
        return "end"

    # Continue with feedback - route to draft for a full critique cycle
    print(f"Feedback loop: routing back to draft (iteration {iteration})")
    return "draft"


# --- 5. Graph Construction ---
workflow = StateGraph(AgentState)

# Add nodes - Interrogator is the entry point (v5.1)
workflow.add_node("interrogator", interrogator_node)
workflow.add_node("draft", draft_node)
workflow.add_node("critique", critique_node)
workflow.add_node("similarity_check", similarity_check_node)
workflow.add_node("devil_advocate", devil_advocate_node)
workflow.add_node("human_injection", human_injection_node)
workflow.add_node("synthesize", synthesize_node)
workflow.add_node("gatekeeper", gatekeeper_node)

# Entry point: Interrogator asks clarifying questions before any planning
workflow.set_entry_point("interrogator")

# Interrogator -> Draft (after questions are answered via interrupt/resume)
workflow.add_edge("interrogator", "draft")

workflow.add_edge("draft", "critique")
workflow.add_edge("critique", "similarity_check")

workflow.add_conditional_edges(
    "similarity_check",
    route_similarity,
    {"devil_advocate": "devil_advocate", "synthesize": "synthesize"}
)

workflow.add_edge("devil_advocate", "synthesize")
workflow.add_edge("human_injection", "synthesize")
workflow.add_edge("synthesize", "gatekeeper")

workflow.add_conditional_edges(
    "gatekeeper",
    route_gatekeeper,
    {
        "human_review": "human_reaction",
        "human_injection": "human_injection",
        "draft": "draft",
        "veto": END
    }
)


def human_reaction_node(state: AgentState):
    print("--- Node: Human Review/Reaction ---")
    action = state.get("human_action", "reject")
    current_loop_count = state.get("feedback_loop_count", 0)

    if action == "approve":
        return {"status": "APPROVED", "feedback_loop_count": current_loop_count}
    else:
        new_loop_count = current_loop_count + 1
        print(f"Feedback loop count: {new_loop_count}")
        # After 3 rejections, force termination to prevent infinite loops
        if new_loop_count >= 3:
            print("Max feedback loops reached. Forcing termination.")
            return {"status": "MAX_LOOPS_REACHED", "feedback_loop_count": new_loop_count}
        return {"status": "FEEDBACK_LOOP", "feedback_loop_count": new_loop_count}

workflow.add_node("human_reaction", human_reaction_node)
workflow.add_conditional_edges(
    "human_reaction",
    route_after_human,
    {
        "end": END,
        "synthesize": "synthesize",
        "draft": "draft"
    }
)

# --- 6. Compilation with Checkpointing ---
from langgraph.checkpoint.memory import MemorySaver

# Initialize in-memory checkpointer for thread-level persistence
checkpointer = MemorySaver()

# Compile with interrupt before human_reaction (awaits approve/reject)
app = workflow.compile(
    checkpointer=checkpointer,
    interrupt_before=["human_reaction"]
)
