from typing import Annotated, List, Dict, Optional, Literal, TypedDict, Union
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, END
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

# --- 3. Node Logic ---
def draft_node(state: AgentState):
    print(f"--- Node: Drafter (Iteration {state.get('iteration', 0)}) ---")
    current_calls = state.get("total_calls", 0)
    
    # Construct Inputs
    objective = state["user_objective"]
    current_plan = state.get("plan")
    critiques = state.get("critiques", [])
    
    # System Prompt
    system_prompt = (
        "You are the DRAFT AGENT for the Devils Advocate system. "
        "Your goal is to create a comprehensive ProjectPlan based on the user's objective."
    )
    
    user_prompt = f"Objective: {objective}\n"
    if current_plan:
        system_prompt += "Refine the existing plan based on usage feedback."
        user_prompt += f"Current Plan Version: {current_plan.version}\n"
        user_prompt += f"Critiques to address: {critiques}\n"
    
    # Normalize objective only on first run if not set
    # (In a real run, normalized_objective would be set by a specialized call or kept from 1st Draft)
    
    try:
        new_plan = call_agent(system_prompt, user_prompt, ProjectPlan, current_call_count=current_calls)
        
        # Ensure normalized_objective is preserved or set
        if not new_plan.normalized_objective and state.get("plan"):
             new_plan.normalized_objective = state["plan"].normalized_objective
        elif not new_plan.normalized_objective:
             new_plan.normalized_objective = objective # Fallback
             
        return {
            "plan": new_plan,
            "iteration": state.get("iteration", 0) + 1, 
            "total_calls": current_calls + 1,
            "critiques": [] # Clear old critiques
        }
    except ResourceLimitExceeded:
         return {"status": "VETO", "total_calls": current_calls + 1} # Handling in edge logic mostly, but safe exit here

def critique_node(state: AgentState):
    print("--- Node: Parallel Critique ---")
    current_calls = state.get("total_calls", 0)
    plan = state["plan"]
    
    # Determine Iteration Context for Critics (e.g. stricter as we go?)
    # For now, two standard critics A and B.
    
    sys_prompt_base = (
        "You are a CRITIC AGENT. Analyze the plan for flaws, missing elements, and risks. "
        "Return a Critique object. "
        "Directive: If you find a structural error that makes the plan impossible, set fatal_flaw to True."
    )
    
    # Critic A
    crit_a = call_agent(
        sys_prompt_base + " You are Critic A - Focus on Feasibility.", 
        f"Plan: {plan.model_dump_json()}", 
        Critique, 
        current_call_count=current_calls
    )
    crit_a.critic_name = "Critic A"

    # Critic B
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
    
    crit_c = call_agent(
        sys_prompt, 
        f"Plan: {plan.model_dump_json()}", 
        Critique, 
        current_call_count=current_calls
    )
    crit_c.critic_name = "Devil's Advocate"
    
    # Append to existing critiques
    return {
        "critiques": [crit_c], # This will likely merge/append in LangGraph if configured as reducer, 
                               # but here we might need to manually handle list concatenation if state writes overlap. 
                               # For 'critiques', standard TypedDict overwrites. We need to grab existing + new.
                               # But LangGraph nodes return updates. 
                               # To safely add, we should probably return the full list or rely on a custom reducer.
                               # For simplicity, we assume we just return the new one and the next node reads all?
                               # Accessing state['critiques'] provides current. 
                               # If we return "critiques": [crit_c], it overwrites.
                               # So we explicitly combine.
        "critiques": state["critiques"] + [crit_c], 
        "total_calls": current_calls + 1
    }

def human_injection_node(state: AgentState):
    print("--- Node: Human Injection ---")
    # In a real app, this would pause/wait for input or read from state['human_feedback_text']
    # which presumably was set by an interrupt handler.
    # We just clear the active flag.
    return {"human_interrupt_active": False}

def synthesize_node(state: AgentState):
    print("--- Node: Synthesizer ---")
    current_calls = state.get("total_calls", 0)
    plan = state["plan"]
    critiques = state["critiques"]
    
    sys_prompt = (
        "You are the SYNTHESIZER AGENT. "
        "Your job is to update the ProjectPlan specifically addressing the critiques provided. "
        "\nMandate 1: If Critic C (Devil's Advocate) is present, you MUST explicitly address their points. "
        "\nMandate 2: Ensure the normalized_objective is respected."
    )
    
    user_prompt = f"Original Plan: {plan.model_dump_json()}\nCritiques: {critiques}"
    
    new_plan = call_agent(sys_prompt, user_prompt, ProjectPlan, current_call_count=current_calls)
    
    # Ensure anchor is kept
    new_plan.normalized_objective = plan.normalized_objective
    new_plan.version = plan.version + 1
    
    return {
        "plan": new_plan,
        "total_calls": current_calls + 1
    }

def gatekeeper_node(state: AgentState):
    print("--- Node: Gatekeeper ---")
    plan = state["plan"]
    critiques = state["critiques"]
    iteration = state["iteration"]
    normalized_obj = plan.normalized_objective
    
    # Convert plan to text for consistency checking
    # Refined to use semantic fields only (Objective + Step Descriptions)
    # to avoid JSON noise triggering false drift.
    step_descriptions = " ".join([s.description for s in plan.steps])
    plan_text = f"Objective: {plan.objective}. Steps: {step_descriptions}"
    
    result = evaluate_plan(
        critiques=critiques,
        iteration=iteration,
        current_plan_text=plan_text,
        normalized_objective=normalized_obj
    )
    
    print(f"Gatekeeper Decision: {result.status} | {result.message}")
    
    return {"status": result.status}

# --- 4. Conditional Edges ---
def route_similarity(state: AgentState):
    if state.get("devil_advocate_triggered"):
        return "devil_advocate"
    return "synthesize"

def route_gatekeeper(state: AgentState):
    status = state.get("status", "")
    if state.get("total_calls", 0) > 15:
        return "veto"
    if status == "PASS" or status == "FATAL_FLAW" or status == "STAGNANT" or status == "POLARIZED":
        return "human_review"
    elif status == "RECOVERABLE_FAIL":
        return "draft"
    else:
        return "veto"

def route_after_human(state: AgentState):
    if state.get("status") == "APPROVED":
        return "end"
    return "synthesize"

# --- 5. Graph Construction ---
workflow = StateGraph(AgentState)

workflow.add_node("draft", draft_node)
workflow.add_node("critique", critique_node)
workflow.add_node("similarity_check", similarity_check_node)
workflow.add_node("devil_advocate", devil_advocate_node)
workflow.add_node("human_injection", human_injection_node)
workflow.add_node("synthesize", synthesize_node)
workflow.add_node("gatekeeper", gatekeeper_node)

workflow.set_entry_point("draft")

workflow.add_edge("draft", "critique")
workflow.add_edge("critique", "similarity_check")

workflow.add_conditional_edges("similarity_check", route_similarity, { "devil_advocate": "devil_advocate", "synthesize": "synthesize" })

workflow.add_edge("devil_advocate", "synthesize")
workflow.add_edge("human_injection", "synthesize")
workflow.add_edge("synthesize", "gatekeeper")

workflow.add_conditional_edges("gatekeeper", route_gatekeeper, { "human_review": "human_reaction", "draft": "draft", "veto": END })

# Add a dummy node for human_reaction if it doesn't exist, or just route to END if it's the final step.
# In the spec, Human_Review is a block. We can treat it as a node where we pause.
# Let's add a placeholder node for Human Reaction/Review so we can interrupt before it.

def human_reaction_node(state: AgentState):
    print("--- Node: Human Review/Reaction ---")
    action = state.get("human_action", "reject") # Default to reject/loop if missing
    
    if action == "approve":
        return {"status": "APPROVED"}
    else:
        return {"status": "FEEDBACK_LOOP"}

workflow.add_node("human_reaction", human_reaction_node)
workflow.add_conditional_edges("human_reaction", route_after_human, { "end": END, "synthesize": "synthesize" })

# --- 6. Compilation with Checkpointing ---
from langgraph.checkpoint.memory import MemorySaver

# Initialize in-memory checkpointer for thread-level persistence
checkpointer = MemorySaver()

# Compile with interrupt logic
app = workflow.compile(
    checkpointer=checkpointer,
    interrupt_before=["human_reaction"]
)
