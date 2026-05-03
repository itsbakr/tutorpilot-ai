"""
Activity Creator Agent
Generates interactive React activities with auto-fix loop
Critical feature for WaveHacks 2 - Self-debugging code generation!
"""

import json
import asyncio
import weave
from typing import Dict, Any, Optional
from uuid import UUID, uuid4
from datetime import datetime

from services.ai_service import call_gemini_coder, extract_code_block, has_errors, call_gemini
from services.knowledge_service import explain_topic_with_sources
from services.memory_service import (
    load_student_memories,
    load_learning_insights,
    store_performance_metric
)
from services.daytona_service import daytona_service
from agents.evaluator import evaluator
from db.supabase_client import supabase, get_student, get_tutor


async def load_lesson_context(lesson_id: str, class_section: Optional[str] = None) -> Dict:
    """
    Load lesson context including knowledge (topic, sources, explanation).
    Optionally focuses on a specific class section (activity).
    
    This retrieves ALL the research that was done for the lesson!
    No need to call Knowledge Service again!
    """
    try:
        response = supabase.table('lessons').select('title, content, knowledge_context').eq('id', lesson_id).execute()
        
        if not response.data:
            print(f"⚠️ Lesson {lesson_id} not found")
            return {}
        
        lesson = response.data[0]
        content = lesson.get('content', {})
        knowledge_context = lesson.get('knowledge_context', {})
        
        # Base context from lesson (includes all the sources!)
        base_context = {
            'topic': knowledge_context.get('topic', lesson.get('title', '')),
            'explanation': knowledge_context.get('explanation', ''),
            'sources': knowledge_context.get('sources', []),
            'learning_objectives': content.get('learning_objectives', []),
            'session_overview': content.get('session_overview', '')
        }
        
        # If specific class section requested, add that context
        if class_section:
            class_activities = content.get('class_activities', [])
            for activity in class_activities:
                if class_section.lower() in activity.get('name', '').lower():
                    base_context['activity_description'] = activity.get('description', '')
                    base_context['duration'] = activity.get('duration', 20)
                    base_context['materials'] = activity.get('materials', [])
                    base_context['teacher_notes'] = activity.get('teacher_notes', '')
                    break
        
        return base_context
        
    except Exception as e:
        print(f"⚠️ Error loading lesson context: {str(e)}")
        return {}


@weave.op()
async def generate_activity(
    student_id: str,
    tutor_id: str,
    topic: Optional[str] = None,
    activity_description: Optional[str] = None,
    duration: int = 20,
    lesson_id: Optional[str] = None,
    lesson_phase: Optional[str] = None,  # Renamed to class_section in UI, kept for API compatibility
    max_attempts: int = 3
) -> Dict[str, Any]:
    """
    Generate an interactive React activity with automatic error fixing
    
    Supports two modes:
    1. FROM LESSON: Provide lesson_id + optional class_section → Retrieves all context from lesson (NO API CALLS!)
    2. STANDALONE: Provide topic + activity_description directly
    
    This is THE killer feature - the agent debugs its own code!
    
    Args:
        student_id: Student UUID
        tutor_id: Tutor UUID
        topic: Activity topic (required if standalone, auto-filled if from lesson)
        activity_description: What the activity should do (optional if from lesson)
        duration: Activity duration in minutes
        lesson_id: Optional lesson UUID this activity derives from
        lesson_phase: Which class section/activity (UI calls it "class_section")
        max_attempts: Max attempts to fix errors (default: 3)
        
    Returns:
        Dict with activity content, sandbox URL, and evaluation
    """
    
    # AGENT HANDOFF: Load lesson context if creating from lesson
    knowledge_context = None
    if lesson_id:
        print(f"\n🎮 Generating activity from Lesson...")
        lesson_context = await load_lesson_context(lesson_id, lesson_phase)
        
        # Extract everything from lesson (no API calls needed!)
        topic = lesson_context.get('topic', topic) or topic
        knowledge_context = {
            'explanation': lesson_context.get('explanation', ''),
            'sources': lesson_context.get('sources', [])
        }
        
        # Auto-fill activity description if not provided
        if not activity_description:
            activity_description = lesson_context.get('activity_description', 
                f"Interactive activity for {topic}")
        
        print(f"   ✅ Retrieved lesson context (topic: {topic})")
        print(f"   ✅ Found {len(knowledge_context['sources'])} sources from lesson")
        print(f"   Activity: {activity_description[:80]}...")
    else:
        print(f"\n🎮 Generating standalone interactive activity...")
        if not topic or not activity_description:
            raise ValueError("Topic and activity_description required for standalone activity")
    
    # Step 1: Load student and tutor data
    student = await get_student(student_id)
    tutor = await get_tutor(tutor_id)
    
    if not student:
        raise ValueError(f"Student {student_id} not found")
    if not tutor:
        raise ValueError(f"Tutor {tutor_id} not found")
    
    print(f"   Student: {student['name']} (Grade {student['grade']})")
    print(f"   Request: {activity_description[:80]}...")
    
    # Step 2: Load memories and insights
    memories = await load_student_memories(student_id, limit=10)
    insights = await load_learning_insights(student['grade'], topic, limit=5)
    
    # Step 3: Get knowledge context (from lesson OR call Layer 1 for standalone)
    if not knowledge_context:  # Only for standalone activities
        print(f"   🔍 Researching topic (standalone mode)...")
        knowledge_context = await explain_topic_with_sources(
            topic=topic,
            grade=student['grade'],
            subject=student.get('subject', 'General')
        )
        print(f"   Found {len(knowledge_context.get('sources', []))} sources")
    # else: Already loaded from lesson!
    
    # Step 4: Generate React code using Gemini 3.0 Flash
    print(f"   💻 Generating React code with Gemini 3.0 Flash...")
    code = await generate_react_activity_code(
        topic=topic,
        grade=student['grade'],
        activity_description=activity_description,
        knowledge_context=knowledge_context,
        student=student
    )
    
    print(f"   ✅ Generated {len(code)} characters of React code")
    
    # Step 5: Deploy with automatic error fixing (THE MAGIC!)
    print(f"   🚀 Deploying to Daytona sandbox (max {max_attempts} attempts)...")
    deployment = await deploy_with_auto_fix(
        code=code,
        topic=topic,
        student_id=student_id,
        max_attempts=max_attempts
    )
    
    # Step 6: Build activity record
    activity_content = {
        "type": "interactive",
        "title": f"Interactive {topic} Activity",
        "description": activity_description,
        "topic": topic,
        "duration": duration,
        "code": deployment['code'],
        "language": "javascript",
        "sandbox_id": deployment.get('sandbox_id'),
        "sandbox_url": deployment.get('url'),
        "deployment_status": deployment['status'],
        "attempts_needed": deployment['attempts']
    }
    
    # Step 7: Self-evaluate (includes code quality assessment)
    print("   🔍 Self-evaluating activity...")
    evaluation = await evaluator.evaluate_activity(
        activity=activity_content,
        student=student,
        deployment_status=deployment['status']
    )
    
    print(f"   📊 Overall Score: {evaluation['overall_score']}/10")
    if deployment['status'] == 'success':
        print(f"   ✅ Deployed successfully on attempt {deployment['attempts']}")
        print(f"   🌐 Sandbox URL: {deployment['url']}")
    else:
        print(f"   ❌ Failed after {deployment['attempts']} attempts")
    
    # Step 8: Store in database
    activity_id = uuid4()
    activity_record = {
        'id': str(activity_id),
        'tutor_id': tutor_id,
        'student_id': student_id,
        'lesson_id': lesson_id,
        'title': f"{topic} - Interactive Activity",
        'type': 'interactive',
        'duration': duration,
        'content': activity_content,
        'code': deployment['code'],
        'language': 'javascript',
        'sandbox_id': deployment.get('sandbox_id'),
        'sandbox_url': deployment.get('url'),
        'self_evaluation': evaluation,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }
    
    supabase.table('activities').insert(activity_record).execute()
    print(f"   ✅ Activity stored (ID: {activity_id})")
    
    # Step 9: Store performance metric
    await store_performance_metric(
        agent_type='activity_creator',
        evaluation=evaluation,
        session_id=str(activity_id)
    )
    
    return {
        'activity_id': str(activity_id),
        'content': activity_content,
        'evaluation': evaluation,
        'deployment': deployment,
        'student': student,
        'tutor': tutor
    }


@weave.op()
async def generate_react_activity_code(
    topic: str,
    grade: str,
    activity_description: str,
    knowledge_context: Dict,
    student: Dict
) -> str:
    """Generate React code for educational activity using Gemini 3.0 Flash"""
    
    # Truncate explanation to avoid token limits
    explanation = knowledge_context.get('explanation', '')[:1000]
    
    prompt = f"""Generate a BEAUTIFUL, interactive React web page for an educational activity.

TOPIC: {topic}
STUDENT GRADE: {grade}
STUDENT INTERESTS: {', '.join(student.get('interests', [])[:3])}

ACTIVITY DESCRIPTION: {activity_description}

EDUCATIONAL CONTEXT:
{explanation}

---

🎨 **CRITICAL: DESIGN-FIRST APPROACH**

This MUST look like a professional, modern web app (Duolingo, Khan Academy, Brilliant.org quality).

**MODERN UI DESIGN REQUIREMENTS (MANDATORY!):**

1. **COLOR SCHEME** (Pick one that fits the topic):
   - Science/Tech: Gradients (blue-500 → purple-600, teal-400 → cyan-600)
   - Nature/Biology: Green gradients (emerald-400 → green-600)
   - Space: Dark theme with indigo/purple (bg-gray-900, text-purple-400)
   - Math: Orange/yellow warm tones (amber-400 → orange-600)
   - Use `bg-gradient-to-br` or `bg-gradient-to-r` for backgrounds

2. **LAYOUT & SPACING**:
   ```jsx
   <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-8">
     <div className="max-w-6xl mx-auto">
       <div className="bg-white rounded-3xl shadow-2xl p-8">
         {{/* Your content */}}
       </div>
     </div>
   </div>
   ```
   - Use `rounded-3xl`, `rounded-2xl` for modern curves
   - Generous padding: `p-6`, `p-8`, `px-8 py-6`
   - White/light cards on gradient backgrounds
   - `shadow-2xl`, `shadow-xl` for depth

3. **TYPOGRAPHY**:
   - Headings: `text-4xl font-black` or `text-3xl font-bold`
   - Subheadings: `text-xl font-semibold`
   - Body: `text-base` or `text-lg`
   - Use `text-gray-900` for dark text, `text-gray-600` for secondary

4. **BUTTONS & INTERACTIVE ELEMENTS**:
   ```jsx
   <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200">
     Action Text
   </button>
   ```
   - ALWAYS use gradients for primary buttons
   - Add hover effects: `hover:scale-105 transform transition-all`
   - Use `rounded-xl` or `rounded-2xl` for buttons
   - Icons with emojis (🚀 🔬 🎯 ⚡ 🌟 💡 🎨)

5. **CARDS & CONTAINERS**:
   ```jsx
   <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
     {{/* Card content */}}
   </div>
   ```
   - Use subtle gradients for backgrounds (`from-blue-50 to-indigo-50`)
   - Borders with color: `border-2 border-blue-300`
   - Hover effects on interactive cards

6. **PROGRESS INDICATORS & FEEDBACK**:
   ```jsx
   {{/* Progress Bar */}}
   <div className="w-full bg-gray-200 rounded-full h-4">
     <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-4 rounded-full transition-all duration-500" 
          style={{{{width: `${{progress}}%`}}}}>
     </div>
   </div>
   
   {{/* Score Display */}}
   <div className="text-center">
     <div className="text-5xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
       {{score}}
     </div>
     <div className="text-sm text-gray-600">Points</div>
   </div>
   ```

7. **ANIMATIONS & TRANSITIONS**:
   - ALWAYS add: `transition-all duration-300` to interactive elements
   - Use `animate-pulse` for loading states
   - Use `transform hover:scale-105` for hover effects
   - Add smooth transitions: `transition-colors duration-200`

8. **VISUAL HIERARCHY**:
   - Large, bold titles at top
   - Clear sections with visual separation
   - Important elements: larger, brighter, gradients
   - Secondary info: smaller, muted colors

**ACTIVITY TYPES** (Choose what fits):
1. Interactive Simulations (physics, chemistry, biology visualizations)
2. Educational Games (puzzles, strategy, building games)
3. Role-Playing Scenarios (historical perspectives, scientific investigations)
4. Interactive Laboratories (experiments with variables)
5. Story-Driven Explorations (narrative with decision points)

**ENGAGEMENT PRINCIPLES**:
- Curiosity-driven exploration
- Meaningful choices that affect outcomes
- Immediate visual feedback with animations
- Learning through DOING, not reading
- Make failures interesting, not punishing
- Smooth, responsive interactions

**TECHNICAL REQUIREMENTS**:
- Modern React with hooks (useState, useEffect, useCallback)
- **BEAUTIFUL UI with Tailwind CSS** (see design requirements above!)
- Rich interactivity (click, drag, animations)
- Self-contained (no external APIs)
- Production-ready code quality
- **ALWAYS use semicolons** after every statement (mandatory!)
- NO LINE LIMIT - build something comprehensive!

**CRITICAL — TUTOR-PILOT CONTRACT (MANDATORY)**:
- Read URL params at startup: `const params = new URLSearchParams(window.location.search);`
- `const isTutor = params.get('role') === 'tutor';` — when true, you may show debug controls; default UI assumes student.
- Emit interaction events to the parent window using:
  ```js
  function reportEvent(kind, payload) {{
    try {{
      window.parent.postMessage({{ type: 'tutorpilot:event', kind, payload }}, '*');
    }} catch (e) {{}}
  }}
  ```
- Call `reportEvent` for at least these moments:
  - `reportEvent('answer', {{ question_id, question, response, correct, time_ms }})` after each question/choice.
  - `reportEvent('hint', {{ question_id }})` when the student requests a hint.
  - `reportEvent('completed', {{ score, total, time_ms }})` when the activity finishes.
- These events feed the tutor's run-results dashboard. They are silent if the activity is opened standalone.

**CULTURAL ADAPTATION**:
- Student background: {student.get('nationality', 'International')}
- Use examples relevant to: {', '.join(student.get('interests', [])[:2])}

---

**BAD EXAMPLE (Ugly, avoid this!):**
```jsx
<div>
  <h1>Topic</h1>
  <button>Click</button>
  <div>Score: 0</div>
</div>
```

**GOOD EXAMPLE (Beautiful, do this!):**
```jsx
<div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-8">
  <div className="max-w-6xl mx-auto">
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <h1 className="text-5xl font-black text-gray-900 mb-4 text-center">
        🚀 Mars Rover Mission
      </h1>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-indigo-300 rounded-2xl p-6 text-center">
          <div className="text-4xl font-black text-indigo-600">0%</div>
          <div className="text-sm text-gray-600 mt-2">Battery Level</div>
        </div>
      </div>
      <button className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-2xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
        🔋 Charge Battery
      </button>
    </div>
  </div>
</div>
```

---

**OUTPUT FORMAT**:

Generate a COMPLETE, BEAUTIFUL, self-contained React component with:
1. Modern gradient backgrounds and color schemes
2. Rounded corners (rounded-2xl, rounded-3xl) everywhere
3. Shadow effects for depth
4. Hover animations and transitions
5. Clear visual hierarchy with bold typography
6. Emojis for visual interest (🚀 🔬 🎯 ⚡ 🌟 💡)
7. State management for game/simulation logic
8. Educational content integrated naturally

Return ONLY the complete React component code (no markdown, no explanation).

Start with: import React, {{ useState, useEffect, useCallback }} from 'react';

Generate BEAUTIFUL code now:
"""
    
    # Call Gemini 3.0 Flash
    response = await call_gemini_coder(prompt, temperature=0.3, max_tokens=6000)
    
    # Extract code from response
    code = extract_code_block(response, language="jsx")
    
    return code


@weave.op()
async def deploy_with_auto_fix(
    code: str,
    topic: str,
    student_id: str,
    max_attempts: int = 3
) -> Dict[str, Any]:
    """
    Deploy to Daytona with automatic error fixing
    
    THIS IS THE MAGIC - The agent fixes its own code!
    
    Args:
        code: Initial generated code
        topic: Activity topic (for context when fixing)
        student_id: For sandbox metadata
        max_attempts: Maximum fix attempts
        
    Returns:
        Dict with status, sandbox_id, url, attempts, final code
    """
    for attempt in range(1, max_attempts + 1):
        try:
            print(f"\n      🔄 Deployment attempt {attempt}/{max_attempts}...")
            
            # Deploy to Daytona sandbox with complete Vite + React setup
            sandbox = await daytona_service.create_and_deploy_react_app(
                code=code,
                student_id=student_id,
                auto_stop_interval=120  # 2 hours for tutoring sessions
            )
            
            # Check deployment status
            if sandbox['status'] == 'failed':
                error_logs = sandbox.get('logs', 'Unknown error')
                print(f"      ❌ Daytona deployment failed: {error_logs[:200]}...")
            else:
                # Deployment succeeded, check for runtime errors
                error_logs = sandbox.get('logs', '')
            
            # Check if sandbox has errors
            if sandbox['status'] == 'running' and not has_errors(error_logs if error_logs else ''):
                # SUCCESS!
                print(f"      ✅ Deployed successfully on attempt {attempt}!")
                return {
                    "sandbox_id": sandbox['sandbox_id'],
                    "url": sandbox['url'],
                    "status": "success",
                    "attempts": attempt,
                    "code": code,
                    "session_id": sandbox.get('session_id'),
                    "dev_command_id": sandbox.get('dev_command_id')
                }
            
            # Errors found - try to fix if we have attempts left
            print(f"      ⚠️ Errors detected in deployment")
            print(f"      Error preview: {str(error_logs)[:200]}...")
            
            if attempt < max_attempts:
                print(f"      🔧 Attempting to auto-fix code...")
                
                # Use Gemini to fix the errors
                fixed_code = await fix_code_errors(
                    original_code=code,
                    error_logs=str(error_logs),
                    topic=topic,
                    attempt_number=attempt
                )
                
                print(f"      ✅ Generated fix (diff: {len(fixed_code) - len(code):+d} chars)")
                
                # Store fix attempt for learning
                await store_code_fix_attempt(code, fixed_code, str(error_logs), attempt)
                
                # Use fixed code for next attempt
                code = fixed_code
                
                # Delete failed sandbox before retry (with session cleanup)
                if sandbox.get('sandbox_id'):
                    await daytona_service.delete_sandbox(
                        sandbox['sandbox_id'],
                        session_id=sandbox.get('session_id')
                    )
                
            else:
                # Out of attempts
                print(f"      ❌ Failed after {max_attempts} attempts")
                return {
                    "sandbox_id": None,
                    "url": None,
                    "status": "failed",
                    "attempts": attempt,
                    "error_logs": str(error_logs)[:500] if error_logs else "Unknown error",
                    "code": code
                }
                
        except Exception as e:
            print(f"      ❌ Deployment exception: {str(e)}")
            if attempt == max_attempts:
                return {
                    "sandbox_id": None,
                    "url": None,
                    "status": "failed",
                    "attempts": attempt,
                    "error": str(e),
                    "code": code
                }
            # Retry
            await asyncio.sleep(2)
    
    # Should never reach here
    return {"status": "failed", "attempts": max_attempts, "code": code}


@weave.op()
async def fix_code_errors(
    original_code: str,
    error_logs: str,
    topic: str,
    attempt_number: int
) -> str:
    """Use Gemini 3.0 Flash to fix errors in generated code"""
    
    # Truncate code and logs to avoid token limits
    code_preview = original_code[:2000]
    if len(original_code) > 2000:
        code_preview += "\n... (truncated)"
    
    error_preview = error_logs[:800]
    
    prompt = f"""You are debugging React code that was deployed to a sandbox and encountered errors.

ORIGINAL TOPIC: {topic}
ATTEMPT NUMBER: {attempt_number}/3

DEPLOYED CODE (preview):
```jsx
{code_preview}
```

ERROR LOGS FROM SANDBOX:
```
{error_preview}
```

---

**YOUR TASK**: Fix the code to eliminate ALL errors while maintaining the educational and interactive experience.

**DEBUGGING APPROACH**:

1. **Analyze the Error**:
   - Identify root cause (syntax, logic, missing imports, etc.)
   - Check for MISSING SEMICOLONS (very common!)
   - Check React-specific issues (hooks, state, lifecycle)
   - Look for Tailwind CSS class issues
   - Check for JavaScript errors (undefined variables, type mismatches)
   - Check for Babel/parser errors (usually syntax issues)

2. **Fix Strategy**:
   - Make MINIMAL changes to fix the error
   - Don't remove features - fix them properly
   - **ADD SEMICOLONS** after every statement (JavaScript best practice!)
   - Ensure all state updates are correct
   - Verify all event handlers are properly bound
   - Check all conditional rendering logic

3. **Common Issues**:
   - **Missing semicolons** (add ; after every statement)
   - Missing dependencies in useEffect
   - Incorrect hook usage (calling hooks conditionally)
   - Unescaped characters in JSX (especially quotes in strings)
   - Missing closing tags
   - Incorrect prop types
   - Using undefined variables
   - Math operations on undefined/null values
   - Template literals with backticks inside JSX strings

**OUTPUT**: 

Return the COMPLETE, FIXED React component code.
- Fix the actual problem, don't just remove features
- Maintain ALL educational and interactive elements
- **Maintain the BEAUTIFUL UI design** (gradients, rounded corners, shadows, animations)
- Keep code quality high
- Must run without errors

Return ONLY the complete fixed code (no markdown, no explanation):
"""
    
    # Call Gemini to fix
    response = await call_gemini_coder(prompt, temperature=0.2, max_tokens=6000)
    
    # Extract fixed code
    fixed_code = extract_code_block(response, language="jsx")
    
    return fixed_code if fixed_code else original_code


async def store_code_fix_attempt(
    original_code: str,
    fixed_code: str,
    error_logs: str,
    attempt: int
):
    """Store code fix attempt in platform memory for learning"""
    try:
        # Extract error type from logs
        error_type = "unknown"
        if "SyntaxError" in error_logs:
            error_type = "syntax"
        elif "TypeError" in error_logs:
            error_type = "type"
        elif "ReferenceError" in error_logs:
            error_type = "reference"
        elif "Failed to compile" in error_logs:
            error_type = "compilation"
        
        memory_record = {
            'entity_type': 'content',
            'entity_id': str(uuid4()),
            'memory_category': 'code_debugging',
            'memory_key': 'fix_attempt',
            'memory_value': {
                'error_type': error_type,
                'attempt_number': attempt,
                'code_length_change': len(fixed_code) - len(original_code),
                'had_error_keywords': {
                    'syntax': 'Syntax' in error_logs,
                    'type': 'Type' in error_logs,
                    'reference': 'Reference' in error_logs
                }
            },
            'confidence_score': 0.6,  # Will update based on success
            'created_at': datetime.now().isoformat()
        }
        
        supabase.table('platform_memory').insert(memory_record).execute()
        print(f"         💾 Stored fix attempt for learning")
        
    except Exception as e:
        print(f"         ⚠️ Failed to store fix attempt: {str(e)}")


@weave.op()
async def iterate_activity_from_chat(
    activity_id: str,
    student_id: str,
    current_code: str,
    tutor_message: str,
    topic: str
) -> Dict[str, Any]:
    """
    Iterate on an activity based on tutor's chat message.
    This enables conversational editing: tutors can ask for changes in natural language.
    
    Args:
        activity_id: Activity UUID
        student_id: Student UUID  
        current_code: Current React code
        tutor_message: Tutor's request for changes
        topic: Activity topic
        
    Returns:
        Dict with new_code, explanation, changes, sandbox_url
    """
    print(f"\n💬 Iterating activity based on chat: {tutor_message[:100]}...")
    
    # Build prompt for code modification
    prompt = f"""You are an expert React developer iterating on an educational activity.

CURRENT FULL CODE:
```jsx
{current_code}
```

TUTOR'S REQUEST:
"{tutor_message}"

TOPIC: {topic}

Your task: Modify the ENTIRE React component to implement the tutor's request.

CRITICAL REQUIREMENTS:
1. Return the COMPLETE, FULL React component code (not just the changed parts!)
2. Include ALL imports, ALL functions, ALL JSX - the entire file
3. Keep it fun and engaging
4. Maintain game-like feel and interactivity
5. Use Tailwind CSS for styling
6. Ensure code is complete and functional
7. The code must be ready to deploy as-is

Return format:
```jsx
[COMPLETE FULL CODE HERE - FROM import TO export default]
```

Return ONLY the complete React component code in a code block. NO explanations, NO partial code, NO placeholders.
"""
    
    # Generate modified code
    new_code = await call_gemini_coder(prompt, temperature=0.2, max_tokens=9000)
    
    # Clean code
    if '```' in new_code:
        new_code = new_code.split('```')[1]
        if new_code.startswith('jsx') or new_code.startswith('javascript'):
            new_code = '\n'.join(new_code.split('\n')[1:])
    
    # Identify changes
    changes_prompt = f"""Briefly describe what changed between these two code versions in 1-2 sentences:

OLD CODE:
{current_code[:500]}...

NEW CODE:
{new_code[:500]}...

TUTOR'S REQUEST: {tutor_message}

Provide a concise summary of the changes made:
"""
    
    explanation = await call_gemini(changes_prompt, temperature=0.3, max_tokens=200)
    
    # Try to redeploy (optional - can fail gracefully)
    sandbox_url = None
    try:
        deployment = await deploy_to_daytona(new_code, student_id, max_attempts=1)
        sandbox_url = deployment.get('url')
    except Exception as e:
        print(f"⚠️ Redeployment failed (non-blocking): {str(e)}")
    
    return {
        'new_code': new_code,
        'explanation': explanation.strip(),
        'changes': explanation.strip(),
        'sandbox_url': sandbox_url,
        'iteration_successful': True
    }

