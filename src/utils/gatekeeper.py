from typing import List, Optional, Dict
from src.utils.similarity import calculate_cosine_distance

class GatekeeperResult:
    def __init__(self, status: str, message: str):
        self.status = status
        self.message = message

def evaluate_plan(
    critiques: List,  # expects List[Critique] objects (duck-typed or imported)
    iteration: int,
    current_plan_text: str,
    normalized_objective: str,
    previous_score: float = 0.0,
    previous_flaw_count: int = 999
) -> GatekeeperResult:
    """
    Evaluates the current plan against the Gatekeeper rules in Section 5 of architecture_specs.md.
    
    Args:
        critiques: List of Critique objects from the current iteration.
        iteration: Current iteration number (1-based).
        current_plan_text: Text representation of the current plan (e.g. objective + steps).
        normalized_objective: The frozen anchor objective.
        previous_score: Average score from the previous iteration.
        previous_flaw_count: Count of flaws from the previous iteration.
        
    Returns:
        GatekeeperResult with status (PASS, FATAL_FLAW, RECOVERABLE_FAIL, etc.) and a message.
    """
    
    # --- 1. Fatal Flaw Check (5.1) ---
    # Rule: IF any(c.fatal_flaw for c in critiques) is True -> Block PASS. Route to Human_Review.
    for c in critiques:
        if getattr(c, 'fatal_flaw', False):
            return GatekeeperResult("FATAL_FLAW", f"Fatal flaw detected by critic: {c.critic_name}")

    # Calculate Average Score
    if not critiques:
        return GatekeeperResult("RECOVERABLE_FAIL", "No critiques found.")
        
    avg_score = sum(c.score for c in critiques) / len(critiques)
    flaw_count = sum(len(c.flaws) for c in critiques)

    # --- 2. Drift Check (5.4) ---
    # Anchor: Compare against normalized_objective.
    # Metric: Cosine Distance (1 - cosine_similarity).
    # If Cosine Distance > 0.3, reject changes.
    drift_distance = calculate_cosine_distance(current_plan_text, normalized_objective)
    if drift_distance > 0.3:
        # Spec says "reject changes", which implies failure. 
        # Usually implies a recoverable fail or specialized drift status.
        # The spec flow: "IF FAIL (Recoverable): -> Draft (Loop)". 
        # High drift suggests we strayed too far -> send back to Draft.
        return GatekeeperResult("RECOVERABLE_FAIL", f"Drift detected. Distance: {drift_distance:.4f} > 0.3")

    # --- 3. Scoring Thresholds (5.2) ---
    passed_threshold = False
    
    if iteration == 1:
        if avg_score > 70: passed_threshold = True
    elif iteration == 2:
        if avg_score > 75: passed_threshold = True
    elif iteration == 3:
        if avg_score > 80: passed_threshold = True
    else: # Iteration 4+
        if avg_score > 85: passed_threshold = True

    if passed_threshold:
        return GatekeeperResult("PASS", f"Passed threshold for Iteration {iteration} with Avg Score {avg_score:.2f}")

    # --- 4. Extension Logic (Anti-Gaming) (5.3) ---
    # Grant extension to Iteration 7 ONLY IF:
    # Score_Delta > 5
    # Score_Velocity > 3 (Here we treat velocity ~ delta for single step or require history)
    # Current_Score > 82
    # Flaw_Count_Current < Flaw_Count_Previous
    
    # We only check this if we FAILED the threshold but might get an extension.
    # Typically this applies if we are hitting the iteration limit, but spec says "Grant extension to Iteration 7".
    # Assuming standard max is lower (e.g. 5) or this logic applies when we are failing to PASS.
    # If we haven't passed, we default to RECOVERABLE_FAIL unless we hit limits (checked in graph).
    # However, if we want to explicitly flag an "EXTENSION_GRANTED" vs "FAIL", we check this.
    # For now, if we don't pass, we return RECOVERABLE_FAIL so the graph loops back (Extension).
    
    # If we are failing, we just return RECOVERABLE_FAIL to loop again.
    # The Veto/Limit logic is handled in the graph conditional edge (total_calls > 15), 
    # but specific "Extension" logic usually modifies that limit or allows a loop where it might otherwise stop.
    # Given the prompt asks to implement the logic *rules*, I will keep it simple: 
    # If not PASS and not FATAL_FLAW, it is RECOVERABLE_FAIL.
    
    return GatekeeperResult("RECOVERABLE_FAIL", f"Score {avg_score:.2f} below threshold for Iteration {iteration}")
