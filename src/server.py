import sys
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

# Ensure src is importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.graph import workflow, ProjectPlan

# --- 1. App Initialization ---
app_graph = workflow.compile()
api_server = FastAPI(
    title="Devils Advocate API",
    description="Deterministic AI Planning Engine with Adversarial Critique",
    version="4.3"
)

# --- 2. Data Models ---
class PlanRequest(BaseModel):
    objective: str

class PlanResponse(BaseModel):
    final_plan: Optional[Dict[str, Any]]
    iteration_count: int
    status: str
    message: Optional[str] = None

# --- 3. Endpoints ---
@api_server.get("/health")
async def health_check():
    return {"status": "healthy", "service": "devils-advocate"}

@api_server.post("/plan", response_model=PlanResponse)
async def generate_plan(request: PlanRequest):
    """
    Executes the full planning cycle for the given objective.
    """
    initial_state = {
        "user_objective": request.objective,
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
    
    try:
        # Run the graph integration synchronously (or threadboxed via invoke)
        # LangGraph invoke returns the final state
        final_state = app_graph.invoke(initial_state)
        
        # Extract results
        plan_obj = final_state.get("plan")
        final_plan_dict = plan_obj.model_dump() if plan_obj else None
        
        return PlanResponse(
            final_plan=final_plan_dict,
            iteration_count=final_state.get("iteration", 0),
            status=final_state.get("status", "COMPLETED")
        )

    except Exception as e:
        # Log the error (print for now)
        print(f"Server Error during execution: {e}")
        # Return HTTP 500
        raise HTTPException(status_code=500, detail=str(e))

# --- 4. Execution Entry Point ---
if __name__ == "__main__":
    uvicorn.run("src.server:api_server", host="0.0.0.0", port=8000, reload=True)
