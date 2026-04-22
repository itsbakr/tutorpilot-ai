"""
Reflection Service - The Self-Improvement Brain
Analyzes patterns in agent performance and tutor feedback to generate learning insights
This is the KEY component for "Best Self-Improving Agent" track
"""

import weave
from typing import List, Dict, Any
from datetime import datetime, timedelta
from db.supabase_client import supabase
from services.ai_service import call_gemini


class ReflectionService:
    """
    Analyzes agent performance and generates learning insights
    This enables the self-improvement loop
    """
    
    @weave.op()
    async def generate_learning_insights(
        self,
        agent_type: str,
        lookback_days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Analyze recent agent performance and generate insights
        
        Args:
            agent_type: 'strategy_planner', 'lesson_creator', or 'activity_creator'
            lookback_days: How many days of data to analyze
            
        Returns:
            List of learning insights
        """
        print(f"\n🧠 Reflection: Analyzing {agent_type} performance...")
        
        # Step 1: Get recent performance metrics
        cutoff_date = (datetime.now() - timedelta(days=lookback_days)).isoformat()
        
        metrics_result = supabase.table('agent_performance_metrics')\
            .select('*')\
            .eq('agent_type', agent_type)\
            .gte('created_at', cutoff_date)\
            .order('created_at', desc=True)\
            .limit(20)\
            .execute()
        
        metrics = metrics_result.data if metrics_result.data else []
        
        if len(metrics) < 3:
            print(f"   ℹ️  Not enough data yet ({len(metrics)} records)")
            return []
        
        # Step 2: Get recent tutor edits (version history)
        content_type = self._agent_to_content_type(agent_type)
        edits_result = supabase.table('content_versions')\
            .select('*, content, edit_notes, changes_summary')\
            .eq('content_type', content_type)\
            .eq('edit_type', 'manual_edit')\
            .gte('created_at', cutoff_date)\
            .order('created_at', desc=True)\
            .limit(10)\
            .execute()
        
        edits = edits_result.data if edits_result.data else []
        
        # Step 3: Analyze patterns with LLM
        insights = await self._analyze_patterns(agent_type, metrics, edits)
        
        # Step 4: Store insights in cross_agent_learning table
        for insight in insights:
            insight_record = {
                'source_agent': agent_type,
                'target_agent': agent_type,  # Can also share with other agents
                'learning_type': insight['type'],
                'insight': insight['insight'],
                'evidence': insight['evidence'],
                'confidence': insight['confidence'],
                'created_at': datetime.now().isoformat()
            }
            
            supabase.table('cross_agent_learning').insert(insight_record).execute()
            print(f"   ✅ Stored insight: {insight['insight'][:60]}...")
        
        print(f"   🎓 Generated {len(insights)} learning insights")
        return insights
    
    @weave.op()
    async def _analyze_patterns(
        self,
        agent_type: str,
        metrics: List[Dict],
        edits: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Use LLM to analyze patterns in metrics and edits"""
        
        # Format metrics for LLM
        metrics_summary = self._format_metrics(metrics)
        edits_summary = self._format_edits(edits)
        
        prompt = f"""You are analyzing an AI agent's performance to identify improvement patterns.

AGENT: {agent_type}

RECENT PERFORMANCE METRICS ({len(metrics)} generations):
{metrics_summary}

TUTOR EDIT PATTERNS ({len(edits)} manual edits):
{edits_summary}

---

ANALYSIS TASK:
Identify 3-5 concrete, actionable patterns that would improve future generations.

Focus on:
1. **What criteria consistently score low?** (Look for weaknesses)
2. **What do tutors frequently edit?** (Look for gaps in AI output)
3. **Why do some generations score higher?** (Look for success patterns)
4. **Cultural/contextual issues** (Student backgrounds, interests)
5. **Structural improvements** (Activity types, lesson formats)

For EACH insight, provide:
- **Type**: "weakness_pattern" | "tutor_preference" | "success_pattern" | "contextual_insight"
- **Insight**: One clear, actionable sentence (e.g., "Activities with simulations score 2 points higher than quizzes")
- **Evidence**: Specific data supporting this (e.g., "5 of 8 high-scoring activities used interactive simulations")
- **Confidence**: 0.0-1.0 (how confident are you in this pattern?)

BE SPECIFIC. Don't say "improve engagement" - say HOW.

Return ONLY valid JSON:
{{
  "insights": [
    {{
      "type": "success_pattern",
      "insight": "Activities incorporating student interests score 1.5 points higher on engagement",
      "evidence": "6 of 7 activities that referenced student interests scored ≥8.5 on engagement vs 5.2 average",
      "confidence": 0.85,
      "action": "Always explicitly connect topic to at least one student interest"
    }},
    {{
      "type": "tutor_preference",
      "insight": "Tutors consistently add cultural context that AI omits",
      "evidence": "8 of 10 edits added culturally-relevant examples or modified Western-centric references",
      "confidence": 0.90,
      "action": "Proactively include culturally-appropriate examples based on student nationality"
    }}
  ]
}}
"""
        
        response = await call_gemini(prompt, temperature=0.4, max_tokens=2000)
        
        # Parse insights
        try:
            import json
            import re
            
            # Extract JSON
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                insights = data.get('insights', [])
                
                print(f"   🔍 Extracted {len(insights)} insights from analysis")
                return insights
        except Exception as e:
            print(f"   ⚠️  Insight parsing failed: {str(e)}")
        
        return []
    
    def _format_metrics(self, metrics: List[Dict]) -> str:
        """Format metrics for LLM"""
        if not metrics:
            return "No metrics available"
        
        lines = []
        for i, metric in enumerate(metrics[:10]):  # Top 10
            # Stored as 'evaluation_details' by memory_service.store_performance_metric
            eval_data = metric.get('evaluation_details', {}) or metric.get('evaluation', {})
            score = eval_data.get('overall_score', 0)
            criteria = eval_data.get('criteria', {})
            
            # Get low-scoring criteria
            low_criteria = [
                f"{k.replace('_', ' ')}: {v.get('score', 0):.1f}"
                for k, v in criteria.items()
                if isinstance(v, dict) and v.get('score', 10) < 7
            ]
            
            lines.append(
                f"{i+1}. Overall: {score}/10 | Low scores: {', '.join(low_criteria) if low_criteria else 'None'}"
            )
        
        # Calculate averages
        scores = [
            (m.get('evaluation_details', {}) or m.get('evaluation', {}) or {}).get('overall_score', 0)
            for m in metrics
        ]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        lines.append(f"\nAverage Score: {avg_score:.2f}/10")
        
        return "\n".join(lines)
    
    def _format_edits(self, edits: List[Dict]) -> str:
        """Format tutor edits for LLM"""
        if not edits:
            return "No tutor edits available"
        
        lines = []
        for i, edit in enumerate(edits[:10]):
            edit_notes = edit.get('edit_notes', 'No notes')
            changes = edit.get('changes_summary', 'Changes not specified')
            lines.append(f"{i+1}. WHY: {edit_notes} | WHAT: {changes}")
        
        return "\n".join(lines)
    
    def _agent_to_content_type(self, agent_type: str) -> str:
        """Map agent type to content type"""
        mapping = {
            'strategy_creator': 'strategy',
            'strategy_planner': 'strategy',
            'lesson_creator': 'lesson',
            'activity_creator': 'activity'
        }
        return mapping.get(agent_type, 'strategy')
    
    @weave.op()
    async def get_relevant_insights(
        self,
        agent_type: str,
        max_insights: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve most relevant learning insights for this agent
        To be prepended to prompts for adaptive generation
        """
        try:
            result = supabase.table('cross_agent_learning')\
                .select('*')\
                .or_(f'source_agent.eq.{agent_type},target_agent.eq.{agent_type}')\
                .order('created_at', desc=True)\
                .limit(max_insights)\
                .execute()
            
            insights = result.data if result.data else []
            
            if insights:
                print(f"   🎓 Retrieved {len(insights)} learning insights for {agent_type}")
            
            return insights
        except Exception as e:
            print(f"   ⚠️  Failed to retrieve insights: {str(e)}")
            return []


# Global instance
reflection_service = ReflectionService()


def format_insights_for_prompt(insights: List[Dict[str, Any]]) -> str:
    """
    Format learning insights for inclusion in generation prompts
    This is how we implement adaptive prompting!
    """
    if not insights:
        return ""
    
    lines = ["🎓 LEARNING INSIGHTS FROM PREVIOUS GENERATIONS:"]
    lines.append("(The AI has learned these patterns from tutor feedback and self-evaluation)")
    lines.append("")
    
    for i, insight in enumerate(insights, 1):
        confidence_emoji = "🟢" if insight.get('confidence', 0) > 0.8 else "🟡"
        lines.append(f"{i}. {confidence_emoji} {insight.get('insight', '')}")
        
        action = insight.get('action')
        if action:
            lines.append(f"   → ACTION: {action}")
        
        lines.append("")
    
    return "\n".join(lines)


# Global instance
reflection_service = ReflectionService()


# Background task to run periodically (call this from a cron job or FastAPI background task)
async def run_reflection_analysis():
    """
    Run reflection analysis for all agents
    This should be called periodically (e.g., every 6 hours)
    """
    print("\n" + "=" * 60)
    print("🧠 STARTING REFLECTION ANALYSIS")
    print("=" * 60)
    
    for agent_type in ['strategy_creator', 'lesson_creator', 'activity_creator']:
        try:
            insights = await reflection_service.generate_learning_insights(
                agent_type=agent_type,
                lookback_days=7
            )
            print(f"✅ {agent_type}: Generated {len(insights)} insights")
        except Exception as e:
            print(f"❌ {agent_type}: Reflection failed - {str(e)}")
    
    print("=" * 60)
    print("🎓 REFLECTION COMPLETE\n")

