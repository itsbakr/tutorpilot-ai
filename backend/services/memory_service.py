"""
Memory Service
Handles platform memory, learning insights, and performance metrics
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID
from db.supabase_client import supabase


async def load_student_memories(student_id: str, limit: int = 10) -> List[Dict]:
    """Load student-specific memories for personalization"""
    try:
        response = supabase.table('platform_memory') \
            .select('*') \
            .eq('entity_type', 'student') \
            .eq('entity_id', student_id) \
            .gte('confidence_score', 0.3) \
            .order('confidence_score', desc=True) \
            .limit(limit) \
            .execute()
        
        return response.data if response.data else []
    except Exception as e:
        print(f"Error loading student memories: {str(e)}")
        return []


async def load_learning_insights(
    grade: str,
    subject: Optional[str] = None,
    limit: int = 5
) -> List[Dict]:
    """Load validated learning insights for adaptive prompting"""
    try:
        response = supabase.table('learning_insights') \
            .select('*') \
            .eq('status', 'validated') \
            .order('created_at', desc=True) \
            .limit(20) \
            .execute()
        
        # Filter client-side for applicability
        insights = response.data if response.data else []
        filtered = []
        
        for insight in insights:
            applicability = insight.get('applicability', {})
            grade_levels = applicability.get('grade_levels', [])
            subjects = applicability.get('subjects', [])
            
            # Check if applicable to this grade/subject
            if not grade_levels or grade in grade_levels:
                if not subject or not subjects or subject in subjects:
                    filtered.append(insight)
        
        return filtered[:limit]
    except Exception as e:
        print(f"Error loading learning insights: {str(e)}")
        return []


async def store_performance_metric(
    agent_type: str,
    evaluation: Dict[str, Any],
    session_id: Optional[str] = None
) -> None:
    """
    Store agent performance metric for self-improvement tracking
    
    Args:
        agent_type: 'strategy_planner', 'lesson_creator', 'activity_creator'
        evaluation: Evaluation dict with overall_score and criteria
        session_id: Optional session identifier
    """
    try:
        # Extract confidence scores from criteria
        confidence_scores = []
        if 'criteria' in evaluation:
            confidence_scores = [
                criterion['score']
                for criterion in evaluation['criteria'].values()
            ]
        
        overall_score = evaluation.get('overall_score', 5.0)
        
        metric = {
            'agent_type': agent_type,
            'agent_id': f"{agent_type}_{datetime.now().isoformat()}",
            'session_id': session_id,
            'success_rate': overall_score / 10.0,  # Normalize to 0-1
            'confidence_scores': confidence_scores,
            'error_count': 0 if overall_score >= 7.0 else 1,
            'last_error': None if overall_score >= 7.0 else str(evaluation.get('weaknesses', [])),
            'evaluation_details': evaluation,
            'created_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat()
        }
        
        supabase.table('agent_performance_metrics').insert(metric).execute()
        print(f"✅ Stored performance metric for {agent_type}: {overall_score}/10")
        
    except Exception as e:
        print(f"Error storing performance metric: {str(e)}")


async def store_learning_insight(
    insight_type: str,
    description: str,
    supporting_evidence: List[Dict],
    applicability: Dict[str, Any],
    priority: str = "medium"
) -> None:
    """
    Store a new learning insight discovered by reflection loop
    
    Args:
        insight_type: 'pattern_recognition', 'effectiveness_correlation', etc.
        description: Human-readable description
        supporting_evidence: List of evidence dicts
        applicability: Dict with grade_levels, subjects, etc.
        priority: 'low', 'medium', 'high', 'critical'
    """
    try:
        insight = {
            'insight_type': insight_type,
            'description': description,
            'supporting_evidence': supporting_evidence,
            'applicability': applicability,
            'validation_required': False,  # Auto-validate for hackathon
            'priority': priority,
            'status': 'validated',
            'created_at': datetime.now().isoformat(),
            'validated_at': datetime.now().isoformat()
        }
        
        supabase.table('learning_insights').insert(insight).execute()
        print(f"✅ Stored learning insight: {description[:50]}...")
        
    except Exception as e:
        print(f"Error storing learning insight: {str(e)}")


async def write_finding(
    entity_type: str,
    entity_id: str,
    memory_category: str,
    memory_key: str,
    memory_value: Dict[str, Any],
    confidence_score: float,
) -> None:
    """Write a high-confidence finding directly into platform_memory.

    If a memory with the same entity + category + key already exists, append to it
    by incrementing update_count and replacing memory_value. Otherwise insert new.
    """
    try:
        existing = supabase.table('platform_memory') \
            .select('id, update_count') \
            .eq('entity_type', entity_type) \
            .eq('entity_id', entity_id) \
            .eq('memory_category', memory_category) \
            .eq('memory_key', memory_key) \
            .limit(1) \
            .execute()

        now = datetime.now().isoformat()

        if existing.data:
            row = existing.data[0]
            supabase.table('platform_memory').update({
                'memory_value': memory_value,
                'confidence_score': confidence_score,
                'last_updated': now,
                'update_count': (row.get('update_count') or 1) + 1,
            }).eq('id', row['id']).execute()
        else:
            supabase.table('platform_memory').insert({
                'entity_type': entity_type,
                'entity_id': entity_id,
                'memory_category': memory_category,
                'memory_key': memory_key,
                'memory_value': memory_value,
                'confidence_score': confidence_score,
                'created_at': now,
                'last_updated': now,
                'update_count': 1,
            }).execute()
    except Exception as e:
        print(f"Error writing platform memory finding: {str(e)}")


async def stage_memory_proposal(
    source_session_id: Optional[str],
    entity_type: str,
    entity_id: str,
    memory_category: str,
    memory_key: str,
    memory_value: Dict[str, Any],
    confidence_score: float,
) -> None:
    """Stage a lower-confidence finding as a proposal awaiting tutor approval."""
    try:
        supabase.table('memory_proposals').insert({
            'source_session_id': source_session_id,
            'entity_type': entity_type,
            'entity_id': entity_id,
            'memory_category': memory_category,
            'memory_key': memory_key,
            'memory_value': memory_value,
            'confidence_score': confidence_score,
            'status': 'pending',
            'created_at': datetime.now().isoformat(),
        }).execute()
    except Exception as e:
        print(f"Error staging memory proposal: {str(e)}")


def format_insights_for_prompt(insights: List[Dict]) -> str:
    """
    Format learning insights for inclusion in generation prompts
    
    Args:
        insights: List of insight dicts
        
    Returns:
        Formatted string for prompt
    """
    if not insights:
        return "No previous learnings available."
    
    result = []
    for insight in insights[:5]:  # Top 5 most relevant
        result.append(f"""
📊 **{insight['insight_type'].replace('_', ' ').title()}**
   Description: {insight['description']}
   Applicability: {insight.get('applicability', {})}
   Evidence Count: {len(insight.get('supporting_evidence', []))}
""")
    
    return "\n".join(result)


def format_sources(sources: List[Dict]) -> str:
    """
    Format research sources for prompts
    
    Args:
        sources: List of source dicts with title, url, etc.
        
    Returns:
        Formatted string
    """
    if not sources:
        return "No sources available."
    
    result = []
    for i, source in enumerate(sources[:6], 1):
        title = source.get('title', 'Unknown')
        url = source.get('url', '#')
        description = source.get('description', 'N/A')
        credibility = source.get('credibility_score', 0.8)
        
        result.append(f"""
{i}. **{title}**
   URL: {url}
   Description: {description}
   Credibility: {credibility:.0%}
""")
    
    return "\n".join(result)

