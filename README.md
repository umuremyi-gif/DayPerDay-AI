# DayPerDay AI

AI-powered daily planning, goal tracking, and financial management application for individuals and businesses.

## Features

- **Daily Planner** — Create structured daily plans at 06:00 with tasks, priorities, time slots, and completion tracking
- **Evening Review** — Reflect on accomplishments, challenges, and improvements with AI-generated summaries
- **90-Day Goals** — Break ambitious goals into monthly milestones, weekly objectives, and daily tasks with AI assistance
- **Financial Tracking** — Record income, expenses, transfers, and savings with accurate server-side calculations
- **Financial Reports** — Daily, weekly, monthly, and custom-period reports with charts and CSV export
- **AI Coach** — Chat with a local AI (Ollama) for personalized productivity and financial insights
- **Achievements** — Earn gold, silver, and bronze trophies for consistent planning, reviews, savings, and goal completion
- **Notifications** — Configurable reminders for planning, reviews, and reports
- **Dark & Light Mode** — Beautiful, responsive design that works on phones, tablets, and desktops
- **Personal & Business** — Separate profiles for personal and business users

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, Recharts |
| Backend | Python, FastAPI |
| Database | Supabase (PostgreSQL with Row Level Security) |
| AI | Ollama (local model: qwen2.5:3b) |
| Auth | Supabase Auth (email/password) |

## Quick Start (Windows PowerShell)

### 1. Prerequisites

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org)
- **Python 3.10+**: Download from [python.org](https://python.org)
- **Ollama**: Download from [ollama.com](https://ollama.com)

### 2. Frontend Setup

```powershell
# Navigate to project root
cd path\to\project

# Install dependencies
npm install

# Create .env file (already created by Bolt)
# Verify .env contains:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# VITE_API_BASE_URL=http://localhost:8000

# Start the development server
npm run dev
```

The frontend runs at `http://localhost:5173`

### 3. Backend Setup

```powershell
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate it (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# If execution policy blocks, run:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install Python dependencies
pip install -r requirements.txt

# Copy environment file
Copy-Item .env.example .env

# Edit .env to match your Ollama settings (default is fine for local dev)

# Start the backend
python -m uvicorn main:app --reload --port 8000
```

The backend runs at `http://localhost:8000`
API documentation available at `http://localhost:8000/docs`

### 4. Ollama Setup (for AI features)

```powershell
# Install Ollama from https://ollama.com

# Pull the small quantized model (optimized for 8GB RAM)
ollama pull qwen2.5:3b

# Start the Ollama service
ollama serve
```

Ollama runs at `http://localhost:11434` by default.

**Note:** The AI features work only when the Python backend AND Ollama are both running. If either is unavailable, the app falls back to basic data-driven summaries (no fake AI responses).

### 5. Using the App

1. Open `http://localhost:5173` in your browser
2. Click "Get Started" to create an account
3. Choose Personal or Business account type
4. Start planning your day, tracking finances, and setting goals
5. Visit Settings to configure reminder times, currency, and AI settings
6. Visit the AI Coach page to verify Ollama connectivity

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/status` | Check Ollama availability |
| POST | `/api/ai/evening-summary` | Generate evening review summary |
| POST | `/api/ai/goal-breakdown` | Break 90-day goal into milestones |
| POST | `/api/ai/financial-analysis` | Analyze financial trends |
| POST | `/api/ai/coach` | AI coach chat |
| POST | `/api/finance/summary` | Calculate financial summary |
| POST | `/api/finance/accounting-profit` | Calculate accounting profit |
| POST | `/api/finance/category-breakdown` | Expense breakdown by category |
| POST | `/api/reports/generate` | Generate a periodic report |

Full interactive docs at `http://localhost:8000/docs` (FastAPI/OpenAPI)

## Database Schema

The app uses Supabase (PostgreSQL) with the following tables:

- `profiles` — User profile data (name, account type, timezone)
- `daily_plans` — Daily task plans
- `tasks` — Individual tasks within daily plans
- `evening_reviews` — End-of-day self-reflection
- `goals` — 90-day goal definitions
- `milestones` — Monthly milestones within goals
- `transactions` — Income, expenses, transfers, savings
- `accounts` — Financial accounts (cash, bank, mobile money, savings)
- `achievements` — Trophy/badge definitions (global)
- `user_achievements` — Achievements earned by users
- `notifications` — User notifications and reminders
- `user_preferences` — User settings (theme, times, AI config)
- `reports` — Generated periodic reports

All tables have Row Level Security (RLS) enabled — users can only access their own data.

## Background Scheduler

The Python backend includes a scheduler for automated reminders and reports:

| Schedule | Action |
|----------|--------|
| Daily 06:00 | Planning reminder |
| Daily 20:00 | Evening review reminder |
| Every 3 days | Productivity progress review |
| Weekly (Sunday 09:00) | Comprehensive weekly report |
| Monthly (1st, 09:00) | Monthly performance and financial report |
| Every 90 days | Long-term goal review |

Times are in the user's configured timezone.

## Financial Calculations

All financial math is performed in Python on the backend, never by AI:

- **Income**: Money earned or received
- **Expenses**: Money spent on goods, services, and operating costs
- **Net Cash Flow**: Income minus expenses for the period
- **Savings Balance**: Savings contributions minus withdrawals
- **Transfers**: NOT counted as income or expenses (movement between own accounts)
- **Accounting Profit**: Revenue minus recognized expenses

## Mobile Money Integration (Future)

The app is designed to support MTN Mobile Money, Airtel Money, and bank integrations in the future. Currently, a manual transaction mode is implemented. The backend has clean interfaces ready for API integration when provider credentials are available. API keys and secrets will be stored exclusively on the backend — users will never enter PINs or OTPs in the app.

## Browser Notifications

The app supports browser notifications when permission is granted. Note: browser notifications may not work when the browser is closed unless push notifications or another supported delivery system is configured. The backend scheduler handles server-side scheduling.

## Deployment Notes

- The frontend can be deployed to any static hosting service (Vercel, Netlify, etc.)
- The Python backend should be deployed to a server (Railway, Render, Fly.io, etc.)
- Ollama must run on a server accessible to the backend. For production, consider:
  - Running Ollama on a dedicated GPU server
  - Replacing the local Ollama with a hosted AI provider (OpenAI, Anthropic, etc.)
  - The AI endpoint is configurable via environment variables
- Supabase is cloud-hosted and requires no local setup

## Limitations

- AI features require Ollama running locally or on an accessible server
- Mobile money/bank API integrations are not yet connected (manual mode only)
- Push notifications (when browser is closed) require additional infrastructure
- The background scheduler runs only while the Python backend is running

## Project Structure

```
project/
├── src/                    # Frontend (React + Vite)
│   ├── components/         # Reusable UI components
│   ├── contexts/           # Auth and Theme contexts
│   ├── lib/                # Supabase client and utilities
│   └── pages/              # All application pages
├── backend/                # Python FastAPI backend
│   ├── main.py             # FastAPI app entry point
│   ├── routers/            # API route handlers
│   ├── services/           # Ollama AI service
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Backend environment template
├── supabase/               # Database migrations
├── .env                    # Frontend environment (Supabase + API URL)
└── README.md
```
