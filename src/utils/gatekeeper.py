from typing import List, Optional, Dict
from src.utils.similarity import calculate_cosine_distance

class GatekeeperResult:
    def __init__(
        self,
        status: str,
        message: str,
        stagnation_count: int = 0,
        polarization_count: int = 0,
    ):
        self.status = status
        self.message = message
        self.stagnation_count = stagnation_count
        self.polarization_count = polarization_count

def evaluate_plan(
    critiques: List,
    iteration: int,
    current_plan_text: str,
    normalized_objective: str,
    previous_score: float = 0.0,
    previous_flaw_count: int = 999,
    stagnation_count: int = 0,
    polarization_count: int = 0,
) -> GatekeeperResult:
    """
    Evaluates the current plan against the Gatekeeper rules in Section 5 of architecture_specs.md.

    Args:
        critiques: List of Critique objects from the current iteration.
        iteration: Current iteration number (1-based).
        current_plan_text: Text representation of the current plan (objective + steps).
        normalized_objective: The frozen anchor objective.
        previous_score: Average score from the previous iteration (for stagnation/extension).
        previous_flaw_count: Flaw count from the previous iteration (for extension logic).
        stagnation_count: Running count of consecutive stagnant iterations.
        polarization_count: Running count of consecutive polarized iterations.

    Returns:
        GatekeeperResult with status, message, and updated stagnation/polarization counts.
    """

    # --- 1. Fatal Flaw Check (5.1) ---
    # Rule: IF any(c.fatal_flaw for c in critiques) is True -> Block PASS. Route to Human_Review.
    for c in critiques:
        if getattr(c, 'fatal_flaw', False):
            return GatekeeperResult(
                "FATAL_FLAW",
                f"Fatal flaw detected by critic: {c.critic_name}",
                stagnation_count=stagnation_count,
                polarization_count=polarization_count,
            )

    # Guard: no critiques at all
    if not critiques:
        return GatekeeperResult(
            "RECOVERABLE_FAIL",
            "No critiques found.",
            stagnation_count=stagnation_count,
            polarization_count=polarization_count,
        )

    scores = [c.score for c in critiques]
    avg_score = sum(scores) / len(scores)
    flaw_count = sum(len(c.flaws) for c in critiques)
    score_delta = avg_score - previous_score

    # --- 2. Stagnation Check ---
    # Score improvement <= 2 points across two or more iterations indicates the loop
    # is not making meaningful progress.
    if iteration > 1 and score_delta <= 2.0:
        new_stagnation_count = stagnation_count + 1
        if new_stagnation_count >= 2:
            return GatekeeperResult(
                "STAGNANT",
                f"Stagnation detected over {new_stagnation_count} iterations. Delta: {score_delta:.2f}",
                stagnation_count=new_stagnation_count,
                polarization_count=polarization_count,
            )
    else:
        new_stagnation_count = 0  # Reset on meaningful improvement

    # --- 3. Polarization Check ---
    # Critic scores differing by >= 20 points means they have fundamentally different
    # views of the plan quality; human adjudication is needed.
    if len(scores) >= 2:
        score_spread = max(scores) - min(scores)
        if score_spread >= 20:
            new_polarization_count = polarization_count + 1
            if new_polarization_count >= 2:
                return GatekeeperResult(
                    "POLARIZED",
                    f"Critic polarization detected ({score_spread:.0f}pt spread) over {new_polarization_count} iterations.",
                    stagnation_count=new_stagnation_count,
                    polarization_count=new_polarization_count,
                )
        else:
            new_polarization_count = 0  # Reset when critics converge
    else:
        new_polarization_count = polarization_count

    # --- 4. Drift Check (5.4) ---
    # Spec mandate: If Cosine Distance > 0.3, reject changes.
    drift_distance = calculate_cosine_distance(current_plan_text, normalized_objective)
    if drift_distance > 0.3:
        return GatekeeperResult(
            "RECOVERABLE_FAIL",
            f"Drift detected. Distance: {drift_distance:.4f} > 0.3",
            stagnation_count=new_stagnation_count,
            polarization_count=new_polarization_count,
        )

    # --- 5. Scoring Thresholds (5.2) ---
    passed_threshold = False

    if iteration == 1:
        passed_threshold = avg_score > 70
    elif iteration == 2:
        passed_threshold = avg_score > 75
    elif iteration == 3:
        passed_threshold = avg_score > 80
    else:  # Iteration 4+
        passed_threshold = avg_score > 85

    if passed_threshold:
        return GatekeeperResult(
            "PASS",
            f"Passed threshold for Iteration {iteration} with Avg Score {avg_score:.2f}",
            stagnation_count=new_stagnation_count,
            polarization_count=new_polarization_count,
        )

    # --- 6. Extension Logic (Anti-Gaming) (5.3) ---
    # Grant extension to Iteration 7 only when the plan is genuinely improving.
    # score_velocity is treated as the single-step delta here.
    score_velocity = score_delta
    if (
        score_delta > 5
        and score_velocity > 3
        and avg_score > 82
        and flaw_count < previous_flaw_count
    ):
        return GatekeeperResult(
            "RECOVERABLE_FAIL",
            f"Extension granted. Score: {avg_score:.2f}, Delta: {score_delta:.2f}, Flaws: {flaw_count} < {previous_flaw_count}",
            stagnation_count=new_stagnation_count,
            polarization_count=new_polarization_count,
        )

    return GatekeeperResult(
        "RECOVERABLE_FAIL",
        f"Score {avg_score:.2f} below threshold for Iteration {iteration}",
        stagnation_count=new_stagnation_count,
        polarization_count=new_polarization_count,
    )
