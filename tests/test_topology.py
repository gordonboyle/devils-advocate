import sys
import os
from unittest.mock import patch, MagicMock
from pydantic import BaseModel
from typing import List, Dict, Optional

# Ensure src is importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import necessary classes for mocking
try:
    from src.graph import ProjectPlan, Critique, AgentState, workflow
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def run_topology_test():
    print("--- Starting QA Topology Test (Mocked LLM) ---")
    
    # Define Mock Data
    mock_plan = ProjectPlan(
        objective="Build a moon base",
        normalized_objective="Build a moon base",
        assumptions=["Gravity exists"],
        constraints=["Budget limit"],
        steps=[{"step": "1", "description": "Launch rocket"}],
        success_metrics=["Base established"],
        risks=[{"risk": "Vacuum", "mitigation": "Suits"}],
        version=1
    )
    
    mock_critique = Critique(
        critic_name="Mock Critic",
        score=85,
        fatal_flaw=False,
        flaws=["Minor flaw"],
        missing_elements=["Oxygen"],
        recommendations=["Add tanks"]
    )

    # Patch external dependencies to test graph topology only
    with patch('src.graph.call_agent') as mock_call, \
         patch('src.graph.check_similarity') as mock_sim:
        
        # Configure LLM Mock to return appropriate objects based on expected return type
        def llm_side_effect(sys_prompt, user_prompt, response_model, current_call_count, model_name="gpt-4o"):
            if response_model == Critique:
                 return mock_critique
            return mock_plan
        
        mock_call.side_effect = llm_side_effect
        
        # Configure Similarity Mock (0.5 = Diverse, skips Devil's Advocate)
        mock_sim.return_value = 0.5 

        try:
            print("Compiling workflow...")
            from src.graph import workflow
            app = workflow.compile()
            print("Graph compilation successful.")
        except Exception as e:
            print(f"CRITICAL: Graph definition failed: {e}")
            return

        initial_input = {
            "user_objective": "Build a moon base", 
            "iteration": 0, 
            "total_calls": 0,
            "status": "START",
            "critiques": [],
            "plan": None,
            "stagnation_count": 0,
            "polarization_count": 0,
            "human_interrupt_active": False,
            "devil_advocate_triggered": False
        }
        
        print(f"\nRunning simulation with input: {initial_input['user_objective']}")
        print("-" * 40)

        try:
            step_count = 0
            for output in app.stream(initial_input):
                step_count += 1
                node_name = next(iter(output))
                node_val = output[node_name]
                
                print(f"Finished Node: {node_name}")
                print(f"Output Keys: {list(node_val.keys())}")
                
                # Stop after a full cycle (Draft -> Critique -> Similarity -> Synthesize -> Gatekeeper)
                # Gatekeeper loops back to Draft in this mock scenario (Drift fail)
                if node_name == "gatekeeper":
                    print("Gatekeeper executed. Stopping test simulation.")
                    break
                    
        except Exception as e:
            print(f"Runtime Error during simulation: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    run_topology_test()
