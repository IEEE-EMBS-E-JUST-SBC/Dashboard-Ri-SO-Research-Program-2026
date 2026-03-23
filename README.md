<div align="center">

<img src="public/logo.jpg" alt="Ri-Sō Logo" width="120" style="border-radius:50%"/>

# Ri-Sō 理創
### IEEE E-JUST EMBS SBC · Research Program 2026

*A structured 6-phase biomedical engineering research program platform*  
*Live-synced with Google Sheets · Gemini/Groq AI-powered applicant review · Role-based dashboards*

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Google Sheets](https://img.shields.io/badge/Google%20Sheets-Live%20Backend-34A853?logo=googlesheets&logoColor=white)](https://sheets.google.com)
[![Groq AI](https://img.shields.io/badge/Groq%20AI-Free%20Tier-F55036?logo=groq&logoColor=white)](https://console.groq.com)

---

</div>

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Google Sheets Setup](#-google-sheets-setup)
- [AI Setup (Free Groq Key)](#-ai-setup-free-groq-key)
- [Apps Script Setup](#-apps-script-setup)
- [Project Structure](#-project-structure)
- [User Roles](#-user-roles)
- [Sheets Architecture](#-sheets-architecture)
- [Filtration & Scoring System](#-filtration--scoring-system)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

---

## 🌟 Overview

**Ri-Sō 理創** (Japanese: "Research Creation") is a full-featured research program management platform for the IEEE E-JUST EMBS Student Branch Chapter. It manages the complete lifecycle of student researchers — from application and filtration through mentorship, IEEE paper drafting, and international competition entry.

```
📢 Recruitment → 🔍 Filtration → 📚 Training → 🤝 Mentorship → ⚡ Implementation → 📄 Publication
```

**Everything is live-synced with Google Sheets** — no separate database needed.

---

## ✨ Features

### 🔐 Authentication
- Login directly from your **Google Sheets `Users` tab** — email + password verified server-side
- Role-based routing: `superadmin` → `mentor` → `participant`
- Session persistence via `sessionStorage`
- Graceful offline fallback to local seed data

### 👤 Three Role Dashboards

| Role | Capabilities |
|------|-------------|
| **Super Admin** | Full program control, applicant review, track assignment, resource management |
| **Mentor** | Mentee management, meeting scheduler, paper review portal, progress tracking |
| **Participant** | Phase progress, training modules, research hub, novelty tool, competitions |

### 🔍 AI-Powered Filtration Center
- Loads applicants **live from Google Form responses** (`Applications` sheet)
- **7-criteria competitive scoring** rubric (100 pts total)
- **Groq AI analysis** (free, 90 req/min) — scores essays, gives strengths/weaknesses, recommends Accept/Waitlist/Reject
- **CV embed** — Google Drive CVs render directly in the panel via `<iframe>`
- **Always re-editable decisions** — no one-shot lock-in
- **Per-admin columns** — `Nada Decision`, `Nada Score`, `Nada Note` auto-created in Applications sheet
- See all other reviewers' decisions in one view

### 📊 Live Google Sheets Sync
- All actions push to Sheets in real-time
- `updateByMatch` — updates existing rows without creating duplicates
- Auto-creates new columns on first use (e.g. new admin review columns)
- Activity log tracks every push

---

## 🛠 Tech Stack

```
Frontend    React 19 + Vite 8
Styling     Pure CSS-in-JS (no Tailwind, no UI lib) — custom design system
Backend     Google Apps Script (deployed as Web App)
Database    Google Sheets (via REST proxy)
AI          Groq API — llama-3.1-8b-instant (FREE, 90 req/min)
Fonts       DM Sans + DM Mono + Fraunces (Google Fonts)
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-org/riso-dashboard.git
cd riso-dashboard
npm install
```

### 2. Add Your Logo

Place your logo file at:
```
public/logo.jpg
```
It renders in the navbar (52px), hero section (180px), and sign-in page (64px).

### 3. Configure the Proxy

In `vite.config.js`, replace the Apps Script deployment ID:

```js
rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/YOUR_DEPLOYMENT_ID/exec')
```

### 4. Add Your Groq Key

In `src/App.jsx`, find:
```js
const GROQ_KEY = ""; // ← paste your key here
```
Get your free key at [console.groq.com/keys](https://console.groq.com/keys) — no credit card needed.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 📊 Google Sheets Setup

### Required Spreadsheet ID

The app is configured for spreadsheet:
```
1AMkHfFLSpTDY8JvrMbJrkzA628rFbpAyXFvWTjQI1UU
```
Update `SPREADSHEET_ID` in `Code.gs` if you use a different spreadsheet.

### Required Sheets (Tabs)

Create these tabs in your spreadsheet:

| Sheet Name | Purpose | Key Columns |
|-----------|---------|-------------|
| `Users` | Admin/mentor/participant accounts | `email`, `password`, `role`, `name` |
| `Applications` | Google Form responses | All form fields + auto-added review columns |
| `Filtration` | Legacy filtration log | Auto-created |
| `Meetings` | Mentor meeting records | Auto-created |
| `PaperReviews` | IEEE draft feedback | Auto-created |
| `NoveltyAssessments` | Novelty tool submissions | Auto-created |
| `ResourceRequests` | Hardware/software requests | Auto-created |
| `CompetitionEnrollments` | Competition entries | Auto-created |
| `CalendarRegistrations` | Webinar registrations | Auto-created |
| `TrackAssignments` | Track engine results | Auto-created |
| `Capstone` | Capstone project submissions | Auto-created |
| `ResearchHub` | Research workspace saves | Auto-created |
| `ProfileUpdates` | Profile change log | Auto-created |

> **Note:** Most sheets are auto-created by the Apps Script on first use. Only `Users` and `Applications` need to exist upfront.

### Users Sheet Format

Your `Users` sheet must have these column headers (row 1):

```
id | email | password | role | name | avatar | phase | track | trackLabel | gpa | ...
```

The `role` column must contain exactly: `superadmin`, `mentor`, or `participant` (lowercase).

### Applications Sheet

This is your **Google Form responses sheet**. The app reads these columns:
- `Timestamp`, `Name`, `University`, `Email`, `Phone`, `Student ID`
- `Gender`, `LinkedIn`, `CV Link`, `Faculty`, `Department`, `Academic Year`, `GPA`
- `Target Track`, `Programming Skill`, `Math/Stats Skill`, `Research Motivation`
- `Status`, `Reviewed`

Admin review columns are **auto-created** when a reviewer saves their first decision:
- `{AdminName} Decision` — Accept / Waitlist / Reject
- `{AdminName} Score` — score out of 100
- `{AdminName} Note` — reviewer notes
- `{AdminName} AI` — Groq AI recommendation
- `{AdminName} Scores` — JSON breakdown of 7 criteria scores
- `{AdminName} ReviewedAt` — timestamp

---

## 🤖 AI Setup (Free Groq Key)

Groq provides **free AI inference** at 90 requests/minute — no credit card required.

### Step 1: Get Your Free Key

1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up (free, takes 30 seconds)
3. Click **"Create API Key"**
4. Copy the key (starts with `gsk_...`)

### Step 2: Add to App

Open `src/App.jsx` and find line:
```js
const GROQ_KEY = ""; // ← paste your key here
```

Replace with:
```js
const GROQ_KEY = "gsk_your_key_here";
```

### What Groq Analyzes

For each applicant, the AI evaluates:
- **Q1 (Problem Solving)** — depth, systematic approach, technical substance
- **Q2 (Methodology)** — first-week plan quality, clinical domain awareness
- **Q3 (Goals)** — IEEE publication alignment, specificity
- **Track Fit** — maps evidence to chosen biomedical track
- **Portfolio** — only from provided CV/LinkedIn text (cannot open URLs)

Output: scores for all 7 criteria, strengths, weaknesses, evidence bullets, admission note.

> **Model:** `llama-3.1-8b-instant` — fast, accurate, and free at this scale.

---

## ⚙️ Apps Script Setup

### Step 1: Open Apps Script

1. Open your Google Spreadsheet
2. Click **Extensions → Apps Script**
3. Delete the default `myFunction()` code

### Step 2: Paste Code

Copy the entire contents of `Code.gs` and paste it into the Apps Script editor.

### Step 3: Deploy as Web App

1. Click **Deploy → New Deployment**
2. Click the gear icon ⚙️ → **Web App**
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone ← **(critical — must be "Anyone", not "Anyone with Google account")**
4. Click **Deploy**
5. Copy the Web App URL

### Step 4: Update vite.config.js

```js
// vite.config.js
server: {
  proxy: {
    '/sheets-api': {
      target: 'https://script.google.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(
        /^\/sheets-api/,
        '/macros/s/YOUR_NEW_DEPLOYMENT_ID/exec'  // ← replace this
      ),
      secure: true,
    }
  }
}
```

> ⚠️ **Important:** Every time you modify `Code.gs`, you must **create a new deployment** (not just save). Old deployments serve cached code.

### Apps Script API Reference

| Action | Method | Description |
|--------|--------|-------------|
| `get` | GET `?sheet=SheetName` | Fetch all rows as JSON array |
| `login` | POST `{action:"login", email, password}` | Authenticate user |
| `push` | POST `{action:"push", sheet, data}` | Append new row (auto-creates columns) |
| `update` | POST `{action:"update", sheet, rowId, data}` | Update row by `id` column |
| `updateByMatch` | POST `{action:"updateByMatch", sheet, matchCol, matchVal, data}` | Update row by any column match (auto-creates columns) |
| `delete` | POST `{action:"delete", sheet, rowId}` | Delete row by `id` |

---

## 📁 Project Structure

```
riso-dashboard/
├── public/
│   └── logo.jpg              ← your program logo
├── src/
│   ├── App.jsx               ← entire application (1 file)
│   ├── main.jsx              ← React entry point
│   ├── index.css             ← global reset
│   └── App.css               ← (legacy, not used)
├── Code.gs                   ← Google Apps Script backend
├── vite.config.js            ← Vite config + proxy
├── index.html                ← HTML shell
└── package.json
```

> The entire frontend is one file (`App.jsx` ~2700 lines) containing all CSS-in-JS, all components, all business logic. This is intentional for this project's scope.

---

## 👤 User Roles

### 🔴 Super Admin (`superadmin`)
- **Dashboard** — live stats from Applications sheet, phase/track distribution
- **Filtration Center** — full AI-powered applicant review with CV embed
- **User Management** — CRUD for participants, mentors, admins
- **Track Assignment Engine** — runs composite scoring algorithm
- **Resource Management** — track procurement status
- **Metrics Dashboard** — publication rates, competition performance
- **Sheets Config** — activity log, connection test

### 🟢 Mentor (`mentor`)
- **Dashboard** — mentee overview, avg progress
- **My Mentees** — detailed profile cards
- **Meeting Scheduler** — schedule + save to Sheets
- **Paper Review Portal** — 3-round IEEE draft review
- **Progress Tracking** — mentee scorecard

### 🔵 Participant (`participant`)
- **Dashboard** — phase timeline, webinars, connected tools
- **My Progress** — 6-phase tracker with scores
- **Training Modules** — video lectures, reading list, assignments, capstone
- **Research Hub** — workspace, Overleaf/GitHub links, draft rounds
- **Novelty Tool** — 6-item checklist + contribution statement
- **Competitions** — MICCAI, BCI Award, NHID enrollment
- **Request Resources** — GPU, lab access, hardware
- **Enrichment Calendar** — webinars & workshops

---

## 📊 Sheets Architecture

```
Google Spreadsheet
│
├── Users                 ← authentication source
│   id | email | role | name | password | ...
│
├── Applications          ← Google Form responses + review columns
│   Timestamp | Name | Email | GPA | ... | Nada Decision | Nada Score | ...
│
├── Meetings              ← mentor meeting records
├── PaperReviews          ← IEEE draft feedback
├── NoveltyAssessments    ← novelty tool submissions
├── ResourceRequests      ← hardware/software requests
├── CompetitionEnrollments
├── CalendarRegistrations
├── TrackAssignments      ← track engine output
├── Capstone              ← capstone project data
└── ResearchHub           ← research workspace saves
```

---

## 🏆 Filtration & Scoring System

### 7-Criteria Rubric (100 pts)

| Criterion | Weight | Auto-scored? | Description |
|-----------|--------|-------------|-------------|
| 🎓 Academic Standing | 15 | ✅ Yes | GPA + year + faculty relevance |
| 💻 Programming Skills | 15 | ✅ Yes | Self-assessment + library evidence |
| 📐 Mathematical Maturity | 10 | ✅ Yes | Linear algebra, probability, optimization |
| 🧩 Problem-Solving Essay | 20 | 🤖 AI | Q1: real challenge, systematic approach |
| 🔬 Research Methodology | 20 | 🤖 AI | Q2: first-week plan, clinical awareness |
| 🚀 Goals & Vision | 10 | 🤖 AI | Q3: IEEE publication alignment |
| 🎯 Motivation & Track Fit | 10 | 🤖 AI | Track rationale + portfolio evidence |

### Decision Thresholds

| Score | Recommendation |
|-------|---------------|
| ≥ 75 | ✅ Accept |
| 55–74 | ◐ Waitlist |
| < 55 | ✗ Reject |

### Track Assignment Algorithm

```
Composite = (portfolioScore × 0.3) + (interviewScore × 0.3) + (GPA × 10 × 0.4)

If composite ≥ 85 AND max(mlScore, modelingScore, electronicsScore) ≥ 80:
  → TOP-TIER BYPASS: skip Phase III → directly to Phase IV Mentorship

Otherwise:
  → Assign to track with highest domain score:
    Track 1: AI & Machine Learning    (mlScore)
    Track 2: Modeling & Simulation    (modelingScore)
    Track 3: Biomedical Electronics   (electronicsScore)
```

---

## 🚢 Deployment

### Build

```bash
npm run build
```

Output goes to `dist/`. Deploy to any static host.

### Environment Note

The Vite dev proxy (`/sheets-api`) **only works during `npm run dev`**. For production, you have two options:

**Option A — Vercel/Netlify rewrite (recommended)**
```json
// vercel.json
{
  "rewrites": [
    {
      "source": "/sheets-api/:path*",
      "destination": "https://script.google.com/macros/s/YOUR_ID/exec/:path*"
    }
  ]
}
```

**Option B — Update SHEETS_URL directly**
```js
// In App.jsx, change:
const SHEETS_URL = "/sheets-api";
// to:
const SHEETS_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

---

## 🔧 Troubleshooting

### ❌ Dashboard is blank / empty after login

**Cause:** User object from Sheets is missing required fields.

**Fix:** Check your `Users` sheet has:
- `role` column with value `superadmin`, `mentor`, or `participant` (lowercase)
- `name` column (or `Name`) with the user's display name
- `email` column matching what you log in with

Open browser DevTools → Console for the yellow debug panel output.

---

### ❌ "No applications loaded" in Filtration Center

**Cause:** Sheet name mismatch or Apps Script not deployed correctly.

**Checklist:**
1. Sheet tab is named exactly **`Applications`** (capital A, no spaces)
2. `npm run dev` is running (proxy only works in dev mode)
3. Apps Script deployed as **"Anyone"** (not "Anyone with Google account")
4. You created a **new deployment** after updating the script (not just saved)

---

### ❌ AI analysis fails

**Cause:** Groq API key not set or invalid.

**Fix:**
1. Get free key at [console.groq.com/keys](https://console.groq.com/keys)
2. Set `const GROQ_KEY = "gsk_your_key_here";` in `App.jsx`
3. Check browser console for the specific error message

---

### ❌ Login fails with "Invalid email or password"

**Cause:** Sheets `login` action can't find user.

**Checklist:**
1. `Users` sheet has columns named exactly `email` and `password` (lowercase)
2. No extra spaces in the cell values
3. Apps Script has been redeployed after adding `login` action
4. Access is set to "Anyone" in deployment settings

---

### ❌ Admin decisions not saving to sheet

**Cause:** `updateByMatch` action not supported by old Apps Script deployment.

**Fix:** Replace your Apps Script with the latest `Code.gs` from this repo and **create a new deployment**.

---

## 📄 License

MIT — IEEE E-JUST EMBS SBC 2026

---

<div align="center">

Built with ❤️ for the **Ri-Sō 理創 Research Program 2026**  
IEEE Engineering in Medicine and Biology Society · E-JUST Student Branch Chapter

</div>
