"""
Knowledge Service (Layer 1)
Generates queries and explains topics using Perplexity
Non-personalized, universal knowledge layer
"""

import asyncio
import weave
from typing import List, Dict, Any
from .ai_service import call_gemini, call_perplexity


@weave.op()
async def generate_queries(topic: str, grade: str, subject: str) -> List[str]:
    """
    Generate 2-3 search queries for a topic using Gemini
    
    Args:
        topic: The learning topic
        grade: Grade level
        subject: Subject area
        
    Returns:
        List of search queries
    """
    prompt = f"""Generate 2-3 specific search queries to research this educational topic.

TOPIC: {topic}
GRADE LEVEL: {grade}
SUBJECT: {subject}

Generate queries that will help find:
1. Core conceptual explanations appropriate for {grade} grade
2. Real-world applications and examples
3. Common misconceptions and teaching strategies

Return ONLY a JSON array of 2-3 query strings:
["query 1", "query 2", "query 3"]
"""
    
    response = await call_gemini(prompt, temperature=0.3, max_tokens=200)
    
    # Parse queries from response
    import json
    import re
    
    # Try to extract JSON array
    json_match = re.search(r'\[.*\]', response, re.DOTALL)
    if json_match:
        try:
            queries = json.loads(json_match.group(0))
            return queries[:3]  # Limit to 3
        except json.JSONDecodeError:
            pass
    
    # Fallback: split by newlines and clean up
    lines = [line.strip().strip('"').strip("'").strip('-').strip()
             for line in response.split('\n')
             if line.strip() and len(line.strip()) > 10]
    
    return lines[:3] if lines else [f"{topic} {grade} grade explanation"]


@weave.op()
async def explain_topic_with_sources(
    topic: str,
    grade: str,
    subject: str
) -> Dict[str, Any]:
    """
    Explain a single topic using Perplexity Sonar (with sources)
    
    Args:
        topic: The learning topic
        grade: Grade level
        subject: Subject area
        
    Returns:
        Dict with explanation, sources, and queries used
    """
    # Generate optimized queries
    queries = await generate_queries(topic, grade, subject)
    
    print(f"📚 Generated {len(queries)} queries for: {topic}")
    
    # Call Perplexity for each query in parallel
    tasks = [call_perplexity(query) for query in queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Combine results
    all_content = []
    all_sources = []
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"⚠️ Query {i+1} failed: {str(result)}")
            continue
        
        all_content.append(result.get('content', ''))
        all_sources.extend(result.get('sources', []))
    
    # Deduplicate sources by URL
    unique_sources = {}
    for source in all_sources:
        url = source.get('url', '')
        if url and url not in unique_sources:
            unique_sources[url] = source
    
    # Combine content
    combined_explanation = "\n\n---\n\n".join(all_content)
    
    return {
        "topic": topic,
        "queries": queries,
        "explanation": combined_explanation,
        "sources": list(unique_sources.values())[:10],  # Top 10 sources
        "query_count": len(queries),
        "source_count": len(unique_sources)
    }


@weave.op()
async def explain_multiple_topics(
    topics: List[str],
    grade: str,
    subject: str
) -> List[Dict[str, Any]]:
    """
    Explain multiple topics in parallel (for strategy planning)
    
    Args:
        topics: List of topic names
        grade: Grade level
        subject: Subject area
        
    Returns:
        List of topic explanation dicts
    """
    print(f"🔍 Explaining {len(topics)} topics for {grade} grade {subject}...")
    
    # Explain all topics in parallel
    tasks = [explain_topic_with_sources(topic, grade, subject) for topic in topics]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle any errors
    explanations = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"⚠️ Topic {i+1} failed: {str(result)}")
            # Provide fallback
            explanations.append({
                "topic": topics[i],
                "queries": [],
                "explanation": f"Error fetching explanation for {topics[i]}",
                "sources": [],
                "query_count": 0,
                "source_count": 0
            })
        else:
            explanations.append(result)
    
    total_sources = sum(exp['source_count'] for exp in explanations)
    print(f"✅ Explained {len(topics)} topics with {total_sources} total sources")
    
    return explanations

