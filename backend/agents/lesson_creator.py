"""
Lesson Creator Agent
Generates 5E lesson plans with self-evaluation
"""

import json
import weave
from typing import Dict, Any, Optional, List
from uuid import UUID, uuid4
from datetime import datetime

from services.ai_service import call_gemini
from services.knowledge_service import explain_topic_with_sources
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
async def generate_lesson(
    student_id: str,
    tutor_id: str,
    topic: Optional[str] = None,
    duration: int = 60,
    strategy_id: Optional[str] = None,
    strategy_week_number: Optional[int] = None
) -> Dict[str, Any]:
    """
    Generate a 5E lesson plan with self-evaluation
    
    Supports two modes:
    1. FROM STRATEGY: Provide strategy_id + strategy_week_number → Auto-loads topic from strategy week
    2. STANDALONE: Provide topic directly → No strategy context
    
    Args:
        student_id: Student UUID
        tutor_id: Tutor UUID
        topic: Lesson topic (required if standalone, ignored if from strategy)
        duration: Lesson duration in minutes (default: 60)
        strategy_id: Optional strategy UUID this lesson derives from
        strategy_week_number: Which week from strategy (1-4) if applicable
        
    Returns:
        Dict with lesson content and self-evaluation
    """
    
    # AGENT HANDOFF: Load strategy context if creating from strategy week
    strategy_context = None
    if strategy_id and strategy_week_number:
        print(f"\n📚 Generating lesson from Strategy Week {strategy_week_number}...")
        strategy_context = await load_strategy_week_context(strategy_id, strategy_week_number)
        topic = strategy_context['topic']  # Auto-fill topic from strategy
        print(f"   Topic from strategy: {topic}")
    else:
        print(f"\n📚 Generating standalone {duration}-minute lesson on: {topic}...")
        if not topic:
            raise ValueError("Topic required for standalone lesson (or provide strategy_id + strategy_week_number)")
    
    # Step 1: Load student and tutor data
    student = await get_student(student_id)
    tutor = await get_tutor(tutor_id)
    
    if not student:
        raise ValueError(f"Student {student_id} not found")
    if not tutor:
        raise ValueError(f"Tutor {tutor_id} not found")
    
    print(f"   Student: {student['name']} (Grade {student['grade']})")
    print(f"   Tutor: {tutor['name']}")
    
    # Step 2: Load memories and insights
    memories = await load_student_memories(student_id, limit=10)
    insights = await load_learning_insights(student['grade'], topic, limit=5)
    
    print(f"   Loaded {len(memories)} memories, {len(insights)} insights")
    
    # Extract attention span from memories if available
    attention_span = 15  # Default
    for memory in memories:
        if memory.get('memory_category') == 'learning_profile':
            data = memory.get('memory_value', {}).get('data', {})
            if 'attention_span' in data:
                attention_span = data['attention_span']
                break
    
    # Step 3: Call Layer 1 to explain the topic
    print(f"   🔍 Researching topic...")
    knowledge_context = await explain_topic_with_sources(
        topic=topic,
        grade=student['grade'],
        subject=student.get('subject', 'General')
    )
    print(f"   Found {len(knowledge_context.get('sources', []))} sources")
    
    # Step 4: Generate 5E lesson plan (with strategy context if applicable)
    lesson_content = await generate_comprehensive_lesson(
        student=student,
        tutor=tutor,
        topic=topic,
        duration=duration,
        knowledge_context=knowledge_context,
        learning_insights=insights,
        strategy_context=strategy_context
    )
    
    # Step 5: Self-evaluate the lesson
    print("   🔍 Self-evaluating lesson...")
    evaluation = await evaluator.evaluate_lesson(lesson_content, student)
    
    print(f"   📊 Overall Score: {evaluation['overall_score']}/10")
    
    # Step 6: Store in database
    lesson_id = uuid4()
    lesson_record = {
        'id': str(lesson_id),
        'tutor_id': tutor_id,
        'student_id': student_id,
        'strategy_id': strategy_id,
        'strategy_week_number': strategy_week_number,  # NEW: Track which week
        'title': f"{topic} - {duration}min Lesson",
        'duration': duration,
        'content': lesson_content,
        'knowledge_context': {  # NEW: Store sources + explanation for Activity Creator!
            'topic': topic,
            'explanation': knowledge_context.get('explanation', ''),
            'sources': knowledge_context.get('sources', [])
        },
        'self_evaluation': evaluation,
        'current_version': 1,  # NEW: Version tracking
        'is_latest': True,     # NEW: Latest version flag
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }
    
    supabase.table('lessons').insert(lesson_record).execute()
    print(f"   ✅ Lesson stored (ID: {lesson_id})")
    
    # Step 7: Store performance metric
    await store_performance_metric(
        agent_type='lesson_creator',
        evaluation=evaluation,
        session_id=str(lesson_id)
    )
    
    return {
        'lesson_id': str(lesson_id),
        'content': lesson_content,
        'evaluation': evaluation,
        'student': student,
        'tutor': tutor
    }


async def load_strategy_week_context(strategy_id: str, week_number: int) -> Dict:
    """Load specific week context from a strategy (markdown format)"""
    try:
        response = supabase.table('strategies').select('content').eq('id', strategy_id).execute()
        
        if not response.data:
            raise ValueError(f"Strategy {strategy_id} not found")
        
        strategy_content = response.data[0]['content']
        
        # Handle new markdown format
        if isinstance(strategy_content, dict) and strategy_content.get('format') == 'markdown':
            topics = strategy_content.get('topics', [])
            markdown_content = strategy_content.get('content', '')
            
            # Get the topic for this week
            if week_number <= 0 or week_number > len(topics):
                raise ValueError(f"Week {week_number} out of range (strategy has {len(topics)} weeks)")
            
            topic = topics[week_number - 1]
            
            # Extract the relevant week section from markdown
            import re
            week_pattern = rf"(?:Week|WEEK)\s*{week_number}[:\s]+.*?(?=(?:Week|WEEK)\s*\d+|$)"
            week_match = re.search(week_pattern, markdown_content, re.DOTALL | re.IGNORECASE)
            
            week_excerpt = ""
            if week_match:
                week_excerpt = week_match.group(0)[:500]  # First 500 chars of week section
            
            return {
                'topic': topic,
                'strategy_excerpt': week_excerpt,
                'full_strategy': markdown_content[:2000],  # First 2000 chars for broader context
                'week_number': week_number
            }
        
        # Fallback for old JSON format (backward compatibility)
        elif isinstance(strategy_content, dict) and 'weeks' in strategy_content:
            weeks = strategy_content.get('weeks', [])
            for week in weeks:
                if week.get('week_number') == week_number:
                    return {
                        'topic': week.get('topic', ''),
                        'focus_area': week.get('focus_area', ''),
                        'learning_objectives': week.get('learning_objectives', []),
                        'key_concepts': week.get('key_concepts', []),
                        'week_number': week_number
                    }
        
        raise ValueError(f"Week {week_number} not found in strategy")
        
    except Exception as e:
        print(f"⚠️ Error loading strategy context: {str(e)}")
        return None


@weave.op()
async def generate_5e_lesson(
    student: Dict,
    tutor: Dict,
    topic: str,
    duration: int,
    knowledge_context: Dict,
    learning_insights: List[Dict],
    attention_span: int,
    strategy_context: Optional[Dict] = None  # NEW: Strategy week context
) -> Dict:
    """Generate lesson using 5E framework (Engage, Explore, Explain, Elaborate, Evaluate)"""
    
    # Build insights section for adaptive prompting
    insights_section = ""
    if learning_insights:
        insights_section = f"""
LEARNINGS FROM PREVIOUS LESSON GENERATIONS:
{format_insights_for_prompt(learning_insights)}
"""
    
    # Calculate time allocations for 5E phases
    engage_time = 5
    explore_time = int(duration * 0.25)
    explain_time = int(duration * 0.2)
    elaborate_time = int(duration * 0.3)
    evaluate_time = int(duration * 0.15)
    
    # Build strategy context section if available
    strategy_section = ""
    if strategy_context:
        strategy_section = f"""
STRATEGY WEEK CONTEXT (from parent strategy):
This lesson is part of a larger {strategy_context.get('focus_area', '')} learning sequence.

Week Learning Objectives:
{chr(10).join('- ' + obj for obj in strategy_context.get('learning_objectives', []))}

Key Concepts to Cover:
{chr(10).join('- ' + concept for concept in strategy_context.get('key_concepts', []))}

Suggested Activities from Strategy:
{chr(10).join('- ' + str(act) for act in strategy_context.get('activities_suggested', [])[:3])}

⚠️ Important: This lesson should align with the strategy's progression and build on these objectives.
"""
    
    prompt = f"""You are a master teacher designing an active learning lesson using the 5E model.

{insights_section}

{strategy_section}

STUDENT PROFILE:
- Name: {student['name']}
- Grade: {student['grade']}
- Learning Style: {student.get('learning_style', 'Visual')}
- Interests: {', '.join(student.get('interests', []))}
- Attention Span: {attention_span} minutes (chunk activities accordingly)

TUTOR:
- Teaching Style: {tutor.get('teaching_style', 'Adaptive')}
- Education System: {tutor.get('education_system', 'Standard')}

TOPIC: {topic}
DURATION: {duration} minutes

RESEARCH CONTEXT:
{knowledge_context.get('explanation', '')[:1500]}

CREDIBLE SOURCES:
{format_sources(knowledge_context.get('sources', [])[:5])}

---

DESIGN A 5E LESSON:

**1. ENGAGE ({engage_time} mins)**: Hook that creates curiosity
- Connect to student interest: {student.get('interests', ['general topics'])[0] if student.get('interests') else 'their interests'}
- Create cognitive dissonance or curiosity gap
- Provide specific hook idea (question, demo, story, challenge)

**2. EXPLORE ({explore_time} mins)**: Student-led discovery
- Guided investigation activity
- Chunk into {attention_span}-minute segments if longer
- List specific materials needed
- Provide scaffolding questions
- Include {student.get('learning_style', 'multi-sensory')} elements

**3. EXPLAIN ({explain_time} mins)**: Concept clarification
- Student explanations first, then teacher refinement
- Visual aids for visual learners, verbal for auditory, etc.
- List 3-4 key concepts to cover
- Include analogies or examples from {', '.join(student.get('interests', [])[:2])}

**4. ELABORATE ({elaborate_time} mins)**: Application
- Real-world connections to {', '.join(student.get('interests', [])[:2])}
- Practice activities with differentiation
- Options for collaboration or independent work
- Increasing complexity

**5. EVALUATE ({evaluate_time} mins)**: Assessment & reflection
- Formative assessment checkpoints (non-threatening)
- Metacognitive reflection questions
- Preview next session connection

Include:
- Materials needed (with URLs from research sources)
- Formative assessment strategies throughout
- Differentiation for struggling/advanced learners
- Cultural adaptations for {student.get('nationality', 'diverse')} background

Return ONLY valid JSON (no markdown):
{{
  "lesson_title": "Engaging title",
  "overview": "Brief lesson overview",
  "learning_objectives": ["Objective 1", "Objective 2", "Objective 3"],
  "materials": ["Material 1 (URL)", "Material 2"],
  "phases": [
    {{
      "phase": "Engage",
      "duration": {engage_time},
      "activities": ["Specific activity description"],
      "teacher_notes": "Implementation guidance",
      "student_outcomes": "What students should do/think"
    }},
    {{
      "phase": "Explore",
      "duration": {explore_time},
      "activities": ["Activity 1", "Activity 2"],
      "materials": ["Material 1", "Material 2"],
      "scaffolding": ["Question 1", "Question 2"],
      "teacher_notes": "How to guide without telling"
    }},
    {{
      "phase": "Explain",
      "duration": {explain_time},
      "key_concepts": ["Concept 1", "Concept 2", "Concept 3"],
      "teaching_points": ["Point 1", "Point 2"],
      "visual_aids": ["Aid 1", "Aid 2"],
      "teacher_notes": "Explanation strategy"
    }},
    {{
      "phase": "Elaborate",
      "duration": {elaborate_time},
      "activities": ["Practice activity 1", "Application activity 2"],
      "differentiation": {{
        "struggling": "Support strategy",
        "advanced": "Extension activity"
      }},
      "real_world_connections": ["Connection 1", "Connection 2"]
    }},
    {{
      "phase": "Evaluate",
      "duration": {evaluate_time},
      "assessment_methods": ["Method 1", "Method 2"],
      "reflection_questions": ["Question 1", "Question 2"],
      "success_criteria": ["Criterion 1", "Criterion 2"],
      "next_steps": "Preview of next lesson"
    }}
  ],
  "cultural_adaptations": "How to adapt for this student",
  "resources": [
    {{
      "title": "Resource title",
      "url": "URL from research",
      "type": "video/article/interactive"
    }}
  ]
}}
"""
    
    response = await call_gemini(prompt, temperature=0.7, max_tokens=4000)
    
    # Parse JSON
    parsed = parse_json_response(response)
    
    if parsed and 'phases' in parsed:
        return parsed
    
    # Fallback
    print("⚠️ Failed to parse 5E lesson, using simplified version")
    return {
        "lesson_title": f"Lesson: {topic}",
        "overview": f"{duration}-minute lesson on {topic}",
        "learning_objectives": ["Understand key concepts", "Apply knowledge"],
        "materials": ["Standard materials"],
        "phases": [
            {"phase": "Engage", "duration": 5, "activities": ["Hook activity"]},
            {"phase": "Explore", "duration": explore_time, "activities": ["Exploration"]},
            {"phase": "Explain", "duration": explain_time, "key_concepts": ["Concept A"]},
            {"phase": "Elaborate", "duration": elaborate_time, "activities": ["Practice"]},
            {"phase": "Evaluate", "duration": evaluate_time, "assessment_methods": ["Check"]}
        ]
    }


@weave.op()
async def generate_comprehensive_lesson(
    student: Dict,
    tutor: Dict,
    topic: str,
    duration: int,
    knowledge_context: Dict,
    learning_insights: List[Dict],
    strategy_context: Optional[Dict] = None
) -> Dict:
    """Generate comprehensive detailed lesson plan with pre-class work, in-class activities, and homework"""
    
    # Build insights section
    insights_section = ""
    if learning_insights:
        insights_section = f"""
LEARNINGS FROM PREVIOUS LESSON GENERATIONS:
{format_insights_for_prompt(learning_insights)}
"""
    
    # Build strategy context section
    strategy_section = ""
    if strategy_context:
        strategy_section = f"""
STRATEGY WEEK CONTEXT:
This lesson is part of week {strategy_context.get('week_number', '')} of the learning strategy.
Topic: {strategy_context.get('topic', '')}
Context: {strategy_context.get('strategy_excerpt', '')[:500]}
"""
    
    # Format sources for readings
    sources = knowledge_context.get('sources', [])
    sources_formatted = "\n".join([
        f"{i+1}. {src.get('title', 'Source')} - {src.get('url', '')}"
        for i, src in enumerate(sources[:15])
    ])
    
    prompt = f"""You are a master educator creating a comprehensive, detailed lesson plan.

{insights_section}

{strategy_section}

STUDENT PROFILE:
- Name: {student['name']}
- Grade: {student['grade']}
- Learning Style: {student.get('learning_style', 'Visual')}
- Interests: {', '.join(student.get('interests', []))}
- Nationality: {student.get('nationality', 'International')}

TUTOR:
- Teaching Style: {tutor.get('teaching_style', 'Adaptive')}
- Education System: {tutor.get('education_system', 'Standard')}

TOPIC: {topic}
DURATION: {duration} minutes (in-class time)

RESEARCH CONTEXT:
{knowledge_context.get('explanation', '')[:2000]}

CREDIBLE SOURCES (Use these for readings and materials!):
{sources_formatted}

---

CREATE A COMPREHENSIVE LESSON PLAN with these sections:

**1. TITLE**: Engaging, clear lesson title

**2. LEARNING OBJECTIVES**: 3-5 specific, measurable objectives (use Bloom's taxonomy)

**3. SESSION OVERVIEW**: Brief 2-3 sentence description of the lesson flow

**4. STUDY GUIDE FOR STUDENT**: 
- Key questions students should be able to answer by the end
- Core concepts summary
- Visual diagrams or concept maps description

**5. PRE-CLASS READINGS**: 
- Select 2-3 articles/videos from the credible sources provided
- For each: title, URL, estimated time, key takeaways
- Include reading questions to guide students

**6. PRE-CLASS WORK**:
- Pre-assessment quiz (3-5 questions)
- Reflection prompts based on readings
- Preparation tasks (e.g., gather materials, write questions)

**7. CLASS ACTIVITIES AND MATERIALS**: 
- Detailed breakdown of {duration}-minute session
- For each activity: description, duration, materials needed (with URLs from sources!), teacher notes
- Include active learning strategies
- Adapt to {student.get('learning_style', 'visual')} learning style
- Connect to student interests: {', '.join(student.get('interests', [])[:2])}

**8. HOMEWORK**:
- Practice problems or reflection tasks
- Creative project or application task
- Reading/watching for next class (from sources)

Return ONLY valid JSON:
{{
  "title": "Engaging lesson title",
  "learning_objectives": ["Objective 1", "Objective 2", "Objective 3"],
  "session_overview": "2-3 sentence overview",
  "study_guide": {{
    "key_questions": ["Question 1", "Question 2", "Question 3"],
    "core_concepts": ["Concept 1", "Concept 2", "Concept 3"],
    "visual_aids": "Description of diagrams/maps students should create"
  }},
  "pre_class_readings": [
    {{
      "title": "Article/Video title",
      "url": "URL from sources above",
      "estimated_time": "15 minutes",
      "key_takeaways": ["Takeaway 1", "Takeaway 2"],
      "reading_questions": ["Question 1", "Question 2"]
    }}
  ],
  "pre_class_work": {{
    "pre_assessment": [
      {{"question": "Q1", "purpose": "Check prior knowledge"}}
    ],
    "reflection_prompts": ["Prompt 1", "Prompt 2"],
    "preparation_tasks": ["Task 1", "Task 2"]
  }},
  "class_activities": [
    {{
      "name": "Activity name",
      "duration": 10,
      "description": "Detailed description",
      "materials": ["Material 1 (URL if applicable)", "Material 2"],
      "teacher_notes": "Implementation guidance",
      "learning_strategy": "Type (e.g., collaborative, hands-on, discussion)"
    }}
  ],
  "homework": {{
    "practice_tasks": ["Task 1", "Task 2"],
    "creative_project": "Project description",
    "next_class_prep": [
      {{"type": "reading", "title": "Title", "url": "URL", "time": "15 min"}}
    ]
  }},
  "materials_summary": ["All materials needed with sources"],
  "cultural_adaptations": "Adaptations for {student.get('nationality', 'diverse')} background"
}}
"""
    
    response = await call_gemini(prompt, temperature=0.7, max_tokens=5000)
    
    # Parse JSON
    parsed = parse_json_response(response)
    
    if parsed and 'title' in parsed:
        return parsed
    
    # Fallback
    print("⚠️ Failed to parse comprehensive lesson, using simplified version")
    return {
        "title": f"Lesson: {topic}",
        "learning_objectives": ["Understand key concepts", "Apply knowledge"],
        "session_overview": f"{duration}-minute lesson on {topic}",
        "study_guide": {"key_questions": [], "core_concepts": [], "visual_aids": ""},
        "pre_class_readings": [],
        "pre_class_work": {"pre_assessment": [], "reflection_prompts": [], "preparation_tasks": []},
        "class_activities": [{"name": "Main Activity", "duration": duration, "description": "Explore topic", "materials": [], "teacher_notes": "", "learning_strategy": "discussion"}],
        "homework": {"practice_tasks": [], "creative_project": "", "next_class_prep": []},
        "materials_summary": [],
        "cultural_adaptations": ""
    }


def parse_json_response(response: str) -> Dict:
    """Parse JSON from LLM response with robust extraction"""
    import re
    
    cleaned = response.strip()
    
    # Method 1: Extract from markdown code blocks
    if '```' in cleaned:
        code_block_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
        if code_block_match:
            try:
                return json.loads(code_block_match.group(1))
            except json.JSONDecodeError as e:
                print(f"   ⚠️ Markdown JSON parse error: {str(e)[:100]}")
    
    # Method 2: Bracket counting to find outermost JSON
    brace_count = 0
    start_idx = None
    for i, char in enumerate(cleaned):
        if char == '{':
            if start_idx is None:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx is not None:
                try:
                    candidate = cleaned[start_idx:i+1]
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    start_idx = None
                    continue
    
    # Method 3: Try to find any JSON pattern
    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError as e:
            print(f"   ⚠️ Regex JSON parse error: {str(e)[:100]}")
    
    print("   ❌ No valid JSON found in response")
    print(f"   Response preview: {response[:300]}...")
    return {}

