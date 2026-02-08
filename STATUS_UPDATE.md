# Devil's Advocate - Project Status Update
**Date:** February 8, 2026  
**Status:** ✅ Core Functionality Operational

---

## Executive Summary

The Devil's Advocate AI Planning Engine is now fully functional with all critical bugs resolved. The system successfully generates plans, processes multi-agent critiques, and supports human-in-the-loop feedback cycles without crashing.

---

## Recent Fixes (This Session)

### 1. Infinite Loop Bug — RESOLVED ✅
**Problem:** The system entered an infinite loop when human feedback was rejected, cycling endlessly between `synthesize` and `gatekeeper` nodes.

**Solution:** 
- Modified `route_after_human` in `graph.py` to route rejected feedback to `draft` (full cycle) instead of `synthesize`
- Added multiple termination conditions:
  - Max 3 feedback rejections → Forces termination
  - Max 5 iterations per session
  - Max 45 total LLM calls (soft limit)

### 2. 500 Server Error on Resume — RESOLVED ✅
**Problem:** Clicking "Resume Execution" after human review caused a 500 Internal Server Error.

**Root Causes Identified & Fixed:**
1. **State Deserialization Issue:** Plan objects restored from checkpoints became dictionaries, causing `AttributeError` when accessing `.version`, `.normalized_objective`, etc.
   - **Fix:** Added `ensure_plan_object()` helper function to safely convert dict → ProjectPlan
   - Applied to `draft_node`, `synthesize_node`, and `gatekeeper_node`

2. **Resource Limit Exceeded:** The `MAX_TOTAL_CALLS` limit (15) was too low for plans requiring multiple iterations
   - **Fix:** Increased limit to 50 calls in `src/utils/llm_client.py`
   - Updated safety check in `graph.py` to match (45 calls soft limit)

### 3. Frontend/Backend Port Mismatch — RESOLVED ✅
- Corrected API endpoints to use port `8005` (was incorrectly set to `8010`)

### 4. State Persistence — RESOLVED ✅
- Added `localStorage` persistence for `activeThreadId`, `result`, and `objective`
- Users can now refresh the page without losing their session
- Added "New Session" button to manually clear state

### 5. Windows Compatibility — RESOLVED ✅
- Removed Unicode emojis from server logs (caused `UnicodeEncodeError` on Windows console)
- Created `start_server.py` script with automatic zombie process cleanup

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│                      http://localhost:3005                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Objective   │→ │  Execute    │→ │  Human Review Panel     │  │
│  │ Input       │  │  Button     │  │  (Approve/Resume)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI)                         │
│                      http://localhost:8005                       │
│  Endpoints: POST /plan, POST /feedback, GET /health             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LANGGRAPH WORKFLOW                          │
│                                                                  │
│   ┌───────┐    ┌──────────┐    ┌────────────┐    ┌───────────┐  │
│   │ Draft │ →  │ Critique │ →  │ Synthesize │ →  │ Gatekeeper│  │
│   └───────┘    └──────────┘    └────────────┘    └─────┬─────┘  │
│       ▲                                                │        │
│       │                    ┌───────────────────────────┘        │
│       │                    ▼                                    │
│       │         ┌─────────────────────┐                         │
│       │         │   Human Review      │ ← INTERRUPT POINT       │
│       │         │   (Approve/Reject)  │                         │
│       │         └──────────┬──────────┘                         │
│       │                    │                                    │
│       └────────────────────┘  (if rejected, loop back)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## System Limits

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Max LLM Calls | 50 | Prevents runaway costs |
| Max Iterations | 5 | Prevents infinite refinement |
| Max Feedback Loops | 3 | Forces decision after 3 rejections |
| Drift Threshold | 0.3 | Semantic similarity check |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/graph.py` | Added `ensure_plan_object()`, fixed routing logic, added termination conditions |
| `src/server.py` | Added lifespan manager, improved error logging, removed emojis |
| `src/utils/llm_client.py` | Increased `MAX_TOTAL_CALLS` to 50 |
| `frontend/app/page.tsx` | Fixed API port, added state persistence, added New Session button, updated UI label |
| `start_server.py` | NEW - Server startup script with port cleanup |

---

## How to Run

### Backend
```bash
cd "c:\Users\gordo\develop\Projects\Devil's Advocate"
.\venv\Scripts\python.exe start_server.py
```
Server runs at: `http://localhost:8005`

### Frontend
```bash
cd "c:\Users\gordo\develop\Projects\Devil's Advocate\frontend"
npm run dev
```
App runs at: `http://localhost:3005`

---

## Known Limitations

1. **Plan Generation Time:** Complex objectives may take 30-60 seconds due to multiple LLM calls and iterations
2. **Gatekeeper Sensitivity:** Currently triggers `RECOVERABLE_FAIL` frequently due to drift detection; may need tuning
3. **No Authentication:** API endpoints are open (intended for local development)

---

## Next Steps (Recommendations)

1. **Performance Optimization:** Consider caching embeddings or reducing critique parallelism
2. **Gatekeeper Tuning:** Adjust drift threshold or scoring logic to reduce unnecessary iterations
3. **UI Polish:** Add progress indicators showing which node is currently executing
4. **Testing:** Add integration tests for the feedback loop
5. **Deployment:** Containerize with Docker for production use

---

## Verification

The system has been verified working via:
- ✅ `test_loop.py` script (API-level test of feedback loop)
- ✅ Backend logs showing successful `POST /plan` and `POST /feedback` with 200 OK
- ✅ Browser testing confirming UI functionality

---

*Status update generated by development session on 2026-02-08*
