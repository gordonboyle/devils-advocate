import sys
import os
import uvicorn
import uuid
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load env vars immediately
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# Ensure src is importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.graph import workflow, ProjectPlan

# --- 1. App Initialization ---
# Import the compiled graph (includes checkpointer) from graph.py
from src.graph import app as app_graph

# LangGraph Command for resuming from interrupts (v5.1)
from langgraph.types import Command

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("devils-advocate")


# --- Lifespan Manager for Clean Startup/Shutdown ---
@asynccontextmanager
async def lifespan(app):
    """Handle server startup and shutdown events."""
    logger.info(f"Devils Advocate API starting up... PID: {os.getpid()}")
    yield
    logger.info("Devils Advocate API shutting down.")

api_server = FastAPI(
    title="Devils Advocate API",
    description="Deterministic AI Planning Engine with Adversarial Critique",
    version="5.1",
    lifespan=lifespan
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

class AnswerRequest(BaseModel):
    """Request to answer Interrogator's clarifying questions."""
    answers: str  # User's answers as free-form text

class PlanResponse(BaseModel):
    thread_id: str
    final_plan: Optional[Dict[str, Any]]
    iteration_count: int
    status: str
    message: Optional[str] = None
    next_node: Optional[str] = None # Indicates if graph is paused
    questions: Optional[List[str]] = None  # Interrogator questions (v5.1)


def _extract_interrupt_payload(snapshot) -> Optional[Dict]:
    """Extract the interrupt payload from a graph snapshot, if present."""
    if snapshot.tasks and len(snapshot.tasks) > 0:
        task = snapshot.tasks[0]
        if hasattr(task, 'interrupts') and task.interrupts:
            return task.interrupts[0].value
    return None


# --- 3. Endpoints ---
@api_server.get("/health")
async def health_check():
    return {"status": "healthy", "service": "devils-advocate"}

@api_server.post("/plan", response_model=PlanResponse)
async def start_plan(request: InitRequest):
    """
    Starts a new planning session. Runs until the graph hits an interrupt
    (Interrogator questions or Human Review) or completes.
    """
    thread_id = request.thread_id or str(uuid.uuid4())

    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "user_objective": request.objective,
        "iteration": 0,
        "total_calls": 0,
        "stagnation_count": 0,
        "polarization_count": 0,
        "previous_score": 0.0,
        "previous_flaw_count": 999,
        "human_interrupt_active": False,
        "devil_advocate_triggered": False,
        "status": "START",
        "critiques": [],
        "plan": None,
        "feedback_loop_count": 0,
        # Interrogator fields (v5.1)
        "interrogator_questions": None,
        "user_answers": None,
        "combined_context": None
    }

    try:
        final_state = app_graph.invoke(initial_state, config=config)

        snapshot = app_graph.get_state(config)
        next_steps = snapshot.next if snapshot.next else []
        interrupt_payload = _extract_interrupt_payload(snapshot)

        # Determine status based on interrupt state
        if next_steps:
            if interrupt_payload and "questions" in interrupt_payload:
                status = "INTERRUPTED"  # Interrogator is waiting for answers
                questions = interrupt_payload["questions"]
            else:
                status = "PAUSED"       # Human review is waiting
                questions = None
        else:
            status = final_state.get("status", "COMPLETED")
            questions = None

        plan_obj = final_state.get("plan")
        final_plan_dict = plan_obj.model_dump() if plan_obj else None

        return PlanResponse(
            thread_id=thread_id,
            final_plan=final_plan_dict,
            iteration_count=final_state.get("iteration", 0),
            status=status,
            next_node=next_steps[0] if next_steps else None,
            questions=questions
        )

    except Exception as e:
        logger.exception("Server error during /plan execution")
        raise HTTPException(status_code=500, detail=str(e))

@api_server.post("/plan/{thread_id}/answer", response_model=PlanResponse)
async def answer_questions(thread_id: str, request: AnswerRequest):
    """
    Answer the Interrogator's clarifying questions (v5.1).

    Uses LangGraph's Command(resume=...) to unpause the graph and feed
    the user's answers back into the Interrogator node, which then
    builds combined_context and passes it to the Draft node.
    """
    config = {"configurable": {"thread_id": thread_id}}

    snapshot = app_graph.get_state(config)
    if not snapshot.next:
        raise HTTPException(status_code=400, detail="Thread is not in a paused state.")

    try:
        final_state = app_graph.invoke(
            Command(resume=request.answers),
            config=config
        )

        snapshot = app_graph.get_state(config)
        next_steps = snapshot.next if snapshot.next else []
        interrupt_payload = _extract_interrupt_payload(snapshot)

        if next_steps:
            status = "PAUSED"  # Human review interrupt
            questions = None
        else:
            status = final_state.get("status", "COMPLETED")
            questions = None

        plan_obj = final_state.get("plan")
        final_plan_dict = plan_obj.model_dump() if plan_obj else None

        return PlanResponse(
            thread_id=thread_id,
            final_plan=final_plan_dict,
            iteration_count=final_state.get("iteration", 0),
            status=status,
            next_node=next_steps[0] if next_steps else None,
            questions=questions
        )

    except Exception as e:
        logger.exception("Server error during /answer processing")
        raise HTTPException(status_code=500, detail=str(e))

@api_server.post("/feedback", response_model=PlanResponse)
async def provide_feedback(request: FeedbackRequest):
    """
    Resume execution after human feedback (approve / reject / feedback).
    """
    config = {"configurable": {"thread_id": request.thread_id}}

    snapshot = app_graph.get_state(config)
    if not snapshot.next:
        raise HTTPException(status_code=400, detail="Thread is not in a paused state.")

    updates = {
        "human_interrupt_active": True,
        "human_action": request.action
    }
    if request.feedback_text:
        updates["human_feedback_text"] = request.feedback_text

    app_graph.update_state(config, updates)

    try:
        final_state = app_graph.invoke(None, config=config)

        # Check if the graph paused again (e.g., looped back to human_reaction)
        snapshot = app_graph.get_state(config)
        next_steps = snapshot.next if snapshot.next else []

        if next_steps:
            status = "PAUSED"
        else:
            status = final_state.get("status", "COMPLETED")

        plan_obj = final_state.get("plan")
        final_plan_dict = plan_obj.model_dump() if plan_obj else None

        return PlanResponse(
            thread_id=request.thread_id,
            final_plan=final_plan_dict,
            iteration_count=final_state.get("iteration", 0),
            status=status,
            next_node=next_steps[0] if next_steps else None,
        )
    except Exception as e:
        logger.exception("Server error during /feedback resume")
        raise HTTPException(status_code=500, detail=str(e))


# --- 4. Execution Entry Point ---
if __name__ == "__main__":
    uvicorn.run("src.server:api_server", host="0.0.0.0", port=8005, reload=True)
