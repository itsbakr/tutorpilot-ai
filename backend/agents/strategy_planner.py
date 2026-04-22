"""
Strategy Planner Agent
Generates 4-week personalized learning strategies with self-evaluation
"""

import json
import weave
from typing import Dict, Any, List
from uuid import UUID, uuid4
from datetime import datetime

from services.ai_service import call_gemini
from services.knowledge_service import explain_multiple_topics
from services.memory_service import (
    load_student_memories,
    load_learning_insights,
    store_performance_metric,
    format_insights_for_prompt,
    format_sources
)
from agents.evaluator import evaluator
from db.supabase_client import supabase, get_student, get_tutor


@weave.op()
async def generate_strategy(
    student_id: str,
    tutor_id: str,
    subject: str,
    weeks: int = 4
) -> Dict[str, Any]:
    """
    Generate a comprehensive learning strategy with self-evaluation
    
    Args:
        student_id: Student UUID
        tutor_id: Tutor UUID
        subject: Subject area (e.g., "Physics", "Chemistry")
        weeks: Number of weeks (default: 4)
        
    Returns:
        Dict with strategy content and self-evaluation
    """
    print(f"\n🎯 Generating {weeks}-week strategy for {subject}...")
    
    # Step 1: Load student and tutor data
    student = await get_student(student_id)
    tutor = await get_tutor(tutor_id)
    
    if not student:
        raise ValueError(f"Student {student_id} not found")
    if not tutor:
        raise ValueError(f"Tutor {tutor_id} not found")
    
    print(f"   Student: {student['name']} (Grade {student['grade']})")
    print(f"   Tutor: {tutor['name']} ({tutor.get('teaching_style', 'Standard')})")
    
    # Step 2: Load memories and insights for adaptive prompting
    memories = await load_student_memories(student_id, limit=10)
    insights = await load_learning_insights(student['grade'], subject, limit=5)
    
    print(f"   Loaded {len(memories)} student memories")
    print(f"   Loaded {len(insights)} learning insights")
    
    # Step 3: Generate weekly topics (now returns list of strings)
    week_topics = await generate_weekly_topics(student, tutor, subject, weeks)
    print(f"   Generated {len(week_topics)} weekly topics")
    
    # Step 4: Call Layer 1 to explain all topics in parallel
    knowledge_contexts = await explain_multiple_topics(
        topics=week_topics,  # week_topics is already a list of strings
        grade=student['grade'],
        subject=subject
    )
    print(f"   Retrieved knowledge for {len(knowledge_contexts)} topics")
    
    # Step 5: Generate comprehensive strategy
    strategy_content = await generate_full_strategy(
        student=student,
        tutor=tutor,
        week_topics=week_topics,
        knowledge_contexts=knowledge_contexts,
        learning_insights=insights
    )
    
    # Step 6: Self-evaluate the strategy
    print("   🔍 Self-evaluating strategy...")
    evaluation = await evaluator.evaluate_strategy(strategy_content, student)
    
    print(f"   📊 Overall Score: {evaluation['overall_score']}/10")
    
    # Step 7: Store in database
    strategy_id = uuid4()
    strategy_record = {
        'id': str(strategy_id),
        'tutor_id': tutor_id,
        'student_id': student_id,
        'title': f"{weeks}-Week {subject} Strategy for {student['name']}",
        'description': f"Personalized learning strategy for grade {student['grade']} {subject}",
        'weeks_count': weeks,
        'content': strategy_content,
        'knowledge_contexts': knowledge_contexts,  # NEW: Store all research for lessons/activities!
        'self_evaluation': evaluation,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }
    
    supabase.table('strategies').insert(strategy_record).execute()
    print(f"   ✅ Strategy stored (ID: {strategy_id})")
    
    # Step 8: Store performance metric
    await store_performance_metric(
        agent_type='strategy_planner',
        evaluation=evaluation,
        session_id=str(strategy_id)
    )
    
    # Collect all sources from all knowledge contexts
    all_sources = []
    for context in knowledge_contexts:
        all_sources.extend(context.get('sources', []))
    
    return {
        'strategy_id': str(strategy_id),
        'content': strategy_content,
        'evaluation': evaluation,
        'student': student,
        'tutor': tutor,
        'sources': all_sources  # Include all Perplexity sources
    }


@weave.op()
async def generate_weekly_topics(
    student: Dict,
    tutor: Dict,
    subject: str,
    weeks: int
) -> List[str]:
    """Generate weekly topics/themes for the strategy - simple list of topics"""
    
    prompt = f"""You are an expert curriculum designer creating a {weeks}-week learning strategy.

STUDENT PROFILE:
- Name: {student['name']}
- Grade: {student['grade']}
- Learning Style: {student.get('learning_style', 'Mixed')}
- Interests: {', '.join(student.get('interests', []))}
- Objectives: {', '.join(student.get('objectives', []))}

TUTOR APPROACH:
- Teaching Style: {tutor.get('teaching_style', 'Adaptive')}
- Education System: {tutor.get('education_system', 'Standard')}

SUBJECT: {subject}

Generate {weeks} weekly topics that:
1. Build progressively in complexity (scaffolding principle)
2. Connect to the student's interests
3. Are culturally relevant and engaging

Provide {weeks} topics, one per line, each starting with "Week N: "

Example format:
Week 1: Forces in Everyday Life - From Push to Pull
Week 2: Newton's Laws - The Rules of Motion

Now generate {weeks} topics for {subject}:
"""
    
    response = await call_gemini(prompt, temperature=0.8, max_tokens=800)
    
    # Extract topics from response
    topics = []
    for line in response.strip().split('\n'):
        line = line.strip()
        if line and ('week' in line.lower() or (len(topics) < weeks and ':' in line)):
            # Clean up the topic
            if ':' in line:
                topic = line.split(':', 1)[1].strip()
            else:
                topic = line
            topics.append(topic)
        
        if len(topics) >= weeks:
            break
    
    # Fallback if we didn't get enough topics
    while len(topics) < weeks:
        topics.append(f"{subject} Exploration - Week {len(topics) + 1}")
    
    return topics[:weeks]


@weave.op()
async def generate_full_strategy(
    student: Dict,
    tutor: Dict,
    week_topics: List[str],
    knowledge_contexts: List[Dict],
    learning_insights: List[Dict]
) -> Dict:
    """Generate a comprehensive, pedagogically-rich learning strategy in free-form markdown"""
    
    # Build insights section for adaptive prompting
    insights_section = ""
    if learning_insights:
        insights_section = f"""
IMPORTANT LEARNINGS FROM PREVIOUS STRATEGIES:
{format_insights_for_prompt(learning_insights)}

⚠️ Incorporate these insights to create an even stronger strategy.
"""
    
    # Format knowledge contexts with sources
    knowledge_section = format_knowledge_for_strategy(week_topics, knowledge_contexts)
    
    prompt = f"""You are a master educator and instructional designer. Create a comprehensive {len(week_topics)}-week learning strategy for a real student.

{insights_section}

## STUDENT PROFILE
- **Name**: {student['name']}
- **Grade**: {student['grade']}
- **Learning Style**: {student.get('learning_style', 'Mixed')}
- **Interests**: {', '.join(student.get('interests', []))}
- **Goals**: {', '.join(student.get('objectives', []))}
- **Cultural Background**: {student.get('nationality', 'International')}
- **Current Level**: {student.get('proficiency_level', 'Intermediate')}

## TUTOR APPROACH
- **Teaching Philosophy**: {tutor.get('teaching_style', 'Adaptive and student-centered')}
- **Curriculum**: {tutor.get('education_system', 'International standards')}

## WEEKLY TOPICS & RESEARCH
{knowledge_section}

---

# YOUR TASK: Create a Comprehensive Learning Strategy

This is a **strategic planning document** for the tutor, NOT individual lesson plans.

Think like an educational strategist. Address:

## 1. PEDAGOGICAL PHILOSOPHY (2-3 paragraphs)
- Why this approach for THIS specific student?
- How does it honor their learning style, interests, and cultural background?
- What's your theory of change for their learning over {len(week_topics)} weeks?
- How will you build trust and intrinsic motivation?

## 2. BIG IDEAS & ESSENTIAL QUESTIONS
- What are the 3-4 **big ideas** that connect all {len(week_topics)} weeks?
- What **essential questions** will drive inquiry? (e.g., "How do forces shape our world?")
- Why does this learning matter beyond the classroom?

## 3. LEARNING PROGRESSION & SCAFFOLDING
For each week, describe:
- **Week N: [Topic]**
  - **Conceptual Focus**: What big idea(s) does this week explore?
  - **Learning Goals**: What will the student be able to *think about* or *do* differently?
  - **Key Concepts**: 3-4 core concepts (with brief explanations)
  - **Cognitive Progression**: How does this build on prior weeks and prepare for future ones?
  - **Common Misconceptions**: What misunderstandings should the tutor anticipate?
  - **Differentiation Notes**: How to adapt if student struggles or excels?

## 4. FORMATIVE ASSESSMENT STRATEGY
- How will the tutor **check for understanding** throughout (not just at the end)?
- What **success indicators** show the student is progressing?
- What **dialogue questions** can reveal student thinking?
- How will you assess both conceptual understanding AND skill development?

## 5. DIFFERENTIATION & STUDENT-CENTERED ADAPTATIONS
- How to adjust pacing for {student.get('learning_style', 'this student')}?
- What **choice points** can you offer to honor student agency?
- How to connect abstract concepts to {', '.join(student.get('interests', [])[:2])} (student's interests)?
- Cultural responsiveness: How to respect {student.get('nationality', 'International')} perspective?

## 6. RESOURCES & KNOWLEDGE INTEGRATION
- Curated list of **high-quality resources** from the research (include URLs)
- Mix of: interactive simulations, videos, articles, primary sources
- Note which resources work best for which weeks

## 7. REFLECTION & METACOGNITION
- How will you help the student become aware of their OWN learning process?
- What **reflection prompts** can you use weekly?
- How will you celebrate growth and normalize struggle?

---

**IMPORTANT**:
- Be **creative and thoughtful**, not formulaic
- Write in **rich paragraphs**, not bullet lists (except where bullets clarify)
- Think like a **master teacher planning a transformative learning experience**
- This is a STRATEGY document - specific activities will come later in lesson plans
- Include specific **credible sources** (URLs) from the research provided
- Make it **personalized** to {student['name']}'s needs and interests

Write the complete strategy in **markdown format**. Be thorough and pedagogically sophisticated.
"""
    
    response = await call_gemini(prompt, temperature=0.8, max_tokens=6000)
    
    # Return as structured data (markdown content + metadata)
    return {
        "format": "markdown",
        "content": response,
        "weeks": len(week_topics),
        "topics": week_topics,
        "student_id": student['id'],
        "tutor_id": tutor['id']
    }


def format_knowledge_for_strategy(week_topics: List[str], knowledge_contexts: List[Dict]) -> str:
    """Format the research from Layer 1 for inclusion in strategy prompt"""
    result = []
    
    for i, (topic, context) in enumerate(zip(week_topics, knowledge_contexts)):
        # Truncate explanation to avoid token limits
        explanation = context.get('explanation', '')[:800]
        if len(context.get('explanation', '')) > 800:
            explanation += "..."
        
        sources_formatted = format_sources(context.get('sources', [])[:4])
        
        result.append(f"""
### Week {i+1}: {topic}

**Background Knowledge:**
{explanation}

**Credible Sources to Reference:**
{sources_formatted}
""")
    
    return "\n".join(result)


def parse_json_response(response: str) -> Dict:
    """Parse JSON from LLM response, handling markdown code blocks"""
    import re
    
    # Try to extract JSON from markdown code block
    json_match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find raw JSON
    json_match = re.search(r'\{.*\}', response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    
    return {}

