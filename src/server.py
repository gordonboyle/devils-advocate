import sys
import os
import uvicorn
import uuid
from dotenv import load_dotenv

# Load env vars immediatey
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# Ensure src is importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.graph import workflow, ProjectPlan

# --- 1. App Initialization ---
# Note: workflow.compile() is called inside graph.py and exposes 'app'.
# We import the compiled 'app' directly if exported, or compile it here.
# Since we modified graph.py to compile 'app' with checkpointer, we need to import THAT app.
# However, for robustness, we usually define the graph structure in graph.py and compile here or import the compiled one.
# Let's import 'app' from src.graph which now has the checkpointer.
from src.graph import app as app_graph

api_server = FastAPI(
    title="Devils Advocate API",
    description="Deterministic AI Planning Engine with Adversarial Critique",
    version="4.3"
)

# Enable CORS for Frontend Development (Port 3005)
api_server.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Data Models ---
class InitRequest(BaseModel):
    objective: str
    thread_id: Optional[str] = None

class FeedbackRequest(BaseModel):
    thread_id: str
    action: str # "approve" | "reject" | "feedback"
    feedback_text: Optional[str] = None

class PlanResponse(BaseModel):
    thread_id: str
    final_plan: Optional[Dict[str, Any]]
    iteration_count: int
    status: str
    message: Optional[str] = None
    next_node: Optional[str] = None # To indicate if we are Paused at "human_reaction"

# --- 3. Endpoints ---
@api_server.get("/health")
async def health_check():
    return {"status": "healthy", "service": "devils-advocate"}

@api_server.post("/plan", response_model=PlanResponse)
async def start_plan(request: InitRequest):
    """
    Starts or resumes a planning session.
    """
    # Generate or use provided thread_id
    thread_id = request.thread_id or str(uuid.uuid4())
    
    config = {"configurable": {"thread_id": thread_id}}
    
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
        # LangGraph invoke with config for thread ID
        # Since we have interrupt_before=["human_reaction"], it will stop there.
        # We need to loop or just return the stopped state.
        
        # We use stream or invoke. Invoke will run until interrupt.
        final_state = app_graph.invoke(initial_state, config=config)
        
        # Check if we are interrupted
        snapshot = app_graph.get_state(config)
        next_steps = snapshot.next if snapshot.next else []
        status = "PAUSED" if next_steps else final_state.get("status", "COMPLETED")
        
        plan_obj = final_state.get("plan")
        final_plan_dict = plan_obj.model_dump() if plan_obj else None
        
        return PlanResponse(
            thread_id=thread_id,
            final_plan=final_plan_dict,
            iteration_count=final_state.get("iteration", 0),
            status=status,
            next_node=next_steps[0] if next_steps else None
        )

    except Exception as e:
        print(f"Server Error during execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_server.post("/feedback", response_model=PlanResponse)
async def provide_feedback(request: FeedbackRequest):
    """
    Resume execution after human feedback.
    """
    config = {"configurable": {"thread_id": request.thread_id}}
    
    # Check current state
    snapshot = app_graph.get_state(config)
    if not snapshot.next:
         raise HTTPException(status_code=400, detail="Thread is not in a paused state.")

    # Update state with feedback if needed
    # Update state with feedback and action
    updates = {
        "human_interrupt_active": True,
        "human_action": request.action
    }
    if request.feedback_text:
        updates["human_feedback_text"] = request.feedback_text
        
    app_graph.update_state(config, updates)
        
    # Resume! 
    # Calling invoke with None input resumes from the interruption
    try:
        final_state = app_graph.invoke(None, config=config)
        
        plan_obj = final_state.get("plan")
        final_plan_dict = plan_obj.model_dump() if plan_obj else None
         
        return PlanResponse(
            thread_id=request.thread_id,
            final_plan=final_plan_dict,
            iteration_count=final_state.get("iteration", 0),
            status=final_state.get("status", "COMPLETED")
        )
    except Exception as e:
         print(f"Server Error during resume: {e}")
         raise HTTPException(status_code=500, detail=str(e))


# --- 4. Execution Entry Point ---
if __name__ == "__main__":
    uvicorn.run("src.server:api_server", host="0.0.0.0", port=8005, reload=True)
