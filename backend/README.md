# TutorPilot Backend - FastAPI + Python

Self-improving AI agent system for educational content generation.

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Supabase account
- API Keys: Google Gemini 3.0 Flash, Perplexity, W&B, Daytona

### Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# AI Models
GOOGLE_GEMINI_API_KEY=your-google-ai-studio-key
PERPLEXITY_API_KEY=pplx-your-key
WANDB_API_KEY=your-wandb-key

# Sandbox
DAYTONA_API_KEY=your-daytona-key

# Weave
WANDB_PROJECT=tutorpilot-weavehacks
```

### Run Server

```bash
uvicorn main:app --reload
# API docs: http://localhost:8000/docs
```

## 📁 Project Structure

```
backend/
├── agents/                      # AI agents
│   ├── strategy_planner.py     # 4-week learning strategies
│   ├── lesson_creator.py       # Comprehensive lesson plans
│   ├── activity_creator.py     # Interactive React activities
│   ├── evaluator.py            # Self-evaluation logic
│   └── reflection_service.py   # Learning insights analysis
├── services/
│   ├── ai_service.py           # Gemini 3.0 Flash, Perplexity, Gemini 3.0 Flash clients
│   ├── daytona_service.py      # React sandbox deployment
│   ├── knowledge_service.py    # Research queries + retrieval
│   └── memory_service.py       # Agentic memory operations
├── db/
│   └── supabase_client.py      # Database connection
├── models/                      # Pydantic data models
├── main.py                      # FastAPI application
└── requirements.txt
```

## 🧪 Test Agent Handoff

```bash
python test_agent_handoff.py
```

This demonstrates:
1. Strategy Planner generates 4-week plan
2. Lesson Creator uses strategy context (week 2)
3. Activity Creator uses lesson context

## 🔧 Key Features

### Hierarchical Agent Handoff
- **Strategy → Lesson**: Auto-fills topic from strategy week
- **Lesson → Activity**: Reuses research context (no redundant API calls)

### Self-Evaluation
- Every generation scored on 6 criteria (1-10 each)
- Identifies weaknesses and improvements
- Stored in `agent_performance_metrics`

### Auto-Debugging
- Activity Creator auto-fixes React code errors
- Up to 3 attempts with Gemini 3.0 Flash
- Falls back to Gemini if W&B Inference fails

### Reflection Loop
- Background service analyzes low-scoring outputs
- Generates `learning_insights`
- Future generations adapt prompts automatically

## 📊 API Endpoints

### Agents
- `POST /api/v1/agents/strategy` - Generate 4-week strategy
- `POST /api/v1/agents/lesson` - Generate comprehensive lesson
- `POST /api/v1/agents/activity` - Generate interactive React activity

### Data
- `GET /api/v1/data/students` - List students
- `GET /api/v1/data/tutors` - List tutors
- `GET /api/v1/data/strategies/{student_id}` - Student's strategies
- `GET /api/v1/data/lessons/{student_id}` - Student's lessons

### Collaborative Editing
- `POST /api/v1/content/save-version` - Save edited content
- `GET /api/v1/content/versions/{type}/{id}` - Version history
- `POST /api/v1/activity/chat` - Conversational activity editing

### Self-Improvement
- `POST /api/v1/reflection/analyze` - Trigger reflection analysis
- `GET /api/v1/reflection/insights/{agent_type}` - Get learning insights

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI 0.109.0 |
| Database | Supabase (PostgreSQL) |
| AI Models | Google Gemini 3.0 Flash, Perplexity Sonar, Gemini 3.0 Flash |
| Tracing | Weave (W&B) |
| Sandboxes | Daytona |
| Async | httpx, asyncio |

## 📝 License

Portfolio project for WaveHacks 2 2025 - Best Self-Improving Agent Track
