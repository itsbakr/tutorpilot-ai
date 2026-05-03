"""
TutorPilot FastAPI Backend - WaveHacks 2
Self-Improving AI Tutoring Platform
"""

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
from contextlib import asynccontextmanager
import weave
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from collections import defaultdict
from dotenv import load_dotenv
import asyncio

# Load environment variables
load_dotenv()

# Initialize Weave for tracing
weave.init(os.getenv("WEAVE_PROJECT_NAME", "tutorpilot-weavehacks"))

# Import services
from services.auth_service import (
    auth_service, 
    get_current_user, 
    get_optional_user,
    AuthenticatedUser,
    SignUpRequest, 
    SignInRequest, 
    ResetPasswordRequest
)
from services.student_service import (
    student_service,
    CreateStudentRequest,
    UpdateStudentRequest
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("🚀 TutorPilot backend starting...")
    print(f"📊 Weave tracing enabled: {os.getenv('WEAVE_PROJECT_NAME')}")
    print(f"🔐 Auth enabled: Supabase")
    
    yield
    
    # Shutdown
    print("👋 TutorPilot backend shutting down...")


app = FastAPI(
    title="TutorPilot API",
    description="Self-Improving AI Tutoring Platform for WaveHacks 2",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", "http://localhost:3000")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount tutor AI tools router (sessions, versions, insights, recap, alignment, etc.)
from routers.tutor_tools import router as tutor_tools_router, snapshot_version
app.include_router(tutor_tools_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "TutorPilot API - WaveHacks 2",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "weave_enabled": bool(os.getenv("WEAVE_PROJECT_NAME"))
    }


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/v1/auth/signup")
async def signup(request: SignUpRequest):
    """Register a new user (tutor)"""
    return await auth_service.sign_up(request)


@app.post("/api/v1/auth/signin")
async def signin(request: SignInRequest):
    """Sign in an existing user"""
    return await auth_service.sign_in(request)


@app.post("/api/v1/auth/signout")
async def signout(user: AuthenticatedUser = Depends(get_current_user)):
    """Sign out the current user"""
    return await auth_service.sign_out("")


@app.post("/api/v1/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Request password reset email"""
    return await auth_service.reset_password(request)


@app.post("/api/v1/auth/refresh")
async def refresh_session(refresh_token: str):
    """Refresh access token"""
    return await auth_service.refresh_session(refresh_token)


@app.get("/api/v1/auth/me")
async def get_current_user_profile(user: AuthenticatedUser = Depends(get_current_user)):
    """Get current user profile"""
    return await auth_service.get_user_profile(user)


# ==========================================
# STUDENT MANAGEMENT ENDPOINTS (Protected)
# ==========================================

@app.post("/api/v1/students")
async def create_student(
    request: CreateStudentRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new student for the authenticated tutor"""
    tutor_id = user.tutor_id or user.id
    return await student_service.create_student(tutor_id, request)


@app.get("/api/v1/students")
async def get_my_students(user: AuthenticatedUser = Depends(get_current_user)):
    """Get all students for the authenticated tutor"""
    tutor_id = user.tutor_id or user.id
    return await student_service.get_students(tutor_id)


@app.get("/api/v1/students/{student_id}")
async def get_student_detail(
    student_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific student (ownership check)"""
    tutor_id = user.tutor_id or user.id
    return await student_service.get_student(student_id, tutor_id)


@app.put("/api/v1/students/{student_id}")
async def update_student(
    student_id: str,
    request: UpdateStudentRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update a student"""
    tutor_id = user.tutor_id or user.id
    return await student_service.update_student(student_id, tutor_id, request)


@app.delete("/api/v1/students/{student_id}")
async def delete_student(
    student_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Delete a student"""
    tutor_id = user.tutor_id or user.id
    return await student_service.delete_student(student_id, tutor_id)


@app.get("/api/v1/students/stats/overview")
async def get_students_stats(user: AuthenticatedUser = Depends(get_current_user)):
    """Get statistics for all students"""
    tutor_id = user.tutor_id or user.id
    return await student_service.get_student_stats(tutor_id)


# ==========================================
# DATA API ENDPOINTS (for dropdowns - public for now)
# ==========================================

# ==========================================
# SELF-IMPROVEMENT / REFLECTION ENDPOINTS
# ==========================================

@app.post("/api/v1/reflection/analyze")
async def trigger_reflection_analysis(agent_type: str = None):
    """
    Trigger reflection analysis to generate learning insights
    This is the self-improvement loop!
    
    Args:
        agent_type: Optional - specific agent to analyze, or None for all
    """
    try:
        from agents.reflection_service import reflection_service
        
        if agent_type:
            insights = await reflection_service.generate_learning_insights(
                agent_type=agent_type,
                lookback_days=7
            )
            return {
                "success": True,
                "agent_type": agent_type,
                "insights_generated": len(insights),
                "insights": insights
            }
        else:
            # Analyze all agents (use canonical agent_type names used in performance metrics)
            all_insights = {}
            for agent in ['strategy_planner', 'lesson_creator', 'activity_creator',
                          'session_assessor', 'feedback_generator']:
                insights = await reflection_service.generate_learning_insights(
                    agent_type=agent,
                    lookback_days=7
                )
                all_insights[agent] = insights
            
            return {
                "success": True,
                "insights_by_agent": {
                    agent: len(insights)
                    for agent, insights in all_insights.items()
                },
                "total_insights": sum(len(i) for i in all_insights.values()),
                "details": all_insights
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/reflection/insights/{agent_type}")
async def get_learning_insights(agent_type: str):
    """
    Get learning insights for a specific agent
    Shows what the AI has learned from past generations
    """
    try:
        from agents.reflection_service import reflection_service
        
        insights = await reflection_service.get_relevant_insights(
            agent_type=agent_type,
            max_insights=10
        )
        
        return {
            "success": True,
            "agent_type": agent_type,
            "insights": insights or []
        }
    except Exception as e:
        # Return empty insights on error instead of 500
        print(f"Error getting insights for {agent_type}: {str(e)}")
        return {
            "success": True,
            "agent_type": agent_type,
            "insights": []
        }


# ==========================================
# ANALYTICS ENDPOINTS (public for now)
# ==========================================

@app.get("/api/v1/analytics/agent-metrics")
async def analytics_agent_metrics(days: int = 30):
    """
    Aggregate agent performance metrics for the last N days.
    Returns per-agent totals, average overall score, and a simple improvement trend.
    """
    try:
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        rows = supabase.table('agent_performance_metrics')\
            .select('agent_type, evaluation_details, created_at')\
            .gte('created_at', cutoff_date)\
            .order('created_at', desc=False)\
            .execute()

        data = rows.data if rows.data else []
        by_agent = defaultdict(list)
        for r in data:
            by_agent[r.get('agent_type', 'unknown')].append(r)

        metrics = []
        for agent_type, items in by_agent.items():
            scores: List[float] = []
            for it in items:
                eval_details = it.get('evaluation_details') or {}
                score = eval_details.get('overall_score')
                if isinstance(score, (int, float)):
                    scores.append(float(score))

            total = len(items)
            avg_score = (sum(scores) / len(scores)) if scores else 0.0

            # Trend = compare last 5 avg vs previous 5 avg (percentage)
            recent = scores[-5:]
            prev = scores[-10:-5]
            recent_avg = sum(recent) / len(recent) if recent else 0.0
            prev_avg = sum(prev) / len(prev) if prev else 0.0
            trend_pct = ((recent_avg - prev_avg) / prev_avg) * 100.0 if prev_avg > 0 else 0.0

            metrics.append({
                "agent_type": agent_type,
                "avg_score": avg_score,
                "total_generations": total,
                "improvement_trend": trend_pct,
            })

        metrics.sort(key=lambda m: m["agent_type"])
        return {"success": True, "days": days, "metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/analytics/agent-scores")
async def analytics_agent_scores(days: int = 30):
    """
    Daily averages of overall score per agent for the last N days.
    """
    try:
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        rows = supabase.table('agent_performance_metrics')\
            .select('agent_type, evaluation_details, created_at')\
            .gte('created_at', cutoff_date)\
            .order('created_at', desc=False)\
            .execute()

        data = rows.data if rows.data else []
        buckets = defaultdict(lambda: defaultdict(list))  # agent -> day -> scores

        for r in data:
            agent_type = r.get('agent_type', 'unknown')
            created_at = r.get('created_at') or ''
            day = created_at[:10] if len(created_at) >= 10 else 'unknown'
            eval_details = r.get('evaluation_details') or {}
            score = eval_details.get('overall_score')
            if isinstance(score, (int, float)):
                buckets[agent_type][day].append(float(score))

        series = {}
        for agent_type, days_map in buckets.items():
            points = []
            for day, scores in sorted(days_map.items(), key=lambda x: x[0]):
                points.append({
                    "date": day,
                    "avg_score": sum(scores) / len(scores) if scores else 0.0,
                    "count": len(scores),
                })
            series[agent_type] = points

        return {"success": True, "days": days, "series": series}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/library")
async def get_content_library(
    tutor_id: Optional[str] = None,
    content_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50
):
    """
    Get unified content library (strategies, lessons, activities) for the tutor.
    Supports filtering by content_type and search query.
    """
    try:
        items = []

        # Fetch strategies
        if not content_type or content_type == 'strategy':
            query = supabase.table('strategies')\
                .select('id, title, content, student_id, tutor_id, created_at')
            if tutor_id:
                query = query.eq('tutor_id', tutor_id)
            strategies = query.order('created_at', desc=True).limit(limit).execute()
            for s in (strategies.data or []):
                if search and search.lower() not in (s.get('title') or '').lower():
                    continue
                items.append({
                    'id': s['id'],
                    'title': s.get('title') or 'Untitled Strategy',
                    'type': 'strategy',
                    'student_id': s.get('student_id'),
                    'created_at': s.get('created_at'),
                    'preview': (s.get('content', {}).get('overview') or '')[:120]
                })

        # Fetch lessons
        if not content_type or content_type == 'lesson':
            query = supabase.table('lessons')\
                .select('id, title, topic, student_id, tutor_id, created_at')
            if tutor_id:
                query = query.eq('tutor_id', tutor_id)
            lessons = query.order('created_at', desc=True).limit(limit).execute()
            for l in (lessons.data or []):
                if search and search.lower() not in (l.get('title') or l.get('topic') or '').lower():
                    continue
                items.append({
                    'id': l['id'],
                    'title': l.get('title') or l.get('topic') or 'Untitled Lesson',
                    'type': 'lesson',
                    'student_id': l.get('student_id'),
                    'created_at': l.get('created_at'),
                    'preview': l.get('topic', '')[:120]
                })

        # Fetch activities
        if not content_type or content_type == 'activity':
            query = supabase.table('activities')\
                .select('id, title, type, student_id, tutor_id, created_at, sandbox_url')
            if tutor_id:
                query = query.eq('tutor_id', tutor_id)
            activities = query.order('created_at', desc=True).limit(limit).execute()
            for a in (activities.data or []):
                if search and search.lower() not in (a.get('title') or '').lower():
                    continue
                items.append({
                    'id': a['id'],
                    'title': a.get('title') or 'Untitled Activity',
                    'type': 'activity',
                    'activity_type': a.get('type'),
                    'student_id': a.get('student_id'),
                    'created_at': a.get('created_at'),
                    'sandbox_url': a.get('sandbox_url'),
                    'preview': f"Type: {a.get('type', 'interactive')}"
                })

        # Sort all items by created_at descending
        items.sort(key=lambda x: x.get('created_at') or '', reverse=True)

        return {
            "success": True,
            "items": items[:limit],
            "total": len(items)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/data/students")
async def get_students():
    """Get all students for dropdown selection"""
    try:
        response = supabase.table('students')\
            .select('id, name, grade, subject, learning_style')\
            .execute()
        return {
            "success": True,
            "students": response.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/data/tutors")
async def get_tutors():
    """Get all tutors for dropdown selection"""
    try:
        response = supabase.table('tutors')\
            .select('id, name, teaching_style, education_system')\
            .execute()
        return {
            "success": True,
            "tutors": response.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/data/strategies/{student_id}")
async def get_student_strategies(student_id: str):
    """Get all strategies for a student"""
    try:
        response = supabase.table('strategies')\
            .select('id, title, content, created_at')\
            .eq('student_id', student_id)\
            .order('created_at', desc=True)\
            .execute()
        return {
            "success": True,
            "strategies": response.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/data/lessons/{student_id}")
async def get_student_lessons(student_id: str):
    """Get all lessons for a student"""
    try:
        response = supabase.table('lessons')\
            .select('id, title, content, strategy_id, strategy_week_number, created_at')\
            .eq('student_id', student_id)\
            .order('created_at', desc=True)\
            .execute()
        return {
            "success": True,
            "lessons": response.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/data/activities/{student_id}")
async def get_student_activities(student_id: str):
    """Get all activities for a student (for gallery view)"""
    try:
        response = supabase.table('activities')\
            .select('id, title, type, duration, sandbox_url, sandbox_id, deployment_status, created_at, lesson_id, self_evaluation')\
            .eq('student_id', student_id)\
            .order('created_at', desc=True)\
            .execute()
        return {
            "success": True,
            "activities": response.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Import agents
from agents.strategy_planner import generate_strategy
from agents.lesson_creator import generate_lesson
from agents.activity_creator import generate_activity
from pydantic import BaseModel
from db.supabase_client import supabase

# Request models
class StrategyRequest(BaseModel):
    student_id: str
    tutor_id: str
    subject: str
    weeks: int = 4

class LessonRequest(BaseModel):
    student_id: str
    tutor_id: str
    topic: Optional[str] = None  # Optional if from strategy
    duration: int = 60
    strategy_id: Optional[str] = None  # If creating from strategy week
    strategy_week_number: Optional[int] = None  # Which week (1-4)

class ActivityRequest(BaseModel):
    student_id: str
    tutor_id: str
    topic: Optional[str] = None  # Optional if from lesson
    activity_description: Optional[str] = None  # Optional if from lesson
    duration: int = 20
    lesson_id: Optional[str] = None  # If creating from lesson phase
    lesson_phase: Optional[str] = None  # Which phase (Engage, Explore, etc.)
    max_attempts: int = 3

# Collaborative Editing Models
class ContentVersionRequest(BaseModel):
    content_type: str  # 'strategy' or 'lesson'
    content_id: str
    content: Dict[str, Any]  # The edited content
    changes_summary: Optional[str] = None  # What changed
    edit_notes: Optional[str] = None  # WHY tutor edited (feeds learning insights)
    tutor_id: str

class ActivityChatRequest(BaseModel):
    activity_id: str
    tutor_id: str
    message: str  # Tutor's request for changes
    student_id: str

# Strategy endpoint
@app.post("/api/v1/agents/strategy")
async def create_strategy(request: StrategyRequest):
    """Generate a personalized learning strategy"""
    try:
        result = await generate_strategy(
            student_id=request.student_id,
            tutor_id=request.tutor_id,
            subject=request.subject,
            weeks=request.weeks
        )
        return {
            "success": True,
            "strategy_id": result['strategy_id'],
            "content": result['content'],
            "evaluation": result['evaluation'],
            "sources": result.get('sources', []),
            "student": result['student'],
            "tutor": result['tutor']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Lesson endpoint
@app.post("/api/v1/agents/lesson")
async def create_lesson(request: LessonRequest):
    """Generate a 5E lesson plan"""
    try:
        result = await generate_lesson(
            student_id=request.student_id,
            tutor_id=request.tutor_id,
            topic=request.topic,
            duration=request.duration,
            strategy_id=request.strategy_id,
            strategy_week_number=request.strategy_week_number  # NEW
        )
        return {
            "success": True,
            "lesson_id": result['lesson_id'],
            "content": result['content'],
            "evaluation": result['evaluation'],
            "student": result['student'],
            "tutor": result['tutor']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Activity endpoint (with auto-fix!)
@app.post("/api/v1/agents/activity")
async def create_activity(request: ActivityRequest):
    """Generate an interactive React activity with auto-debugging"""
    try:
        result = await generate_activity(
            student_id=request.student_id,
            tutor_id=request.tutor_id,
            topic=request.topic,
            activity_description=request.activity_description,
            duration=request.duration,
            lesson_id=request.lesson_id,
            lesson_phase=request.lesson_phase,  # NEW
            max_attempts=request.max_attempts
        )
        return {
            "success": True,
            "activity_id": result['activity_id'],
            "content": result['content'],
            "evaluation": result['evaluation'],
            "deployment": result['deployment'],
            "student": result['student'],
            "tutor": result['tutor'],
            "sandbox_url": result['deployment'].get('url')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Activity redeployment endpoint (retry only Daytona deployment, don't regenerate code)
@app.post("/api/v1/agents/activity/redeploy")
async def redeploy_activity(request: dict):
    """
    Redeploy an existing activity's code to a new Daytona sandbox.
    This ONLY retries deployment, without regenerating code with AI.
    """
    try:
        from services.daytona_service import daytona_service
        
        activity_id = request.get('activity_id')
        student_id = request.get('student_id')
        
        if not activity_id or not student_id:
            raise HTTPException(status_code=400, detail="activity_id and student_id required")
        
        # Fetch existing activity code from database
        activity_result = supabase.table('activities')\
            .select('content')\
            .eq('id', activity_id)\
            .single()\
            .execute()
        
        if not activity_result.data:
            raise HTTPException(status_code=404, detail="Activity not found")
        
        code = activity_result.data['content'].get('code')
        if not code:
            raise HTTPException(status_code=400, detail="No code found in activity")
        
        # Redeploy to Daytona (direct call, no auto-fix)
        print(f"♻️ Redeploying activity {activity_id} to Daytona...")
        deployment = await daytona_service.create_and_deploy_react_app(
            code=code,
            student_id=student_id,
            auto_stop_interval=120
        )
        
        # Update activity record with new sandbox URL
        sandbox_url = deployment.get('url')
        supabase.table('activities')\
            .update({'sandbox_url': sandbox_url})\
            .eq('id', activity_id)\
            .execute()
        
        return {
            "success": True,
            "activity_id": activity_id,
            "deployment": {
                "sandbox_id": deployment.get('sandbox_id'),
                "url": sandbox_url,
                "status": deployment.get('status', 'running'),
                "exit_code": deployment.get('exit_code', 0)
            },
            "sandbox_url": sandbox_url
        }
        
    except Exception as e:
        print(f"❌ Redeployment error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/agents/activity/cleanup")
async def cleanup_old_sandbox(request: dict):
    """
    Delete old Daytona sandbox to free resources.
    Called when creating a new sandbox for an activity that already has one.
    """
    try:
        from services.daytona_service import daytona_service
        
        old_sandbox_id = request.get('old_sandbox_id')
        session_id = request.get('session_id')
        
        if not old_sandbox_id:
            return {"success": False, "message": "No old_sandbox_id provided"}
        
        print(f"🧹 Cleaning up old sandbox: {old_sandbox_id}")
        success = await daytona_service.delete_sandbox(old_sandbox_id, session_id)
        
        if success:
            return {
                "success": True,
                "message": f"Sandbox {old_sandbox_id} cleaned up successfully"
            }
        else:
            return {
                "success": False,
                "message": "Sandbox cleanup failed (may already be deleted)"
            }
        
    except Exception as e:
        print(f"⚠️ Cleanup error: {str(e)}")
        return {"success": False, "error": str(e)}


# ==========================================
# COLLABORATIVE EDITING ENDPOINTS
# ==========================================

@app.post("/api/v1/content/save-version")
async def save_content_version(request: ContentVersionRequest):
    """
    Save a new version of edited strategy or lesson content.
    Supports Google Doc-like collaborative editing with version history.
    
    This feeds into learning insights - we analyze WHY tutors edit content
    to improve future AI generations.
    """
    try:
        # Get current version number
        version_query = supabase.table('content_versions')\
            .select('version_number')\
            .eq('content_type', request.content_type)\
            .eq('content_id', request.content_id)\
            .order('version_number', desc=True)\
            .limit(1)\
            .execute()
        
        current_version = version_query.data[0]['version_number'] if version_query.data else 0
        new_version = current_version + 1
        
        # Save new version
        version_record = {
            'content_type': request.content_type,
            'content_id': request.content_id,
            'version_number': new_version,
            'content': request.content,
            'changes_summary': request.changes_summary,
            'edited_by': request.tutor_id,
            'edit_type': 'manual_edit',
            'edit_notes': request.edit_notes,  # WHY they edited (important for learning!)
        }
        
        result = supabase.table('content_versions').insert(version_record).execute()
        
        # Update main content table to mark latest version
        table_name = 'strategies' if request.content_type == 'strategy' else 'lessons'
        supabase.table(table_name)\
            .update({'current_version': new_version, 'content': request.content})\
            .eq('id', request.content_id)\
            .execute()
        
        return {
            "success": True,
            "version_number": new_version,
            "message": f"Version {new_version} saved successfully",
            "edit_notes": request.edit_notes
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/content/versions/{content_type}/{content_id}")
async def get_content_versions(content_type: str, content_id: str):
    """
    Get version history for a strategy or lesson.
    Returns all versions with edit notes for tracking tutor modifications.
    """
    try:
        versions = supabase.table('content_versions')\
            .select('*')\
            .eq('content_type', content_type)\
            .eq('content_id', content_id)\
            .order('version_number', desc=True)\
            .execute()
        
        return {
            "success": True,
            "versions": versions.data,
            "total_versions": len(versions.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/activity/chat")
async def activity_chat(request: ActivityChatRequest):
    """
    Chat-based conversational editing for activities.
    Tutors can request modifications, and the agent iterates on the code.
    
    This is different from version history - it's a conversational interface
    for tweaking activities through natural language.
    """
    try:
        # Save tutor message
        tutor_message = {
            'activity_id': request.activity_id,
            'tutor_id': request.tutor_id,
            'message_type': 'tutor_request',
            'message_content': request.message
        }
        
        supabase.table('activity_chat_history').insert(tutor_message).execute()
        
        # Get current activity
        activity_result = supabase.table('activities')\
            .select('*')\
            .eq('id', request.activity_id)\
            .execute()
        
        if not activity_result.data:
            raise HTTPException(status_code=404, detail="Activity not found")
        
        current_activity = activity_result.data[0]
        current_code = current_activity['content'].get('code', '')
        
        # Generate modified activity based on chat
        # Import here to avoid circular dependency
        from agents.activity_creator import iterate_activity_from_chat
        
        result = await iterate_activity_from_chat(
            activity_id=request.activity_id,
            student_id=request.student_id,
            current_code=current_code,
            tutor_message=request.message,
            topic=current_activity.get('topic', '')
        )
        
        # Save agent response
        agent_message = {
            'activity_id': request.activity_id,
            'tutor_id': request.tutor_id,
            'message_type': 'agent_response',
            'message_content': result.get('explanation', 'Activity updated'),
            'code_snapshot': result.get('new_code'),
            'sandbox_url': result.get('sandbox_url')
        }
        
        supabase.table('activity_chat_history').insert(agent_message).execute()
        
        # Update activity
        supabase.table('activities')\
            .update({
                'content': {
                    **current_activity['content'],
                    'code': result.get('new_code'),
                    'iteration_count': current_activity['content'].get('iteration_count', 0) + 1
                }
            })\
            .eq('id', request.activity_id)\
            .execute()
        
        return {
            "success": True,
            "new_code": result.get('new_code'),
            "explanation": result.get('explanation'),
            "sandbox_url": result.get('sandbox_url'),
            "changes_made": result.get('changes')
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/activity/chat/stream")
async def activity_chat_stream(request: ActivityChatRequest):
    """
    Streaming variant of /activity/chat that emits SSE-style events for stage progress.

    Event payloads (one JSON object per line, prefixed with `data: `):
      {"type": "stage", "stage": "thinking|editing|debugging|deploying"}
      {"type": "explanation", "text": "..."}
      {"type": "ready", "sandbox_url": "...", "new_code": "...", "explanation": "..."}
      {"type": "error", "message": "..."}

    The underlying Gemini call is non-streaming (single generate_content call), so
    this endpoint streams stage events while the existing pipeline runs in the
    background, giving the UI a live "vibe-coding" feel without changing the model
    integration.
    """
    async def event_stream():
        def sse(payload: dict) -> str:
            return f"data: {json.dumps(payload)}\n\n"

        try:
            yield sse({"type": "stage", "stage": "thinking"})

            # Save tutor message
            tutor_message = {
                'activity_id': request.activity_id,
                'tutor_id': request.tutor_id,
                'message_type': 'tutor_request',
                'message_content': request.message
            }
            supabase.table('activity_chat_history').insert(tutor_message).execute()

            # Get current activity
            activity_result = supabase.table('activities')\
                .select('*')\
                .eq('id', request.activity_id)\
                .execute()

            if not activity_result.data:
                yield sse({"type": "error", "message": "Activity not found"})
                return

            current_activity = activity_result.data[0]
            current_code = current_activity['content'].get('code', '')

            yield sse({"type": "stage", "stage": "editing"})

            # Run the iteration (Gemini regenerate + redeploy)
            # We can't easily stream tokens through the existing helper, so
            # we run the stages sequentially and emit stage events around each.
            from agents.activity_creator import iterate_activity_from_chat

            # We can't interleave events inside iterate_activity_from_chat without
            # refactoring it, so we emit "deploying" right before awaiting the
            # call (the Daytona deploy is the long pole inside the function).
            iter_task = asyncio.create_task(iterate_activity_from_chat(
                activity_id=request.activity_id,
                student_id=request.student_id,
                current_code=current_code,
                tutor_message=request.message,
                topic=current_activity.get('topic', '')
            ))

            # Heartbeat stage progression: emit `debugging` then `deploying`
            # while waiting. We shield the task inside `wait_for` so the timeout
            # only advances the stage UI without cancelling the iteration.
            # If the client disconnects, the generator receives CancelledError
            # and we cancel iter_task in the finally so the model call and DB
            # writes are abandoned instead of completing silently.
            try:
                stage_timeline = [
                    (8, "debugging"),
                    (18, "deploying"),
                ]
                elapsed = 0
                for delay, next_stage in stage_timeline:
                    try:
                        await asyncio.wait_for(
                            asyncio.shield(iter_task), timeout=delay - elapsed
                        )
                        break  # task finished early
                    except asyncio.TimeoutError:
                        elapsed = delay
                        yield sse({"type": "stage", "stage": next_stage})

                # Final wait — no shield, so cancellation here will cancel
                # iter_task too (handled in the finally for cleanliness).
                result = await iter_task
            finally:
                if not iter_task.done():
                    iter_task.cancel()

            new_code = result.get('new_code')
            sandbox_url = result.get('sandbox_url')
            explanation = result.get('explanation', 'Activity updated')

            # Save agent response
            agent_message = {
                'activity_id': request.activity_id,
                'tutor_id': request.tutor_id,
                'message_type': 'agent_response',
                'message_content': explanation,
                'code_snapshot': new_code,
                'sandbox_url': sandbox_url
            }
            supabase.table('activity_chat_history').insert(agent_message).execute()

            # Update activity
            supabase.table('activities')\
                .update({
                    'content': {
                        **current_activity['content'],
                        'code': new_code,
                        'iteration_count': current_activity['content'].get('iteration_count', 0) + 1
                    }
                })\
                .eq('id', request.activity_id)\
                .execute()

            # Snapshot a new version (Tier 3.4)
            try:
                await snapshot_version(
                    activity_id=request.activity_id,
                    code=new_code,
                    sandbox_url=sandbox_url,
                    tutor_id=request.tutor_id,
                )
            except Exception as ver_e:
                print(f"⚠️ Failed to snapshot version: {ver_e}")

            yield sse({
                "type": "ready",
                "sandbox_url": sandbox_url,
                "new_code": new_code,
                "explanation": explanation,
            })

        except Exception as e:
            yield sse({"type": "error", "message": str(e)[:300]})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/v1/activity/chat/{activity_id}")
async def get_activity_chat_history(activity_id: str):
    """Get chat history for an activity"""
    try:
        chat_history = supabase.table('activity_chat_history')\
            .select('*')\
            .eq('activity_id', activity_id)\
            .order('created_at', desc=False)\
            .execute()
        
        return {
            "success": True,
            "chat_history": chat_history.data,
            "total_messages": len(chat_history.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# SESSION CAPTURE + ASSESSMENT + PARENT FEEDBACK ENDPOINTS
# ==========================================

from agents.session_assessor import assess_session as run_session_assessor
from agents.feedback_generator import generate_feedback_report as run_feedback_generator
from services.transcription_service import SUPABASE_STORAGE_BUCKET

SESSION_MEDIA_ALLOWED_MIMES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/mp4", "audio/m4a", "audio/x-m4a",
    "audio/webm", "audio/ogg", "audio/flac",
    "video/mp4", "video/webm", "video/quicktime",
}


class FeedbackGenerateRequest(BaseModel):
    student_id: str
    tutor_id: str
    mode: str  # "per_session" | "weekly_digest"
    session_ids: List[str]
    period_start: Optional[str] = None
    period_end: Optional[str] = None


class FeedbackReportPatch(BaseModel):
    markdown: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None  # "draft" | "tutor_edited" | "shared"


class MemoryProposalDecision(BaseModel):
    decision: str  # "approved" | "rejected"
    reviewed_by: Optional[str] = None


@app.post("/api/v1/sessions/upload")
async def upload_session_recording(
    student_id: str = Form(...),
    tutor_id: str = Form(...),
    lesson_id: Optional[str] = Form(None),
    occurred_at: Optional[str] = Form(None),
    file: UploadFile = File(...),
):
    """Upload an audio/video recording of a tutoring session.

    Stores the file in the Supabase 'session-media' bucket and creates a
    lesson_sessions row with status='pending'. Returns the session_id; call
    POST /api/v1/sessions/{id}/assess to start transcription + assessment.
    """
    try:
        if file.content_type and file.content_type not in SESSION_MEDIA_ALLOWED_MIMES:
            raise HTTPException(status_code=400, detail=f"Unsupported media type: {file.content_type}")

        body = await file.read()
        if not body:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        from uuid import uuid4 as _uuid4
        session_id = str(_uuid4())
        ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
        storage_path = f"{tutor_id}/{student_id}/{session_id}.{ext}"

        # Upload to Supabase Storage (sync API → run in thread)
        await asyncio.to_thread(
            lambda: supabase.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
                storage_path,
                body,
                {"content-type": file.content_type or "application/octet-stream"},
            )
        )

        row = {
            "id": session_id,
            "student_id": student_id,
            "tutor_id": tutor_id,
            "lesson_id": lesson_id,
            "source": "manual_upload",
            "media_url": storage_path,
            "status": "pending",
            "occurred_at": occurred_at,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        supabase.table("lesson_sessions").insert(row).execute()

        return {"success": True, "session_id": session_id, "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/sessions/{session_id}/assess")
async def trigger_session_assessment(
    session_id: str,
    background_tasks: BackgroundTasks,
    force: bool = False,
):
    """Kick off transcription + assessment for a session in the background.

    Returns immediately; the frontend should poll GET /sessions/{id} for status.
    Passing ?force=true will re-assess a session that has already been assessed
    (replacing the previous assessment row).
    """
    try:
        # Confirm the session exists and isn't already being processed
        existing = supabase.table("lesson_sessions") \
            .select("id, status") \
            .eq("id", session_id) \
            .limit(1) \
            .execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Session not found")
        status = existing.data[0]["status"]
        if status in ("transcribing", "assessing"):
            return {"success": True, "session_id": session_id, "status": status, "message": "Already in progress"}
        if status == "assessed" and not force:
            return {
                "success": True,
                "session_id": session_id,
                "status": status,
                "message": "Session already assessed; pass force=true to re-assess.",
            }

        async def _run():
            try:
                await run_session_assessor(session_id)
            except Exception as e:
                print(f"❌ Session assessment failed for {session_id}: {e}")

        background_tasks.add_task(_run)
        return {"success": True, "session_id": session_id, "status": "queued"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/sessions/{session_id}")
async def get_session_detail(session_id: str):
    """Return session row + transcript + assessment (whatever exists so far)."""
    try:
        sess = supabase.table("lesson_sessions").select("*").eq("id", session_id).limit(1).execute()
        if not sess.data:
            raise HTTPException(status_code=404, detail="Session not found")

        transcript = supabase.table("session_transcripts").select("*").eq("session_id", session_id).limit(1).execute()
        assessment = supabase.table("session_assessments").select("*").eq("session_id", session_id).order("created_at", desc=True).limit(1).execute()

        return {
            "success": True,
            "session": sess.data[0],
            "transcript": transcript.data[0] if transcript.data else None,
            "assessment": assessment.data[0] if assessment.data else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/students/{student_id}/sessions")
async def list_student_sessions(student_id: str):
    """All sessions for a student, newest first, with light assessment summary."""
    try:
        sessions = supabase.table("lesson_sessions") \
            .select("id, lesson_id, status, occurred_at, created_at, media_duration_seconds") \
            .eq("student_id", student_id) \
            .order("created_at", desc=True) \
            .execute()
        rows = sessions.data or []
        if not rows:
            return {"success": True, "sessions": []}

        ids = [r["id"] for r in rows]
        assessments = supabase.table("session_assessments") \
            .select("session_id, overall_engagement_score, recommendations") \
            .in_("session_id", ids) \
            .execute()
        a_by_session = {a["session_id"]: a for a in (assessments.data or [])}

        for r in rows:
            r["assessment"] = a_by_session.get(r["id"])
        return {"success": True, "sessions": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/agents/feedback-generator")
async def create_feedback_report(request: FeedbackGenerateRequest):
    """Draft a parent-facing report (per_session or weekly_digest)."""
    try:
        if request.mode not in ("per_session", "weekly_digest"):
            raise HTTPException(status_code=400, detail="mode must be 'per_session' or 'weekly_digest'")
        result = await run_feedback_generator(
            student_id=request.student_id,
            tutor_id=request.tutor_id,
            mode=request.mode,
            session_ids=request.session_ids,
            period_start=request.period_start,
            period_end=request.period_end,
        )
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/students/{student_id}/feedback-reports")
async def list_feedback_reports(student_id: str):
    """List parent reports for a student, newest first."""
    try:
        res = supabase.table("parent_feedback_reports") \
            .select("*") \
            .eq("student_id", student_id) \
            .order("created_at", desc=True) \
            .execute()
        return {"success": True, "reports": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/v1/feedback-reports/{report_id}")
async def edit_feedback_report(report_id: str, patch: FeedbackReportPatch):
    """Tutor edits to a draft. Captures the diff in tutor_edits for the reflection loop."""
    try:
        existing = supabase.table("parent_feedback_reports").select("*").eq("id", report_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Report not found")
        report = existing.data[0]
        content = dict(report.get("content") or {})
        original_md = content.get("markdown")

        if patch.markdown is not None:
            content["markdown"] = patch.markdown
        if patch.title is not None:
            content["title"] = patch.title

        new_status = patch.status or ("tutor_edited" if patch.markdown is not None else report.get("status"))

        tutor_edits = report.get("tutor_edits") or {}
        if patch.markdown is not None and patch.markdown != original_md:
            tutor_edits = {
                "original_markdown": original_md,
                "edited_markdown": patch.markdown,
                "edited_at": datetime.now().isoformat(),
            }

        supabase.table("parent_feedback_reports").update({
            "content": content,
            "status": new_status,
            "tutor_edits": tutor_edits,
            "updated_at": datetime.now().isoformat(),
        }).eq("id", report_id).execute()

        return {"success": True, "report_id": report_id, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/students/{student_id}/memory-proposals")
async def list_memory_proposals(student_id: str, status: str = "pending"):
    """List staged memory proposals for a student awaiting tutor approval."""
    try:
        res = supabase.table("memory_proposals") \
            .select("*") \
            .eq("entity_type", "student") \
            .eq("entity_id", student_id) \
            .eq("status", status) \
            .order("created_at", desc=True) \
            .execute()
        return {"success": True, "proposals": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/memory-proposals/{proposal_id}/decision")
async def decide_memory_proposal(proposal_id: str, request: MemoryProposalDecision):
    """Approve or reject a staged memory proposal. Approval writes it into platform_memory."""
    try:
        if request.decision not in ("approved", "rejected"):
            raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'")

        existing = supabase.table("memory_proposals").select("*").eq("id", proposal_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Proposal not found")
        prop = existing.data[0]

        if prop.get("status") != "pending":
            return {
                "success": True,
                "proposal_id": proposal_id,
                "decision": prop["status"],
                "message": "Proposal already reviewed; no change applied.",
            }

        if request.decision == "approved":
            from services.memory_service import write_finding
            await write_finding(
                entity_type=prop["entity_type"],
                entity_id=prop["entity_id"],
                memory_category=prop["memory_category"],
                memory_key=prop["memory_key"],
                memory_value=prop["memory_value"],
                confidence_score=float(prop.get("confidence_score") or 0.5),
            )

        supabase.table("memory_proposals").update({
            "status": request.decision,
            "reviewed_by": request.reviewed_by,
            "reviewed_at": datetime.now().isoformat(),
        }).eq("id", proposal_id).eq("status", "pending").execute()

        return {"success": True, "proposal_id": proposal_id, "decision": request.decision}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )

