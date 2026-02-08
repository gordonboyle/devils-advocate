# Devil's Advocate Project Status & Architecture Update (v5.1)
**Date:** February 8, 2026
**Status:** ✅ Operational, UI Polished, Backend Stable

## 1. Executive Summary
Devil's Advocate is currently at version **v5.1**. The platform has successfully transitioned to a production-ready UI with a polished, centered hero layout featuring the new transparent insignia. The core AI logic, powered by a LangGraph-based backend, is fully functional and capable of handling complex mission planning, interrogation loops, and plan generation.

## 2. System Architecture

### A. Frontend (UI Layer)
The user interface is built with **Next.js 14+** (App Router) and **Tailwind CSS**.
*   **Hero Layout (`page.tsx`)**: Reimagined as a centralized "Control Center". Removed sidebar navigation for a focused, mission-critical experience.
*   **Insignia Component (`Insignia.tsx`)**: Displays the official "Devil's Advocate" shield. Now uses `insignia_v2.png` with a transparent background for seamless integration on dark mode.
*   **Interrogator UI**: Dynamically renders clarifying questions when the AI detects missing information. Uses red cards for high-priority queries.

### B. Backend (Intelligence Core)
The backend is a **FastAPI** service running on port `8005`, facilitating communication between the UI and the AI graph.
*   **Graph Logic (`src/graph.py`)**: Implements a state machine using `langgraph`.
    *   **Nodes**: `InputParser`, `Strategist`, `Interrogator`, `PlanExecutor`.
    *   **Flow**:
        1.  Received Mission -> `InputParser`
        2.  Analyze -> If ambiguity detected -> **Interrogator** (Human-in-the-loop)
        3.  If clear -> `Strategist` -> `PlanExecutor`
        4.  Output -> **Operational Plan**

### C. AI Integration
*   **Model**: Google Gemini 1.5 Pro via `src/utils/llm_client.py`.
*   **Prompting**: Uses system prompts designed for "adversarial" planning (finding flaws, risks, and contingencies).

## 3. Recent Updates & Fixes (v5.1)

### ✅ UI/UX Polish
*   **Transparent Insignia**: Fixed the black square background artifact on the main logo. The new `insignia_v2.png` is clean and professional.
*   **Centered Layout**: Moved from a dashboard-style sidebar to a centered, high-impact hero section.
*   **New Mission Reset**: Implemented a "New Mission" button to clear local state and start fresh without browser refreshes.

### ✅ Backend Logic
*   **Recursion Limit Handling**: Updated `graph.py` to handle recursion limits more gracefully during complex planning loops.
*   **Interrogator Handoff**: Fixed the state persistence issue where the graph would lose context after user input.

## 4. Current Workflow Status

| Stage | Status | Notes |
| :--- | :--- | :--- |
| **Mission Input** | ✅ Working | Direct text entry in hero input. parser active. |
| **Analysis** | ✅ Working | AI correctly identifies mission intent. |
| **Interrogation** | ✅ Working | Triggers correctly when details (e.g., budget, timeline) are missing. questions render in UI. |
| **Plan Generation** | ✅ Working | Generates comprehensive operational plans with risk analysis. |
| **Deployment** | ⚠️ Pending | Running locally on `localhost:3005` (frontend) and `8000/8005` (backend). |

## 5. Next Steps
1.  **Deployment**: Prepare Docker containers for frontend and backend to streamline deployment.
2.  **Authentication**: Implement user accounts (if required for multi-user support).
3.  **History Persistence**: Save past missions to a database (SQLite/PostgreSQL) instead of in-memory graph state.
4.  **Export Options**: Allow exporting the final plan to PDF or Markdown.

---
**Repository Status**: All changes pushed to `origin/main` (Commit `b8688cb`).
