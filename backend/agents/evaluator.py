"""
Self-Evaluator Agent
Evaluates generated content (strategies, lessons, activities)
Critical for self-improvement loop
"""

import json
import weave
from typing import Dict, Any
from services.ai_service import call_gemini


class SelfEvaluator:
    """Agent that evaluates its own outputs"""
    
    @weave.op()
    async def evaluate_strategy(
        self,
        strategy: Dict[str, Any],
        student: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Self-evaluate a generated strategy
        
        Args:
            strategy: Strategy content dict
            student: Student profile dict
            
        Returns:
            Evaluation dict with scores and feedback
        """
        prompt = self._build_strategy_eval_prompt(strategy, student)
        response = await call_gemini(prompt, temperature=0.3, max_tokens=1500)
        
        return self._parse_evaluation(response)
    
    @weave.op()
    async def evaluate_lesson(
        self,
        lesson: Dict[str, Any],
        student: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Self-evaluate a generated lesson"""
        prompt = self._build_lesson_eval_prompt(lesson, student)
        response = await call_gemini(prompt, temperature=0.3, max_tokens=1500)
        
        return self._parse_evaluation(response)
    
    @weave.op()
    async def evaluate_activity(
        self,
        activity: Dict[str, Any],
        student: Dict[str, Any],
        deployment_status: str = "success"
    ) -> Dict[str, Any]:
        """Self-evaluate a generated activity (including code quality)"""
        prompt = self._build_activity_eval_prompt(activity, student, deployment_status)
        response = await call_gemini(prompt, temperature=0.3, max_tokens=1500)
        
        return self._parse_evaluation(response)
    
    def _build_strategy_eval_prompt(self, strategy: Dict, student: Dict) -> str:
        """Build evaluation prompt for strategy"""
        return f"""You are a pedagogical expert evaluating an AI-generated learning strategy.

STRATEGY TO EVALUATE:
{json.dumps(strategy, indent=2)[:2000]}...

STUDENT CONTEXT:
- Grade: {student.get('grade')}
- Learning Style: {student.get('learning_style', 'Mixed')}
- Interests: {', '.join(student.get('interests', []))}
- Cultural Background: {student.get('nationality', 'International')}

---

EVALUATION CRITERIA (rate each 1-10):

1. **Pedagogical Soundness**: Follows learning science principles (scaffolding, spacing, active recall)
2. **Cultural Appropriateness**: Respects student's cultural background
3. **Engagement Potential**: Likely to maintain student interest
4. **Clarity**: Clear learning objectives and outcomes
5. **Feasibility**: Realistic within time and resource constraints
6. **Progression**: Appropriate scaffolding and difficulty curve

For EACH criterion:
- Give a numeric score (1-10)
  - 1-3: Poor, major issues
  - 4-6: Fair, significant improvements needed
  - 7-8: Good, minor improvements possible
  - 9-10: Excellent, minimal changes needed
- Provide 1-2 sentence reasoning
- Be CRITICAL - identify real weaknesses

Also provide:
1. **Overall Score** (average of criteria scores)
2. **3 Specific Weaknesses** (be concrete, not vague)
3. **3 Concrete Improvements** (actionable suggestions)

BE HONEST: Most first-generation content scores 6-8. Don't give 9-10 unless truly excellent.

Return ONLY valid JSON:
{{
  "overall_score": 7.5,
  "criteria": {{
    "pedagogical_soundness": {{"score": 8, "reasoning": "..."}},
    "cultural_appropriateness": {{"score": 7, "reasoning": "..."}},
    "engagement_potential": {{"score": 8, "reasoning": "..."}},
    "clarity": {{"score": 9, "reasoning": "..."}},
    "feasibility": {{"score": 7, "reasoning": "..."}},
    "progression": {{"score": 8, "reasoning": "..."}}
  }},
  "weaknesses": [
    "Concrete weakness 1",
    "Concrete weakness 2",
    "Concrete weakness 3"
  ],
  "improvements": [
    "Actionable improvement 1",
    "Actionable improvement 2",
    "Actionable improvement 3"
  ],
  "confidence": 0.85
}}
"""
    
    def _build_lesson_eval_prompt(self, lesson: Dict, student: Dict) -> str:
        """Build evaluation prompt for lesson"""
        return f"""You are a pedagogical expert evaluating an AI-generated lesson plan.

LESSON TO EVALUATE:
{json.dumps(lesson, indent=2)[:2000]}...

STUDENT CONTEXT:
- Grade: {student.get('grade')}
- Learning Style: {student.get('learning_style', 'Mixed')}
- Interests: {', '.join(student.get('interests', []))}

---

EVALUATION CRITERIA (rate each 1-10):

1. **Pedagogical Soundness**: Follows active learning principles and learning science
2. **Content Quality**: Accurate, well-researched, uses credible sources
3. **Engagement**: Likely to maintain student attention and motivation
4. **Differentiation**: Addresses diverse learning needs and styles
5. **Clarity**: Clear structure, objectives, and instructions
6. **Feasibility**: Realistic within time and resource constraints

For EACH criterion:
- Give a numeric score (1-10)
  - 1-3: Poor, major issues
  - 4-6: Fair, significant improvements needed
  - 7-8: Good, minor improvements possible
  - 9-10: Excellent, minimal changes needed
- Provide 1-2 sentence reasoning
- Be CRITICAL - identify real weaknesses

Also provide:
1. **Overall Score** (average of criteria scores)
2. **3 Specific Weaknesses** (be concrete, not vague)
3. **3 Concrete Improvements** (actionable suggestions)

BE HONEST: Most first-generation lessons score 6-8. Don't give 9-10 unless truly excellent.

Return ONLY valid JSON:
{{
  "overall_score": 7.5,
  "criteria": {{
    "pedagogical_soundness": {{"score": 8, "reasoning": "..."}},
    "content_quality": {{"score": 7, "reasoning": "..."}},
    "engagement": {{"score": 8, "reasoning": "..."}},
    "differentiation": {{"score": 7, "reasoning": "..."}},
    "clarity": {{"score": 9, "reasoning": "..."}},
    "feasibility": {{"score": 7, "reasoning": "..."}}
  }},
  "weaknesses": [
    "Concrete weakness 1",
    "Concrete weakness 2",
    "Concrete weakness 3"
  ],
  "improvements": [
    "Actionable improvement 1",
    "Actionable improvement 2",
    "Actionable improvement 3"
  ],
  "confidence": 0.85
}}
"""
    
    def _build_activity_eval_prompt(self, activity: Dict, student: Dict, deployment_status: str) -> str:
        """Build evaluation prompt for activity"""
        code_section = ""
        if activity.get('code'):
            code_section = f"""
CODE QUALITY CONTEXT:
- Deployment Status: {deployment_status}
- Language: {activity.get('language', 'javascript')}
- Code Length: {len(activity.get('code', ''))} characters
"""
        
        return f"""You are a pedagogical expert evaluating an AI-generated educational activity.

ACTIVITY TO EVALUATE:
{json.dumps(activity, indent=2)[:2000]}...

{code_section}

STUDENT CONTEXT:
- Grade: {student.get('grade')}
- Learning Style: {student.get('learning_style', 'Mixed')}
- Interests: {', '.join(student.get('interests', []))}

---

EVALUATION CRITERIA (rate each 1-10):

1. **Educational Value**: Clear learning objectives with active learning principles
2. **Engagement**: Strong hooks, gamification, intrinsic motivation
3. **Interactivity**: Multiple interactive elements with immediate feedback
4. **Creativity**: Innovative approach that makes learning fun and memorable
5. **Code Quality** (if applicable): Clean code, responsive design, no bugs
6. **Feasibility**: Appropriate for grade level and time constraints

For EACH criterion:
- Give a numeric score (1-10)
  - 1-3: Poor, major issues
  - 4-6: Fair, significant improvements needed
  - 7-8: Good, minor improvements possible
  - 9-10: Excellent, minimal changes needed
- Provide 1-2 sentence reasoning
- Be CRITICAL - identify real weaknesses

Also provide:
1. **Overall Score** (average of criteria scores)
2. **3 Specific Weaknesses** (be concrete, not vague)
3. **3 Concrete Improvements** (actionable suggestions)

BE HONEST: Most activities score 6-8. Don't give 9-10 unless truly excellent.

Return ONLY valid JSON:
{{
  "overall_score": 7.5,
  "criteria": {{
    "educational_value": {{"score": 8, "reasoning": "..."}},
    "engagement": {{"score": 7, "reasoning": "..."}},
    "interactivity": {{"score": 8, "reasoning": "..."}},
    "creativity": {{"score": 7, "reasoning": "..."}},
    "code_quality": {{"score": 8, "reasoning": "..."}},
    "feasibility": {{"score": 7, "reasoning": "..."}}
  }},
  "weaknesses": [
    "Concrete weakness 1",
    "Concrete weakness 2",
    "Concrete weakness 3"
  ],
  "improvements": [
    "Actionable improvement 1",
    "Actionable improvement 2",
    "Actionable improvement 3"
  ],
  "confidence": 0.85
}}
"""
    
    def _parse_evaluation(self, response: str) -> Dict[str, Any]:
        """Parse JSON evaluation from LLM response with robust extraction"""
        import re
        
        # Clean response
        cleaned = response.strip()
        
        # Remove markdown code blocks if present
        if '```' in cleaned:
            # Extract content between ```json and ``` or just between ```
            code_block_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
            if code_block_match:
                cleaned = code_block_match.group(1)
        
        # Try to find JSON object (use non-greedy match and proper bracket counting)
        json_candidates = []
        
        # Method 1: Find outermost braces
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
                    json_candidates.append(cleaned[start_idx:i+1])
                    start_idx = None
        
        # Method 2: Regex fallback
        if not json_candidates:
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned, re.DOTALL)
            if json_match:
                json_candidates.append(json_match.group(0))
        
        # Try parsing each candidate
        for candidate in json_candidates:
            try:
                evaluation = json.loads(candidate)
                
                # Handle nested "evaluation" key (LLM sometimes wraps response)
                if 'evaluation' in evaluation and isinstance(evaluation['evaluation'], dict):
                    evaluation = evaluation['evaluation']
                
                # Validate structure
                if 'overall_score' in evaluation and 'criteria' in evaluation:
                    # Ensure criteria have proper format
                    validated_criteria = {}
                    for key, value in evaluation['criteria'].items():
                        if isinstance(value, dict) and 'score' in value:
                            validated_criteria[key] = value
                        elif isinstance(value, (int, float)):
                            # Convert simple number to proper format
                            validated_criteria[key] = {
                                "score": float(value),
                                "reasoning": "No reasoning provided"
                            }
                    
                    evaluation['criteria'] = validated_criteria
                    
                    # Ensure weaknesses and improvements are lists
                    if 'weaknesses' not in evaluation or not isinstance(evaluation['weaknesses'], list):
                        evaluation['weaknesses'] = []
                    if 'improvements' not in evaluation or not isinstance(evaluation['improvements'], list):
                        evaluation['improvements'] = []
                    
                    print(f"✅ Successfully parsed evaluation with {len(evaluation['criteria'])} criteria")
                    return evaluation
                else:
                    print(f"⚠️ JSON missing required fields: {list(evaluation.keys())}")
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON parsing attempt failed: {str(e)[:100]}")
                continue
            except Exception as e:
                print(f"⚠️ Error during JSON processing: {str(e)[:100]}")
                continue
        
        # Fallback evaluation with debugging info
        print("⚠️ Using fallback evaluation - all parsing attempts failed")
        print(f"   Response preview: {response[:200]}...")
        return {
            "overall_score": 7.0,
            "criteria": {
                "overall_quality": {"score": 7.0, "reasoning": "Could not parse detailed evaluation"}
            },
            "weaknesses": ["Evaluation parsing failed - check LLM response format"],
            "improvements": ["Ensure JSON is properly formatted", "Verify all required fields are present"],
            "confidence": 0.5
        }


# Global instance
evaluator = SelfEvaluator()

