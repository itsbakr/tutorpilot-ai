---
name: Production-Ready TutorPilot
overview: Complete UX/UI redesign using Awn's design system (Clash Display font, glass cards, animations) with white/red color scheme, plus full user flow including onboarding, all agent creator pages, content detail pages with version history, content library, and analytics dashboard.
todos:
  - id: design-system
    content: "Create design system: globals.css with Awn styling + white/red colors"
    status: completed
  - id: ui-components
    content: "Build UI component library: GlassCard, Button, Input, Badge, Modal, Toast"
    status: completed
  - id: app-shell
    content: Redesign AppShell with glass navigation and animated sidebar
    status: completed
  - id: auth-redesign
    content: Redesign auth pages (login, signup, forgot-password) with premium styling
    status: completed
  - id: onboarding
    content: Create multi-step onboarding flow for new tutors
    status: completed
  - id: dashboard
    content: Complete dashboard redesign with gradient banner and AI performance
    status: completed
  - id: students
    content: Redesign student management pages (list, detail, new/edit)
    status: completed
  - id: strategy-creator
    content: Redesign Strategy Creator with streaming output and self-evaluation
    status: completed
  - id: lesson-creator
    content: Redesign Lesson Creator with agent handoff visualization
    status: completed
  - id: activity-creator
    content: Redesign Activity Creator with sandbox preview and chat interface
    status: completed
  - id: content-detail
    content: Build content detail pages with version history (strategies/lessons/activities)
    status: completed
  - id: library
    content: Build unified content library with search and filters
    status: completed
  - id: analytics
    content: Build analytics dashboard with charts and learning insights
    status: completed
  - id: settings
    content: Redesign settings page with profile, account, and preferences tabs
    status: completed
  - id: backend-apis
    content: Add missing backend APIs for content listing and analytics
    status: completed
---

# TutorPilot Production-Ready Transformation

## Overview

Transform TutorPilot into a polished, production-ready platform by adopting Awn's premium design system (with white/red colors) and completing all user flows for tutors.

---

## Phase 1: Design System Foundation

### 1.1 Global Styles and Theming

Update [`frontend/app/globals.css`](frontend/app/globals.css) to adopt Awn's design patterns:

- **Font**: Clash Display (premium variable font)
- **Colors**: Replace purple/blue with red theme:
    - Primary: `#DC2626` (red-600), `#EF4444` (red-500), `#B91C1C` (red-700)
    - Accent: `#F59E0B` (gold for highlights)
    - Background: White (`#FFFFFF`) with subtle gray (`#F8FAFC`)
- **Effects**: Gradient mesh backgrounds, glass cards, custom scrollbars
- **Animations**: Fade-in-up, float, stagger children

### 1.2 Core Components Library

Create reusable premium components in `frontend/components/ui/`:

| Component | Purpose |

|-----------|---------|

| `GlassCard.tsx` | Premium card with backdrop blur and border |

| `Button.tsx` | Primary/secondary/ghost variants with hover states |

| `Input.tsx` | Styled form inputs with focus rings |

| `Badge.tsx` | Status badges and tags |

| `Modal.tsx` | Dialog with animations |

| `Toast.tsx` | Notification system |

| `LoadingSpinner.tsx` | Branded loading states |

| `Skeleton.tsx` | Content loading placeholders |

### 1.3 Layout Components

Redesign [`frontend/components/AppShell.tsx`](frontend/components/AppShell.tsx):

- Glass navigation header with gradient mesh background
- Animated sidebar with icon + text navigation
- Mobile-responsive drawer navigation
- User profile dropdown with sign out

---

## Phase 2: Authentication and Onboarding

### 2.1 Auth Page Redesign

Redesign all auth pages with Awn's premium styling:

- [`frontend/app/auth/login/page.tsx`](frontend/app/auth/login/page.tsx) - Glass card login form
- [`frontend/app/auth/signup/page.tsx`](frontend/app/auth/signup/page.tsx) - Multi-field signup
- [`frontend/app/auth/forgot-password/page.tsx`](frontend/app/auth/forgot-password/page.tsx) - Password reset

Design elements:

- Split layout (branding left, form right)
- Animated gradient mesh background
- Glass card forms with Framer Motion
- Social proof / feature highlights

### 2.2 Tutor Onboarding Flow (NEW)

Create `frontend/app/onboarding/page.tsx` - Multi-step wizard:

```
Step 1: Welcome
  - Personalized greeting
  - Platform overview animation

Step 2: Teaching Profile
  - Name confirmation
  - Teaching style selection (cards)
  - Education system dropdown

Step 3: First Student (Optional)
  - Quick student creation form
  - Skip option

Step 4: Ready to Go
  - Success animation
  - Quick tour highlights
  - CTA to dashboard
```

Backend: Add `PUT /api/v1/auth/onboarding` endpoint for profile completion.

---

## Phase 3: Dashboard and Navigation

### 3.1 Dashboard Redesign

Completely redesign [`frontend/app/dashboard/page.tsx`](frontend/app/dashboard/page.tsx):

**Header Section:**

- Gradient banner with animated mesh background
- Personalized welcome with time-based greeting
- Quick stats row (Students, Strategies, Lessons, Activities)

**Quick Actions:**

- Three glass cards for agent creators
- Hover animations with icon scale
- Direct links with arrow indicators

**AI Performance Card:**

- Dark gradient card (like Awn's dark sections)
- Average score visualization with animated progress bar
- Improvement trend with sparkline
- Link to full analytics

**Recent Content:**

- Tabbed view (Strategies | Lessons | Activities)
- Card list with thumbnails and metadata
- Quick action buttons

**Students Preview:**

- Top 5 students with avatars
- Quick link to full list

### 3.2 Navigation Redesign

Update AppShell with premium navigation:

**Desktop Sidebar:**

- Logo with "AI" badge (like Awn)
- Icon + label navigation items
- Active state with red highlight
- Collapsible to icons only

**Mobile:**

- Bottom navigation bar
- Hamburger menu with slide-out drawer

---

## Phase 4: Student Management

### 4.1 Students List Page

Redesign [`frontend/app/students/page.tsx`](frontend/app/students/page.tsx):

- Search bar with real-time filtering
- Filter dropdowns (Grade, Subject)
- Grid of student cards with:
    - Avatar with initials
    - Name, grade, subject
    - Learning style badge
    - Content count indicators
    - Hover state with view action

### 4.2 Student Detail Page

Enhance [`frontend/app/students/[id]/page.tsx`](frontend/app/students/[id]/page.tsx):

**Profile Header:**

- Large avatar with gradient background
- Name, grade, subject prominently displayed
- Edit profile button

**Tabbed Content:**

- Overview (learning profile, interests)
- Strategies (list with create new)
- Lessons (list with create new)
- Activities (gallery with sandbox links)

### 4.3 Add/Edit Student

Redesign [`frontend/app/students/new/page.tsx`](frontend/app/students/new/page.tsx):

- Multi-section form with clear groupings
- Interests as tag input
- Learning objectives as list builder
- Real-time validation
- Success animation on save

---

## Phase 5: Agent Creator Pages (Core Product)

### 5.1 Strategy Creator

Complete redesign of [`frontend/app/strategy/page.tsx`](frontend/app/strategy/page.tsx):

**Left Panel - Configuration:**

- Student selector (searchable dropdown)
- Subject input
- Duration (weeks) selector
- Generate button with loading state

**Right Panel - Results:**

- Streaming output with markdown rendering
- Self-evaluation card showing 5 criteria scores
- Weaknesses and improvements list
- Action buttons: Edit, Save, Share

**Features:**

- Real-time generation progress indicator
- Version history sidebar
- Export options (PDF, Markdown)

### 5.2 Lesson Creator

Redesign [`frontend/app/lesson/page.tsx`](frontend/app/lesson/page.tsx):

**Configuration Panel:**

- Student selector
- Strategy selector (optional) with week dropdown
- Topic input (auto-fills from strategy)
- Duration slider

**Results Panel:**

- Active learning framework visualization
- Section tabs (Overview, Pre-Class, In-Class, Homework)
- Self-evaluation scores
- Rich content with sources

**Agent Handoff Visualization:**

- Show context flowing from strategy
- Highlight reused sources

### 5.3 Activity Creator

Redesign [`frontend/app/activity/page.tsx`](frontend/app/activity/page.tsx):

**Configuration:**

- Student and lesson selectors
- Activity description input
- Generate button

**Results - Split View:**

- Left: Generated code with syntax highlighting
- Right: Live sandbox preview (iframe)

**Chat Interface:**

- Below the preview
- Message input for modifications
- Chat history with agent responses
- Auto-redeploy on changes

**Self-Evaluation:**

- 6 criteria scores (Educational Value, Engagement, etc.)
- Code quality indicator
- Deployment status (success/failed/attempts)

---

## Phase 6: Content Detail and Editing Pages

### 6.1 Strategy Detail Page (NEW)

Create `frontend/app/strategies/[id]/page.tsx`:

**View Mode:**

- Full strategy content rendered as rich text
- Self-evaluation summary card
- Week-by-week accordion view

**Edit Mode:**

- Rich text editor (TipTap) integration
- Edit notes field (why you're editing)
- Save creates new version

**Version History Sidebar:**

- List of all versions
- Timestamp, editor name, edit notes
- Click to view/restore previous version
- Diff view (optional)

### 6.2 Lesson Detail Page (NEW)

Create `frontend/app/lessons/[id]/page.tsx`:

- Similar structure to Strategy detail
- Section-based editing
- Version history
- Link to parent strategy (if any)
- Link to create activity from lesson phase

### 6.3 Activity Detail Page (NEW)

Create `frontend/app/activities/[id]/page.tsx`:

**Header:**

- Title, status badge, sandbox link

**Main Content:**

- Sandbox iframe (prominent)
- Code viewer with copy button

**Chat History:**

- Full conversation with agent
- Continue conversation to iterate

**Actions:**

- Redeploy sandbox
- Edit code directly (optional)
- View self-evaluation

---

## Phase 7: Content Library

### 7.1 Unified Library Page

Redesign [`frontend/app/library/page.tsx`](frontend/app/library/page.tsx):

**Filter Bar:**

- Content type tabs (All | Strategies | Lessons | Activities)
- Student filter dropdown
- Date range picker
- Search input

**Content Grid:**

- Cards with type indicator (icon + color)
- Thumbnail/preview
- Title, student name, date
- Quick actions (View, Edit, Delete)

**List/Grid Toggle:**

- Switch between card grid and table view

### 7.2 Search Functionality

- Full-text search across titles and content
- Filter by:
    - Content type
    - Student
    - Date created
    - Self-evaluation score range

---

## Phase 8: Analytics Dashboard

### 8.1 Analytics Page

Enhance [`frontend/app/analytics/page.tsx`](frontend/app/analytics/page.tsx):

**Overview Cards:**

- Total generations
- Average self-evaluation score
- Improvement percentage
- Active students

**AI Performance Chart:**

- Line graph: Score over time
- Bar chart: Score by agent type
- Trend indicators

**Learning Insights Panel:**

- Recent insights from reflection loop
- Pattern recognition results
- Applicability tags

**Student Progress:**

- Per-student content count
- Average scores by student
- Activity engagement metrics

---

## Phase 9: Settings

### 9.1 Settings Page

Redesign [`frontend/app/settings/page.tsx`](frontend/app/settings/page.tsx):

**Tabbed Interface:**

**Profile Tab:**

- Name, email (read-only)
- Teaching style selection
- Education system
- Avatar upload (optional)

**Account Tab:**

- Change password
- Delete account (with confirmation)

**Preferences Tab:**

- Default generation settings
- Notification preferences
- Theme (future: dark mode)

---

## Technical Implementation

### Dependencies to Add

```json
{
  "framer-motion": "^12.x",
  "@heroicons/react": "^2.x",
  "recharts": "^2.x" // for analytics charts
}
```

### File Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   └── forgot-password/
│   ├── onboarding/
│   ├── dashboard/
│   ├── students/
│   │   ├── [id]/
│   │   └── new/
│   ├── strategy/
│   ├── strategies/[id]/
│   ├── lesson/
│   ├── lessons/[id]/
│   ├── activity/
│   ├── activities/[id]/
│   ├── library/
│   ├── analytics/
│   └── settings/
├── components/
│   ├── ui/           # Reusable primitives
│   ├── layout/       # AppShell, Navigation
│   ├── agents/       # Agent-specific components
│   └── shared/       # Version history, evaluation cards
└── lib/
    └── api.ts        # Updated API client
```

### API Additions

| Endpoint | Purpose |

|----------|---------|

| `PUT /api/v1/auth/onboarding` | Complete onboarding |

| `GET /api/v1/strategies` | List all strategies |

| `GET /api/v1/strategies/{id}` | Strategy detail |

| `GET /api/v1/lessons` | List all lessons |

| `GET /api/v1/lessons/{id}` | Lesson detail |

| `GET /api/v1/activities` | List all activities |

| `GET /api/v1/activities/{id}` | Activity detail |

| `GET /api/v1/analytics/overview` | Dashboard stats |

| `GET /api/v1/analytics/performance` | AI performance data |

---

## Implementation Order

1. **Design System** (globals.css, UI components)
2. **AppShell and Navigation** (layout foundation)
3. **Auth Pages Redesign** (login, signup, forgot-password)
4. **Onboarding Flow** (new page + backend)
5. **Dashboard Redesign**
6. **Student Management** (list, detail, new)
7. **Agent Creators** (strategy, lesson, activity)
8. **Content Detail Pages** (strategies/[id], lessons/[id], activities/[id])
9. **Content Library**
10. **Analytics Dashboard**
11. **Settings Page**