import sys
import os
import argparse
import json
import time

# Ensure src is importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.graph import workflow, ProjectPlan, Critique

def print_banner():
    print(r"""
    ____             _ _           _       _                     _       
   |  _ \  _____   _(_) |___      / \   __| |_   _____   ___ __ | |_ ___ 
   | | | |/ _ \ \ / / | / __|    / _ \ / _` \ \ / / _ \ / __/ _` | __/ _ \
   | |_| |  __/\ V /| | \__ \   / ___ \ (_| |\ V / (_) | (_| (_| | ||  __/
   |____/ \___| \_/ |_|_|___/  /_/   \_\__,_| \_/ \___/ \___\__,_|\__\___|
                                                                          
    Devils Advocate System (v4.3)
    ----------------------------------------------------------------------
    """)

def main():
    print_banner()
    
    # Parse Arguments
    parser = argparse.ArgumentParser(description="Run the Devils Advocate AI Planning Engine")
    parser.add_argument("--objective", type=str, help="The project objective to plan for")
    parser.add_argument("--interactive", action="store_true", help="Run in interactive mode")
    args = parser.parse_args()

    objective = args.objective
    
    # Fallback to interactive prompt if no objective
    if not objective:
        objective = input("\n[?] Enter your Project Objective: ").strip()
        if not objective:
            print("(!) Objective cannot be empty.")
            return

    print(f"\n[*] Initializing Engine with Objective: '{objective}'")
    print("[*] Compiling Graph...")
    
    try:
        app = workflow.compile()
    except Exception as e:
        print(f"[!] Error Compiling Graph: {e}")
        return

    initial_state = {
        "user_objective": objective,
        "iteration": 0,
        "total_calls": 0,
        "stagnation_count": 0,
        "polarization_count": 0,
        "human_interrupt_active": False,
        "devil_advocate_triggered": False,
        "status": "START",
        "critiques": [],
        "plan": None
    }

    print("[*] Starting Execution Stream...\n")
    
    final_state = None
    
    try:
        # Stream events
        # We use recursion_limit to allow for the loops defined in logic (Draft -> Critique -> Synthesize -> Gatekeeper -> Draft)
        # Default is usually small (25), spec says total calls < 15, so 40-50 steps is safe.
        config = {"recursion_limit": 50}
        
        for output in app.stream(initial_state, config=config):
            node_name = next(iter(output))
            delta = output[node_name]
            
            # Update local tracking of final state (partial)
            # app.stream returns the *diff* or the *update*, not strictly the full state unless configured.
            # But we can look at what changed.
            
            print(f"--> Executed Node: {node_name.upper()}")
            
            if "status" in delta:
                print(f"    Status Update: {delta['status']}")
            
            if "total_calls" in delta:
                print(f"    Compute Usage: {delta['total_calls']} calls")
            
            if "plan" in delta and delta["plan"]:
                plan: ProjectPlan = delta["plan"]
                print(f"    Plan Version: {plan.version} (Normalized: {plan.normalized_objective})")
                
            if "devil_advocate_triggered" in delta:
                if delta["devil_advocate_triggered"]:
                    print("    [!!!] DEVIL'S ADVOCATE TRIGGERED [!!!]")
                else:
                    print("    (Similarity Check Passed - Diverse Critiques)")
                    
            if node_name == "gatekeeper":
                status = delta.get("status")
                print(f"    Gatekeeper Verdict: {status}")
                if status == "RECOVERABLE_FAIL":
                    print("    ... Looping back to Draft.")
            
            print("-" * 50)
            
            # In a real app we might want to capture the full final state from the returned values if stream provides it
            # or rely on the final yield
            final_state = delta

    except Exception as e:
        print(f"\n[!] Runtime Exception: {e}")
        # import traceback
        # traceback.print_exc()

    print("\n[=] Execution Finished.")
    
    # Ideally we'd print the final plan details here if available from the state
    # Since app.stream yields partials, getting the full final state is better done via invoking or checking checkpoint
    # But for this CLI, we just want to see the flow.

if __name__ == "__main__":
    main()
