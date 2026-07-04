import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ─────────────────────────────────────────────
//  CONSTANTS & DATA
// ─────────────────────────────────────────────
const ROLES = {
  SUPERADMIN:           "superadmin",
  MENTOR:               "mentor",
  PARTICIPANT:          "participant",
  PROADMIN:             "proadmin",
  ASSOCIATE_RESEARCHER: "associate_researcher",
  TEAM_ADMIN:           "team_admin",   // team-level admin (also counts as member)
};
// ─────────────────────────────────────────────
//  TEAM REGISTRY  (from Riso_-_Teams.xlsx)
// ─────────────────────────────────────────────
const TEAMS = [
  { id:"A", challenge:"AutoPET V — Automated Lesion Segmentation in Whole-Body PET/CT", track:"Medical Imaging", meeting:"Monday 12:00 PM (GMT+3)" },
  { id:"B", challenge:"MRIxFields — Cross-Field MRI Translation & Harmonisation Challenge", track:"Medical Imaging", meeting:"Saturday 7:00 PM (GMT+3)" },
  { id:"C", challenge:"Learn2Reg — Medical Image Registration Challenge", track:"Medical Imaging", meeting:"Friday 3:00 PM (GMT+3)" },
  { id:"D", challenge:"AMPLIFAI — Annotated Multi-Phase Liver Imaging For AI", track:"Medical Imaging", meeting:"Saturday 9:00 PM (GMT+3)" },
  { id:"G", challenge:"EndoVis 2026 — Endoscopic Vision Challenge 2026", track:"Medical Imaging", meeting:"Monday 7:00 PM & Friday 7:00 PM (GMT+3)" },
  { id:"H", challenge:"Bioinformatics — TBD", track:"Bioinformatics", meeting:"Sunday 11:00 PM (GMT+3)" },
  { id:"K", challenge:"Bioinformatics — TBD", track:"Bioinformatics", meeting:"Sunday 11:00 PM (GMT+3)" },
  { id:"X", challenge:"BCI Annual Award 2026", track:"Biomedical Sensors", meeting:"TBD" },
  { id:"Y", challenge:"SteadiWrist (VitaNova)", track:"Biomedical Sensors", meeting:"Wednesday 6:00 PM (GMT+3)" },
  { id:"J", challenge:"BCI Annual Award 2026 — MS Disease Prediction + Treatment Plan", track:"Biomedical Sensors", meeting:"Monday 9:00 PM (GMT+3)" },
  { id:"Z", challenge:"Voice Loudness Trainer", track:"Biomedical Sensors", meeting:"Monday 6:00 PM (GMT+3)" },
];

// Helper: get team object for a user
const getTeam = (user) => TEAMS.find(t => t.id === (user?.teamId || user?.team || "")) || null;

// Local fallback seed — only used if Google Sheets is completely unreachable.
// In production, all users live in the "Users" sheet of your spreadsheet.
const INITIAL_USERS = [];

const PHASES = [
  { id:1, name:"Recruitment",    icon:"📢", desc:"Application & talent identification" },
  { id:2, name:"Filtration",     icon:"🔍", desc:"Technical assessment, portfolio, interviews" },
  { id:3, name:"Training",       icon:"📚", desc:"Lectures, assignments, capstone project" },
  { id:4, name:"Mentorship",     icon:"🤝", desc:"Weekly meetings & research direction" },
  { id:5, name:"Implementation", icon:"⚡", desc:"Experiments, data collection, validation" },
  { id:6, name:"Publication",    icon:"📄", desc:"IEEE conference paper submission" },
];

const COMPETITIONS = [
  { id:"C001", name:"BCI Award 2026",    deadline:"2026-07-15", track:3, status:"Open",         enrolled:2 },
  { id:"C002", name:"NHID Competition",  deadline:"2026-08-30", track:2, status:"Open",         enrolled:1 },
  { id:"C003", name:"MICCAI Challenges", deadline:"2026-06-01", track:1, status:"Closing Soon", enrolled:3 },
];

const WEBINARS = [
  { id:"W001", title:"Scientific Writing for IEEE Journals",  date:"2026-03-10", type:"Workshop", speaker:"Dr. Chen",     registered:18 },
  { id:"W002", title:"LaTeX Mastery for Research Papers",     date:"2026-03-17", type:"Webinar",  speaker:"Dr. El-Amin", registered:22 },
  { id:"W003", title:"Research Ethics in Biomedical AI",      date:"2026-03-24", type:"Workshop", speaker:"Dr. Patel",    registered:15 },
  { id:"W004", title:"Statistical Methods in Clinical Data",  date:"2026-03-31", type:"Webinar",  speaker:"Dr. Youssef", registered:19 },
];

// ─────────────────────────────────────────────
//  GOOGLE SHEETS API HELPER
// ─────────────────────────────────────────────
// const SHEETS_URL = import.meta.env.VITE_API_URL;
// const SHEETS_URL = import.meta.env.DEV
//   ? "/sheets-api"
//   : import.meta.env.VITE_API_URL;

const SHEETS_URL = "/api/google-sheets";

// ── All communication with Google Apps Script ──
const sheetsAPI = {
  async get(sheet) {
    try {
      const r = await fetch(`${SHEETS_URL}?action=get&sheet=${encodeURIComponent(sheet)}`);
      if (!r.ok) return null;
      const json = await r.json();
      return json?.data ?? json ?? null;
    } catch { return null; }
  },

  async login(email, password) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ action:"login", email, password })
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  async push(sheet, data) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ action:"push", sheet, data })
      });
      return await r.json();
    } catch { return { status:"offline" }; }
  },

  async update(sheet, rowId, data) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ action:"update", sheet, rowId, data })
      });
      return await r.json();
    } catch { return { status:"offline" }; }
  },

  // NEW: Update by matching a column value
  async updateByMatch(sheet, matchCol, matchVal, data) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ action:"updateByMatch", sheet, matchCol, matchVal, data })
      });
      return await r.json();
    } catch { return { status:"offline" }; }
  },
  async getByTeam(sheet, teamId) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getByTeam", sheet, teamId })
      });
      if (!r.ok) return [];
      const json = await r.json();
      const data = json?.data ?? [];
      // If backend returned results, use them. Otherwise fall back to full-sheet GET + client filter.
      if (data.length > 0) return data;
      const all = await this.get(sheet);
      return (all || []).filter(row => String(row.teamId||"").trim() === String(teamId).trim());
    } catch { return []; }
  },

  async voteSlot(meetingId, teamId, voterEmail, slot) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "voteSlot", sheet: "MeetingVotes", meetingId, teamId, voterEmail, slot })
      });
      return await r.json();
    } catch { return { status: "offline" }; }
  },

  async gradeTask(taskId, score, feedback, status) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "gradeTask", sheet: "TeamTasks", taskId, score, feedback, status })
      });
      return await r.json();
    } catch { return { status: "offline" }; }
  },
};

// ─────────────────────────────────────────────
//  TRACK ASSIGNMENT ALGORITHM
// ─────────────────────────────────────────────
function assignTrack(s) {
  const composite = (s.portfolioScore*0.3) + (s.interviewScore*0.3) + (s.gpa*10*0.4);
  if (composite >= 85 && Math.max(s.mlScore,s.modelingScore,s.electronicsScore) >= 80)
    return { track:"BYPASS", phase:4, label:"Top-Tier: Direct to Mentorship", icon:"⭐" };
  const tracks = [
    { id:1, name:"AI & Machine Learning",    score:s.mlScore,          icon:"🧠" },
    { id:2, name:"Modeling & Simulation",    score:s.modelingScore,    icon:"⚗️" },
    { id:3, name:"Biomedical Electronics",   score:s.electronicsScore, icon:"🔬" },
  ];
  const best = tracks.reduce((a,b) => b.score>a.score ? b : a);
  return { track:best.id, phase:3, label:best.name, icon:best.icon };
}

// ─────────────────────────────────────────────
//  AUTH CONTEXT
// ─────────────────────────────────────────────
const AuthCtx = createContext(null);
const DataCtx = createContext(null);

// ─────────────────────────────────────────────
//  CSS
// ─────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,700;9..144,900&display=swap');

:root {
  --ink:     #0C1227;
  --ink2:    #3D4F7C;
  --ink3:    #6B7DB3;
  --mist:    #C7D2EC;
  --frost:   #E8EDF8;
  --snow:    #F4F7FF;
  --white:   #FFFFFF;
  --violet:  #5B3BF5;
  --violet2: #7B5CF5;
  --azure:   #1A6DFF;
  --teal:    #0EA5C5;
  --jade:    #0F9F6E;
  --amber:   #E8860A;
  --rose:    #E53E5C;
  --r1: linear-gradient(135deg,#5B3BF5,#1A6DFF);
  --r2: linear-gradient(135deg,#EDE9FE,#DBEAFE);
  --sh1: 0 1px 4px rgba(91,59,245,.1),0 1px 2px rgba(26,109,255,.07);
  --sh2: 0 4px 20px rgba(91,59,245,.16),0 2px 8px rgba(26,109,255,.1);
  --sh3: 0 12px 40px rgba(91,59,245,.22),0 4px 16px rgba(26,109,255,.12);
  --rad: 14px;
  --radL: 22px;
}
*{box-sizing:border-box;margin:0;padding:0}
body,#root{font-family:'DM Sans',sans-serif;background:var(--snow);color:var(--ink);min-height:100vh}

/* ── LANDING PAGE (LIGHT MODE) ──────────────── */
.landing{min-height:100vh;background:#F8F9FF;display:flex;flex-direction:column;overflow:hidden;position:relative}
.landing-bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 70% -5%,rgba(91,59,245,.08) 0%,transparent 65%),radial-gradient(ellipse 50% 40% at 5% 90%,rgba(26,109,255,.06) 0%,transparent 60%);pointer-events:none}
.landing-dots{position:absolute;inset:0;background-image:radial-gradient(rgba(91,59,245,.06) 1px,transparent 1px);background-size:32px 32px;pointer-events:none}

.lnav{display:flex;align-items:center;justify-content:space-between;padding:20px 48px;position:relative;z-index:10;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid rgba(91,59,245,.08)}
.lnav-logo{display:flex;align-items:center;gap:12px}
.lnav-logo-img{width:44px;height:44px;display:flex;align-items:center;justify-content:center}
.lnav-logo-text{display:flex;flex-direction:column;gap:1px}
.lnav-jp{font-family:'Fraunces',serif;font-size:22px;color:var(--ink);letter-spacing:-0.5px;line-height:1}
.lnav-en{font-size:9px;color:var(--ink3);letter-spacing:2px;text-transform:uppercase;font-weight:700}
.lnav-badge{background:var(--r2);border:1px solid rgba(91,59,245,.15);color:var(--violet);font-size:10px;font-weight:700;padding:5px 14px;border-radius:20px;letter-spacing:.5px}
.lnav-cta{display:flex;gap:10px}
.lnav-btn{padding:9px 22px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .2s}
.lnav-btn.solid{background:var(--r1);color:white;box-shadow:0 3px 14px rgba(91,59,245,.28)}
.lnav-btn.solid:hover{transform:translateY(-1px);box-shadow:0 5px 22px rgba(91,59,245,.42)}

.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:72px 40px 80px;position:relative;z-index:10}
.hero-chip{display:inline-flex;align-items:center;gap:8px;background:rgba(91,59,245,.07);border:1px solid rgba(91,59,245,.15);color:var(--violet);font-size:11px;font-weight:700;padding:7px 18px;border-radius:30px;margin-bottom:32px;letter-spacing:.5px}
.hero-chip span{width:6px;height:6px;border-radius:50%;background:#0F9F6E;display:inline-block;animation:blink 2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.hero-title{font-family:'Fraunces',serif;font-size:clamp(48px,7vw,88px);color:var(--ink);line-height:.95;letter-spacing:-2px;margin-bottom:12px}
.hero-title em{font-style:normal;background:var(--r1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{font-size:clamp(15px,2vw,18px);color:var(--ink3);max-width:540px;line-height:1.6;margin-bottom:44px;font-weight:400}
.hero-btns{display:flex;justify-content:center}
.hero-btn{padding:13px 36px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .25s;width:auto;display:inline-block}
.hero-btn.main{background:var(--r1);color:white;box-shadow:0 6px 30px rgba(91,59,245,.35)}
.hero-btn.main:hover{transform:translateY(-2px);box-shadow:0 10px 40px rgba(91,59,245,.5)}

.hero-stats{display:flex;gap:48px;margin-top:64px;justify-content:center;flex-wrap:wrap}
.hstat{text-align:center}
.hstat-val{font-family:'Fraunces',serif;font-size:36px;color:var(--ink);letter-spacing:-1px}
.hstat-label{font-size:11px;color:var(--ink3);font-weight:600;letter-spacing:.5px;margin-top:3px}
.hstat-divider{width:1px;background:var(--mist);align-self:stretch}

.features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:0 48px 72px;position:relative;z-index:10;max-width:1100px;margin:0 auto;width:100%}
.feat{background:white;border:1px solid var(--frost);border-radius:var(--radL);padding:24px;transition:all .25s;box-shadow:var(--sh1)}
.feat:hover{border-color:rgba(91,59,245,.2);box-shadow:var(--sh2);transform:translateY(-3px)}
.feat-icon{font-size:28px;margin-bottom:14px}
.feat-title{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:6px}
.feat-desc{font-size:12px;color:var(--ink3);line-height:1.6}

/* ── AUTH PAGE (LIGHT MODE) ─────────────────── */
.auth-page{min-height:100vh;background:#F8F9FF;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.auth-page-bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 60% 0%,rgba(91,59,245,.07),transparent 65%),radial-gradient(ellipse 40% 40% at 0% 100%,rgba(26,109,255,.05),transparent 60%);pointer-events:none}
.auth-page-dots{position:absolute;inset:0;background-image:radial-gradient(rgba(91,59,245,.06) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}
.auth-box{background:white;border:1px solid var(--frost);border-radius:var(--radL);padding:40px;width:100%;max-width:400px;position:relative;z-index:10;box-shadow:0 8px 40px rgba(91,59,245,.1)}
.auth-logo{text-align:center;margin-bottom:28px}
.auth-logo-jp{font-family:'Fraunces',serif;font-size:28px;color:var(--ink);letter-spacing:-0.5px;margin-top:8px}
.auth-logo-en{font-size:10px;color:var(--ink3);letter-spacing:2px;text-transform:uppercase;margin-top:4px}
.auth-label{font-size:11px;font-weight:700;color:var(--ink2);letter-spacing:.5px;margin-bottom:7px;display:block;text-transform:uppercase}
.auth-input{width:100%;padding:11px 14px;background:var(--snow);border:1.5px solid var(--frost);border-radius:10px;color:var(--ink);font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color .2s,box-shadow .2s;margin-bottom:16px}
.auth-input::placeholder{color:var(--mist)}
.auth-input:focus{border-color:var(--violet);box-shadow:0 0 0 3px rgba(91,59,245,.1);background:white}
.auth-error{background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;font-size:12px;padding:10px 14px;border-radius:8px;margin-bottom:16px}
.auth-hint{text-align:center;font-size:12px;color:var(--ink3);margin-top:20px;line-height:1.8;background:var(--snow);border-radius:10px;padding:12px}
.auth-hint strong{color:var(--ink2);font-weight:700}
.auth-back{display:flex;align-items:center;gap:6px;color:var(--ink3);font-size:13px;cursor:pointer;transition:color .2s;background:none;border:none;font-family:'DM Sans',sans-serif;padding:0;margin-bottom:24px;font-weight:500}
.auth-back:hover{color:var(--violet)}

/* ── APP SHELL ──────────────────────────────── */
.app{display:flex;min-height:100vh}
.sidebar{width:260px;min-height:100vh;background:white;border-right:1px solid var(--frost);display:flex;flex-direction:column;position:fixed;left:0;top:0;bottom:0;z-index:100;overflow-y:auto;box-shadow:2px 0 16px rgba(91,59,245,.05)}
.slogo{padding:22px 20px 16px;border-bottom:1px solid var(--frost)}
.slogo-badge{background:var(--r1);color:white;font-size:9px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.5px;display:inline-block;margin-bottom:8px}
.slogo-title{font-family:'Fraunces',serif;font-size:22px;background:var(--r1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.slogo-sub{font-size:10px;color:var(--ink3);letter-spacing:.3px;margin-top:2px}

.snav{padding:10px 10px 0;flex:1}
.snav-label{font-size:9px;font-weight:700;color:var(--mist);letter-spacing:1.5px;text-transform:uppercase;padding:10px 10px 4px}
.snav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;color:var(--ink3);transition:all .2s;margin-bottom:2px}
.snav-item:hover{background:var(--snow);color:var(--ink)}
.snav-item.active{background:linear-gradient(135deg,rgba(91,59,245,.1),rgba(26,109,255,.08));color:var(--violet);font-weight:600}
.snav-icon{font-size:16px;width:22px;text-align:center}
.snav-badge{margin-left:auto;background:var(--r1);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px}
.snav-badge.warn{background:linear-gradient(135deg,var(--amber),var(--rose))}

.sfoot{padding:14px;border-top:1px solid var(--frost)}
.suser{display:flex;align-items:center;gap:10px;padding:10px;background:var(--snow);border-radius:12px;cursor:pointer;transition:background .2s}
.suser:hover{background:var(--frost)}
.sava{width:36px;height:36px;border-radius:50%;background:var(--r1);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0}
.sava.mentor{background:linear-gradient(135deg,#0F9F6E,#0EA5C5)}
.sava.admin{background:linear-gradient(135deg,#E8860A,#E53E5C)}
.suser-name{font-size:12px;font-weight:700;color:var(--ink)}
.suser-role{font-size:10px;color:var(--ink3)}
.suser-logout{margin-left:auto;font-size:18px;color:var(--mist);transition:color .2s}
.suser:hover .suser-logout{color:var(--rose)}

.main{margin-left:260px;flex:1;min-height:100vh}
.topbar{background:white;padding:0 28px;height:60px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--frost);position:sticky;top:0;z-index:50;box-shadow:0 2px 12px rgba(91,59,245,.04)}
.topbar-title{font-size:16px;font-weight:700}
.topbar-right{display:flex;align-items:center;gap:12px}
.sync-dot{width:7px;height:7px;border-radius:50%;background:var(--jade);animation:blink 2s infinite}
.sync-txt{font-size:11px;color:var(--jade);font-weight:600}
.tbtn{padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;border:none;font-family:'DM Sans',sans-serif}
.tbtn.p{background:var(--r1);color:white;box-shadow:var(--sh1)}
.tbtn.p:hover{transform:translateY(-1px);box-shadow:var(--sh2)}
.tbtn.s{background:var(--snow);color:var(--ink2)}
.tbtn.s:hover{background:var(--frost)}

.content{padding:24px 28px}

/* ── CARDS ──────────────────────────────────── */
.card{background:white;border-radius:var(--radL);border:1px solid var(--frost);overflow:hidden;box-shadow:var(--sh1)}
.card-header{padding:18px 20px;border-bottom:1px solid #F0F4FF;display:flex;align-items:center;justify-content:space-between}
.card-title{font-size:14px;font-weight:700}
.card-sub{font-size:11px;color:var(--ink3);margin-top:2px}
.card-body{padding:20px}
.mb4{margin-bottom:16px}
.mb6{margin-bottom:24px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.flex-between{display:flex;justify-content:space-between;align-items:center}

/* ── STAT CARDS ─────────────────────────────── */
.stat{background:white;border-radius:var(--radL);padding:18px 20px;border:1px solid var(--frost);box-shadow:var(--sh1);position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s}
.stat:hover{transform:translateY(-2px);box-shadow:var(--sh2)}
.stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--r1)}
.stat.blue::before{background:linear-gradient(90deg,var(--azure),var(--teal))}
.stat.green::before{background:linear-gradient(90deg,var(--jade),#059669)}
.stat.amber::before{background:linear-gradient(90deg,var(--amber),var(--rose))}
.stat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px;background:var(--r2)}
.stat-val{font-family:'Fraunces',serif;font-size:30px;color:var(--ink);letter-spacing:-1px}
.stat-label{font-size:12px;color:var(--ink3);font-weight:500;margin-top:2px}
.stat-change{font-size:11px;margin-top:6px;font-weight:600}
.up{color:var(--jade)}
.warn{color:var(--amber)}

/* ── BANNER ─────────────────────────────────── */
.banner{background:var(--r1);border-radius:var(--radL);padding:22px 28px;color:white;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden}
.banner::before{content:'';position:absolute;right:-20px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.06)}
.banner::after{content:'';position:absolute;right:60px;bottom:-50px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.04)}
.banner-title{font-family:'Fraunces',serif;font-size:20px;letter-spacing:-.3px;margin-top:8px}
.banner-sub{font-size:12px;opacity:.75;margin-top:4px}
.banner-chip{background:rgba(255,255,255,.15);font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:.5px;display:inline-block}
.bstats{display:flex;gap:28px;position:relative;z-index:1}
.bstat-val{font-family:'Fraunces',serif;font-size:30px;letter-spacing:-1px}
.bstat-label{font-size:10px;opacity:.65;margin-top:2px}

/* ── PHASE TIMELINE ─────────────────────────── */
.phase-line{display:flex;align-items:flex-start;gap:0;position:relative;padding:8px 0}
.ph-item{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
.ph-item:not(:last-child)::after{content:'';position:absolute;top:19px;left:60%;right:-40%;height:2px;background:var(--frost);z-index:0}
.ph-item.done:not(:last-child)::after{background:var(--r1)}
.ph-circle{width:38px;height:38px;border-radius:50%;z-index:1;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid var(--frost);background:white;transition:all .3s}
.ph-item.done .ph-circle{background:var(--r1);border-color:transparent;filter:drop-shadow(0 2px 8px rgba(91,59,245,.3))}
.ph-item.current .ph-circle{background:white;border-color:var(--violet);box-shadow:0 0 0 4px rgba(91,59,245,.1)}
.ph-name{font-size:10px;font-weight:600;color:var(--ink3);margin-top:8px;text-align:center}
.ph-item.done .ph-name{color:var(--violet)}
.ph-item.current .ph-name{color:var(--violet);font-weight:700}

/* ── TABLE ──────────────────────────────────── */
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:var(--ink3);letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--frost);background:var(--snow)}
.tbl td{padding:12px 14px;border-bottom:1px solid #F0F4FF;vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:var(--snow)}

/* ── BADGES ─────────────────────────────────── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700}
.b-track-1{background:#EDE9FE;color:#5B21B6}
.b-track-2{background:#DBEAFE;color:#1E40AF}
.b-track-3{background:#E0F2FE;color:#0369A1}
.b-bypass{background:linear-gradient(135deg,#FEF3C7,#DBEAFE);color:#78350F}
.b-top{background:linear-gradient(135deg,#EDE9FE,#DBEAFE);color:var(--violet)}
.b-qual{background:#D1FAE5;color:#065F46}
.b-review{background:#FEF3C7;color:#92400E}
.b-open{background:#D1FAE5;color:#065F46}
.b-close{background:#FEF3C7;color:#92400E}
.b-phase{background:var(--frost);color:var(--ink2);font-size:10px}
.mono{font-family:'DM Mono',monospace;font-size:13px}

/* ── FORMS ──────────────────────────────────── */
.fg{margin-bottom:16px}
.flabel{font-size:11px;font-weight:700;color:var(--ink2);margin-bottom:6px;display:block;letter-spacing:.3px;text-transform:uppercase}
.finput{width:100%;padding:10px 14px;border:1.5px solid var(--frost);border-radius:10px;font-size:13px;font-family:'DM Sans',sans-serif;background:white;color:var(--ink);outline:none;transition:border-color .2s,box-shadow .2s}
.finput:focus{border-color:var(--violet2);box-shadow:0 0 0 3px rgba(91,59,245,.08)}
.ftextarea{resize:vertical;min-height:80px}
.fselect{appearance:none;cursor:pointer}
.frange{width:100%;accent-color:var(--violet);cursor:pointer}

/* ── BUTTONS ────────────────────────────────── */
.btn{padding:9px 20px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .2s;font-family:'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:7px}
.btn-p{background:var(--r1);color:white;box-shadow:var(--sh1)}
.btn-p:hover{transform:translateY(-1px);box-shadow:var(--sh2)}
.btn-p:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-s{background:var(--snow);color:var(--ink2)}
.btn-s:hover{background:var(--frost)}
.btn-o{background:white;color:var(--violet);border:1.5px solid rgba(91,59,245,.2)}
.btn-o:hover{background:rgba(91,59,245,.04)}
.btn-danger{background:#FEE2E2;color:#991B1B}
.btn-success{background:#D1FAE5;color:#065F46}
.btn-sm{padding:5px 12px;font-size:11px}

/* ── MISC ───────────────────────────────────── */
.alert{padding:12px 16px;border-radius:10px;margin-bottom:16px;font-size:13px;display:flex;align-items:flex-start;gap:10px}
.alert-info{background:#EFF6FF;color:#1E40AF;border:1px solid #BFDBFE}
.alert-success{background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0}
.alert-warn{background:#FFFBEB;color:#92400E;border:1px solid #FDE68A}
.pbar{height:6px;background:var(--frost);border-radius:3px;overflow:hidden}
.pfill{height:100%;border-radius:3px;background:var(--r1);transition:width .5s}
.pfill-g{background:linear-gradient(90deg,var(--jade),#059669)}
.pfill-a{background:linear-gradient(90deg,var(--amber),var(--rose))}
.tag{display:inline-block;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:600;background:var(--snow);color:var(--ink2)}
.txt-muted{color:var(--ink3);font-size:12px}
.tabs{display:flex;gap:4px;background:var(--snow);padding:4px;border-radius:10px;margin-bottom:20px}
.tab{flex:1;padding:8px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;text-align:center;color:var(--ink3);border:none;background:none;font-family:'DM Sans',sans-serif;transition:all .2s}
.tab.active{background:white;color:var(--violet);box-shadow:var(--sh1)}
.event-box{padding:14px;border-radius:10px;border:1px solid var(--frost);display:flex;gap:14px;transition:all .2s}
.event-box:hover{border-color:rgba(91,59,245,.25);box-shadow:var(--sh1)}
.edate{min-width:46px;text-align:center;padding:8px;background:var(--r2);border-radius:8px}
.emon{font-size:9px;font-weight:700;color:var(--violet);letter-spacing:1px;text-transform:uppercase}
.eday{font-family:'Fraunces',serif;font-size:24px;color:var(--ink)}
.toast{position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--ink);color:white;padding:13px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:var(--sh3);display:flex;align-items:center;gap:8px;animation:slideUp .25s ease}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.modal-overlay{position:fixed;inset:0;background:rgba(12,18,39,.5);backdrop-filter:blur(6px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:white;border-radius:var(--radL);max-width:600px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:var(--sh3);animation:pop .25s ease}
@keyframes pop{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
.modal-header{padding:20px 24px;border-bottom:1px solid var(--frost);display:flex;justify-content:space-between;align-items:center}
.modal-body{padding:24px}
.modal-footer{padding:16px 24px;border-top:1px solid var(--frost);display:flex;justify-content:flex-end;gap:10px}
.mclose{background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink3)}
.score-val{font-family:'DM Mono',monospace;font-size:14px;font-weight:500;color:var(--violet)}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--mist);border-radius:10px}

/* ── PROFILE EDIT MODAL ─────────────────────── */
.pill-role{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px}
.pill-superadmin{background:#FEF3C7;color:#92400E}
.pill-mentor{background:#D1FAE5;color:#065F46}
.pill-participant{background:#EDE9FE;color:var(--violet)}
.pill-proadmin{background:linear-gradient(135deg,#1e1b4b,#312e81);color:white}
`;

// ─────────────────────────────────────────────
//  DATA PROVIDER — fetches from Google Sheets on load, falls back to local
// ─────────────────────────────────────────────
function DataProvider({ children }) {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [sheetsReady, setSheetsReady] = useState(false); // true once Sheets responded
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [toast, setToast] = useState(null);
  const [logs, setLogs] = useState([]);

  // On mount: try to load Users sheet → merge with local seed
  useEffect(() => {
    (async () => {
      const sheetUsers = await sheetsAPI.get("Users");
      if (sheetUsers && Array.isArray(sheetUsers) && sheetUsers.length > 0) {
        // Normalize column names from Sheets (may be PascalCase or lowercase)
        const normalized = sheetUsers.map(row => {
          const n = {};
          Object.keys(row).forEach(k => { n[k.charAt(0).toLowerCase() + k.slice(1)] = row[k]; });
          // Ensure role is lowercase
          if (n.role) n.role = n.role.toLowerCase();
          // Parse numeric fields
          ["phase","track","gpa","mlScore","modelingScore","electronicsScore",
           "portfolioScore","interviewScore","meetings","papersReviewed"].forEach(f => {
            if (n[f] !== undefined && n[f] !== "") n[f] = Number(n[f]) || 0;
          });
          // Parse boolean fields
          ["noveltyVerified"].forEach(f => {
            if (n[f] !== undefined) n[f] = n[f] === true || n[f] === "TRUE" || n[f] === "true" || n[f] === 1;
          });
          // Parse mentees list (stored as comma-separated string in Sheets)
          if (n.mentees && typeof n.mentees === "string") {
            n.mentees = n.mentees.split(",").map(s => s.trim()).filter(Boolean);
          }
          return n;
        });
        // Merge: Sheets data takes priority, local seed fills any gaps
        const merged = [...INITIAL_USERS];
        normalized.forEach(su => {
          const idx = merged.findIndex(u => u.email?.toLowerCase() === su.email?.toLowerCase());
          if (idx >= 0) merged[idx] = { ...merged[idx], ...su };
          else merged.push(su);
        });
        setUsers(merged);
        setSyncStatus("synced");
      } else {
        // Sheets unreachable — use local data
        setSyncStatus("offline");
      }
      setSheetsReady(true);
    })();
  }, []);

  const save = (u) => {
    setUsers(u);
    try { localStorage.setItem("riso_users", JSON.stringify(u)); } catch {}
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const pushToSheets = async (sheet, data) => {
    setSyncStatus("syncing");
    const entry = { sheet, data, timestamp: new Date().toISOString() };
    setLogs(l => [entry, ...l].slice(0, 50));
    const res = await sheetsAPI.push(sheet, data);
    setSyncStatus(res?.status === "offline" ? "offline" : "synced");
    showToast(res?.status === "offline" ? "⚠ Saved locally (Sheets offline)" : `✓ Saved to Sheets · ${sheet}`, res?.status === "offline" ? "warn" : "success");
  };

  const updateUser = (id, patch) => {
    const updated = users.map(u => u.id === id ? { ...u, ...patch } : u);
    save(updated);
    const { track, challengeId, teamRole, phase, status, trackLabel, track1, track2, track3, ...safePatch } = patch;
    const userEmail = patch.email || users.find(u => u.id === id)?.email;
    if (userEmail) {
      // updateByMatch in Code.gs now hashes password automatically
      sheetsAPI.updateByMatch("Users", "email", userEmail, safePatch);
    } else {
      sheetsAPI.update("Users", id, safePatch);
    }
    showToast("✓ Profile updated");
  };

  const addUser = (user) => {
    const newUser = { ...user, id: `${user.role === ROLES.MENTOR ? "M" : "P"}${String(Date.now()).slice(-4)}` };
    const updated = [...users, newUser];
    save(updated);
    sheetsAPI.push("Users", newUser);
    showToast(`✓ ${user.name} added`);
    return newUser;
  };

  const deleteUser = (id) => {
    save(users.filter(u => u.id !== id));
    showToast("✓ User removed");
  };

  const participants = users.filter(u => u.role === ROLES.PARTICIPANT);
  const mentors     = users.filter(u => u.role === ROLES.MENTOR);

  return (
    <DataCtx.Provider value={{ users, participants, mentors, syncStatus, sheetsReady, logs, pushToSheets, updateUser, addUser, deleteUser, showToast }}>
      {children}
      {toast && (
        <div className="toast">
          <span style={{ color: toast.type === "error" ? "#FF6B84" : toast.type === "warn" ? "#E8860A" : "#0F9F6E" }}>●</span> {toast.msg}
        </div>
      )}
    </DataCtx.Provider>
  );
}

// ─────────────────────────────────────────────
//  AUTH PROVIDER — Sheets-first authentication
// ─────────────────────────────────────────────
function AuthProvider({ children }) {
  const { users, sheetsReady, showToast } = useContext(DataCtx);
  const [user, setUser] = useState(() => {
    try { const s = sessionStorage.getItem("riso_session"); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });

  // login: tries Sheets first, falls back to local users array
  const login = async (email, password) => {

    // 1️⃣ Try Google Sheets authentication
    const res = await sheetsAPI.login(email, password);

    if (res && res.status === "ok" && res.user) {
      // ✅ Sheets auth success — normalize the user row
      const raw = res.user;
      const u = {};
      Object.keys(raw).forEach(k => {
        // normalize key casing (Sheets headers may be any case)
        u[k.charAt(0).toLowerCase() + k.slice(1)] = raw[k];
      });
      // ensure role is lowercase string
      if (u.role) u.role = String(u.role).toLowerCase().trim();
      // parse numbers
      ["phase","track","gpa","mlScore","modelingScore","electronicsScore",
       "portfolioScore","interviewScore","meetings","papersReviewed"].forEach(f => {
        if (u[f] !== undefined && u[f] !== "") u[f] = Number(u[f]) || 0;
      });
      // parse booleans
      if (u.noveltyVerified !== undefined)
        u.noveltyVerified = u.noveltyVerified === true || u.noveltyVerified === "TRUE" || u.noveltyVerified === "true" || u.noveltyVerified === 1;
      // parse mentees (comma-separated string → array)
      if (u.mentees && typeof u.mentees === "string")
        u.mentees = u.mentees.split(",").map(s => s.trim()).filter(Boolean);

      sessionStorage.setItem("riso_session", JSON.stringify(u));
      setUser(u);
      showToast(`✓ Welcome ${u.name || u.email} · ${u.role}`);
      return { success: true };
    }

    if (res && res.status === "error") {
      // ❌ Sheets responded but credentials are wrong
      return { error: res.message || "Invalid email or password." };
    }

    // 2️⃣ Sheets offline / unreachable (res === null) → fall back to local seed
    const found = users.find(u =>
      u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return { error: "Invalid email or password." };
    sessionStorage.setItem("riso_session", JSON.stringify(found));
    setUser(found);
    showToast("⚠ Signed in locally — Sheets unreachable", "warn");
    return { success: true };
  };

  const logout = () => {
    sessionStorage.removeItem("riso_session");
    setUser(null);
  };

  // Always reflect latest data from users list (so profile edits show live)
  // Reflect profile edits live (e.g. name change), but NEVER let the users
  // array overwrite the authenticated user's role, id, or email — those come
  // from the session established at login and are the source of truth.
  // Only merge if the id is a non-empty exact match, so a missing/blank id
  // in the Users sheet can never cause a wrong-user substitution.
  const refreshedUser = user
    ? (() => {
        const sessionId = user.id;
        const matched = (sessionId !== undefined && sessionId !== null && sessionId !== "")
          ? users.find(u => u.id === sessionId)
          : null;
        if (!matched) return user; // no match → keep session as-is
        return {
          ...matched,          // latest sheet data
          id:       user.id,   // never change identity
          email:    user.email,// never change email
          role:     user.role, // ← CRITICAL: role always comes from login session
        };
      })()
    : null;

  return (
    <AuthCtx.Provider value={{ user: refreshedUser, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ─────────────────────────────────────────────
//  LANDING PAGE
// ─────────────────────────────────────────────
// Logo image — place your logo file as /public/logo.png (or .svg) in your project
// The src below will work once you add your image to the /public folder
const RisoLogo = ({ size = 52 }) => (
  <img
    src="/logo.jpg"
    alt="Ri-Sō Logo"
    width={size}
    height={size}
    style={{ objectFit:"contain", display:"block", borderRadius:"50%", flexShrink:0 }}
    onError={e => {
      e.target.style.display = "none";
      const d = document.createElement("div");
      d.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#5B3BF5,#1A6DFF);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:${Math.round(size*0.35)}px;font-family:serif;flex-shrink:0`;
      d.textContent = "RS";
      e.target.parentNode.insertBefore(d, e.target);
    }}
  />
);

function LandingPage({ onLogin }) {
  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-dots" />

      {/* ── NAVBAR ── */}
      <nav className="lnav">
        <div className="lnav-logo">
          <RisoLogo size={52}/>
          <div className="lnav-logo-text">
            <div className="lnav-jp">Ri-Sō 理創</div>
            <div className="lnav-en">IEEE E-JUST EMBS SBC · 2026</div>
          </div>
        </div>
        <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
          <div className="lnav-badge">Research Program 2026</div>
        </div>
        <div className="lnav-cta">
          <button onClick={onLogin} style={{padding:"9px 22px",background:"linear-gradient(135deg,#5B3BF5,#1A6DFF)",color:"white",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 3px 14px rgba(91,59,245,.28)",lineHeight:1.4,display:"inline-block",width:"auto"}}>Sign In →</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="hero">
        <div style={{marginBottom:24}}>
          <RisoLogo size={180}/>
        </div>
        <div className="hero-chip"><span />Cohort 2026 · Now Active</div>
        <div className="hero-title">Ri-Sō <em>理創</em></div>
        <p className="hero-sub">
          A structured 6-phase research program in Biomedical Engineering at E-JUST.
          Work with expert mentors, publish your research, and compete internationally.
        </p>
        <button onClick={onLogin} style={{marginTop:0,padding:"12px 32px",background:"linear-gradient(135deg,#5B3BF5,#1A6DFF)",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 4px 20px rgba(91,59,245,.35)",lineHeight:1.4,display:"inline-block",width:"auto"}}>
          Sign In to Dashboard →
        </button>
        <div className="hero-stats">
          {[["6","Research Phases"],["3","Specialist Tracks"],["100%","IEEE Publication Goal"],["3","Global Competitions"]].map(([v,l],i,arr) => (
            <div key={l} style={{display:"flex",alignItems:"center",gap:48}}>
              <div className="hstat"><div className="hstat-val">{v}</div><div className="hstat-label">{l}</div></div>
              {i < arr.length-1 && <div className="hstat-divider" style={{width:1,height:36,background:"var(--mist)"}}/>}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURE CARDS ── */}
      <div className="features">
        {[
          { icon:"🧠", t:"AI & Machine Learning",    d:"Deep learning for medical imaging, diagnosis, and clinical AI systems." },
          { icon:"⚗️", t:"Modeling & Simulation",    d:"Systems biology, pharmacokinetics, and computational physiology." },
          { icon:"🔬", t:"Biomedical Electronics",   d:"Wearable sensors, ECG/EEG devices, and embedded biosignal processing." },
          { icon:"🤝", t:"Expert Mentorship",        d:"Weekly 1-on-1 meetings with specialist faculty researchers." },
          { icon:"📄", t:"IEEE Publication",         d:"Guide participants from first draft to published IEEE conference paper." },
          { icon:"🏆", t:"International Competitions",d:"MICCAI, BCI Award, NHID — compete with the world's best." },
        ].map(f => (
          <div key={f.t} className="feat">
            <div className="feat-icon">{f.icon}</div>
            <div className="feat-title">{f.t}</div>
            <div className="feat-desc">{f.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  AUTH PAGE
// ─────────────────────────────────────────────
function AuthPage({ onBack }) {
  const { login } = useContext(AuthCtx);
  const { syncStatus } = useContext(DataCtx);
  const [form, setForm] = useState({ email:"", password:"" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(""); // "sheets" | "local" | ""

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.email || !form.password) { setErr("Please enter your email and password."); return; }
    setErr(""); setLoading(true); setStep("sheets");
    const res = await login(form.email, form.password);
    if (res?.error) { setErr(res.error); setStep(""); }
    setLoading(false);
  };

  const sheetsOnline = syncStatus === "synced" || syncStatus === "syncing" || syncStatus === "connecting";

  return (
    <div className="auth-page">
      <div className="auth-page-bg" />
      <div className="auth-page-dots" />
      <div className="auth-box">
        <button className="auth-back" onClick={onBack}>← Back to home</button>

        <div className="auth-logo">
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
            <RisoLogo size={64}/>
          </div>
          <div className="auth-logo-jp">Ri-Sō 理創</div>
          <div className="auth-logo-en">IEEE E-JUST EMBS SBC · Research Program 2026</div>
        </div>

        {/* Sheets connection status */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:20,padding:"7px 14px",background:sheetsOnline?"#ECFDF5":"#FEF3C7",borderRadius:8,border:`1px solid ${sheetsOnline?"#A7F3D0":"#FDE68A"}`}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:syncStatus==="connecting"?"#E8860A":sheetsOnline?"#0F9F6E":"#E8860A",animation:"blink 2s infinite"}}/>
          <span style={{fontSize:11,fontWeight:700,color:sheetsOnline?"#065F46":"#92400E",letterSpacing:.3}}>
            {syncStatus==="connecting" ? "Connecting to Google Sheets…"
             : sheetsOnline ? "Google Sheets · Live Authentication"
             : "Offline Mode · Using local data"}
          </span>
        </div>

        {err && <div className="auth-error">⚠ {err}</div>}

        <label className="auth-label">Email</label>
        <input
          className="auth-input" type="email" placeholder="your@email.com"
          value={form.email} onChange={e => set("email", e.target.value)}
          onKeyDown={e => e.key==="Enter" && handleSubmit()}
        />
        <label className="auth-label">Password</label>
        <input
          className="auth-input" type="password" placeholder="••••••••"
          value={form.password} onChange={e => set("password", e.target.value)}
          onKeyDown={e => e.key==="Enter" && handleSubmit()}
        />

        <div style={{display:"flex",justifyContent:"center",marginTop:8}}>
          <button
            onClick={handleSubmit} disabled={loading}
            style={{padding:"11px 36px",background:"linear-gradient(135deg,#5B3BF5,#1A6DFF)",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 4px 20px rgba(91,59,245,.35)",lineHeight:1.4,opacity:loading?0.75:1,display:"flex",alignItems:"center",gap:8}}
          >
            {loading && <span style={{width:14,height:14,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>}
            {loading ? "Checking credentials…" : "Sign In →"}
          </button>
        </div>

        <div style={{marginTop:20,textAlign:"center",fontSize:11,color:"var(--ink3)"}}>
          Use your registered email and username.<br/>
          Contact your program admin if you need access.
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
//  SHARED HELPERS & MINI COMPONENTS
// ─────────────────────────────────────────────
const TrackBadge = ({ track, label }) => {
  if (!track) return <span className="badge b-review">Unassigned</span>;
  if (track === "BYPASS") return <span className="badge b-bypass">⭐ Top-Tier Bypass</span>;
  const cls = `badge b-track-${track}`;
  const icons = { 1:"🧠", 2:"⚗️", 3:"🔬" };
  return <span className={cls}>{icons[track]} {label}</span>;
};

const StatusBadge = ({ status }) => {
  const map = { "Top-Tier":"b-top","Qualified":"b-qual","Under Review":"b-review","Applied":"b-review","Pending":"b-review" };
  return <span className={`badge ${map[status]||"b-phase"}`}>{status}</span>;
};

const Avatar = ({ user }) => {
  const cls = user?.role === ROLES.MENTOR ? "sava mentor" : user?.role === ROLES.SUPERADMIN ? "sava admin" : user?.role === ROLES.PROADMIN ? "sava" : "sava";
  const style = user?.role === ROLES.PROADMIN ? {background:"linear-gradient(135deg,#1e1b4b,#312e81)"} : {};
  return <div className={cls} style={style}>{user?.avatar || "?"}</div>;
};

const PhaseBadge = ({ phase }) => <span className="badge b-phase">P{phase}: {PHASES[phase-1]?.name}</span>;

// ─────────────────────────────────────────────
//  PROGRESS BAR
// ─────────────────────────────────────────────
const PBar = ({ val, max=100, color="" }) => (
  <div className="pbar"><div className={`pfill ${color}`} style={{ width:`${Math.min(100,Math.round((val/max)*100))}%` }} /></div>
);

// ─────────────────────────────────────────────
//  PARTICIPANT VIEWS
// ─────────────────────────────────────────────
function ParticipantDashboard({ user }) {
  return <MICCAIChallenges user={user} />;
}

function _OldParticipantDashboard_UNUSED({ user }) {
  const { pushToSheets } = useContext(DataCtx);
  const p = user;
  return (
    <div>
      <div className="banner">
        <div>
          <div className="banner-chip">IEEE E-JUST EMBS SBC · Ri-Sō 理創 2026</div>
          <div className="banner-title">Welcome back, {p.name.split(" ")[0]} 👋</div>
          <div className="banner-sub">Phase {p.phase} · {PHASES[p.phase-1]?.name} · {p.trackLabel||"Awaiting Assignment"}</div>
        </div>
        <div className="bstats">
          {[["Phase",p.phase],["Total","6"],[p.status==="Top-Tier"?"⭐":"✓",p.status]].map(([l,v]) => (
            <div key={l} className="bstat"><div className="bstat-val">{v}</div><div className="bstat-label">{l}</div></div>
          ))}
        </div>
      </div>

      {p.status === "Top-Tier" && (
        <div className="alert alert-success mb4">⭐ <strong>Top-Tier:</strong> You bypassed Phase III and proceed directly to Phase IV Mentorship.</div>
      )}

      <div className="g4 mb6">
        <div className="stat">
          <div className="stat-icon">📊</div>
          <div className="stat-val">{Math.round(((p.phase-1)/5)*100)}%</div>
          <div className="stat-label">Program Progress</div>
          <div style={{marginTop:8}}><PBar val={(p.phase-1)} max={5}/></div>
        </div>
        <div className="stat blue">
          <div className="stat-icon">🎯</div>
          <div className="stat-val">{p.portfolioScore}</div>
          <div className="stat-label">Portfolio Score</div>
        </div>
        <div className="stat green">
          <div className="stat-icon">💬</div>
          <div className="stat-val">3</div>
          <div className="stat-label">Meetings Done</div>
          <div className="stat-change up">↑ On track</div>
        </div>
        <div className="stat amber">
          <div className="stat-icon">📝</div>
          <div className="stat-val">1</div>
          <div className="stat-label">Drafts Submitted</div>
          <div className="stat-change warn">2 remaining</div>
        </div>
      </div>

      <div className="g2 mb6">
        <div className="card">
          <div className="card-header"><div><div className="card-title">Phase Timeline</div><div className="card-sub">Your Ri-Sō 2026 journey</div></div></div>
          <div className="card-body">
            <div className="phase-line">
              {PHASES.map(ph => (
                <div key={ph.id} className={`ph-item ${ph.id<p.phase?"done":""} ${ph.id===p.phase?"current":""}`}>
                  <div className="ph-circle">{ph.id<p.phase?"✓":ph.icon}</div>
                  <div className="ph-name">{ph.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Upcoming Webinars</div></div>
          <div className="card-body" style={{display:"flex",flexDirection:"column",gap:10}}>
            {WEBINARS.slice(0,3).map(w => (
              <div key={w.id} className="event-box">
                <div className="edate"><div className="emon">{new Date(w.date).toLocaleString("en",{month:"short"})}</div><div className="eday">{new Date(w.date).getDate()}</div></div>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{w.title}</div>
                  <div className="txt-muted">{w.type} · {w.speaker}</div>
                  <button className="btn btn-o btn-sm" style={{marginTop:7}} onClick={()=>pushToSheets("CalendarRegistrations",{event:w.title,participantId:p.id})}>Register</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Connected Tools</div></div>
        <div className="card-body">
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {icon:"🌿",name:"Overleaf",url:"https://overleaf.com",color:"#4cae4c"},
              {icon:"🐙",name:"GitHub",url:"https://github.com",color:"#24292e"},
              {icon:"📖",name:"IEEE Xplore",url:"https://ieeexplore.ieee.org",color:"#00629B"},
              {icon:"📊",name:"Sheets",url:"#",color:"#0F9D58"},
            ].map(t => (
              <a key={t.name} href={t.url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",border:"1px solid var(--frost)",borderRadius:10,textDecoration:"none",transition:"all .2s",background:"var(--snow)"}}>
                <span style={{fontSize:20}}>{t.icon}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:t.color}}>{t.name}</div>
                  <div style={{fontSize:10,color:"var(--jade)",fontWeight:600}}>● Live</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticipantProgress({ user }) {
  const p = user;

  // Determine phase state from the "qualified" column in the sheet.
  // If qualified === true/"TRUE"/"true"/1 → phases 1-3 done, phase 4 (Mentorship) in progress.
  // Otherwise → phases 1-2 done (Accepted), phase 3 (Training) in progress.
  const isQualified = p.qualified === true || p.qualified === "TRUE" || p.qualified === "true" || p.qualified === 1 || p.qualified === "1";
  const completedUpTo = isQualified ? 3 : 2;   // phases with id <= this are "done"
  const currentPhase  = isQualified ? 4 : 3;   // this phase is "in progress"

  const getStatus = (phId) => {
    if (phId <= completedUpTo) return "Accepted";
    if (phId === currentPhase) return "In Progress";
    return "Upcoming";
  };
  const getBadgeClass = (phId) => {
    if (phId <= completedUpTo) return "b-qual";
    if (phId === currentPhase) return "b-review";
    return "b-phase";
  };
  const getCircleBg = (phId) => {
    if (phId <= completedUpTo) return "var(--r1)";
    if (phId === currentPhase) return "rgba(91,59,245,.1)";
    return "var(--snow)";
  };

  return (
    <div>
      <div className="card mb6">
        <div className="card-header">
          <div className="card-title">6-Phase Progress</div>
          <span className={`badge ${isQualified?"b-qual":"b-review"}`} style={{fontSize:11}}>
            {isQualified ? "✅ Qualified — Phase 4" : "⏳ Phase 3 — Training"}
          </span>
        </div>
        <div className="card-body">
          <div className="phase-line" style={{marginBottom:24}}>
            {PHASES.map(ph => (
              <div key={ph.id} className={`ph-item ${ph.id<=completedUpTo?"done":""} ${ph.id===currentPhase?"current":""}`}>
                <div className="ph-circle" style={{width:46,height:46,fontSize:18}}>
                  {ph.id<=completedUpTo ? "✓" : ph.icon}
                </div>
                <div className="ph-name">{ph.name}</div>
              </div>
            ))}
          </div>
          {PHASES.map(ph => (
            <div key={ph.id} style={{display:"flex",gap:14,padding:"14px 0",borderBottom:"1px solid var(--frost)",alignItems:"center"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:getCircleBg(ph.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>
                {ph.id<=completedUpTo ? "✓" : ph.icon}
              </div>
              <div style={{flex:1}}>
                <div className="flex-between" style={{marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:ph.id<=currentPhase?"var(--ink)":"var(--mist)"}}>
                    Phase {ph.id}: {ph.name}
                  </span>
                  <span className={`badge ${getBadgeClass(ph.id)}`} style={{background:ph.id>currentPhase?"var(--snow)":""}}>
                    {getStatus(ph.id)}
                  </span>
                </div>
                <div className="txt-muted">{ph.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MICCAI 2026 CHALLENGE DATA
// ─────────────────────────────────────────────
const MICCAI_CHALLENGES = {
  AMPLIFAI: {
    id: "AMPLIFAI",
    name: "AMPLIFAI",
    fullName: "AMPLIFAI — Multi-Phase Liver Imaging",
    theme: "Automated Hepatocellular Carcinoma (HCC) characterization using clinical LI-RADS categories",
    color: "#E53E5C",
    colorLight: "#fff0f3",
    icon: "🫀",
    dataset: "Harmonized multi-phase liver CT (668 cases: 83 normal, 585 HCC). Four contrast phases: non-contrast, arterial, portal venous, delayed.",
    tasks: [
      "Voxel-level segmentation of non-rim APHE, non-peripheral washout, and enhancing capsules",
      "Ordinal classification of lesions into LI-RADS categories (LR-1 to LR-5)"
    ],
    architecture: "[Phase Co-registration] → [Spatio-Temporal Fusion Network] → [Multi-Task Head: Segmentation Mask + Ordinal LR Classification]",
    sprints: [
      {
        weeks: "Weeks 1–2", label: "Data Realignment & Spatial Synchronization", phase: 1,
        tasks: {
          mentor: ["Review alignment accuracy across all 4 phases", "Approve data preprocessing strategy", "Ensure clinical data integrity throughout pipeline"],
          associate: ["Assist with NIfTI format verification", "Document co-registration accuracy metrics", "Set up experiment tracking (MLflow/W&B)"],
          TM1: ["Build 4-phase NIfTI co-registration pipeline using rigid/deformable registration (ANTs/SimpleITK) to align non-contrast, arterial, portal venous, and delayed phases spatially"],
          TM2: ["Set up 3D UNet or Swin UNETR multi-input baseline architecture"],
          TM3: ["Implement balanced data loader addressing high ratio of HCC to normal cases"],
          TM4: ["Establish evaluation harness measuring Dice scores for multi-class segmentation targets"],
          TM5: ["Support TM1 in phase co-registration validation", "Verify NIfTI file integrity across 668 cases"],
          TM6: ["Support TM2 in baseline model setup", "Research and document Swin UNETR architecture papers"],
          TM7: ["Support TM3 in data loading and class imbalance strategies", "Literature review on HCC class distribution"],
          TM8: ["Support TM4 in evaluation metric implementation", "Prepare data split (train/val/test) documentation"],
          board_admin: ["Set up team repository and project management board", "Schedule weekly standups and milestone reviews", "Track task completion and send progress reports to program admins"]
        }
      },
      {
        weeks: "Weeks 3–4", label: "Spatio-Temporal Feature Fusion", phase: 2,
        tasks: {
          mentor: ["Audit multi-task loss weight balance to ensure gradients aren't dominated by segmentation", "Review cross-phase attention mechanism design", "Clinical validation of feature fusion approach"],
          associate: ["Run baseline model experiments and log results", "Compare multi-phase fusion strategies in literature", "Prepare mid-sprint progress report"],
          TM1: ["Implement spatial ROI cropping focused on liver regions to reduce GPU memory strain"],
          TM2: ["Engineer cross-phase attention mechanisms or 3D CNN architectures capturing dynamic contrast enhancement over time (APHE and washout)"],
          TM3: ["Build multi-task loss function combining Dice + Cross-Entropy (segmentation) with Ordinal Cross-Entropy (LI-RADS classification)"],
          TM4: ["Set up tracking pipelines for validation metrics across both classification and segmentation tasks"],
          TM5: ["Assist TM1 with liver ROI cropping implementation and testing"],
          TM6: ["Assist TM2 with attention mechanism literature review and implementation support"],
          TM7: ["Assist TM3 with loss function tuning experiments"],
          TM8: ["Assist TM4 with metric dashboard setup and visualization"],
          board_admin: ["Compile Week 3–4 sprint report", "Coordinate with mentor on timeline adjustments", "Ensure GPU resource requests are submitted"]
        }
      },
      {
        weeks: "Weeks 5–6", label: "Domain Generalization Tuning", phase: 3,
        tasks: {
          mentor: ["Perform clinical error analysis on misclassified validation cases (e.g., LR-3 vs LR-4 edge cases)", "Review domain generalization strategy", "Sign off on ablation study design"],
          associate: ["Run ablation experiments with phase inclusion/exclusion", "Analyze inter-center performance gaps", "Document findings for paper draft"],
          TM1: ["Inject heavy domain augmentations (contrast, intensity scaling, blur) to simulate multi-center protocol heterogeneity"],
          TM2: ["Refine classification head to enforce strict ordinal constraints between LR-1 to LR-5 categories"],
          TM3: ["Run ablation studies on phase inclusion (verifying model reliance on arterial vs. delayed phases)"],
          TM4: ["Evaluate performance consistency across the four contributing public source datasets"],
          TM5: ["Support TM1 with augmentation pipeline testing and validation"],
          TM6: ["Support TM2 with ordinal constraint implementation"],
          TM7: ["Support TM3 with ablation study execution and documentation"],
          TM8: ["Support TM4 with cross-dataset evaluation scripts"],
          board_admin: ["Update milestone tracker", "Prepare Weeks 5–6 progress report for admins", "Coordinate with associates on paper draft timeline"]
        }
      },
      {
        weeks: "Weeks 7–8", label: "Validation & Robust Inference", phase: 4,
        tasks: {
          mentor: ["Conduct final validation checks against simulated held-out data", "Assess domain generalizability of final model", "Sign off on Docker container and submission"],
          associate: ["Write challenge submission report", "Prepare paper draft sections on methodology and results", "Coordinate final Docker testing"],
          TM1: ["Develop multi-model ensemble to stabilize predictions (with TM2)"],
          TM2: ["Co-develop ensemble with TM1; run inference optimizations (TensorRT or mixed precision)"],
          TM3: ["Run inference speed optimizations to ensure processing completes within challenge limits"],
          TM4: ["Package entire multi-task pipeline into Docker container meeting Codabench specifications"],
          TM5: ["Assist TM1/TM2 with ensemble strategy evaluation"],
          TM6: ["Run final model benchmarks and document results table"],
          TM7: ["Assist TM3 with speed profiling and optimization"],
          TM8: ["Assist TM4 with Docker container testing and Codabench submission"],
          board_admin: ["Coordinate final submission checklist", "Submit to Codabench platform", "File final sprint report and prepare celebration event"]
        }
      }
    ],
    assessment: [
      { role: "Mentor", metric: "Clinical Alignment & Structural Oversight", criteria: "Zero training deadlocks; multi-task loss architecture converges within 4 weeks; clinical logic holds across tasks" },
      { role: "TM1", metric: "Registration Precision & Processing Latency", criteria: "Sub-voxel phase-to-phase registration alignment; preprocessing pipelines cause zero training bottlenecks" },
      { role: "TM2", metric: "Architecture Innovation & Feature Maps", criteria: "Successful multi-phase attention tensor fusion; model captures distinct APHE and washout dynamics" },
      { role: "TM3", metric: "Model Convergence & Loss Tuning", criteria: "Validation loss steadily decreases without overfitting; stable multi-task training progression" },
      { role: "TM4", metric: "Metric Accuracy & Container Compliance", criteria: "Code reaches ≥95% completion rate; Docker containers validate successfully on Codabench" }
    ]
  },
  ENDOVIS: {
    id: "ENDOVIS",
    name: "EndoVis 2026",
    fullName: "EndoVis 2026 — Endoscopic Vision Challenge",
    theme: "Surgical Data Science (SDS) for context-aware perception and surgical quality assessment",
    color: "#5B3BF5",
    colorLight: "#f5f3ff",
    icon: "🔭",
    dataset: "Multi-Endoscope and Surgical Video datasets (laparoscopy, colonoscopy, infrared tracking). Real-time STIR tracking + novel view synthesis.",
    tasks: [
      "Real-time surgical tissue tracking using infrared markers (STIR)",
      "Multi-endoscope novel view synthesis and anatomical localization"
    ],
    architecture: "[Surgical Video Frames] → [Temporal Feature Extractor (Transformer/LSTM)] → [Dual Head: Real-time Tissue Tracking + Novel View Synthesis (NeRF/3DGS)]",
    sprints: [
      {
        weeks: "Weeks 1–2", label: "Video Pipeline Initialization & Baseline", phase: 1,
        tasks: {
          mentor: ["Validate that frame preprocessing handles artifacts like smoke and sudden lens occlusion", "Review baseline tracking framework selection", "Clinical review of surgical workflow assumptions"],
          associate: ["Benchmark optical flow vs SuperPoint+LightGlue tracking accuracy", "Set up video dataset access and frame extraction pipeline", "Document baseline MOTA scores"],
          TM1: ["Develop video frame extraction, illumination correction, and specular reflection removal pipelines"],
          TM2: ["Implement baseline real-time object tracking or feature matching framework (Optical Flow / SuperPoint + LightGlue)"],
          TM3: ["Implement specialized loss function optimized for tracking coordinates and spatial mapping"],
          TM4: ["Build validation scripts calculating Multi-Object Tracking Accuracy (MOTA) and structural metrics"],
          TM5: ["Support TM1 with video preprocessing pipeline testing across all endoscope types"],
          TM6: ["Support TM2 with feature matching baseline evaluation"],
          TM7: ["Support TM3 with loss function literature review"],
          TM8: ["Support TM4 with MOTA metric calculation and visualization"],
          board_admin: ["Set up team repo and Kanban board", "Schedule weekly review sessions", "Submit initial resource requests for GPU access"]
        }
      },
      {
        weeks: "Weeks 3–4", label: "Temporal & Novel View Modeling", phase: 2,
        tasks: {
          mentor: ["Verify that architectural design supports target real-time FPS processing constraints", "Review temporal model selection rationale", "Check camera calibration approach"],
          associate: ["Integrate Timesformer or 3DGS baseline implementation", "Run temporal consistency benchmarks", "Prepare mid-sprint technical report"],
          TM1: ["Sequence frame segments into temporal blocks, ensuring synchronicity with infrared markers"],
          TM2: ["Integrate transformer-based temporal models (Timesformer) for tissue tracking, or implement 3D Gaussian Splatting for novel view synthesis"],
          TM3: ["Optimize multi-endoscope perspective projection matrices and camera intrinsic calibrations"],
          TM4: ["Evaluate frame-to-frame tracking stability across highly deformable soft tissue sequences"],
          TM5: ["Assist TM1 with temporal block sequencing and synchronization testing"],
          TM6: ["Assist TM2 with 3DGS implementation and rendering evaluation"],
          TM7: ["Assist TM3 with camera calibration optimization"],
          TM8: ["Assist TM4 with deformable tissue tracking evaluation scripts"],
          board_admin: ["Compile Week 3–4 sprint report", "Coordinate with mentor on FPS benchmark timeline", "Ensure compute resources are allocated for 3DGS training"]
        }
      },
      {
        weeks: "Weeks 5–6", label: "Robustness to Occlusion & Deformations", phase: 3,
        tasks: {
          mentor: ["Benchmark system tracking re-localization capability following complete target occlusion", "Review robustness test design", "Validate occlusion simulation realism"],
          associate: ["Run comprehensive occlusion and deformation stress tests", "Analyze tracking failure modes", "Document results for paper methodology section"],
          TM1: ["Design custom augmentations simulating tool occlusions, motion blur, and blood pooling"],
          TM2: ["Integrate temporal memory cells or Kalman filters to preserve tracking continuity during deep tool occlusions"],
          TM3: ["Fine-tune view synthesis rendering pipelines to reduce blur and spatial artifacts"],
          TM4: ["Run comprehensive inference speed tests on target hardware setups"],
          TM5: ["Assist TM1 with augmentation diversity and realism testing"],
          TM6: ["Assist TM2 with Kalman filter integration and tuning"],
          TM7: ["Assist TM3 with rendering artifact analysis"],
          TM8: ["Assist TM4 with hardware benchmarking across GPU profiles"],
          board_admin: ["Update milestone tracker with Week 5–6 results", "Prepare progress report for program admin", "Coordinate with associates on paper draft sections"]
        }
      },
      {
        weeks: "Weeks 7–8", label: "Final System Deployment", phase: 4,
        tasks: {
          mentor: ["Confirm tracking consistency and geometric fidelity across diverse camera perspectives", "Final sign-off on system latency and accuracy", "Review Docker submission"],
          associate: ["Finalize challenge submission paper", "Write results and discussion sections", "Coordinate final Docker testing and submission"],
          TM1: ["Construct temporal ensemble setups using sliding window inference strategies (with TM2)"],
          TM2: ["Co-develop sliding window ensemble with TM1"],
          TM3: ["Optimize memory allocation to prevent OOM errors during long video sequences"],
          TM4: ["Finalize low-latency inference configurations and build deployment-ready Docker structures"],
          TM5: ["Assist with ensemble evaluation and comparison"],
          TM6: ["Run final FPS benchmarks and document results"],
          TM7: ["Assist TM3 with memory profiling and optimization"],
          TM8: ["Assist TM4 with Docker testing on target hardware"],
          board_admin: ["Submit to challenge platform", "File final sprint report", "Organize team debrief session"]
        }
      }
    ],
    assessment: [
      { role: "Mentor", metric: "Real-time Viability & Algorithmic Safety", criteria: "Tracking maintains frame rate goals without losing target during rapid instrument adjustments" },
      { role: "TM1", metric: "Artifact Suppression & Preprocessing Speed", criteria: "High specular reflection removal rates with negligible frame-processing latency" },
      { role: "TM2", metric: "Temporal Consistency & Spatial Novelty", criteria: "Tracking drift minimal over 1000+ frames; synthesized views resolve fine tissue textures clearly" },
      { role: "TM3", metric: "Calibration Precision & Optimization Bounds", criteria: "Camera pose estimation error minimized; loss curves decrease consistently across dynamic deformations" },
      { role: "TM4", metric: "Processing Throughput (FPS) & System Packaging", criteria: "System maintains target FPS; Docker container passes all pipeline tests" }
    ]
  },
  LEARN2REG: {
    id: "LEARN2REG",
    name: "Learn2Reg 2026",
    fullName: "Learn2Reg 2026 — Learn2Breath / PSMAReg",
    theme: "Clinically relevant deformable image registration for large, non-linear anatomical shifts",
    color: "#0EA5C5",
    colorLight: "#f0fafd",
    icon: "🫁",
    dataset: "Learn2Breath: Paired inspiratory/expiratory chest CT. PSMAReg: Longitudinal whole-body PSMA PET/CT scans.",
    tasks: [
      "Estimate clinically plausible deformable displacement fields (U) aligning moving scans to fixed baselines",
      "Maintain structural accuracy and intensity metric preservation post-registration"
    ],
    architecture: "[Fixed & Moving Scans] → [Deformable Registration Network] → [Displacement Field (U)] → [Jacobian Determinant Check]",
    sprints: [
      {
        weeks: "Weeks 1–2", label: "Voxel Space Alignment & Baseline", phase: 1,
        tasks: {
          mentor: ["Ensure inspiratory scan is strictly designated as fixed reference space across all pipelines", "Review affine pre-alignment strategy", "Validate intensity normalization approach for BMI/radiation variances"],
          associate: ["Set up Voxelmorph or Elastix baseline registration framework", "Benchmark initial TRE with landmark annotations", "Document registration baseline metrics"],
          TM1: ["Implement spatial affine pre-alignment routines and intensity normalization strategies adjusted for BMI/radiation variances"],
          TM2: ["Deploy unsupervised baseline registration framework (Voxelmorph or conventional Elastix)"],
          TM3: ["Formulate initial image similarity components (NCC for CT, Mutual Information for PET/CT)"],
          TM4: ["Develop validation utilities measuring Target Registration Error (TRE) using anatomical landmarks"],
          TM5: ["Support TM1 with affine alignment pipeline testing"],
          TM6: ["Support TM2 with Voxelmorph baseline configuration"],
          TM7: ["Support TM3 with similarity metric implementation and comparison"],
          TM8: ["Support TM4 with TRE calculation validation scripts"],
          board_admin: ["Set up team repository and project board", "Schedule weekly check-ins", "Submit GPU resource requests for registration training"]
        }
      },
      {
        weeks: "Weeks 3–4", label: "Deformable Field Optimization", phase: 2,
        tasks: {
          mentor: ["Inspect deformation fields to verify structural plausibility and rule out topological folding artifacts", "Review multi-scale architecture design", "Approve Jacobian regularization approach"],
          associate: ["Run deformable registration experiments across large lung volume changes", "Evaluate Dice overlap on anatomical segmentations", "Prepare mid-sprint technical report"],
          TM1: ["Build coordinate grid generation tools and transformation warp modules"],
          TM2: ["Design multi-scale or cascade DL architecture to capture large non-linear transformations (diaphragm movement, lung volume differences)"],
          TM3: ["Integrate Jacobian determinant regularization (det(∇U) > 0) into loss function to prevent foldings"],
          TM4: ["Evaluate Dice overlap on transformed anatomical segmentations"],
          TM5: ["Assist TM1 with warp module testing and grid generation"],
          TM6: ["Assist TM2 with cascade architecture experimentation"],
          TM7: ["Assist TM3 with Jacobian regularization tuning"],
          TM8: ["Assist TM4 with Dice evaluation scripts across anatomical structures"],
          board_admin: ["Compile Week 3–4 sprint report", "Coordinate compute scheduling for cascade network training", "Prepare resource usage report"]
        }
      },
      {
        weeks: "Weeks 5–6", label: "Multimodal & Multi-Center Generalization", phase: 3,
        tasks: {
          mentor: ["Confirm quantitative PET values are preserved post-transformation for therapy response monitoring", "Review multi-center generalization strategy", "Validate SUV preservation approach"],
          associate: ["Run intensity-transformation experiments simulating varied scanner types", "Validate robustness across large lung volume changes (≥2L)", "Document findings for paper draft"],
          TM1: ["Apply intensity transformations to simulate differences across varied scanner types and radiation settings"],
          TM2: ["Adapt network to isolate and preserve quantitative SUV indices in PET data during warping"],
          TM3: ["Fine-tune regularization hyperparameters to balance alignment accuracy against deformation smoothness"],
          TM4: ["Validate system robustness across large lung volume changes (≥2L)"],
          TM5: ["Assist TM1 with scanner simulation augmentation pipeline"],
          TM6: ["Assist TM2 with SUV preservation validation"],
          TM7: ["Assist TM3 with regularization hyperparameter sweep"],
          TM8: ["Assist TM4 with large lung volume change evaluation"],
          board_admin: ["Update milestone tracker", "Prepare progress report for program admin", "Coordinate with associates on paper section drafting"]
        }
      },
      {
        weeks: "Weeks 7–8", label: "Validation & Docker Integration", phase: 4,
        tasks: {
          mentor: ["Perform final technical review of TRE and deformation field smoothness profiles", "Sign off on Docker container submission", "Final clinical plausibility review"],
          associate: ["Write challenge submission and paper draft", "Coordinate final Docker testing", "Submit to Codabench platform"],
          TM1: ["Deploy multi-resolution or instance-specific optimization techniques for fine structural alignment (with TM2)"],
          TM2: ["Co-develop instance optimization with TM1; finalize ensemble strategy"],
          TM3: ["Profile code execution speeds to minimize total processing time per scan pair"],
          TM4: ["Integrate validation metric tracking and build evaluation Docker container matching Codabench standards"],
          TM5: ["Assist with final optimization evaluation"],
          TM6: ["Run final TRE benchmarks and document results table"],
          TM7: ["Assist TM3 with execution speed profiling"],
          TM8: ["Assist TM4 with Codabench Docker container validation"],
          board_admin: ["Submit final Docker container", "File sprint completion report", "Organize team retrospective session"]
        }
      }
    ],
    assessment: [
      { role: "Mentor", metric: "Biomechanical Plausibility Review", criteria: "Zero negative Jacobian determinants; registration preserves realistic physical lung boundaries" },
      { role: "TM1", metric: "Affine Initialization Error Rates", criteria: "Pre-alignment reduces initial structural offset by ≥50% prior to deformable steps" },
      { role: "TM2", metric: "Transformation Accuracy Index", criteria: "TRE meets target limits; Dice scores improve across structures post-registration" },
      { role: "TM3", metric: "Field Regularization Balance", criteria: "Minimization of folding artifacts; regularized loss components converge smoothly" },
      { role: "TM4", metric: "Processing Latency & Container Compliance", criteria: "Code executes within clinical time limits; container validates perfectly on Codabench" }
    ]
  },
  MRIXFIELDS: {
    id: "MRIXFIELDS",
    name: "MRIxFields2026",
    fullName: "MRIxFields2026 — Cross-Field MRI Translation",
    theme: "Cross-Field MRI translation and field-aware contrast harmonization",
    color: "#E8860A",
    colorLight: "#fff8f0",
    icon: "🧲",
    dataset: "~500 retrospective + 200 prospective paired cross-field brain scans (0.1T to 7T). Sequence types: T1w, T2w, T2-FLAIR.",
    tasks: [
      "Reconstruct high-field equivalent structural scans from ultra-low-field inputs",
      "Develop unified, controllable field-to-field conditional synthesis framework"
    ],
    architecture: "[Low Field Scan (0.1T)] + [Target Field Condition (7T)] → [Conditional Generative Model] → [Harmonized High-Field Volume]",
    sprints: [
      {
        weeks: "Weeks 1–2", label: "Matrix Normalization & Diffusion/GAN Baselines", phase: 1,
        tasks: {
          mentor: ["Ensure intensity scaling methods adequately preserve structural features across differing field strengths", "Review paired dataset co-registration strategy", "Clinical review of T1w/T2w/FLAIR baseline quality"],
          associate: ["Set up Pix2PixHD or latent diffusion baseline model", "Benchmark nRMSE/SSIM on paired data", "Document baseline image quality scores"],
          TM1: ["Implement voxel-resampling, intensity normalization, and rigid co-registration for multi-field paired datasets"],
          TM2: ["Set up standard conditional generative baseline (Pix2PixHD or latent diffusion model)"],
          TM3: ["Configure standard pixel-level reconstruction and structural similarity loss functions (L1 + SSIM)"],
          TM4: ["Create evaluation suite tracking nRMSE, SSIM, and LPIPS scores"],
          TM5: ["Support TM1 with voxel resampling pipeline testing across field strengths"],
          TM6: ["Support TM2 with baseline GAN/diffusion model setup"],
          TM7: ["Support TM3 with loss function implementation and validation"],
          TM8: ["Support TM4 with multi-metric evaluation harness"],
          board_admin: ["Set up team repository and project board", "Schedule weekly sync with mentor", "Submit GPU resource requests for GAN training"]
        }
      },
      {
        weeks: "Weeks 3–4", label: "Controllable Field-Conditioning", phase: 2,
        tasks: {
          mentor: ["Verify model responds accurately to conditional field inputs without structural hallucinations", "Review AdaIN/cross-attention injection approach", "Validate field strength conditioning logic"],
          associate: ["Test conditional synthesis across all field transition increments", "Compare AdaIN vs cross-attention field injection", "Prepare mid-sprint report"],
          TM1: ["Build vector embedding modules to explicitly handle magnetic field strength parameters (0.1T, 1.5T, 3T, 7T)"],
          TM2: ["Integrate cross-attention mechanisms or AdaIN to inject field-strength conditions into generative network"],
          TM3: ["Incorporate perceptual loss (LPIPS) and adversarial loss to recover fine tissue details"],
          TM4: ["Measure synthesis quality trends across varying field transition increments"],
          TM5: ["Assist TM1 with field embedding module testing"],
          TM6: ["Assist TM2 with conditional injection mechanism evaluation"],
          TM7: ["Assist TM3 with GAN loss balancing and training stability"],
          TM8: ["Assist TM4 with synthesis quality trend visualization"],
          board_admin: ["Compile Week 3–4 sprint report", "Coordinate compute time for GAN training runs", "Ensure all team members have dataset access"]
        }
      },
      {
        weeks: "Weeks 5–6", label: "Anatomical Fidelity & Artifact Control", phase: 3,
        tasks: {
          mentor: ["Audit synthesized deep gray matter regions to ensure anatomical boundaries match target reference scans", "Review anatomical constraint network design", "Validate B0/B1 artifact simulation realism"],
          associate: ["Run Dice overlap tracking across 14 bilateral deep gray matter nuclei", "Analyze hallucination failure modes", "Document results for paper draft"],
          TM1: ["Apply targeted data augmentations to simulate realistic field artifacts (B0/B1 inhomogeneities and field noise)"],
          TM2: ["Implement secondary anatomical constraint network (pre-trained segmentation) to protect deep gray matter structures"],
          TM3: ["Integrate structural preservation terms into primary optimization objectives"],
          TM4: ["Track Dice overlap and volume consistency across 14 bilateral deep gray matter nuclei"],
          TM5: ["Assist TM1 with artifact simulation augmentation pipeline"],
          TM6: ["Assist TM2 with anatomical constraint network integration"],
          TM7: ["Assist TM3 with structural preservation loss tuning"],
          TM8: ["Assist TM4 with deep gray matter evaluation scripts"],
          board_admin: ["Update milestone tracker", "Prepare Weeks 5–6 progress report", "Coordinate with associates on paper methodology section"]
        }
      },
      {
        weeks: "Weeks 7–8", label: "Ensembling & Docker Deployment", phase: 4,
        tasks: {
          mentor: ["Sign off on final model structural fidelity, image quality metrics, and freedom from hallucinations", "Final review of all 5 challenge metrics", "Approve Synapse Docker submission"],
          associate: ["Write challenge submission paper", "Coordinate final Docker testing on Synapse", "Submit to challenge platform"],
          TM1: ["Deploy ensembling methods over multiple training checkpoints to reduce high-frequency reconstruction artifacts (with TM2)"],
          TM2: ["Co-develop checkpoint ensemble with TM1"],
          TM3: ["Apply model quantization or mixed-precision optimization for faster generation"],
          TM4: ["Run comprehensive validation across all 5 required challenge metrics; package into Synapse-compliant Docker container"],
          TM5: ["Assist with checkpoint ensemble evaluation"],
          TM6: ["Run final SSIM/LPIPS/nRMSE benchmarks and document results"],
          TM7: ["Assist TM3 with quantization and mixed-precision testing"],
          TM8: ["Assist TM4 with Synapse container compliance testing"],
          board_admin: ["Submit to Synapse challenge platform", "File final sprint report", "Plan team debrief and next steps"]
        }
      }
    ],
    assessment: [
      { role: "Mentor", metric: "Hallucination Audit & Validation Review", criteria: "Structural anatomy matches reference records; generated contrast scales cleanly with input conditions" },
      { role: "TM1", metric: "Cross-Field Co-registration Precision", criteria: "Spatial alignment errors between paired scans remain sub-voxel before processing steps" },
      { role: "TM2", metric: "Generative Fidelity & Visual Realism", criteria: "SSIM and LPIPS metrics hit target criteria; synthesized tissue boundaries remain sharp" },
      { role: "TM3", metric: "Loss Stability & Convergence Profile", criteria: "GAN/Diffusion training loops converge smoothly without mode collapse or gradient instability" },
      { role: "TM4", metric: "Multi-Metric Ranking Score", criteria: "Output achieves balanced performance rankings across all 5 target evaluation metrics" }
    ]
  },
  AUTOPET: {
    id: "AUTOPET",
    name: "autoPET V",
    fullName: "autoPET V — Interactive Lesion Segmentation",
    theme: "Interactive, clinician-in-the-loop tumor and lesion segmentation in whole-body PET/CT scans",
    color: "#0F9F6E",
    colorLight: "#f0fdf8",
    icon: "🩺",
    dataset: "Multi-center whole-body PET/CT cohort with QIBA-aligned SUV normalization and interactive corrective scribbles.",
    tasks: [
      "Develop interactive segmentation framework that refines whole-body lesion segmentations based on expert corrective inputs",
      "Support simulated or real clinician scribbles (clicks/masks) for iterative mask refinement"
    ],
    architecture: "[PET/CT Volume] + [Corrective Scribbles] → [Interactive Segmentation Model] → [Refined Target Mask] ↑← [Iterative Feedback Loop]",
    sprints: [
      {
        weeks: "Weeks 1–2", label: "Interactive Pipeline & Baseline Setup", phase: 1,
        tasks: {
          mentor: ["Validate correctness of interactive scribble generation logic relative to realistic clinical workflows", "Review SUV normalization strategy", "Ensure baseline interactive segmentation architecture is clinically appropriate"],
          associate: ["Set up interactive 3D UNet or medical SAM baseline", "Test scribble simulation engine with synthetic prompts", "Benchmark initial Dice and FP/FN volumes"],
          TM1: ["Implement QIBA-aligned SUV normalization and multi-modal PET/CT spatial concatenation pipelines"],
          TM2: ["Deploy baseline interactive segmentation architecture (interactive 3D UNet or medical SAM variant)"],
          TM3: ["Program scribble simulation engine converting false positive/negative errors into synthetic point/line prompts"],
          TM4: ["Set up tracking infrastructure monitoring initial Dice scores alongside False Positive/Negative Volume metrics"],
          TM5: ["Support TM1 with QIBA SUV normalization testing and validation"],
          TM6: ["Support TM2 with interactive baseline model configuration"],
          TM7: ["Support TM3 with scribble simulation engine testing"],
          TM8: ["Support TM4 with interactive evaluation metric harness"],
          board_admin: ["Set up team repo and project board", "Schedule weekly standups", "Submit GPU resource requests for whole-body PET/CT training"]
        }
      },
      {
        weeks: "Weeks 3–4", label: "Iterative Feedback Architecture", phase: 2,
        tasks: {
          mentor: ["Confirm model updates remain localized to targeted areas without degrading distant correct regions", "Review memory-guided module design", "Validate iterative feedback convergence behavior"],
          associate: ["Benchmark iterative update efficiency (Dice improvement per scribble)", "Compare memory-guided vs stateless approaches", "Prepare mid-sprint report"],
          TM1: ["Build data loading components managing multi-channel inputs (PET, CT, interaction masks) over consecutive training steps"],
          TM2: ["Engineer memory-guided neural network modules accepting iterative click updates without losing existing correct boundaries"],
          TM3: ["Formulate optimization function scoring both absolute segmentation accuracy and improvement rates per interaction step"],
          TM4: ["Benchmark how rapidly the model updates and converges given variable scribble sequences"],
          TM5: ["Assist TM1 with multi-channel data loader testing and memory efficiency"],
          TM6: ["Assist TM2 with memory-guided module implementation"],
          TM7: ["Assist TM3 with interactive loss function tuning"],
          TM8: ["Assist TM4 with convergence benchmarking scripts"],
          board_admin: ["Compile Week 3–4 sprint report", "Coordinate compute for iterative training runs", "Track team progress against 8-week timeline"]
        }
      },
      {
        weeks: "Weeks 5–6", label: "Physiological Uptake & False Positive Mitigation", phase: 3,
        tasks: {
          mentor: ["Assess model behavior against edge cases: low-uptake lesions vs background noise", "Review physiological uptake region isolation strategy", "Validate false positive penalty approach"],
          associate: ["Run segmentation evaluation on lesion-free control scans", "Analyze false positive distribution across anatomical regions", "Document findings for paper draft"],
          TM1: ["Isolate features from regions of normal physiological tracer absorption (brain, bladder, kidneys) to reduce false positives"],
          TM2: ["Implement architectural enhancements to differentiate true lesions from normal metabolic activity under scribble guidance"],
          TM3: ["Introduce specialized loss weighting to penalize persistent false positive volumes in normal tissues"],
          TM4: ["Evaluate segmentation metrics on lesion-free control scans"],
          TM5: ["Assist TM1 with physiological region feature isolation"],
          TM6: ["Assist TM2 with metabolic activity differentiation implementation"],
          TM7: ["Assist TM3 with false positive penalty loss tuning"],
          TM8: ["Assist TM4 with control scan evaluation scripts"],
          board_admin: ["Update milestone tracker", "Prepare Weeks 5–6 progress report", "Coordinate with associates on paper methodology section"]
        }
      },
      {
        weeks: "Weeks 7–8", label: "Evaluation & Interactive Containerization", phase: 4,
        tasks: {
          mentor: ["Validate complete system using manual interactive testing for real clinician workflow alignment", "Sign off on Docker interactive container", "Final clinical usability review"],
          associate: ["Write challenge submission paper", "Coordinate Grand-Challenge Docker testing", "Submit to challenge platform"],
          TM1: ["Fine-tune interaction loops to maximize metric improvement with minimal user corrective inputs (with TM2)"],
          TM2: ["Co-optimize interaction loops with TM1"],
          TM3: ["Verify inference cycles execute fast enough to support real-time user interactions"],
          TM4: ["Package interactive segmentation pipeline into Docker container handling automated iterative testing on Grand-Challenge/Codabench"],
          TM5: ["Assist with interaction loop optimization evaluation"],
          TM6: ["Run final Dice/FP/FN benchmarks and document results"],
          TM7: ["Assist TM3 with inference speed profiling and optimization"],
          TM8: ["Assist TM4 with Grand-Challenge Docker automated testing"],
          board_admin: ["Submit to Grand-Challenge platform", "File final sprint report", "Organize team debrief and celebration"]
        }
      }
    ],
    assessment: [
      { role: "Mentor", metric: "Clinical Workflow Usability Review", criteria: "System refines masks logically according to user input; interaction behavior remains stable" },
      { role: "TM1", metric: "SUV Normalization & Prompt Latency", criteria: "SUV values scale consistently across sites; interactive prompt parsing incurs zero visible lag" },
      { role: "TM2", metric: "Iterative Update Efficiency Index", criteria: "Dice accuracy improves consistently with each added interaction prompt" },
      { role: "TM3", metric: "False Positive Volume Metrics", criteria: "Continuous reduction in false positive clusters within normal anatomical structures" },
      { role: "TM4", metric: "Container Evaluation Compliance", criteria: "Interactive execution loops pass Grand-Challenge automated verification protocols" }
    ]
  }
};

const SCORING_WEIGHTS = { pipeline: 0.20, architecture: 0.30, optimization: 0.25, validation: 0.25 };

// ─────────────────────────────────────────────
//  SPRINT TASK MANAGER (Authorized Roles)
// ─────────────────────────────────────────────
function SprintTaskManager({ user, challenge, sprintIndex, sprint, tasks, onTasksChange, pushToSheets }) {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ title:"", description:"", assignedTo:"", deadline:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [scoreInput, setScoreInput] = useState({});
  const [feedbackInput, setFeedbackInput] = useState({});

  const sprintTasks = tasks.filter(t => t.challengeId === challenge.id && t.sprintIndex === sprintIndex);

  const statusColor = { draft:"#E8860A", assigned:"#1A6DFF", submitted:"#5B3BF5", confirmed:"#0F9F6E" };
  const statusLabel = { draft:"Draft", assigned:"Assigned", submitted:"Submitted", confirmed:"Confirmed" };

  const openNew = () => {
    setForm({ title:"", description:"", assignedTo:"", deadline:"", notes:"" });
    setEditingTask(null);
    setShowForm(true);
  };

  const openEdit = (t) => {
    setForm({ title:t.title, description:t.description, assignedTo:t.assignedTo, deadline:t.deadline||"", notes:t.notes||"" });
    setEditingTask(t);
    setShowForm(true);
  };

  const saveTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    if (editingTask) {
      const updated = { ...editingTask, ...form, updatedAt: now };
      await pushToSheets("SprintTasks", updated, true);
      onTasksChange(prev => prev.map(t => t.id === editingTask.id ? updated : t));
    } else {
      const newTask = {
        id: `T-${Date.now()}`,
        challengeId: challenge.id,
        sprintIndex,
        ...form,
        status: "draft",
        createdBy: user.email,
        createdAt: now,
        assignedAt: "",
        submittedAt: "",
        confirmedAt: "",
        fileLink: "",
        score: "",
        feedback: ""
      };
      await pushToSheets("SprintTasks", newTask);
      onTasksChange(prev => [...prev, newTask]);
    }
    setSaving(false);
    setShowForm(false);
    setEditingTask(null);
  };

  const assignTask = async (task) => {
    if (!task.assignedTo.trim()) return;
    const updated = { ...task, status:"assigned", assignedAt: new Date().toISOString() };
    await pushToSheets("SprintTasks", updated, true);
    onTasksChange(prev => prev.map(t => t.id === task.id ? updated : t));
  };

  const confirmTask = async (task) => {
    const sc = scoreInput[task.id] || "";
    const fb = feedbackInput[task.id] || "";
    const updated = { ...task, status:"confirmed", score: sc, feedback: fb, confirmedAt: new Date().toISOString() };
    await pushToSheets("SprintTasks", updated, true);
    onTasksChange(prev => prev.map(t => t.id === task.id ? updated : t));
    setConfirmingId(null);
  };

  const deleteTask = async (task) => {
    onTasksChange(prev => prev.filter(t => t.id !== task.id));
  };

  return (
    <div style={{marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--ink3)",letterSpacing:1,textTransform:"uppercase"}}>Sprint Tasks — {sprint.weeks}</div>
        <button onClick={openNew} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:"none",background:"var(--violet)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
          + Add Task
        </button>
      </div>

      {/* Task Form */}
      {showForm && (
        <div style={{padding:20,borderRadius:14,border:"2px solid var(--violet)",background:"#f9f8ff",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--violet)",marginBottom:14}}>{editingTask ? "Edit Task" : "New Task"}</div>
          <div style={{display:"grid",gap:10}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"var(--ink3)",marginBottom:4}}>Task Title *</div>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                placeholder="e.g. Implement co-registration pipeline"
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"var(--ink3)",marginBottom:4}}>Description</div>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                placeholder="Detailed task instructions..."
                rows={3}
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",resize:"vertical"}} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"var(--ink3)",marginBottom:4}}>Assign To (email or TM role)</div>
                <input value={form.assignedTo} onChange={e=>setForm(p=>({...p,assignedTo:e.target.value}))}
                  placeholder="e.g. TM1, TM2 or email@..."
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"var(--ink3)",marginBottom:4}}>Deadline</div>
                <input type="date" value={form.deadline} onChange={e=>setForm(p=>({...p,deadline:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
              </div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"var(--ink3)",marginBottom:4}}>Notes for member</div>
              <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
                placeholder="Resources, hints, references..."
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={saveTask} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"var(--violet)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:saving?0.6:1}}>
              {saving ? "Saving…" : editingTask ? "Save Changes" : "Create Task"}
            </button>
            <button onClick={()=>{setShowForm(false);setEditingTask(null);}} style={{padding:"8px 16px",borderRadius:8,border:"1px solid var(--frost)",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",color:"var(--ink3)"}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      {sprintTasks.length === 0 ? (
        <div style={{padding:"20px 16px",borderRadius:10,border:"1px dashed var(--frost)",textAlign:"center",color:"var(--ink3)",fontSize:13}}>
          No tasks created for this sprint yet. Click <strong>+ Add Task</strong> to create one.
        </div>
      ) : sprintTasks.map(task => (
        <div key={task.id} style={{padding:16,borderRadius:12,border:`1px solid ${statusColor[task.status]}30`,background:`${statusColor[task.status]}06`,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:statusColor[task.status],display:"inline-block",flexShrink:0}} />
                <span style={{fontSize:13,fontWeight:700,color:"var(--ink)"}}>{task.title}</span>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:`${statusColor[task.status]}18`,color:statusColor[task.status],border:`1px solid ${statusColor[task.status]}30`}}>{statusLabel[task.status]}</span>
              </div>
              {task.description && <div style={{fontSize:12,color:"var(--ink2)",marginBottom:4,lineHeight:1.5,paddingLeft:16}}>{task.description}</div>}
              <div style={{display:"flex",gap:12,paddingLeft:16,flexWrap:"wrap"}}>
                {task.assignedTo && <span style={{fontSize:11,color:"var(--ink3)"}}>👤 {task.assignedTo}</span>}
                {task.deadline && <span style={{fontSize:11,color:"var(--ink3)"}}>📅 {task.deadline}</span>}
                {task.fileLink && <span style={{fontSize:11,color:"var(--azure)"}}>📎 <a href={task.fileLink} target="_blank" rel="noreferrer" style={{color:"var(--azure)"}}>Submitted file</a></span>}
                {task.score && <span style={{fontSize:11,fontWeight:700,color:"#0F9F6E"}}>⭐ Score: {task.score}/100</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              {task.status === "draft" && (
                <button onClick={()=>assignTask(task)} style={{padding:"5px 12px",borderRadius:7,border:"none",background:"#1A6DFF",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                  Assign →
                </button>
              )}
              {task.status === "submitted" && (
                <button onClick={()=>setConfirmingId(task.id)} style={{padding:"5px 12px",borderRadius:7,border:"none",background:"#0F9F6E",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                  Review & Score
                </button>
              )}
              <button onClick={()=>openEdit(task)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid var(--frost)",background:"#fff",color:"var(--ink3)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                ✏️
              </button>
              <button onClick={()=>deleteTask(task)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid #fde8ec",background:"#fff5f7",color:"var(--rose)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                🗑
              </button>
            </div>
          </div>

          {/* Confirm / Score Panel */}
          {confirmingId === task.id && (
            <div style={{marginTop:10,padding:14,borderRadius:10,border:"1px solid #0F9F6E40",background:"#f0fdf8"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:12,fontWeight:700,color:"#0F9F6E",marginBottom:10}}>Review Submission</div>
              {task.fileLink && (
                <div style={{marginBottom:10,fontSize:12,color:"var(--ink2)"}}>
                  📎 Submitted file: <a href={task.fileLink} target="_blank" rel="noreferrer" style={{color:"var(--azure)",fontWeight:600}}>View File</a>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--ink3)",marginBottom:4}}>Score (0–100)</div>
                  <input type="number" min={0} max={100} value={scoreInput[task.id]||""} onChange={e=>setScoreInput(p=>({...p,[task.id]:e.target.value}))}
                    placeholder="85"
                    style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--ink3)",marginBottom:4}}>Feedback for member</div>
                  <input value={feedbackInput[task.id]||""} onChange={e=>setFeedbackInput(p=>({...p,[task.id]:e.target.value}))}
                    placeholder="Great work on the registration pipeline..."
                    style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>confirmTask(task)} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F9F6E",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                  ✓ Confirm & Score
                </button>
                <button onClick={()=>setConfirmingId(null)} style={{padding:"7px 14px",borderRadius:8,border:"1px solid var(--frost)",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",color:"var(--ink3)"}}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Show feedback if confirmed */}
          {task.status === "confirmed" && task.feedback && (
            <div style={{marginTop:8,padding:"10px 14px",borderRadius:8,background:"#f0fdf8",border:"1px solid #0F9F6E30",fontSize:12,color:"var(--ink2)"}}>
              💬 <strong>Feedback:</strong> {task.feedback}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MEMBER TASK VIEW (Members only)
// ─────────────────────────────────────────────
function MemberTaskView({ user, challenge, tasks, onTasksChange, pushToSheets }) {
  const userKey = (user.teamRole || "").toLowerCase().trim();
  const userEmail = (user.email || "").toLowerCase().trim();
  const team = getTeam(user);

  const isAssociate = userKey === "associate_researcher" || userKey === "associate";
  if (isAssociate) return (
    <div style={{padding:"32px 24px",textAlign:"center",borderRadius:16,border:"1px dashed var(--frost)",background:"var(--snow)"}}>
      <div style={{fontSize:36,marginBottom:12}}>📊</div>
      <div style={{fontSize:15,fontWeight:700,color:"var(--ink)",marginBottom:8}}>You assess tasks, not receive them</div>
      <div style={{fontSize:13,color:"var(--ink3)",maxWidth:380,margin:"0 auto",lineHeight:1.7}}>
        As Associate Researcher, you assign and review tasks for team members. Use the Sprint Plan to manage the team's work.
      </div>
    </div>
  );

  // Member sees tasks assigned to them, their role, or "all"
  const myTasks = tasks.filter(t => {
    if (t.status === "draft") return false;
    const at = (t.assignedTo || "").toLowerCase().trim();
    return at === "all" || at === userEmail || at === userKey || at.includes(userEmail);
  });

  const [fileLinks, setFileLinks] = useState({});
  const [suppLinks, setSuppLinks] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [mySubmissions, setMySubmissions] = useState([]);

  useEffect(() => {
    if (!team) return;
    sheetsAPI.getByTeam("TaskSubmissions", team.id).then(subs => {
      if (Array.isArray(subs)) setMySubmissions(subs.filter(s => (s.memberEmail || "").toLowerCase() === userEmail));
    }).catch(() => {});
  }, [team?.id]);

  const getSub = (taskId) => mySubmissions.find(s => s.taskId === taskId);

  const submitTask = async (task) => {
    const link = fileLinks[task.id] || "";
    if (!link.trim()) return;
    setSubmitting(task.id);
    const submittedAt = new Date().toISOString();
    const existing = getSub(task.id);
    if (existing) {
      await sheetsAPI.updateByMatch("TaskSubmissions", "id", existing.id, { fileLink: link, suppLinks: suppLinks[task.id] || "", submittedAt, status: "submitted" });
      setMySubmissions(p => p.map(s => s.id === existing.id ? { ...s, fileLink: link, suppLinks: suppLinks[task.id] || "", submittedAt, status: "submitted" } : s));
    } else {
      const sub = { id: `SUB${Date.now()}`, taskId: task.id, taskTitle: task.taskTitle || task.title || "", teamId: team?.id || "", memberEmail: userEmail, fileLink: link, suppLinks: suppLinks[task.id] || "", submittedAt, status: "submitted" };
      await sheetsAPI.push("TaskSubmissions", sub);
      setMySubmissions(p => [...p, sub]);
    }
    // Always also update TeamTasks row so legacy AR views still work
    await sheetsAPI.updateByMatch("TeamTasks", "id", task.id, { status: "submitted", fileLink: link, submittedBy: userEmail, submittedAt });
    onTasksChange(prev => prev.map(t => t.id === task.id ? { ...t, status: "submitted", fileLink: link, submittedAt } : t));
    setSubmitting(null);
  };

  const saveEditSubmission = async (task) => {
    const existing = getSub(task.id);
    const link = fileLinks[task.id] || existing?.fileLink || task.fileLink || task.submissionLink || "";
    setSubmitting(task.id);
    const submittedAt = new Date().toISOString();
    if (existing) {
      await sheetsAPI.updateByMatch("TaskSubmissions", "id", existing.id, { fileLink: link, suppLinks: suppLinks[task.id] || existing.suppLinks || "", submittedAt });
      setMySubmissions(p => p.map(s => s.id === existing.id ? { ...s, fileLink: link, submittedAt } : s));
    } else {
      // Legacy submission lives in TeamTasks — update it there
      await sheetsAPI.updateByMatch("TeamTasks", "id", task.id, { fileLink: link, submissionLink: link, suppLinks: suppLinks[task.id] || task.suppLinks || "", submittedAt });
    }
    setEditingSubmission(null);
    setSubmitting(null);
  };

  const phaseColors = ["#E53E5C","#5B3BF5","#0EA5C5","#0F9F6E"];
  const statusColor = { assigned:"#1A6DFF", submitted:"#5B3BF5", confirmed:"#0F9F6E", graded:"#0F9F6E" };
  const statusLabel = { assigned:"To Do", submitted:"Pending Review", confirmed:"Completed ✓", graded:"Graded ✓" };

  if (myTasks.length === 0) {
    return (
      <div style={{padding:"48px 24px",textAlign:"center",borderRadius:16,border:"1px dashed var(--frost)",background:"var(--snow)"}}>
        <div style={{fontSize:40,marginBottom:12}}>📋</div>
        <div style={{fontSize:15,fontWeight:700,color:"var(--ink)",marginBottom:8}}>No tasks assigned yet</div>
        <div style={{fontSize:13,color:"var(--ink3)",maxWidth:340,margin:"0 auto",lineHeight:1.7}}>
          Your mentor or associate researcher will assign tasks to you. Check back after your next team meeting.
        </div>
      </div>
    );
  }

  // Group by sprint; tasks without sprintIndex go into an "All Tasks" bucket
  const sprintedTasks = myTasks.filter(t => t.sprintIndex !== undefined && t.sprintIndex !== null && t.sprintIndex !== "");
  const unsprintedTasks = myTasks.filter(t => t.sprintIndex === undefined || t.sprintIndex === null || t.sprintIndex === "");
  const bySprint = [
    ...([0,1,2,3].map(si => ({
      sprint: challenge.sprints?.[si] || { weeks: `Sprint ${si+1}` },
      si,
      tasks: sprintedTasks.filter(t => String(t.sprintIndex) === String(si))
    })).filter(g => g.tasks.length > 0)),
    ...(unsprintedTasks.length > 0 ? [{ sprint: { weeks: "Assigned Tasks" }, si: "all", tasks: unsprintedTasks }] : [])
  ];

  return (
    <div>
      {bySprint.map(({ sprint, si, tasks: stasks }) => (
        <div key={si} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{padding:"4px 14px",borderRadius:20,fontSize:11,fontWeight:700,color:phaseColors[si],background:`${phaseColors[si]}12`,border:`1px solid ${phaseColors[si]}30`}}>
              {sprint.weeks}
            </span>
            <span style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>{sprint.label}</span>
          </div>
          <div style={{display:"grid",gap:12,paddingLeft:8,borderLeft:`3px solid ${phaseColors[si]}40`}}>
            {stasks.map(task => {
              const sub = getSub(task.id);
              const isWholeTeam = (task.assignedTo || "").toLowerCase().trim() === "all";
              const effStatus = sub?.status || (isWholeTeam ? "assigned" : (task.status || "assigned"));
              const effScore = sub?.score;
              const effFeedback = sub?.feedback;
              const effFileLink = sub?.fileLink;
              const effSuppLinks = sub?.suppLinks;
              const sc = statusColor[effStatus] || "#1A6DFF";
              return (
              <div key={task.id} style={{padding:18,borderRadius:14,border:`1px solid ${sc}30`,background:"#fff",boxShadow:"0 2px 10px rgba(91,59,245,.06)"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:10}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>{task.title || task.taskTitle}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:20,background:`${sc}15`,color:sc,border:`1px solid ${sc}30`}}>
                        {statusLabel[effStatus] || effStatus}
                      </span>
                    </div>
                    {(task.description || task.taskDesc) && <div style={{fontSize:13,color:"var(--ink2)",lineHeight:1.6,marginBottom:6}}>{task.description || task.taskDesc}</div>}
                    {task.notes && <div style={{fontSize:12,color:"var(--ink3)",padding:"6px 10px",background:"var(--snow)",borderRadius:7,marginBottom:6}}>💡 {task.notes}</div>}
                    {task.suppFiles && (
                      <div style={{fontSize:12,color:"var(--azure)",marginBottom:6}}>
                        📎 Supplementary: {task.suppFiles.split(",").map((f,i) => (
                          <a key={i} href={f.trim()} target="_blank" rel="noreferrer" style={{marginRight:8,color:"var(--azure)"}}>File {i+1} ↗</a>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {(task.deadline || task.dueDate) && <span style={{fontSize:11,color:"var(--ink3)"}}>📅 Due: {task.deadline || task.dueDate}</span>}
                    </div>
                  </div>
                  {(effStatus === "confirmed" || effStatus === "graded") && effScore && (
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:28,fontWeight:900,color:"#0F9F6E",lineHeight:1}}>{effScore}</div>
                      <div style={{fontSize:10,color:"var(--ink3)"}}>/ 100</div>
                    </div>
                  )}
                </div>

                {/* Graded / Confirmed feedback */}
                {(effStatus === "graded" || effStatus === "confirmed") && effFeedback && (
                  <div style={{padding:"10px 14px",borderRadius:9,background:"#f0fdf8",border:"1px solid #0F9F6E30",fontSize:13,color:"var(--ink2)",marginBottom:12}}>
                    💬 <strong>Feedback:</strong> {effFeedback}
                  </div>
                )}

                {/* Submitted / Graded state */}
                {(effStatus === "submitted" || effStatus === "graded") && editingSubmission !== task.id && (
                  <div style={{padding:"10px 14px",borderRadius:9,background: effStatus === "graded" ? "#f0fdf8" : "#f5f3ff",border:`1px solid ${effStatus === "graded" ? "#0F9F6E30" : "#5B3BF530"}`,fontSize:13,color:"var(--ink2)"}}>
                    {effStatus === "submitted" ? "⏳ Submitted — pending review." : "✅ Graded"}
                    {effFileLink && <span> <a href={effFileLink} target="_blank" rel="noreferrer" style={{color:"var(--azure)",fontWeight:600}}>View your file →</a></span>}
                    <button onClick={() => { setEditingSubmission(task.id); setFileLinks(p => ({...p,[task.id]:effFileLink||""})); setSuppLinks(p => ({...p,[task.id]:effSuppLinks||""})); }} style={{marginLeft:10,fontSize:11,padding:"3px 10px",borderRadius:7,border:"1px solid var(--violet)",background:"transparent",color:"var(--violet)",cursor:"pointer",fontWeight:600}}>Edit Submission</button>
                  </div>
                )}

                {/* Edit submission form */}
                {(effStatus === "submitted" || effStatus === "graded") && editingSubmission === task.id && (
                  <div style={{marginTop:8,padding:14,borderRadius:10,background:"var(--snow)",border:"1px solid var(--frost)"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--ink)",marginBottom:8}}>✏️ Edit Submission</div>
                    <div style={{marginBottom:8}}>
                      <input value={fileLinks[task.id]||""} onChange={e=>setFileLinks(p=>({...p,[task.id]:e.target.value}))} placeholder="Paste Google Drive / GitHub link here..." style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
                    </div>
                    <div style={{marginBottom:8}}>
                      <input value={suppLinks[task.id]||""} onChange={e=>setSuppLinks(p=>({...p,[task.id]:e.target.value}))} placeholder="Additional Files (optional, comma-separated links)" style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>saveEditSubmission(task)} disabled={submitting===task.id} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"var(--violet)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:submitting===task.id?0.5:1}}>
                        {submitting===task.id ? "Saving…" : "Save →"}
                      </button>
                      <button onClick={()=>setEditingSubmission(null)} style={{padding:"9px 14px",borderRadius:8,border:"1px solid var(--frost)",background:"transparent",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Submission form for assigned tasks */}
                {effStatus === "assigned" && (
                  <div style={{marginTop:8,padding:14,borderRadius:10,background:"var(--snow)",border:"1px solid var(--frost)"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--ink)",marginBottom:8}}>📎 Submit your work</div>
                    <div style={{fontSize:12,color:"var(--ink3)",marginBottom:10}}>Upload your file to Google Drive and paste the shareable link below.</div>
                    <div style={{marginBottom:8}}>
                      <input value={fileLinks[task.id]||""} onChange={e=>setFileLinks(p=>({...p,[task.id]:e.target.value}))} placeholder="Paste Google Drive / GitHub link here..." style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
                    </div>
                    <div style={{marginBottom:8}}>
                      <input value={suppLinks[task.id]||""} onChange={e=>setSuppLinks(p=>({...p,[task.id]:e.target.value}))} placeholder="Additional Files (optional, comma-separated links)" style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:"1px solid var(--frost)",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} />
                    </div>
                    <button onClick={()=>submitTask(task)} disabled={submitting===task.id || !fileLinks[task.id]?.trim()} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"var(--violet)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:(submitting===task.id||!fileLinks[task.id]?.trim())?0.5:1,whiteSpace:"nowrap"}}>
                      {submitting===task.id ? "Submitting…" : "Submit →"}
                    </button>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MICCAI CHALLENGES PAGE COMPONENT
// ─────────────────────────────────────────────
function MICCAIChallenges({ user }) {
  const { pushToSheets } = useContext(DataCtx);
  const challengeId = (user.challengeId || "").toString().toUpperCase().trim();
  const teamRole = (user.teamRole || "").toString().toLowerCase().trim();

  const isMentor = teamRole === "mentor";
  const isAssociate = teamRole === "associate_researcher" || teamRole === "associate";
  const isAdmin = teamRole === "board_admin" || teamRole === "admin";
  const isAuthorized = isMentor || isAssociate || isAdmin;
  const canSwitchChallenge = isMentor || isAdmin;

  const [activeChallenge, setActiveChallenge] = useState(
    MICCAI_CHALLENGES[challengeId] ? challengeId : Object.keys(MICCAI_CHALLENGES)[0]
  );
  const [mainTab, setMainTab] = useState(isAuthorized ? "overview" : "mytasks");
  const [activeSprint, setActiveSprint] = useState(0);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [animIn, setAnimIn] = useState(true);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [nextMeeting, setNextMeeting] = useState(null);

  const challenge = MICCAI_CHALLENGES[activeChallenge];
  const userRoleKey = isMentor ? "mentor" : isAssociate ? "associate" : isAdmin ? "board_admin" : teamRole || "TM1";

  useEffect(() => {
    const team = getTeam(user);
    const teamId = team?.id;
    (teamId ? sheetsAPI.getByTeam("TeamTasks", teamId) : sheetsAPI.get("TeamTasks")).then(data => {
      if (Array.isArray(data)) setSprintTasks(data);
      setLoadingTasks(false);
    }).catch(() => setLoadingTasks(false));
    // Load upcoming meeting for announcement banner
    if (team) {
      sheetsAPI.getByTeam("MeetingNotes", team.id).then(meetings => {
        if (Array.isArray(meetings)) {
          const upcoming = meetings
            .filter(m => new Date(m.meetingDate + (m.meetingTime ? "T" + m.meetingTime : "")) >= new Date())
            .sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate))[0];
          if (upcoming) setNextMeeting(upcoming);
        }
      }).catch(() => {});
    }
  }, []);

  const pushTaskToSheets = async (sheet, data, isUpdate) => {
    if (isUpdate) {
      await sheetsAPI.updateByMatch(sheet, "id", data.id, data);
    } else {
      await pushToSheets(sheet, data);
    }
  };

  const switchChallenge = (id) => {
    setAnimIn(false);
    setTimeout(() => { setActiveChallenge(id); setActiveSprint(0); setExpandedTasks({}); setAnimIn(true); }, 220);
  };

  const toggleTask = (key) => setExpandedTasks(p => ({ ...p, [key]: !p[key] }));

  const roleLabel = (r) => {
    const map = { mentor:"Mentor", associate:"Associate Researcher", board_admin:"Board Admin",
      TM1:"Team Member 1", TM2:"Team Member 2", TM3:"Team Member 3", TM4:"Team Member 4",
      TM5:"Team Member 5", TM6:"Team Member 6", TM7:"Team Member 7", TM8:"Team Member 8" };
    return map[r] || r;
  };

  const roleColor = (r) => {
    if (r === "mentor") return "#5B3BF5";
    if (r === "associate" || r === "associate_researcher") return "#1A6DFF";
    if (r === "board_admin" || r === "admin") return "#E8860A";
    const tm = parseInt(r.replace("TM",""));
    const cols = ["#0EA5C5","#0F9F6E","#E53E5C","#E8860A","#5B3BF5","#1A6DFF","#0EA5C5","#0F9F6E"];
    return cols[(tm - 1) % cols.length] || "#5B3BF5";
  };

  const phaseColors = ["#E53E5C","#5B3BF5","#0EA5C5","#0F9F6E"];

  const myTasks = challenge.sprints.map(s => ({
    ...s,
    myTasks: s.tasks[userRoleKey] || s.tasks["TM1"] || []
  }));

  return (
    <div>
      <style>{`
        @keyframes miccai-fadein { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes miccai-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes miccai-bar { from{width:0} }
        @keyframes miccai-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .miccai-fadein { animation: miccai-fadein .35s cubic-bezier(.22,1,.36,1) both; }
        .miccai-card { background:#fff; border-radius:16px; border:1px solid var(--frost); box-shadow:0 2px 12px rgba(91,59,245,.07); transition:box-shadow .2s,transform .2s; }
        .miccai-card:hover { box-shadow:0 6px 28px rgba(91,59,245,.13); }
        .miccai-tab { padding:8px 18px; border-radius:9px; border:1px solid transparent; font-size:13px; font-weight:600; cursor:pointer; background:transparent; font-family:'DM Sans',sans-serif; transition:all .18s; color:var(--ink3); }
        .miccai-tab.active { background:#fff; border-color:var(--frost); color:var(--ink); box-shadow:0 2px 8px rgba(91,59,245,.1); }
        .miccai-tab:hover:not(.active) { background:var(--snow); color:var(--ink); }
        .miccai-chip-btn { display:flex; align-items:center; gap:8px; padding:10px 16px; border-radius:12px; border:2px solid transparent; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700; transition:all .2s; }
        .miccai-chip-btn.active { border-color:currentColor; }
        .miccai-sprint-dot { width:14px; height:14px; border-radius:50%; border:2px solid; cursor:pointer; transition:all .2s; flex-shrink:0; }
        .miccai-sprint-dot.done { background:currentColor; }
        .miccai-sprint-dot.active { background:currentColor; transform:scale(1.3); box-shadow:0 0 0 3px rgba(91,59,245,.18); }
        .miccai-task-row { padding:12px 16px; border-radius:10px; border:1px solid var(--frost); margin-bottom:8px; cursor:pointer; transition:all .18s; background:var(--snow); }
        .miccai-task-row:hover { border-color:var(--mist); background:#fff; }
        .miccai-task-row.expanded { border-color:var(--violet); background:#fff; box-shadow:0 2px 12px rgba(91,59,245,.1); }
        .miccai-score-bar { height:10px; border-radius:6px; background:var(--frost); overflow:hidden; }
        .miccai-score-fill { height:100%; border-radius:6px; animation:miccai-bar .6s ease both; transition:width .4s ease; }
        .miccai-week-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:20px; font-size:11px; font-weight:700; border:1px solid; letter-spacing:.3px; }
        .miccai-assess-row { display:grid; grid-template-columns:120px 1fr 1fr; gap:16px; padding:14px 16px; border-radius:10px; border:1px solid var(--frost); margin-bottom:8px; align-items:start; transition:all .18s; }
        .miccai-assess-row:hover { border-color:var(--mist); background:var(--snow); }
        .miccai-arch-box { background:linear-gradient(135deg,#0C1227,#1a2045); border-radius:12px; padding:16px 20px; font-family:'DM Mono',monospace; font-size:12px; color:#a8d8ea; line-height:1.8; overflow-x:auto; }
        .miccai-my-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; background:linear-gradient(135deg,#5B3BF5,#1A6DFF); color:#fff; }
      `}</style>

      {/* Header Banner */}
      <div style={{background:`linear-gradient(135deg,${challenge.color}18,${challenge.colorLight})`,border:`1px solid ${challenge.color}30`,borderRadius:20,padding:"24px 28px",marginBottom:24,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,width:180,height:180,borderRadius:"50%",background:`${challenge.color}10`,pointerEvents:"none"}} />
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:28}}>{challenge.icon}</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:challenge.color,letterSpacing:1.5,textTransform:"uppercase",marginBottom:2}}>MICCAI 2026 · Medical Imaging Track</div>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:"var(--ink)",lineHeight:1.1}}>{challenge.fullName}</div>
              </div>
            </div>
            <div style={{fontSize:13,color:"var(--ink2)",maxWidth:600,lineHeight:1.6}}>{challenge.theme}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
            <div className="miccai-my-badge">👤 {roleLabel(userRoleKey)}</div>
            <div style={{fontSize:11,color:"var(--ink3)"}}>8-Week Sprint · 4 Milestones</div>
          </div>
        </div>
      </div>

      {/* Challenge Selector — only mentors & admins can switch; members are locked to their assigned challenge */}
      {canSwitchChallenge && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
          {Object.values(MICCAI_CHALLENGES).map(c => (
            <button key={c.id} onClick={() => switchChallenge(c.id)}
              className="miccai-chip-btn"
              style={{color:c.color,background:activeChallenge===c.id ? `${c.color}12` : "transparent",borderColor:activeChallenge===c.id ? c.color : "var(--frost)"}}>
              <span>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Upcoming Meeting Announcement */}
      {nextMeeting && (
        <div style={{marginBottom:16,padding:"14px 20px",borderRadius:14,background:"linear-gradient(135deg,#1A6DFF15,#0EA5C515)",border:"1.5px solid #1A6DFF30",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <span style={{fontSize:24,flexShrink:0}}>📅</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,color:"#1A6DFF",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Upcoming Meeting</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>{nextMeeting.title}</div>
            <div style={{fontSize:12,color:"var(--ink3)",marginTop:2}}>{nextMeeting.meetingDate}{nextMeeting.meetingTime ? ` · ${nextMeeting.meetingTime} GMT+3` : ""}</div>
          </div>
          {nextMeeting.meetLink && (
            <a href={nextMeeting.meetLink} target="_blank" rel="noreferrer"
              style={{padding:"8px 18px",borderRadius:10,background:"#1A6DFF",color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none",flexShrink:0}}>
              🎥 Join
            </a>
          )}
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div style={{display:"flex",gap:6,background:"var(--snow)",padding:5,borderRadius:12,border:"1px solid var(--frost)",marginBottom:20,flexWrap:"wrap"}}>
        {(isAuthorized
          ? [["overview","🎯","Overview"],["guidelines","📖","Guidelines"]]
          : [["mytasks","✅","My Tasks"],["feedback","📝","Weekly Feedback"],["guidelines","📖","Guidelines"]]
        ).map(([id,ic,lb]) => (
          <button key={id} className={`miccai-tab ${mainTab===id?"active":""}`} onClick={() => setMainTab(id)}>{ic} {lb}</button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {mainTab === "overview" && (
        <div className="miccai-fadein" style={{display:"grid",gap:16}}>
          {/* Challenge Details Row */}
          <div className="miccai-card" style={{padding:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--ink3)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:12}}>Dataset</div>
            <div style={{fontSize:14,fontWeight:600,color:"var(--ink)",lineHeight:1.6,marginBottom:12}}>{challenge.dataset}</div>
            <div style={{fontSize:11,fontWeight:700,color:"var(--ink3)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:8,marginTop:4}}>Challenge Tasks</div>
            {challenge.tasks.map((t,i) => (
              <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<challenge.tasks.length-1?"1px solid var(--frost)":"none",alignItems:"flex-start"}}>
                <span style={{minWidth:22,height:22,borderRadius:"50%",background:`${challenge.color}18`,color:challenge.color,fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</span>
                <span style={{fontSize:13,color:"var(--ink2)",lineHeight:1.5}}>{t}</span>
              </div>
            ))}
          </div>

        </div>
      )}


      {/* ── TAB: MY TASKS (Members only) ── */}
      {mainTab === "mytasks" && (
        <div className="miccai-fadein">
          <div style={{padding:"14px 18px",borderRadius:12,background:`${challenge.color}10`,border:`1px solid ${challenge.color}30`,marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:22}}>{challenge.icon}</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--ink)"}}>Your Role: <span style={{color:challenge.color}}>{roleLabel(userRoleKey)}</span></div>
              <div style={{fontSize:12,color:"var(--ink3)"}}>Tasks assigned to you by your mentor — submit your work below each task</div>
            </div>
          </div>
          {loadingTasks ? (
            <div style={{textAlign:"center",padding:"40px",color:"var(--ink3)",fontSize:13}}>Loading your tasks…</div>
          ) : (
            <MemberTaskView user={user} challenge={challenge} tasks={sprintTasks} onTasksChange={setSprintTasks} pushToSheets={pushTaskToSheets} />
          )}
        </div>
      )}

      {/* ── TAB: WEEKLY FEEDBACK (Members only) ── */}
      {mainTab === "feedback" && (
        <div className="miccai-fadein">
          <WeeklyFeedbackView user={user} />
        </div>
      )}

      {/* ── TAB: GUIDELINES (all roles) ── */}
      {mainTab === "guidelines" && (
        <div className="miccai-fadein">
          <RoleGuidelinesView user={user} />
        </div>
      )}

      {/* ── TAB: MANAGE TASKS (Authorized roles only) ── */}

    </div>
  );
}

function TrainingModules({ user }) {
  const [tab, setTab] = useState(0);

  // Normalize track value from sheet (case-insensitive)
  const trackRaw = (user.track || "").toString().toLowerCase().trim();
  const isMedicalImaging = trackRaw.includes("medical imaging") || trackRaw.includes("medical_imaging");

  const medicalImagingModules = [
    { id:"M1", title:"Introduction to Medical Imaging & Modalities",      type:"Lecture",  dur:"2h 00m" },
    { id:"M2", title:"Image Preprocessing & Augmentation for Biomedical Data", type:"Lecture", dur:"2h 30m" },
    { id:"M3", title:"Convolutional Neural Networks for Image Classification", type:"Lab",     dur:"2h 00m" },
    { id:"M4", title:"Segmentation Techniques: U-Net & Variants",          type:"Lab",      dur:"2h 15m" },
    { id:"M5", title:"Object Detection in Medical Images (YOLO, Faster R-CNN)", type:"Lecture", dur:"1h 45m" },
    { id:"M6", title:"Transfer Learning with Pre-trained Models (ResNet, VGG)", type:"Lab",  dur:"2h 00m" },
    { id:"M7", title:"Research Methodology & IEEE Paper Writing",          type:"Workshop", dur:"2h 30m" },
    { id:"M8", title:"Capstone Project Kickoff & Dataset Selection",       type:"Workshop", dur:"1h 30m" },
  ];

  const medicalImagingReading = [
    "Litjens et al. — A Survey on Deep Learning in Medical Image Analysis (Medical Image Analysis, 2017)",
    "Ronneberger et al. — U-Net: Convolutional Networks for Biomedical Image Segmentation (MICCAI, 2015)",
    "Shen et al. — Deep Learning in Medical Image Analysis (Annual Review of Biomedical Engineering, 2017)",
    "Goodfellow et al. — Deep Learning, Chapters 9 & 10 (MIT Press, 2016)",
    "IEEE EMBS Guidelines for Clinical AI Research & Ethical Considerations",
  ];

  if (!isMedicalImaging) {
    return (
      <div className="card">
        <div className="card-body" style={{textAlign:"center",padding:"64px 24px"}}>
          <div style={{fontSize:48,marginBottom:16}}>📚</div>
          <div style={{fontSize:17,fontWeight:700,color:"var(--ink)",marginBottom:8}}>Training content coming soon</div>
          <div style={{fontSize:13,color:"var(--ink3)",maxWidth:380,margin:"0 auto",lineHeight:1.7}}>
            Your track-specific training materials haven't been published yet. Check back after the orientation session.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="tabs">
        {["Video Lectures","Reading List","Submit Assignment","Capstone Project"].map((t,i)=>(
          <button key={i} className={`tab ${tab===i?"active":""}`} onClick={()=>setTab(i)}>{t}</button>
        ))}
      </div>

      {tab===0&&(
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Medical Imaging Training Modules</div><div className="card-sub">Track: Medical Imaging · {medicalImagingModules.length} modules</div></div>
          </div>
          <div className="card-body" style={{padding:0}}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Duration</th><th>Action</th><th>Due</th></tr></thead>
              <tbody>{medicalImagingModules.map(m=>(
                <tr key={m.id}>
                  <td className="mono" style={{color:"var(--mist)",fontSize:11}}>{m.id}</td>
                  <td style={{fontWeight:600}}>{m.title}</td>
                  <td><span className="tag">{m.type}</span></td>
                  <td className="mono" style={{fontSize:12}}>{m.dur}</td>
                  <td>
                    <button className="btn btn-o btn-sm" disabled style={{opacity:0.45,cursor:"not-allowed"}}>Watch</button>
                  </td>
                  <td style={{fontSize:11,color:"var(--ink3)",whiteSpace:"nowrap"}}>Due will be determined later</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab===1&&(
        <div className="card">
          <div className="card-header"><div className="card-title">Curated Reading List — Medical Imaging</div></div>
          <div className="card-body">
            {medicalImagingReading.map((r,i)=>(
              <div key={i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid var(--frost)",alignItems:"center"}}>
                <span style={{fontSize:20}}>📖</span>
                <span style={{fontSize:13,fontWeight:500,flex:1}}>{r}</span>
                <button className="btn btn-o btn-sm" disabled style={{opacity:0.45,cursor:"not-allowed"}}>IEEE Xplore →</button>
              </div>
            ))}
            <div style={{marginTop:16,padding:"12px 14px",background:"var(--snow)",borderRadius:10,fontSize:12,color:"var(--ink3)"}}>
              🔒 Links will be activated after the orientation session on <strong>8 May</strong>.
            </div>
          </div>
        </div>
      )}

      {tab===2&&(
        <div className="card">
          <div className="card-header"><div className="card-title">Weekly Assignment Submission</div></div>
          <div className="card-body" style={{textAlign:"center",padding:"48px 24px"}}>
            <div style={{fontSize:40,marginBottom:12}}>📝</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Submissions not open yet</div>
            <div style={{fontSize:13,color:"var(--ink3)",maxWidth:340,margin:"0 auto",lineHeight:1.7}}>
              Assignment submissions will open after the orientation session on <strong>8 May</strong>. Due dates will be determined then.
            </div>
          </div>
        </div>
      )}

      {tab===3&&(
        <div className="card">
          <div className="card-header"><div className="card-title">Capstone Project Portal</div></div>
          <div className="card-body" style={{textAlign:"center",padding:"48px 24px"}}>
            <div style={{fontSize:40,marginBottom:12}}>🔬</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Capstone portal coming soon</div>
            <div style={{fontSize:13,color:"var(--ink3)",maxWidth:340,margin:"0 auto",lineHeight:1.7}}>
              The capstone project portal will be activated once your training track begins. Check back after the orientation on <strong>8 May</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResearchHub({ user }) {
  const { pushToSheets } = useContext(DataCtx);
  return (
    <div>
      <div className="card mb6">
        <div className="card-header"><div><div className="card-title">Research Workspace</div><div className="card-sub">Phases IV–VI: Mentorship → Implementation → Publication</div></div></div>
        <div className="card-body">
          <div className="g2">
            <div>
              <div className="fg"><label className="flabel">Research Question</label><textarea className="finput ftextarea" defaultValue="How can federated learning improve segmentation accuracy in multi-site MRI datasets while preserving patient privacy?" /></div>
              <div className="fg"><label className="flabel">Methodology</label><textarea className="finput ftextarea" style={{minHeight:100}} defaultValue="1. Dataset preparation (BraTS 2023)&#10;2. FedAvg baseline implementation&#10;3. Proposed FedProx variant with attention mechanism&#10;4. Statistical validation (5-fold cross-validation)" /></div>
            </div>
            <div>
              <div className="fg"><label className="flabel">Current Status</label><select className="finput fselect"><option>Methodology Design</option><option>Data Collection</option><option>Experimentation</option><option>Results Validation</option><option>Writing Phase</option></select></div>
              <div className="fg"><label className="flabel">Overleaf Paper URL</label><input className="finput" defaultValue="https://overleaf.com/project/..." /></div>
              <div className="fg"><label className="flabel">GitHub Repo URL</label><input className="finput" defaultValue="https://github.com/..." /></div>
              <div className="fg"><label className="flabel">Validated Results (CSV/PDF)</label><input type="file" className="finput" style={{paddingTop:6}} /></div>
            </div>
          </div>
          <button className="btn btn-p" onClick={()=>pushToSheets("ResearchHub",{participantId:user.id,updatedAt:new Date().toISOString()})}>Save Progress → Google Sheets</button>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">IEEE Paper Draft Rounds</div></div>
        <div className="card-body">
          {["Draft Round 1: Structure & Abstract","Draft Round 2: Results & Discussion","Draft Round 3: Final Polish"].map((d,i)=>(
            <div key={i} style={{padding:"14px",border:"1px solid var(--frost)",borderRadius:10,marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Round {i+1}</div>
              <div className="flex-between">
                <span style={{fontSize:13,fontWeight:600}}>{d}</span>
                <span className={`badge ${i===0?"b-qual":i===1?"b-review":"b-phase"}`} style={{background:i>1?"var(--snow)":""}}>
                  {i===0?"Submitted":i===1?"In Review":"Pending"}
                </span>
              </div>
              {i===0&&<div className="txt-muted" style={{marginTop:4}}>Mentor: Strengthen contribution section. Add more methodology detail.</div>}
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button className="btn btn-o btn-sm">View on Overleaf</button>
                {i===1&&<button className="btn btn-p btn-sm">Submit Draft 2</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NoveltyTool({ user }) {
  const { pushToSheets } = useContext(DataCtx);
  const items = [
    "My project addresses a gap not covered by existing literature (cite ≥3 IEEE papers)",
    "The core algorithm/model is original or substantially modified from prior work",
    "The dataset used is new, private, or processed in a novel way",
    "The evaluation metric or validation protocol introduces innovation",
    "The clinical application context is underexplored in current research",
    "My research question has not been answered in this exact form in published work",
  ];
  const [checks, setChecks] = useState({});
  const [contribution, setContribution] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const all = items.every((_,i)=>checks[i]);
  return (
    <div className="card">
      <div className="card-header">
        <div><div className="card-title">Novelty Assessment Tool</div><div className="card-sub">Required before Phase V · Results saved to Google Sheets</div></div>
        {submitted&&<span className="badge b-qual">✓ Verified</span>}
      </div>
      <div className="card-body">
        {submitted ? (
          <div className="alert alert-success">✓ Your novelty assessment was submitted and saved. Awaiting admin review.</div>
        ) : (
          <>
            <div className="alert alert-info mb4">📋 Complete all items and describe your unique contribution. Submissions are logged for admin verification.</div>
            {items.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid var(--frost)"}}>
                <div onClick={()=>setChecks(c=>({...c,[i]:!c[i]}))}
                  style={{width:20,height:20,borderRadius:5,border:`2px solid ${checks[i]?"var(--jade)":"var(--mist)"}`,background:checks[i]?"var(--jade)":"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:12,flexShrink:0,transition:"all .2s"}}>
                  {checks[i]&&"✓"}
                </div>
                <span style={{fontSize:13,color:checks[i]?"var(--ink)":"var(--ink3)"}}>{item}</span>
              </div>
            ))}
            <div className="fg" style={{marginTop:16}}>
              <label className="flabel">Unique Contribution Statement</label>
              <textarea className="finput ftextarea" style={{minHeight:120}} value={contribution} onChange={e=>setContribution(e.target.value)} placeholder="Clearly state: what is new, what problem it solves, and how it differs from existing work..." />
            </div>
            <button className={`btn ${all&&contribution?"btn-p":"btn-s"}`} disabled={!all||!contribution}
              onClick={async()=>{ await pushToSheets("NoveltyAssessments",{participantId:user.id,contribution,checks:JSON.stringify(checks),submittedAt:new Date().toISOString()}); setSubmitted(true); }}>
              Submit Novelty Assessment → Google Sheets
            </button>
            {(!all||!contribution)&&<div className="txt-muted" style={{marginTop:8}}>Complete all items and add contribution statement to submit.</div>}
          </>
        )}
      </div>
    </div>
  );
}

function CompetitionsView({ user }) {
  return (
    <div>
      <div style={{marginBottom:20,padding:"14px 18px",background:"linear-gradient(135deg,rgba(91,59,245,.06),rgba(26,109,255,.04))",border:"1px solid rgba(91,59,245,.12)",borderRadius:12,fontSize:13,color:"var(--ink2)",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>📢</span>
        <span>Enrollment details will be announced in the <strong>orientation session on 8 May</strong>. All competitions are currently open.</span>
      </div>
      <div className="g3 mb6">
        {COMPETITIONS.map(c=>(
          <div key={c.id} className="card">
            <div style={{padding:"14px 18px 0"}}><span className="badge b-open">Open</span></div>
            <div className="card-body">
              <div style={{fontSize:32,marginBottom:8}}>{c.id==="C001"?"🧠":c.id==="C002"?"🏥":"🔬"}</div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{c.name}</div>
              <div className="txt-muted">Track: {c.track===1?"AI & ML":c.track===2?"Modeling":"Electronics"}</div>
              <div className="txt-muted" style={{marginBottom:12}}>Deadline: <span className="mono" style={{fontWeight:600,color:"var(--ink)"}}>{c.deadline}</span></div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <button className="btn btn-p btn-sm" disabled style={{opacity:0.45,cursor:"not-allowed"}}>Enroll & Track</button>
                <span style={{fontSize:11,color:"var(--ink3)"}}>Will be announced next week in the orientation session</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Competition Overview</div></div>
        <div className="card-body" style={{padding:0}}>
          <table className="tbl">
            <thead><tr><th>Competition</th><th>Track</th><th>Deadline</th><th>Status</th></tr></thead>
            <tbody>{COMPETITIONS.map(c=>(
              <tr key={c.id}>
                <td style={{fontWeight:600}}>{c.name}</td>
                <td><TrackBadge track={c.track} label={c.track===1?"AI & ML":c.track===2?"Modeling":"Electronics"}/></td>
                <td className="mono" style={{fontSize:12}}>{c.deadline}</td>
                <td><span className="badge b-open">Open</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ResourceRequests({ user }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Request Research Resources</div><div className="card-sub">Resources will be available once your program begins</div></div>
      <div className="card-body" style={{textAlign:"center",padding:"56px 24px"}}>
        <div style={{fontSize:48,marginBottom:16}}>📦</div>
        <div style={{fontSize:17,fontWeight:700,color:"var(--ink)",marginBottom:8}}>No resources available yet</div>
        <div style={{fontSize:13,color:"var(--ink3)",maxWidth:360,margin:"0 auto",lineHeight:1.7}}>
          Resource requests will open once your program admin has set up this section.
        </div>
      </div>
    </div>
  );
}

function EnrichmentCalendar({ user }) {
  return (
    <div>
      <div className="g4 mb6">
        {[{l:"Total Events",v:"1",icon:"📅"},{l:"Sessions",v:"1",icon:"🎙️"},{l:"Workshops",v:"0",icon:"🛠️"},{l:"Registered",v:"0",icon:"✅"}].map(s=>(
          <div key={s.l} className="stat"><div className="stat-icon">{s.icon}</div><div className="stat-val">{s.v}</div><div className="stat-label">{s.l}</div></div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">April / May 2026 — Enrichment Calendar</div></div>
        <div className="card-body">
          <div className="event-box" style={{border:"1.5px solid rgba(91,59,245,.18)",background:"linear-gradient(135deg,rgba(91,59,245,.03),rgba(26,109,255,.02))",borderRadius:12,padding:"20px 18px"}}>
            <div style={{minWidth:52,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
              <div style={{background:"var(--frost)",color:"var(--ink3)",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:800,letterSpacing:.5,textAlign:"center",whiteSpace:"nowrap"}}>NEXT WEEK</div>
              <div style={{fontSize:22,marginTop:4}}>🗓</div>
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:15,fontWeight:700,color:"var(--ink)"}}>Orientation Session</span>
                <span className="badge b-review" style={{fontSize:10}}>Date TBC</span>
              </div>
              <div className="txt-muted" style={{marginBottom:6}}>Session · IEEE E-JUST EMBS SBC — Ri-Sō 理創 2026</div>
              <div style={{fontSize:12,color:"var(--amber)",fontWeight:600,marginBottom:10}}>
                ⏳ Exact date & time will be confirmed soon
              </div>
              <div style={{fontSize:12,color:"var(--ink3)",background:"var(--snow)",borderRadius:8,padding:"8px 12px",lineHeight:1.6}}>
                Competition enrollment details, training schedules, and program timelines will be announced at this session.
              </div>
            </div>
          </div>
          <div style={{marginTop:24,textAlign:"center",fontSize:12,color:"var(--ink3)"}}>
            More events will be added after the orientation session. Stay tuned!
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
//  TEAM-SCOPED GRADING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Grading weights — editable in one place
const GRADE_WEIGHTS = {
  tasks:      0.50,   // 50 pts: average of task scores
  attendance: 0.25,   // 25 pts: attendance rate × 25
  bonus:      0.15,   // up to +15 bonus pts
  penalty:    -0.10,  // up to -10 penalty pts
};

function GradeBar({ value, max = 100, color = "var(--violet)" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ height: 8, borderRadius: 6, background: "var(--frost)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 6, transition: "width .4s" }} />
    </div>
  );
}

function GradePill({ score }) {
  const color = score >= 85 ? "var(--jade)" : score >= 65 ? "var(--amber)" : "var(--rose)";
  const label = score >= 85 ? "Excellent" : score >= 65 ? "On Track" : "Needs Work";
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {label} · {score}
    </span>
  );
}

// ─── Member view: see my own grade breakdown ────────────────────────────────
function MyGradeView({ user }) {
  const roleKey = (user.teamRole || "").toLowerCase().trim();
  if (roleKey === "associate_researcher" || roleKey === "associate") return (
    <div style={{padding:"40px 24px",textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:12}}>📊</div>
      <div style={{fontSize:15,fontWeight:700,color:"var(--ink)",marginBottom:8}}>No grade assigned</div>
      <div style={{fontSize:13,color:"var(--ink3)"}}>Associate Researchers assess others — they are not graded themselves.</div>
    </div>
  );
  const team = getTeam(user);
  const [tasks, setTasks]               = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [meetings, setMeetings]         = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!team) { setLoading(false); return; }
    Promise.all([
      sheetsAPI.getByTeam("TeamTasks",       team.id),
      sheetsAPI.getByTeam("TaskSubmissions", team.id),
      sheetsAPI.getByTeam("MeetingNotes",    team.id),
    ]).then(([t, s, m]) => {
      setTasks(t || []);
      setMySubmissions((s || []).filter(sub => (sub.memberEmail || "").toLowerCase() === (user.email || "").toLowerCase()));
      setMeetings(m || []);
      setLoading(false);
    });
  }, [team?.id]);

  if (!team) return <div className="card"><div className="card-body">No team assigned. Contact your admin.</div></div>;
  if (loading) return <div className="card"><div className="card-body">Loading grades…</div></div>;

  const myTasks      = tasks.filter(t => t.assignedTo === user.email || t.assignedTo === "all");
  // Merge task definitions with submission data
  const tasksWithSubs = myTasks.map(t => ({ ...t, sub: mySubmissions.find(s => s.taskId === t.id) }));
  const bonusTasks   = tasksWithSubs.filter(t => t.isBonus === "true" || t.isBonus === true);
  const regularTasks = tasksWithSubs.filter(t => t.isBonus !== "true" && t.isBonus !== true);
  const gradedReg    = regularTasks.filter(t => t.sub?.status === "graded");
  const taskAvg      = gradedReg.length
    ? Math.round(gradedReg.reduce((a, t) => a + Number(t.sub?.score || 0), 0) / gradedReg.length)
    : 0;
  const bonusTotal   = bonusTasks.filter(t => t.sub?.status === "graded").reduce((a, t) => a + Number(t.sub?.score || 0), 0);
  const attendedCount = meetings.filter(m => (m.attendees || "").includes(user.email)).length;
  const attendancePct = meetings.length ? Math.round((attendedCount / meetings.length) * 100) : 0;
  const attendanceScore = Math.round(attendancePct * 0.25);
  const penaltyScore  = 0; // admins set this; shown from TeamGrades sheet
  const totalScore    = Math.min(100, Math.max(0, Math.round(taskAvg * 0.75 + attendanceScore - penaltyScore))) + bonusTotal;

  return (
    <div>
      <div className="banner" style={{ marginBottom: 24 }}>
        <div>
          <div className="banner-chip">Team {team.id} · {team.track}</div>
          <div className="banner-title">My Grade</div>
          <div className="banner-sub">{team.challenge}</div>
        </div>
        <div className="bstats">
          <div><div className="bstat-val" style={{ color: "var(--jade)" }}>{Math.round(totalScore)}</div><div className="bstat-label">Total</div></div>
          <div><div className="bstat-val">{taskAvg}</div><div className="bstat-label">Tasks</div></div>
          <div><div className="bstat-val">{attendancePct}%</div><div className="bstat-label">Attendance</div></div>
        </div>
      </div>

      {/* Task list */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><div className="card-title">My Tasks</div><GradePill score={Math.round(totalScore)} /></div>
        <div className="card-body" style={{ padding: 0 }}>
          {tasksWithSubs.length === 0
            ? <div style={{ padding: 20, color: "var(--ink3)", fontSize: 13 }}>No tasks assigned yet.</div>
            : tasksWithSubs.map((t, i) => {
              const effStatus = t.sub?.status || ((t.assignedTo || "").toLowerCase().trim() === "all" ? "assigned" : (t.status || "assigned"));
              const effScore  = t.sub?.score;
              return (
              <div key={t.id || i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--frost)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.taskTitle} {t.isBonus === "true" && <span style={{ fontSize: 10, background: "var(--jade)18", color: "var(--jade)", padding: "2px 8px", borderRadius: 10, marginLeft: 6, fontWeight: 700 }}>BONUS</span>}</div>
                  <div className="txt-muted" style={{ fontSize: 11 }}>
                    Due: {t.dueDate || "—"} · {effStatus}
                    {t.sub?.fileLink && <> · <a href={t.sub.fileLink} target="_blank" rel="noreferrer" style={{color:"var(--azure)"}}>My submission ↗</a></>}
                  </div>
                  {effStatus === "graded" && t.sub?.feedback && <div style={{fontSize:11,color:"var(--ink3)",fontStyle:"italic",marginTop:2}}>"{t.sub.feedback}"</div>}
                </div>
                {effStatus === "graded" ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: "var(--jade)" }}>{effScore}</div>
                    <div style={{ fontSize: 10, color: "var(--ink3)" }}>/ 100</div>
                  </div>
                ) : (
                  <span className={`badge ${effStatus === "submitted" ? "b-review" : effStatus === "assigned" ? "b-phase" : "b-qual"}`}>{effStatus}</span>
                )}
              </div>
              );
            })
          }
        </div>
      </div>

      {/* Penalty policy */}
      <div className="card">
        <div className="card-header"><div className="card-title" style={{color:"var(--rose)"}}>⚠️ Penalty & Warning Policy</div></div>
        <div className="card-body" style={{padding:0}}>
          {[
            { icon:"📅", text:"Missing a meeting without a prior excuse → 1 Warning" },
            { icon:"📋", text:"Missing a task deadline without a prior excuse → 1 Warning" },
            { icon:"🟡", text:"Using 2 excuses (meeting or task) → 1 Warning" },
            { icon:"🔴", text:"Accumulating 3 Warnings → Termination from the program" },
          ].map((item,i) => (
            <div key={i} style={{display:"flex",gap:14,padding:"13px 20px",borderBottom:i<3?"1px solid var(--frost)":"none",alignItems:"center"}}>
              <span style={{fontSize:20,flexShrink:0}}>{item.icon}</span>
              <span style={{fontSize:13,color:"var(--ink2)",lineHeight:1.5}}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TASK SUBMISSION  (member view)
// ─────────────────────────────────────────────────────────────────────────────
function TaskSubmissionView({ user }) {
  const team = getTeam(user);
  const userEmail = (user.email || "").toLowerCase().trim();
  const [tasks, setTasks]       = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState({});
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [form, setForm]         = useState({});
  const [editLinks, setEditLinks] = useState({});
  const [toast, setToast]       = useState("");

  useEffect(() => {
    if (!team) { setLoading(false); return; }
    Promise.all([
      sheetsAPI.getByTeam("TeamTasks", team.id),
      sheetsAPI.getByTeam("TaskSubmissions", team.id),
    ]).then(([t, subs]) => {
      setTasks(Array.isArray(t) ? t : []);
      if (Array.isArray(subs)) setMySubmissions(subs.filter(s => (s.memberEmail || "").toLowerCase() === userEmail));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [team?.id]);

  const getSub = (taskId) => mySubmissions.find(s => s.taskId === taskId);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const submit = async (task) => {
    const link = form[task.id]?.link || "";
    const note = form[task.id]?.note || "";
    if (!link) { showToast("Paste a link before submitting."); return; }
    setSubmitting(p => ({ ...p, [task.id]: true }));
    const submittedAt = new Date().toISOString();
    const existing = getSub(task.id);
    if (existing) {
      await sheetsAPI.updateByMatch("TaskSubmissions", "id", existing.id, { fileLink: link, suppLinks: note, submittedAt, status: "submitted" });
      setMySubmissions(p => p.map(s => s.id === existing.id ? { ...s, fileLink: link, suppLinks: note, submittedAt, status: "submitted" } : s));
    } else {
      const sub = { id: `SUB${Date.now()}`, taskId: task.id, taskTitle: task.taskTitle || task.title || "", teamId: team?.id || "", memberEmail: userEmail, fileLink: link, suppLinks: note, submittedAt, status: "submitted" };
      await sheetsAPI.push("TaskSubmissions", sub);
      setMySubmissions(p => [...p, sub]);
    }
    // Dual-write to TeamTasks so legacy AR views still work
    await sheetsAPI.updateByMatch("TeamTasks", "id", task.id, { status: "submitted", fileLink: link, submittedBy: userEmail, submittedAt });
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: "submitted", fileLink: link, submittedAt } : t));
    setSubmitting(p => ({ ...p, [task.id]: false }));
    showToast("Task submitted ✓");
  };

  const saveEdit = async (task) => {
    const existing = getSub(task.id);
    const link = editLinks[task.id] || existing?.fileLink || task.fileLink || task.submissionLink || "";
    setSubmitting(p => ({ ...p, [task.id]: true }));
    const submittedAt = new Date().toISOString();
    if (existing) {
      await sheetsAPI.updateByMatch("TaskSubmissions", "id", existing.id, { fileLink: link, submittedAt });
      setMySubmissions(p => p.map(s => s.id === existing.id ? { ...s, fileLink: link, submittedAt } : s));
    } else {
      await sheetsAPI.updateByMatch("TeamTasks", "id", task.id, { fileLink: link, submissionLink: link, submittedBy: userEmail, submittedAt });
    }
    setEditingSubmission(null);
    setSubmitting(p => ({ ...p, [task.id]: false }));
    showToast("Submission updated ✓");
  };

  if (!team) return <div className="card"><div className="card-body">No team assigned.</div></div>;
  if (loading) return <div className="card"><div className="card-body">Loading tasks…</div></div>;

  const myTasks = tasks.filter(t => {
    if (t.status === "draft") return false;
    const at = (t.assignedTo || "").toLowerCase().trim();
    return at === "all" || at === userEmail || at.includes(userEmail);
  });
  const isWhole = (t) => (t.assignedTo || "").toLowerCase().trim() === "all";
  const pending = myTasks.filter(t => !getSub(t.id) && (isWhole(t) || t.status === "assigned" || t.status === "pending"));
  const done    = myTasks.filter(t => !!getSub(t.id) || (!isWhole(t) && (t.status === "submitted" || t.status === "graded")));

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "var(--jade)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
      <div className="banner" style={{ marginBottom: 24 }}>
        <div>
          <div className="banner-chip">Team {team.id}</div>
          <div className="banner-title">Submit Tasks</div>
          <div className="banner-sub">{team.challenge}</div>
        </div>
        <div className="bstats">
          <div><div className="bstat-val">{pending.length}</div><div className="bstat-label">Pending</div></div>
          <div><div className="bstat-val">{done.length}</div><div className="bstat-label">Submitted</div></div>
        </div>
      </div>

      {pending.length === 0 && done.length === 0 && (
        <div className="card"><div className="card-body" style={{ color: "var(--ink3)", fontSize: 13 }}>No tasks assigned to you yet. Check back after the next meeting.</div></div>
      )}

      {pending.map((task, i) => (
        <div key={task.id || i} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">{task.taskTitle} {task.isBonus === "true" && <span style={{ fontSize: 11, background: "var(--jade)20", color: "var(--jade)", padding: "2px 8px", borderRadius: 10, marginLeft: 8, fontWeight: 700 }}>BONUS +15 pts</span>}</div>
            <span className="badge b-phase">Due {task.dueDate || "TBD"}</span>
          </div>
          <div className="card-body">
            {task.taskDesc && <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 16 }}>{task.taskDesc}</p>}
            <div className="fg"><label className="flabel">Submission Link (GitHub / Drive / Colab / etc.)</label>
              <input className="finput" placeholder="https://..." value={form[task.id]?.link || ""} onChange={e => setForm(p => ({ ...p, [task.id]: { ...p[task.id], link: e.target.value } }))} />
            </div>
            <div className="fg"><label className="flabel">Note (optional)</label>
              <textarea className="finput ftextarea" placeholder="Any notes for the reviewer…" style={{ minHeight: 60 }} value={form[task.id]?.note || ""} onChange={e => setForm(p => ({ ...p, [task.id]: { ...p[task.id], note: e.target.value } }))} />
            </div>
            <button className="btn btn-p" onClick={() => submit(task)} disabled={submitting[task.id]}>
              {submitting[task.id] ? "Submitting…" : "Submit Task →"}
            </button>
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Completed Tasks</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {done.map((t, i) => {
              const sub = getSub(t.id);
              const fileLink = sub?.fileLink || t.submissionLink || t.fileLink || "";
              const score = sub?.score || t.score;
              const feedback = sub?.feedback || t.feedback;
              const status = sub?.status || t.status;
              const isEditing = editingSubmission === t.id;
              return (
                <div key={t.id || i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--frost)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.taskTitle}</div>
                      {fileLink && !isEditing && <a href={fileLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--azure)" }}>View submission ↗</a>}
                      {feedback && <div style={{ fontSize: 12, marginTop: 4, padding: "6px 10px", background: "var(--frost)", borderRadius: 8 }}>💬 {feedback}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      {status === "graded"
                        ? <div style={{ textAlign: "center" }}><div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, color: "var(--jade)" }}>{score}</div><div style={{ fontSize: 10, color: "var(--ink3)" }}>/ 100</div></div>
                        : <span className="badge b-review">Awaiting grade</span>
                      }
                      {status !== "graded" && (
                        <button onClick={() => { setEditingSubmission(isEditing ? null : t.id); setEditLinks(p => ({ ...p, [t.id]: fileLink })); }}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--frost)", background: "transparent", cursor: "pointer", color: "var(--ink3)" }}>
                          {isEditing ? "Cancel" : "Edit"}
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditing && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <input className="finput" style={{ flex: 1, fontSize: 12 }} placeholder="New submission link…" value={editLinks[t.id] || ""} onChange={e => setEditLinks(p => ({ ...p, [t.id]: e.target.value }))} />
                      <button className="btn btn-p" style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => saveEdit(t)} disabled={submitting[t.id]}>
                        {submitting[t.id] ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROLE GUIDELINES  (interactive, role-aware)
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_GUIDELINES = {
  mentor: {
    label: "Mentor",
    icon: "🎓",
    color: "#5B3BF5",
    tagline: "Supervisor and strategic guide",
    responsibilities: [
      "Sets the research direction and validates the team's approach at each milestone",
      "Reviews and confirms decisions made by the Associate Researcher before they are finalized",
      "Attends bi-weekly sprint reviews and provides strategic feedback",
      "Identifies and resolves blockers that the team cannot handle on its own",
      "Signs off on final submissions, Docker containers, and challenge deliverables",
      "Ensures clinical and scientific integrity is maintained throughout the project",
    ],
    doesNot: [
      "Write code or run experiments directly",
      "Assign or manage day-to-day tasks (delegated to the Associate Researcher)",
      "Handle logistics or administrative matters (delegated to Admin)",
    ],
    escalation: null,
    extra: null,
  },
  associate_researcher: {
    label: "Associate Researcher",
    icon: "🔬",
    color: "#0EA5C5",
    tagline: "Technical lead and primary bridge between the team and the Mentor",
    responsibilities: [
      "Works hands-on with the team across all sprint milestones",
      "Assigns tasks to team members, tracks progress, and unblocks day-to-day issues",
      "Runs experiments, reviews code, and validates results before escalating to the Mentor",
      "Prepares and presents sprint updates to the Mentor for confirmation and validation",
      "Ensures the team follows the sprint plan and meets milestone deadlines",
      "Drafts the challenge submission report and paper methodology sections",
    ],
    doesNot: null,
    escalation: null,
    extra: {
      title: "Relationship with Mentor",
      points: [
        "Surfaces findings, results, and decisions to the Mentor",
        "The Mentor confirms, redirects, or validates — the Associate Researcher executes",
        "Nothing is finalized without Mentor confirmation on key decisions",
      ],
    },
  },
  board_admin: {
    label: "Admin (Board Member)",
    icon: "📋",
    color: "#0F9F6E",
    tagline: "Logistics coordinator and operational support",
    responsibilities: [
      "Handles all logistical matters: compute resource requests, access provisioning, scheduling",
      "Maintains the team's project board and tracks task completion status",
      "Coordinates team meetings, communicates deadlines, and sends progress reports to program admins",
      "Manages platform submissions (Codabench, Grand-Challenge, Synapse) from a logistics standpoint",
      "Acts as the point of contact between the team and the broader IEEE E-JUST EMBS SBC board",
      "Escalates operational blockers (access issues, resource shortages) to the appropriate authority",
    ],
    doesNot: [
      "Make technical decisions or validate research output",
      "Supervise or assess team members' technical work",
    ],
    escalation: null,
    extra: null,
  },
  team_member: {
    label: "Team Member (TM1–TM8)",
    icon: "⚡",
    color: "#E53E5C",
    tagline: "Core researcher and implementer",
    responsibilities: [
      "Executes assigned tasks within their sprint milestone as directed by the Associate Researcher",
      "Implements, tests, and documents their component of the pipeline",
      "Submits completed work (with a file link) through the dashboard for review",
      "Attends team standups and flags blockers immediately — does not stay stuck for more than one day",
      "Iterates based on feedback from the Associate Researcher or Mentor after review",
      "Contributes to the final paper and challenge submission as directed",
    ],
    doesNot: null,
    escalation: [
      { from: "Blocker on a task", to: "Raise immediately to the Associate Researcher" },
      { from: "AR cannot resolve", to: "Associate Researcher escalates to the Mentor" },
      { from: "Logistical issue (access, scheduling)", to: "Raise to Admin" },
    ],
    extra: null,
  },
};

function RoleGuidelinesView({ user }) {
  const roleRaw = (user.teamRole || user.role || "").toLowerCase().trim();
  const roleKey = roleRaw.startsWith("tm") ? "team_member"
    : roleRaw === "associate_researcher" || roleRaw === "associate" ? "associate_researcher"
    : roleRaw === "board_admin" || roleRaw === "team_admin" ? "board_admin"
    : roleRaw === "mentor" ? "mentor"
    : "team_member";
  const myGuide = ROLE_GUIDELINES[roleKey];

  const GuideCard = ({ guide }) => (
    <div>
      <div style={{padding:"18px 20px",borderRadius:14,background:`${guide.color}10`,border:`1px solid ${guide.color}30`,marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
        <span style={{fontSize:36}}>{guide.icon}</span>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:guide.color}}>{guide.label}</div>
          <div style={{fontSize:13,color:"var(--ink2)",marginTop:2}}>{guide.tagline}</div>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="card-header"><div className="card-title" style={{color:guide.color}}>✅ Responsibilities</div></div>
        <div className="card-body" style={{padding:0}}>
          {guide.responsibilities.map((r,i) => (
            <div key={i} style={{display:"flex",gap:12,padding:"12px 20px",borderBottom:i<guide.responsibilities.length-1?"1px solid var(--frost)":"none",alignItems:"flex-start"}}>
              <span style={{color:guide.color,fontWeight:800,flexShrink:0,marginTop:1}}>→</span>
              <span style={{fontSize:13,color:"var(--ink2)",lineHeight:1.6}}>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {guide.doesNot && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><div className="card-title" style={{color:"var(--rose)"}}>🚫 Does Not</div></div>
          <div className="card-body" style={{padding:0}}>
            {guide.doesNot.map((r,i) => (
              <div key={i} style={{display:"flex",gap:12,padding:"12px 20px",borderBottom:i<guide.doesNot.length-1?"1px solid var(--frost)":"none",alignItems:"flex-start"}}>
                <span style={{color:"var(--rose)",fontWeight:800,flexShrink:0,marginTop:1}}>✕</span>
                <span style={{fontSize:13,color:"var(--ink2)",lineHeight:1.6}}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {guide.extra && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><div className="card-title" style={{color:guide.color}}>🤝 {guide.extra.title}</div></div>
          <div className="card-body" style={{padding:0}}>
            {guide.extra.points.map((r,i) => (
              <div key={i} style={{display:"flex",gap:12,padding:"12px 20px",borderBottom:i<guide.extra.points.length-1?"1px solid var(--frost)":"none",alignItems:"flex-start"}}>
                <span style={{color:guide.color,fontWeight:800,flexShrink:0,marginTop:1}}>→</span>
                <span style={{fontSize:13,color:"var(--ink2)",lineHeight:1.6}}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {guide.escalation && (
        <div className="card">
          <div className="card-header"><div className="card-title" style={{color:"var(--amber)"}}>🔺 Escalation Path</div></div>
          <div className="card-body" style={{padding:0}}>
            {guide.escalation.map((step,i) => (
              <div key={i} style={{display:"flex",gap:12,padding:"12px 20px",borderBottom:i<guide.escalation.length-1?"1px solid var(--frost)":"none",alignItems:"flex-start"}}>
                <div style={{minWidth:180,fontSize:12,fontWeight:700,color:"var(--amber)",flexShrink:0}}>{step.from}</div>
                <div style={{fontSize:13,color:"var(--ink2)"}}>{step.to}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{padding:"10px 16px",borderRadius:10,background:`${myGuide.color}10`,border:`1px solid ${myGuide.color}30`,fontSize:13,color:myGuide.color,fontWeight:600,marginBottom:20}}>
        📌 Your role: <strong>{myGuide.label}</strong> — {myGuide.tagline}
      </div>
      <GuideCard guide={myGuide} />

      {/* Penalty & Warning Policy — shown to all */}
      <div className="card" style={{marginTop:20}}>
        <div className="card-header"><div className="card-title" style={{color:"var(--rose)"}}>⚠️ Penalty & Warning Policy</div></div>
        <div className="card-body" style={{padding:0}}>
          {[
            { icon:"📅", text:"Missing a meeting without a prior excuse → 1 Warning" },
            { icon:"📋", text:"Missing a task deadline without a prior excuse → 1 Warning" },
            { icon:"🟡", text:"Using 2 excuses (meeting or task) → 1 Warning" },
            { icon:"🔴", text:"Accumulating 3 Warnings → Termination from the program" },
          ].map((item,i) => (
            <div key={i} style={{display:"flex",gap:14,padding:"13px 20px",borderBottom:i<3?"1px solid var(--frost)":"none",alignItems:"center"}}>
              <span style={{fontSize:20,flexShrink:0}}>{item.icon}</span>
              <span style={{fontSize:13,color:"var(--ink2)",lineHeight:1.5}}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXCUSE FORM  (any member)
// ─────────────────────────────────────────────────────────────────────────────
function ExcuseFormView({ user }) {
  const team = getTeam(user);
  const [form, setForm] = useState({ selectedId: "", excuseType: "meeting", reason: "" });
  const [myExcuses, setMyExcuses] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!team) return;
    Promise.all([
      sheetsAPI.getByTeam("ExcuseRequests", team.id),
      sheetsAPI.getByTeam("MeetingNotes", team.id),
      sheetsAPI.getByTeam("TeamTasks", team.id),
    ]).then(([excuses, mtgs, tks]) => {
      setMyExcuses(excuses.filter(e => e.memberEmail?.toLowerCase() === user.email?.toLowerCase()));
      setMeetings(mtgs.sort((a,b) => new Date(a.meetingDate) - new Date(b.meetingDate)));
      setTasks(tks.filter(t => (t.assignedTo === user.email || t.assignedTo === "all") && t.status !== "graded"));
    });
  }, [team?.id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const submit = async () => {
    if (!form.selectedId || !form.reason.trim()) { showToast("Select a meeting/task and enter a reason."); return; }
    setSubmitting(true);
    const options = form.excuseType === "meeting" ? meetings : tasks;
    const selected = options.find(o => o.id === form.selectedId);
    const label = form.excuseType === "meeting"
      ? `${selected?.title || "Meeting"} (${selected?.meetingDate || ""})`
      : `${selected?.taskTitle || selected?.title || "Task"} (due ${selected?.dueDate || "TBD"})`;
    const record = {
      id: `EX${Date.now()}`,
      teamId: team.id,
      memberEmail: user.email,
      memberName: user.name || user.Name || user.email,
      targetId: form.selectedId,
      targetLabel: label,
      excuseType: form.excuseType,
      reason: form.reason,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    await sheetsAPI.push("ExcuseRequests", record);
    setMyExcuses(p => [record, ...p]);
    setForm({ selectedId: "", excuseType: "meeting", reason: "" });
    setSubmitting(false);
    showToast("Excuse submitted ✓");
  };

  if (!team) return <div className="card"><div className="card-body">No team assigned.</div></div>;

  const dropdownOptions = form.excuseType === "meeting"
    ? meetings.map(m => ({ id: m.id, label: `📅 ${m.title} — ${m.meetingDate}` }))
    : tasks.map(t => ({ id: t.id, label: `📋 ${t.taskTitle || t.title || "Task"} — due ${t.dueDate || "TBD"}` }));

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "var(--jade)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">Submit an Excuse</div><div className="card-sub">For a missed meeting or task deadline</div></div>
        <div className="card-body">
          <div className="fg">
            <label className="flabel">Type</label>
            <div style={{ display: "flex", gap: 10 }}>
              {[{ v: "meeting", label: "📅 Meeting absence" }, { v: "task", label: "📋 Task deadline" }].map(opt => (
                <div key={opt.v} onClick={() => setForm(f => ({ ...f, excuseType: opt.v, selectedId: "" }))}
                  style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: form.excuseType === opt.v ? "var(--violet)" : "var(--frost)", background: form.excuseType === opt.v ? "rgba(91,59,245,.07)" : "white", color: form.excuseType === opt.v ? "var(--violet)" : "var(--ink3)" }}>
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
          <div className="fg">
            <label className="flabel">{form.excuseType === "meeting" ? "Select Meeting" : "Select Task"}</label>
            <select className="finput fselect" value={form.selectedId} onChange={e => setForm(f => ({ ...f, selectedId: e.target.value }))}>
              <option value="">— choose {form.excuseType === "meeting" ? "a meeting" : "a task"} —</option>
              {dropdownOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {dropdownOptions.length === 0 && (
              <div style={{fontSize:12,color:"var(--ink3)",marginTop:6}}>No {form.excuseType === "meeting" ? "meetings" : "tasks"} found for your team.</div>
            )}
          </div>
          <div className="fg"><label className="flabel">Reason</label>
            <textarea className="finput ftextarea" style={{ minHeight: 90 }} placeholder="Explain why you won't be able to attend / submit…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <button className="btn btn-p" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit Excuse"}</button>
        </div>
      </div>

      {myExcuses.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">My Excuse History</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {myExcuses.map((e, i) => (
              <div key={e.id || i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--frost)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.excuseType === "meeting" ? "Meeting absence" : "Task deadline"} — {e.targetLabel || e.targetDate || ""}</div>
                  <div className="txt-muted" style={{ fontSize: 12, marginTop: 2 }}>{e.reason}</div>
                </div>
                <span className={`badge ${e.status === "approved" ? "b-qual" : e.status === "rejected" ? "" : "b-review"}`} style={e.status === "rejected" ? { background: "var(--rose)18", color: "var(--rose)" } : {}}>
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MEETING NOTES + VOTING  (all roles)
// ─────────────────────────────────────────────────────────────────────────────
function MeetingNotesView({ user }) {
  const team = getTeam(user);
  const isAR    = user.teamRole === "associate_researcher" || user.teamRole === "associate";
  const isAdmin = user.teamRole === "team_admin" || user.role === ROLES.SUPERADMIN || user.role === ROLES.TEAM_ADMIN;
  const isMentor = user.role === ROLES.MENTOR;
  const canManage = isAR || isAdmin || isMentor;

  const [meetings, setMeetings]   = useState([]);
  const [votes, setVotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [newForm, setNewForm]     = useState({ title: "", date: "", time: "", meetLink: "", attendanceSheet: "", recording: "", minutesFile: "", notes: "", actionItems: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState("");
  const [editingLinks, setEditingLinks] = useState({});
  const [editingMeeting, setEditingMeeting] = useState(null);

  useEffect(() => {
    if (!team) { setLoading(false); return; }
    Promise.all([
      sheetsAPI.getByTeam("MeetingNotes", team.id),
      sheetsAPI.getByTeam("MeetingVotes", team.id),
    ]).then(([m, v]) => {
      setMeetings(m.sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate)));
      setVotes(v);
      setLoading(false);
      if (m.length > 0) setSelected(m[0].id);
    });
  }, [team?.id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const createMeeting = async () => {
    if (!newForm.title || !newForm.date) { showToast("Title and date required."); return; }
    setSaving(true);
    const record = {
      id: `MTG${Date.now()}`, teamId: team.id,
      meetingDate: newForm.date, meetingTime: newForm.time,
      meetLink: newForm.meetLink, title: newForm.title,
      attendanceSheet: newForm.attendanceSheet || "",
      recording: newForm.recording || "",
      minutesFile: newForm.minutesFile || "",
      notes: newForm.notes, actionItems: newForm.actionItems,
      attendees: "", createdBy: user.email,
      createdAt: new Date().toISOString(),
    };
    await sheetsAPI.push("MeetingNotes", record);
    setMeetings(p => [record, ...p]);
    setSelected(record.id);
    setShowCreate(false);
    setNewForm({ title: "", date: "", time: "", meetLink: "", attendanceSheet: "", recording: "", minutesFile: "", notes: "", actionItems: "" });
    setSaving(false);
    showToast("Meeting note saved ✓");
  };

  const castVote = async (meeting, slot) => {
    await sheetsAPI.voteSlot(meeting.id, team.id, user.email, slot);
    setVotes(p => {
      const existing = p.findIndex(v => v.meetingId === meeting.id && v.voterEmail?.toLowerCase() === user.email?.toLowerCase());
      const record = { meetingId: meeting.id, teamId: team.id, voterEmail: user.email, slot, votedAt: new Date().toISOString() };
      if (existing >= 0) { const n = [...p]; n[existing] = record; return n; }
      return [...p, record];
    });
    showToast("Vote recorded ✓");
  };

  if (!team) return <div className="card"><div className="card-body">No team assigned.</div></div>;
  if (loading) return <div className="card"><div className="card-body">Loading meetings…</div></div>;

  const activeMeeting = meetings.find(m => m.id === selected);
  const nextMeeting   = meetings.find(m => new Date(m.meetingDate) > new Date());

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "var(--jade)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}

      {/* Next meeting banner */}
      {nextMeeting && (
        <div className="banner" style={{ marginBottom: 20 }}>
          <div>
            <div className="banner-chip">📅 Next Meeting</div>
            <div className="banner-title">{nextMeeting.title}</div>
            <div className="banner-sub">{nextMeeting.meetingDate} · Team {team.id} — {team.meeting}</div>
          </div>
          <div style={{display:"flex",gap:10,alignSelf:"center",flexWrap:"wrap"}}>
            {nextMeeting.meetLink && (
              <a href={nextMeeting.meetLink} target="_blank" rel="noreferrer" className="btn btn-p">🎥 Join Meeting</a>
            )}
            <a href={`https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(nextMeeting.title)}&dates=${nextMeeting.meetingDate.replace(/-/g,"")}/${nextMeeting.meetingDate.replace(/-/g,"")}`} target="_blank" rel="noreferrer" className="btn btn-p" style={{background:"rgba(255,255,255,.2)",backdropFilter:"blur(4px)"}}>📅 Add to Calendar</a>
          </div>
        </div>
      )}

      {/* New meeting modal */}
      {showCreate && canManage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>📅 New Meeting</div>
              <button onClick={() => setShowCreate(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "var(--ink3)" }}>×</button>
            </div>
            <div className="fg"><label className="flabel">Title *</label><input className="finput" value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="fg"><label className="flabel">Date *</label><input type="date" className="finput" value={newForm.date} onChange={e => setNewForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div className="fg"><label className="flabel">Time (GMT+3)</label><input type="time" className="finput" value={newForm.time} onChange={e => setNewForm(f => ({ ...f, time: e.target.value }))} /></div>
            </div>
            <div className="fg"><label className="flabel">🎥 Google Meet / Zoom Link</label><input className="finput" placeholder="https://meet.google.com/..." value={newForm.meetLink} onChange={e => setNewForm(f => ({ ...f, meetLink: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">📋 Attendance Sheet Link</label><input className="finput" placeholder="Google Sheet or Drive link..." value={newForm.attendanceSheet} onChange={e => setNewForm(f => ({ ...f, attendanceSheet: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">🎬 Recording Link</label><input className="finput" placeholder="Google Drive / YouTube link..." value={newForm.recording} onChange={e => setNewForm(f => ({ ...f, recording: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">📄 Minutes File Link</label><input className="finput" placeholder="Google Doc link..." value={newForm.minutesFile} onChange={e => setNewForm(f => ({ ...f, minutesFile: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">Meeting Notes</label><textarea className="finput ftextarea" style={{ minHeight: 70 }} value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">Action Items (one per line)</label><textarea className="finput ftextarea" style={{ minHeight: 50 }} value={newForm.actionItems} onChange={e => setNewForm(f => ({ ...f, actionItems: e.target.value }))} /></div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn btn-p" onClick={createMeeting} disabled={saving}>{saving ? "Saving…" : "Save Meeting"}</button>
              <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
        {/* Sidebar: meeting list */}
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-header">
            <div className="card-title">Meetings</div>
            {canManage && <button className="btn btn-p btn-sm" onClick={() => setShowCreate(true)}>+ New</button>}
          </div>
          <div style={{ padding: 0 }}>
            {meetings.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--ink3)" }}>No meetings yet.</div>}
            {meetings.map(m => (
              <div key={m.id} onClick={() => setSelected(m.id)}
                style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--frost)", background: selected === m.id ? "rgba(91,59,245,.06)" : "white", borderLeft: selected === m.id ? "3px solid var(--violet)" : "3px solid transparent" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>{m.meetingDate}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main: selected meeting detail */}
        {activeMeeting ? (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">{activeMeeting.title}</div>
                  <div className="card-sub">
                    {activeMeeting.meetingDate}{activeMeeting.meetingTime ? ` · ${activeMeeting.meetingTime} GMT+3` : ""} · Team {team.id}
                    {activeMeeting.meetLink && (
                      <a href={activeMeeting.meetLink} target="_blank" rel="noreferrer"
                        style={{marginLeft:12,display:"inline-flex",alignItems:"center",gap:5,padding:"3px 12px",borderRadius:20,background:"var(--violet)",color:"white",fontSize:11,fontWeight:700,textDecoration:"none"}}>
                        🎥 Join Meeting
                      </a>
                    )}
                  </div>
                </div>
                {canManage && editingMeeting?.id !== activeMeeting.id && (
                  <button className="btn btn-sm" onClick={() => setEditingMeeting({...activeMeeting})}>✏️ Edit</button>
                )}
              </div>
              {editingMeeting?.id === activeMeeting.id ? (
                <div className="card-body">
                  <div className="fg"><label className="flabel">Title</label><input className="finput" value={editingMeeting.title||""} onChange={e=>setEditingMeeting(p=>({...p,title:e.target.value}))} /></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div className="fg"><label className="flabel">Date</label><input type="date" className="finput" value={editingMeeting.meetingDate||""} onChange={e=>setEditingMeeting(p=>({...p,meetingDate:e.target.value}))} /></div>
                    <div className="fg"><label className="flabel">Time (GMT+3)</label><input type="time" className="finput" value={editingMeeting.meetingTime||""} onChange={e=>setEditingMeeting(p=>({...p,meetingTime:e.target.value}))} /></div>
                  </div>
                  <div className="fg"><label className="flabel">Meeting Link</label><input className="finput" value={editingMeeting.meetLink||""} onChange={e=>setEditingMeeting(p=>({...p,meetLink:e.target.value}))} /></div>
                  <div className="fg"><label className="flabel">Notes</label><textarea className="finput ftextarea" style={{minHeight:80}} value={editingMeeting.notes||""} onChange={e=>setEditingMeeting(p=>({...p,notes:e.target.value}))} /></div>
                  <div className="fg"><label className="flabel">Action Items (one per line)</label><textarea className="finput ftextarea" style={{minHeight:60}} value={editingMeeting.actionItems||""} onChange={e=>setEditingMeeting(p=>({...p,actionItems:e.target.value}))} /></div>
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn btn-p" disabled={saving} onClick={async()=>{
                      setSaving(true);
                      const {id,title,meetingDate,meetingTime,meetLink,notes,actionItems} = editingMeeting;
                      await sheetsAPI.updateByMatch("MeetingNotes","id",id,{title,meetingDate,meetingTime,meetLink,notes,actionItems});
                      setMeetings(p=>p.map(m=>m.id===id?{...m,title,meetingDate,meetingTime,meetLink,notes,actionItems}:m));
                      setEditingMeeting(null);setSaving(false);showToast("Meeting updated ✓");
                    }}>{saving?"Saving…":"Save Changes"}</button>
                    <button className="btn" onClick={()=>setEditingMeeting(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
              <div className="card-body">
                {activeMeeting.notes
                  ? <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--ink2)" }}>{activeMeeting.notes}</p>
                  : <p style={{ fontSize: 13, color: "var(--ink3)" }}>No notes recorded.</p>}

                {activeMeeting.actionItems && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Action Items</div>
                    {activeMeeting.actionItems.split("\n").filter(Boolean).map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: "var(--violet)", fontWeight: 700, flexShrink: 0 }}>→</span> {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Meeting Resources */}
            <div className="card" style={{marginBottom:16}}>
              <div className="card-header">
                <div className="card-title">Meeting Resources</div>
                {canManage && <span style={{fontSize:11,color:"var(--ink3)"}}>Only admin / AR / mentor can edit</span>}
              </div>
              <div className="card-body" style={{display:"grid",gap:12}}>
                {[
                  {key:"attendanceSheet", icon:"📋", label:"Attendance Sheet", placeholder:"Google Sheet or Drive link..."},
                  {key:"recording",       icon:"🎬", label:"Recording",        placeholder:"Google Drive / YouTube link..."},
                  {key:"minutesFile",     icon:"📄", label:"Minutes File",     placeholder:"Google Doc (agenda, discussion, action plan)..."},
                ].map(({key,icon,label,placeholder}) => {
                  const val = activeMeeting[key] || "";
                  const editKey = activeMeeting.id + "_" + key;
                  const isEditing = editingLinks[editKey] !== undefined;
                  const linkVal = isEditing ? editingLinks[editKey] : val;
                  const startEdit = () => setEditingLinks(p=>({...p,[editKey]:val}));
                  const cancelEdit = () => setEditingLinks(p=>{const n={...p};delete n[editKey];return n;});
                  const saveLink = async () => {
                    await sheetsAPI.updateByMatch("MeetingNotes","id",activeMeeting.id,{[key]:linkVal});
                    setMeetings(p=>p.map(m=>m.id===activeMeeting.id?{...m,[key]:linkVal}:m));
                    cancelEdit();
                    showToast("Link saved ✓");
                  };
                  return (
                    <div key={key} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,border:"1px solid var(--frost)",background:"var(--snow)"}}>
                      <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--ink3)",marginBottom:3}}>{label}</div>
                        {isEditing ? (
                          <div style={{display:"flex",gap:8}}>
                            <input className="finput" style={{flex:1,fontSize:12}} value={linkVal} onChange={e=>setEditingLinks(p=>({...p,[editKey]:e.target.value}))} placeholder={placeholder} autoFocus />
                            <button className="btn btn-p btn-sm" onClick={saveLink}>Save</button>
                            <button className="btn btn-sm" onClick={cancelEdit}>Cancel</button>
                          </div>
                        ) : val ? (
                          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                            <a href={val} target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--violet)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{val}</a>
                            {canManage && <button className="btn btn-sm" style={{fontSize:10,padding:"2px 8px",flexShrink:0}} onClick={startEdit}>Edit</button>}
                          </div>
                        ) : canManage ? (
                          <button className="btn btn-sm" style={{fontSize:11}} onClick={startEdit}>+ Add link</button>
                        ) : (
                          <span style={{fontSize:12,color:"var(--ink3)"}}>Not uploaded yet</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voting panel — removed */}
            {false && activeMeeting.votingOpen === "true" && activeMeeting.votingSlots && (
              <div className="card">
                <div className="card-header"><div className="card-title">🗳 Vote for Next Meeting Slot</div></div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 16 }}>Select the time that works best for you. One vote per person.</p>
                  {activeMeeting.votingSlots.split(",").map(slot => slot.trim()).filter(Boolean).map(slot => {
                    const slotVotes = votes.filter(v => v.meetingId === activeMeeting.id && v.slot === slot);
                    const myVote    = votes.find(v => v.meetingId === activeMeeting.id && v.voterEmail?.toLowerCase() === user.email?.toLowerCase())?.slot;
                    const isChosen  = myVote === slot;
                    return (
                      <div key={slot} onClick={() => castVote(activeMeeting, slot)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, marginBottom: 8, cursor: "pointer", border: "1.5px solid", borderColor: isChosen ? "var(--violet)" : "var(--frost)", background: isChosen ? "rgba(91,59,245,.08)" : "white", transition: "all .15s" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: isChosen ? 700 : 500, color: isChosen ? "var(--violet)" : "var(--ink)" }}>{slot}</div>
                          <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{slotVotes.length} vote{slotVotes.length !== 1 ? "s" : ""}</div>
                        </div>
                        <div style={{ width: 100, height: 6, borderRadius: 4, background: "var(--frost)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 4, background: isChosen ? "var(--violet)" : "var(--azure)", width: `${Math.min(100, slotVotes.length * 20)}%`, transition: "width .4s" }} />
                        </div>
                        {isChosen && <span style={{ fontSize: 12, color: "var(--violet)", fontWeight: 700 }}>✓ Your vote</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card"><div className="card-body" style={{ color: "var(--ink3)" }}>Select a meeting from the list.</div></div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WEEKLY FEEDBACK VIEW  (member)
// ─────────────────────────────────────────────────────────────────────────────
const StarPicker = ({ value, onChange, label }) => (
  <div className="fg">
    <label className="flabel">{label}</label>
    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer", opacity: n <= value ? 1 : 0.25, transition: "opacity .15s", lineHeight: 1 }}>⭐</button>
      ))}
      <span style={{ alignSelf: "center", fontSize: 12, color: "var(--ink3)", marginLeft: 4 }}>{value}/5</span>
    </div>
  </div>
);

function WeeklyFeedbackView({ user }) {
  const team = getTeam(user);
  const [week, setWeek]               = useState("");
  const [sessionRating, setSessionRating] = useState(4);
  const [arRating, setArRating]       = useState(4);
  const [programRating, setProgramRating] = useState(4);
  const [wentWell, setWentWell]       = useState("");
  const [improve, setImprove]         = useState("");
  const [messageToAR, setMessageToAR] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [toast, setToast]             = useState("");
  const [past, setPast]               = useState([]);
  const [loadingPast, setLoadingPast] = useState(true);

  useEffect(() => {
    if (!team) { setLoadingPast(false); return; }
    sheetsAPI.getByTeam("WeeklyFeedback", team.id).then(rows => {
      const myEmail = (user.email || "").toLowerCase();
      setPast((rows || []).filter(r => (r.submitterEmail || "").toLowerCase() === myEmail));
      setLoadingPast(false);
    });
  }, [team?.id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const reset = () => { setWeek(""); setSessionRating(4); setArRating(4); setProgramRating(4); setWentWell(""); setImprove(""); setMessageToAR(""); };

  const submit = async () => {
    if (!week) { showToast("Please enter a week number."); return; }
    setSubmitting(true);
    const record = {
      id: `FB${Date.now()}`, teamId: team.id,
      submitterEmail: user.email, submitterName: user.name || user.Name || "",
      week, sessionRating, arRating, programRating,
      wentWell, improve, messageToAR,
      submittedAt: new Date().toISOString(),
    };
    await sheetsAPI.push("WeeklyFeedback", record);
    setPast(p => [record, ...p]);
    reset();
    setSubmitting(false);
    showToast("Feedback submitted ✓");
  };

  if (!team) return <div className="card"><div className="card-body">No team assigned.</div></div>;

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "var(--jade)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">📝 Weekly Feedback — Week <input type="number" min={1} max={52} style={{ width: 56, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--frost)", fontSize: 14, fontWeight: 700, textAlign: "center", fontFamily: "inherit" }} value={week} onChange={e => setWeek(e.target.value)} placeholder="#" /></div></div>
        <div className="card-body">

          {/* Section 1: This week */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>This Week's Session</div>
          <StarPicker value={sessionRating} onChange={setSessionRating} label="How was this week's session overall?" />
          <div className="g2" style={{ marginTop: 4 }}>
            <div className="fg"><label className="flabel">✅ What went well?</label><textarea className="finput ftextarea" style={{ minHeight: 60 }} value={wentWell} onChange={e => setWentWell(e.target.value)} placeholder="Topics covered, tasks completed, team collaboration…" /></div>
            <div className="fg"><label className="flabel">🔧 What could be improved?</label><textarea className="finput ftextarea" style={{ minHeight: 60 }} value={improve} onChange={e => setImprove(e.target.value)} placeholder="Pacing, resources, explanations…" /></div>
          </div>

          {/* Section 2: AR evaluation */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: 1, margin: "20px 0 12px" }}>Associate Researcher Evaluation</div>
          <StarPicker value={arRating} onChange={setArRating} label="How would you rate your AR's support & communication?" />
          <div className="fg"><label className="flabel">💬 Message / Suggestion for your AR</label><textarea className="finput ftextarea" style={{ minHeight: 60 }} value={messageToAR} onChange={e => setMessageToAR(e.target.value)} placeholder="Anything you'd like them to know or do differently…" /></div>

          {/* Section 3: Program evaluation */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: 1, margin: "20px 0 12px" }}>Program Evaluation</div>
          <StarPicker value={programRating} onChange={setProgramRating} label="How satisfied are you with the research program overall?" />

          <button className="btn btn-p" style={{ marginTop: 8 }} onClick={submit} disabled={submitting || !week}>{submitting ? "Submitting…" : "Submit Feedback →"}</button>
        </div>
      </div>

      {!loadingPast && past.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Past Submissions</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {past.map((fb, i) => (
              <div key={fb.id || i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--frost)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Week {fb.week}</span>
                  <span style={{ fontSize: 12, color: "var(--ink3)" }}>{fb.submittedAt?.split("T")[0]}</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink3)", marginBottom: 6, flexWrap: "wrap" }}>
                  {fb.sessionRating && <span>Session {"⭐".repeat(Number(fb.sessionRating))}</span>}
                  {fb.arRating && <span>AR {"⭐".repeat(Number(fb.arRating))}</span>}
                  {fb.programRating && <span>Program {"⭐".repeat(Number(fb.programRating))}</span>}
                  {!fb.sessionRating && fb.rating && <span>Rating {"⭐".repeat(Number(fb.rating))}</span>}
                </div>
                {fb.wentWell && <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 2 }}>✅ {fb.wentWell}</div>}
                {fb.improve && <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 2 }}>🔧 {fb.improve}</div>}
                {fb.messageToAR && <div style={{ fontSize: 12, color: "var(--azure)" }}>💬 {fb.messageToAR}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ASSOCIATE RESEARCHER — Assign Tasks + Grade Submissions
// ─────────────────────────────────────────────────────────────────────────────
function ARTaskManager({ user }) {
  const team = getTeam(user);
  const { pushToSheets } = useContext(DataCtx);
  const [tasks, setTasks]               = useState([]);
  const [submissions, setSubmissions]   = useState([]);
  const [members, setMembers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [form, setForm]                 = useState({ taskTitle: "", taskDesc: "", assignedTo: "all", dueDate: "", isBonus: false, suppFiles: "" });
  const [gradeForm, setGradeForm]       = useState({});
  const [saving, setSaving]             = useState(false);
  const [toast, setToast]               = useState("");
  const [editingTask, setEditingTask]   = useState(null);
  const [editingGrade, setEditingGrade] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);

  useEffect(() => {
    if (!team) { setLoading(false); return; }
    Promise.all([
      sheetsAPI.getByTeam("TeamTasks", team.id),
      sheetsAPI.getByTeam("TaskSubmissions", team.id),
      sheetsAPI.get("Users"),
    ]).then(([t, s, u]) => {
      const allTasks = (t || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTasks(allTasks);

      // Merge TaskSubmissions entries with legacy TeamTasks submissions.
      // If a task row in TeamTasks has status=submitted/graded and no
      // corresponding TaskSubmissions entry exists, create a synthetic entry
      // so the AR can still see and grade it.
      const newSubs = s || [];
      const newSubTaskIds = new Set(newSubs.map(sub => sub.taskId));
      const legacySubs = allTasks
        .filter(tk => (tk.status === "submitted" || tk.status === "graded") && !newSubTaskIds.has(tk.id))
        .map(tk => ({
          id:           `LEGACY_${tk.id}`,
          taskId:       tk.id,
          taskTitle:    tk.taskTitle || tk.title || "",
          teamId:       tk.teamId || team.id,
          memberEmail:  tk.submittedBy || (tk.assignedTo !== "all" ? tk.assignedTo : ""),
          fileLink:     tk.fileLink || tk.submissionLink || "",
          suppLinks:    tk.suppLinks || "",
          submittedAt:  tk.submittedAt || "",
          score:        tk.score || "",
          feedback:     tk.feedback || "",
          status:       tk.status,
          _legacy:      true,
        }));
      setSubmissions([...newSubs, ...legacySubs]);
      if (u) setMembers(u.filter(m => (m.teamId || m.team) === team.id));
      setLoading(false);
    });
  }, [team?.id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const assignTask = async () => {
    if (!form.taskTitle) { showToast("Task title required."); return; }
    setSaving(true);
    const record = {
      id: `T${Date.now()}`, teamId: team.id,
      taskTitle: form.taskTitle, taskDesc: form.taskDesc,
      assignedTo: form.assignedTo, assignedBy: user.email,
      dueDate: form.dueDate, status: "assigned",
      isBonus: form.isBonus ? "true" : "false",
      suppFiles: form.suppFiles || "",
      createdAt: new Date().toISOString(),
    };
    await sheetsAPI.push("TeamTasks", record);
    setTasks(p => [record, ...p]);
    setForm({ taskTitle: "", taskDesc: "", assignedTo: "all", dueDate: "", isBonus: false, suppFiles: "" });
    setSaving(false);
    showToast("Task assigned ✓");
  };

  const editTask = async () => {
    if (!editingTask) return;
    setSaving(true);
    const { taskTitle, taskDesc, dueDate, isBonus } = editingTask;
    await sheetsAPI.updateByMatch("TeamTasks", "id", editingTask.id, { taskTitle, taskDesc, dueDate, isBonus });
    setTasks(p => p.map(t => t.id === editingTask.id ? { ...t, taskTitle, taskDesc, dueDate, isBonus } : t));
    setEditingTask(null);
    setSaving(false);
    showToast("Task updated ✓");
  };

  const gradeSubmission = async (sub) => {
    const gf = gradeForm[sub.id] || {};
    if (!gf.score) { showToast("Enter a score first."); return; }
    if (sub._legacy) {
      // Legacy submission lives in TeamTasks — update there
      await sheetsAPI.updateByMatch("TeamTasks", "id", sub.taskId, { score: gf.score, feedback: gf.feedback || "", status: "graded" });
      setTasks(p => p.map(t => t.id === sub.taskId ? { ...t, status: "graded", score: gf.score, feedback: gf.feedback || "" } : t));
    } else {
      await sheetsAPI.updateByMatch("TaskSubmissions", "id", sub.id, { score: gf.score, feedback: gf.feedback || "", status: "graded" });
    }
    setSubmissions(p => p.map(s => s.id === sub.id ? { ...s, status: "graded", score: gf.score, feedback: gf.feedback || "" } : s));
    showToast("Graded ✓");
  };

  const saveGradeEdit = async () => {
    if (!editingGrade) return;
    setSaving(true);
    const gf = gradeForm[editingGrade.id] || {};
    const newScore    = gf.score    !== undefined ? gf.score    : editingGrade.score;
    const newFeedback = gf.feedback !== undefined ? gf.feedback : (editingGrade.feedback || "");
    if (editingGrade._legacy) {
      await sheetsAPI.updateByMatch("TeamTasks", "id", editingGrade.taskId, { score: newScore, feedback: newFeedback });
      setTasks(p => p.map(t => t.id === editingGrade.taskId ? { ...t, score: newScore, feedback: newFeedback } : t));
    } else {
      await sheetsAPI.updateByMatch("TaskSubmissions", "id", editingGrade.id, { score: newScore, feedback: newFeedback });
    }
    setSubmissions(p => p.map(s => s.id === editingGrade.id ? { ...s, score: newScore, feedback: newFeedback } : s));
    setEditingGrade(null);
    setSaving(false);
    showToast("Grade updated ✓");
  };

  if (!team) return <div className="card"><div className="card-body">No team assigned.</div></div>;
  if (loading) return <div className="card"><div className="card-body">Loading…</div></div>;

  const pendingSubs = submissions.filter(s => s.status === "submitted");
  const gradedSubs  = submissions.filter(s => s.status === "graded");
  const taskDefs    = tasks.filter(t => t.status !== "draft");

  const subsByTask = {};
  submissions.forEach(s => { if (!subsByTask[s.taskId]) subsByTask[s.taskId] = []; subsByTask[s.taskId].push(s); });

  const memberCount = members.filter(m => !["associate_researcher","associate","mentor"].includes(m.teamRole)).length;
  const getMemberName = (email) => { const m = members.find(x => x.email === email); return m?.name || m?.Name || email; };

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "var(--jade)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}

      <div className="banner" style={{ marginBottom: 20 }}>
        <div>
          <div className="banner-chip">Team {team.id} — Associate Researcher</div>
          <div className="banner-title">Task Manager</div>
          <div className="banner-sub">{team.challenge}</div>
        </div>
        <div className="bstats">
          <div><div className="bstat-val" style={{color:"var(--amber)"}}>{pendingSubs.length}</div><div className="bstat-label">To Grade</div></div>
          <div><div className="bstat-val">{taskDefs.length}</div><div className="bstat-label">Tasks</div></div>
          <div><div className="bstat-val" style={{color:"var(--jade)"}}>{gradedSubs.length}</div><div className="bstat-label">Graded</div></div>
        </div>
      </div>

      {/* Assign task */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">➕ Assign New Task</div></div>
        <div className="card-body">
          <div className="g2">
            <div className="fg"><label className="flabel">Task Title</label><input className="finput" value={form.taskTitle} onChange={e => setForm(f => ({ ...f, taskTitle: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">Assign To</label>
              <select className="finput fselect" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="all">Whole Team</option>
                {members.map(m => <option key={m.email} value={m.email}>{m.name || m.Name || m.email}</option>)}
              </select>
            </div>
          </div>
          <div className="fg"><label className="flabel">Description</label><textarea className="finput ftextarea" style={{ minHeight: 70 }} value={form.taskDesc} onChange={e => setForm(f => ({ ...f, taskDesc: e.target.value }))} /></div>
          <div className="fg"><label className="flabel">Supplementary Files (Google Drive links, comma-separated)</label><input className="finput" value={form.suppFiles} onChange={e => setForm(f => ({ ...f, suppFiles: e.target.value }))} placeholder="https://drive.google.com/..." /></div>
          <div className="g2">
            <div className="fg"><label className="flabel">Due Date</label><input type="date" className="finput" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="fg"><label className="flabel" style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isBonus} onChange={e => setForm(f => ({ ...f, isBonus: e.target.checked }))} /> Bonus Task (+15 pts)
            </label></div>
          </div>
          <button className="btn btn-p" onClick={assignTask} disabled={saving}>{saving ? "Saving…" : "Assign Task →"}</button>
        </div>
      </div>

      {/* Pending submissions to grade */}
      {pendingSubs.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><div className="card-title">📥 Submissions to Grade</div><span className="snav-badge warn">{pendingSubs.length}</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {pendingSubs.map((sub, i) => (
              <div key={sub.id || i} style={{ padding: "16px 20px", borderBottom: "1px solid var(--frost)" }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{sub.taskTitle}</div>
                  <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                    👤 <strong style={{color:"var(--ink2)"}}>{getMemberName(sub.memberEmail)}</strong> <span style={{opacity:.7}}>({sub.memberEmail})</span> · Submitted {sub.submittedAt?.split("T")[0] || "—"}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    {sub.fileLink && <a href={sub.fileLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--azure)", fontWeight: 600 }}>📎 View submission ↗</a>}
                    {sub.suppLinks && sub.suppLinks.split(",").map((f, j) => f.trim() && <a key={j} href={f.trim()} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--azure)" }}>Extra {j+1} ↗</a>)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div className="fg" style={{ flex: "0 0 100px", margin: 0 }}>
                    <label className="flabel">Score / 100</label>
                    <input type="number" min={0} max={100} className="finput" style={{ padding: "7px 10px" }} value={gradeForm[sub.id]?.score || ""} onChange={e => setGradeForm(p => ({ ...p, [sub.id]: { ...p[sub.id], score: e.target.value } }))} />
                  </div>
                  <div className="fg" style={{ flex: 1, margin: 0 }}>
                    <label className="flabel">Feedback</label>
                    <input className="finput" style={{ padding: "7px 10px" }} placeholder="Optional feedback…" value={gradeForm[sub.id]?.feedback || ""} onChange={e => setGradeForm(p => ({ ...p, [sub.id]: { ...p[sub.id], feedback: e.target.value } }))} />
                  </div>
                  <button className="btn btn-p btn-sm" style={{ marginBottom: 1, whiteSpace: "nowrap" }} onClick={() => gradeSubmission(sub)}>Grade ✓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Tasks — expandable per-member submission view */}
      <div className="card">
        <div className="card-header"><div className="card-title">📋 All Tasks</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {taskDefs.length === 0 && <div style={{ padding: 20, color: "var(--ink3)", fontSize: 13 }}>No tasks assigned yet.</div>}
          {taskDefs.map((t, i) => {
            const taskSubs    = subsByTask[t.id] || [];
            const gradedCount = taskSubs.filter(s => s.status === "graded").length;
            const pendingCount= taskSubs.filter(s => s.status === "submitted").length;
            const total       = t.assignedTo === "all" ? memberCount : 1;
            const isExpanded  = expandedTask === t.id;
            return (
              <div key={t.id || i}>
                <div
                  style={{ padding: "14px 20px", borderBottom: "1px solid var(--frost)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: isExpanded ? "var(--snow)" : "transparent" }}
                  onClick={() => setExpandedTask(isExpanded ? null : t.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                      {t.taskTitle}
                      {t.isBonus === "true" && <span style={{ fontSize: 10, background: "var(--jade)18", color: "var(--jade)", padding: "2px 7px", borderRadius: 10, marginLeft: 8, fontWeight: 700 }}>BONUS</span>}
                    </div>
                    <div className="txt-muted" style={{ fontSize: 11 }}>
                      {t.assignedTo === "all" ? "Whole team" : getMemberName(t.assignedTo)}
                      {" · "}Due {t.dueDate || "TBD"}
                      {" · "}<span style={{ color: pendingCount > 0 ? "var(--amber)" : "var(--ink3)" }}>{pendingCount} pending</span>
                      {" · "}<span style={{ color: "var(--jade)" }}>{gradedCount} graded</span>
                      {t.assignedTo === "all" && total > 0 && <span> · {taskSubs.length}/{total} submitted</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    {pendingCount > 0 && <span className="snav-badge warn">{pendingCount}</span>}
                    <button className="btn btn-sm" style={{ fontSize: 11, padding: "4px 10px" }} onClick={e => { e.stopPropagation(); setEditingTask({ ...t }); }}>Edit</button>
                    <span style={{ fontSize: 11, color: "var(--ink3)", userSelect: "none" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ background: "#f8f9fc", borderBottom: "1px solid var(--frost)" }}>
                    {taskSubs.length === 0 ? (
                      <div style={{ padding: "12px 32px", fontSize: 12, color: "var(--ink3)", fontStyle: "italic" }}>No submissions yet.</div>
                    ) : taskSubs.map((sub, j) => (
                      <div key={sub.id || j} style={{ padding: "12px 32px", borderBottom: j < taskSubs.length - 1 ? "1px solid var(--frost)" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{getMemberName(sub.memberEmail)}</div>
                          <div style={{ fontSize: 11, color: "var(--ink3)" }}>
                            {sub.memberEmail} · {sub.submittedAt?.split("T")[0] || "—"}
                            {sub.fileLink && <> · <a href={sub.fileLink} target="_blank" rel="noreferrer" style={{ color: "var(--azure)", fontWeight: 600 }}>View ↗</a></>}
                            {sub.suppLinks && sub.suppLinks.split(",").map((f, k) => f.trim() && <> · <a key={k} href={f.trim()} target="_blank" rel="noreferrer" style={{ color: "var(--azure)" }}>Extra {k+1} ↗</a></>)}
                          </div>
                          {sub.feedback && <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2, fontStyle: "italic" }}>"{sub.feedback}"</div>}
                        </div>
                        {sub.status === "graded" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, color: "var(--jade)", lineHeight: 1 }}>{sub.score}</div>
                              <div style={{ fontSize: 10, color: "var(--ink3)" }}>/ 100</div>
                            </div>
                            <button className="btn btn-sm" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setEditingGrade(sub); setGradeForm(p => ({ ...p, [sub.id]: { score: sub.score, feedback: sub.feedback || "" } })); }}>Edit Grade</button>
                          </div>
                        ) : (
                          <span className={`badge ${sub.status === "submitted" ? "b-review" : "b-phase"}`}>{sub.status || "assigned"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Edit Task</div>
            <div className="fg"><label className="flabel">Task Title</label><input className="finput" value={editingTask.taskTitle || ""} onChange={e => setEditingTask(p => ({ ...p, taskTitle: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">Description</label><textarea className="finput ftextarea" style={{ minHeight: 60 }} value={editingTask.taskDesc || ""} onChange={e => setEditingTask(p => ({ ...p, taskDesc: e.target.value }))} /></div>
            <div className="fg"><label className="flabel">Due Date</label><input type="date" className="finput" value={editingTask.dueDate || ""} onChange={e => setEditingTask(p => ({ ...p, dueDate: e.target.value }))} /></div>
            <div className="fg"><label className="flabel" style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={editingTask.isBonus === "true" || editingTask.isBonus === true} onChange={e => setEditingTask(p => ({ ...p, isBonus: e.target.checked ? "true" : "false" }))} /> Mark as Bonus Task
            </label></div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-p" onClick={editTask} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
              <button className="btn" onClick={() => setEditingTask(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Grade Modal */}
      {editingGrade && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Edit Grade</div>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 16 }}>{editingGrade.taskTitle} · {getMemberName(editingGrade.memberEmail)}</div>
            <div className="fg"><label className="flabel">Score / 100</label>
              <input type="number" min={0} max={100} className="finput" value={gradeForm[editingGrade.id]?.score ?? editingGrade.score ?? ""} onChange={e => setGradeForm(p => ({ ...p, [editingGrade.id]: { ...p[editingGrade.id], score: e.target.value } }))} />
            </div>
            <div className="fg"><label className="flabel">Feedback</label>
              <input className="finput" value={gradeForm[editingGrade.id]?.feedback ?? editingGrade.feedback ?? ""} onChange={e => setGradeForm(p => ({ ...p, [editingGrade.id]: { ...p[editingGrade.id], feedback: e.target.value } }))} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-p" onClick={saveGradeEdit} disabled={saving}>{saving ? "Saving…" : "Update Grade"}</button>
              <button className="btn" onClick={() => setEditingGrade(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  REQUEST MEETING VOTE  (AR + Admin — request members vote for a slot)
// ─────────────────────────────────────────────────────────────────────────────
function RequestMeetingVote({ user }) {
  return <MeetingNotesView user={user} />;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXCUSE REVIEW  (AR + Admin — approve / reject excuses)
// ─────────────────────────────────────────────────────────────────────────────
function ExcuseReviewView({ user }) {
  const team = getTeam(user);
  const [excuses, setExcuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState("");

  useEffect(() => {
    if (!team) { setLoading(false); return; }
    sheetsAPI.getByTeam("ExcuseRequests", team.id).then(e => { setExcuses(e); setLoading(false); });
  }, [team?.id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const decide = async (excuse, decision) => {
    await sheetsAPI.updateByMatch("ExcuseRequests", "id", excuse.id, { status: decision, reviewedBy: user.email, reviewedAt: new Date().toISOString() });
    setExcuses(p => p.map(e => e.id === excuse.id ? { ...e, status: decision } : e));
    showToast(`Excuse ${decision} ✓`);
  };

  if (!team) return <div className="card"><div className="card-body">No team assigned.</div></div>;
  if (loading) return <div className="card"><div className="card-body">Loading…</div></div>;

  const pending  = excuses.filter(e => e.status === "pending");
  const reviewed = excuses.filter(e => e.status !== "pending");

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "var(--jade)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>{toast}</div>}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">Pending Excuses</div>{pending.length > 0 && <span className="snav-badge warn">{pending.length}</span>}</div>
        <div className="card-body" style={{ padding: 0 }}>
          {pending.length === 0 && <div style={{ padding: 20, color: "var(--ink3)", fontSize: 13 }}>No pending excuses.</div>}
          {pending.map((e, i) => (
            <div key={e.id || i} style={{ padding: "16px 20px", borderBottom: "1px solid var(--frost)" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.memberName || e.memberEmail}</div>
                  <div className="txt-muted" style={{ fontSize: 12 }}>{e.excuseType === "meeting" ? "Meeting absence" : "Task deadline"} — {e.targetDate}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>{e.reason}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-p btn-sm" onClick={() => decide(e, "approved")}>✓ Approve</button>
                <button className="btn btn-sm" style={{ background: "var(--rose)18", color: "var(--rose)", border: "1px solid var(--rose)40" }} onClick={() => decide(e, "rejected")}>✗ Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {reviewed.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Reviewed Excuses</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {reviewed.map((e, i) => (
              <div key={e.id || i} style={{ padding: "12px 20px", borderBottom: "1px solid var(--frost)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.memberName || e.memberEmail} — {e.targetDate}</div>
                  <div className="txt-muted" style={{ fontSize: 12 }}>{e.reason?.slice(0, 60)}{e.reason?.length > 60 ? "…" : ""}</div>
                </div>
                <span className={`badge ${e.status === "approved" ? "b-qual" : ""}`} style={e.status === "rejected" ? { background: "var(--rose)18", color: "var(--rose)" } : {}}>{e.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEAM ADMIN DASHBOARD  (same as AR + grading overview for all members)
// ─────────────────────────────────────────────────────────────────────────────
function TeamAdminDashboard({ user }) {
  const team = getTeam(user);
  const [tab, setTab] = useState("tasks");
  const tabs = [
    { id: "tasks",    label: "📋 Tasks" },
    { id: "meetings", label: "📅 Meetings" },
    { id: "excuses",  label: "📝 Excuses" },
    { id: "grades",   label: "🏆 Grades" },
  ];
  return (
    <div>
      <div className="banner" style={{ marginBottom: 20 }}>
        <div>
          <div className="banner-chip">Team {team?.id || "?"} — Admin</div>
          <div className="banner-title">Team Dashboard</div>
          <div className="banner-sub">{team?.challenge}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === "tasks"    && <ARTaskManager user={user} />}
      {tab === "meetings" && <MeetingNotesView user={user} />}
      {tab === "excuses"  && <ExcuseReviewView user={user} />}
      {tab === "grades"   && <TeamGradeOverview user={user} />}
    </div>
  );
}

function TeamGradeOverview({ user }) {
  const team = getTeam(user);
  const [tasks, setTasks]       = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [excuses, setExcuses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);  // selected member email
  const [tab, setTab]           = useState("grades"); // grades | tasks | profile

  const [feedbacks, setFeedbacks] = useState([]);

  useEffect(() => {
    if (!team) { setLoading(false); return; }
    Promise.all([
      sheetsAPI.getByTeam("TeamTasks",      team.id),
      sheetsAPI.getByTeam("MeetingNotes",   team.id),
      sheetsAPI.getByTeam("ExcuseRequests", team.id),
      sheetsAPI.get("Users"),
      sheetsAPI.getByTeam("WeeklyFeedback", team.id),
    ]).then(([t, m, ex, u, fb]) => {
      setTasks(t || []);
      setMeetings(m || []);
      setExcuses(ex || []);
      setFeedbacks(fb || []);
      const members = (u || []).filter(mem =>
        (mem.teamId || mem.team) === team.id &&
        mem.teamRole !== "associate_researcher" &&
        mem.teamRole !== "associate"
      );
      setAllUsers(members);
      if (members.length > 0) setSelected(members[0].email);
      setLoading(false);
    });
  }, [team?.id]);

  if (!team) return <div className="card"><div className="card-body">No team assigned.</div></div>;
  if (loading) return <div className="card"><div className="card-body" style={{padding:40,textAlign:"center",color:"var(--ink3)"}}>Loading team data…</div></div>;

  const computeScore = (m) => {
    const myTasks    = tasks.filter(t => (t.assignedTo === m.email || t.assignedTo === "all") && t.status === "graded" && t.isBonus !== "true");
    const myBonus    = tasks.filter(t => (t.assignedTo === m.email || t.assignedTo === "all") && t.status === "graded" && t.isBonus === "true");
    const taskAvg    = myTasks.length ? Math.round(myTasks.reduce((a, t) => a + Number(t.score || 0), 0) / myTasks.length) : 0;
    const bonusPts   = myBonus.reduce((a, t) => a + Number(t.score || 0), 0);
    const attended   = meetings.filter(mt => (mt.attendees || "").includes(m.email)).length;
    const attendPct  = meetings.length ? Math.round((attended / meetings.length) * 100) : 0;
    const attendScore= Math.round(attendPct * 0.25);
    const myExcuses  = excuses.filter(e => e.memberEmail?.toLowerCase() === m.email?.toLowerCase());
    const penaltyPts = myExcuses.filter(e => e.status === "rejected").length * 2;
    const total      = Math.min(100, Math.max(0, Math.round(taskAvg * 0.75 + attendScore - penaltyPts))) + bonusPts;
    return { taskAvg, bonusPts: Math.round(bonusPts), attendPct, attendScore, penaltyPts, total,
      myTasks, myBonus, attended, allTasks: tasks.filter(t => t.assignedTo === m.email || t.assignedTo === "all"), myExcuses };
  };

  const activeMember = allUsers.find(m => m.email === selected);
  const activeScore  = activeMember ? computeScore(activeMember) : null;

  const gradeColor = (s) => s >= 85 ? "var(--jade)" : s >= 65 ? "var(--amber)" : "var(--rose)";
  const gradeLabel = (s) => s >= 85 ? "Excellent" : s >= 65 ? "On Track" : "Needs Work";

  return (
    <div>
      {/* ── Banner ── */}
      <div className="banner" style={{marginBottom:20}}>
        <div>
          <div className="banner-chip">Team {team.id} — {team.track}</div>
          <div className="banner-title">Team Overview</div>
          <div className="banner-sub">{team.challenge}</div>
        </div>
        <div className="bstats">
          <div><div className="bstat-val">{allUsers.length}</div><div className="bstat-label">Members</div></div>
          <div><div className="bstat-val">{tasks.filter(t=>t.status==="submitted").length}</div><div className="bstat-label">To Grade</div></div>
          <div><div className="bstat-val">{excuses.filter(e=>e.status==="pending").length}</div><div className="bstat-label">Excuses</div></div>
        </div>
      </div>

      {/* ── Per-member overview ── */}
      <div className="card">
        <div className="card-header"><div className="card-title">👥 Team Members</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {allUsers.length === 0 && <div style={{ padding: 20, color: "var(--ink3)", fontSize: 13 }}>No members yet.</div>}
          {allUsers.map((m, i) => {
            const sc        = computeScore(m);
            const submitted = tasks.filter(t => {
              const at = (t.assignedTo || "").toLowerCase().trim();
              return (at === "all" || at === (m.email || "").toLowerCase()) && (t.status === "submitted" || t.status === "graded");
            }).length;
            const totalTasks = tasks.filter(t => {
              const at = (t.assignedTo || "").toLowerCase().trim();
              return at === "all" || at === (m.email || "").toLowerCase();
            }).length;
            const memberFbs = feedbacks.filter(fb => (fb.submitterEmail || "").toLowerCase() === (m.email || "").toLowerCase());
            const avgFbRating = memberFbs.length
              ? (memberFbs.reduce((a, fb) => a + Number(fb.sessionRating || fb.rating || 0), 0) / memberFbs.length).toFixed(1)
              : null;
            const gc = gradeColor(sc.total);
            return (
              <div key={m.email || i} style={{ padding: "16px 20px", borderBottom: "1px solid var(--frost)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {/* Avatar + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${gc}20`, border: `2px solid ${gc}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: gc, flexShrink: 0 }}>
                    {(m.name || m.Name || m.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{m.name || m.Name || m.email}</div>
                    <div style={{ fontSize: 11, color: "var(--ink3)" }}>{m.teamRole || m.role || "member"}</div>
                  </div>
                </div>

                {/* Stats chips */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: 1 }}>
                  <div style={{ textAlign: "center", padding: "6px 14px", borderRadius: 10, background: "var(--snow)", border: "1px solid var(--frost)" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: sc.attendPct >= 75 ? "var(--jade)" : "var(--amber)" }}>{sc.attended}/{meetings.length}</div>
                    <div style={{ fontSize: 10, color: "var(--ink3)", marginTop: 1 }}>Meetings</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "6px 14px", borderRadius: 10, background: "var(--snow)", border: "1px solid var(--frost)" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--violet)" }}>{submitted}/{totalTasks}</div>
                    <div style={{ fontSize: 10, color: "var(--ink3)", marginTop: 1 }}>Tasks</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "6px 14px", borderRadius: 10, background: "var(--snow)", border: "1px solid var(--frost)" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: sc.taskAvg >= 75 ? "var(--jade)" : sc.taskAvg > 0 ? "var(--amber)" : "var(--ink3)" }}>{sc.taskAvg > 0 ? sc.taskAvg : "—"}</div>
                    <div style={{ fontSize: 10, color: "var(--ink3)", marginTop: 1 }}>Avg Score</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "6px 14px", borderRadius: 10, background: "var(--snow)", border: "1px solid var(--frost)" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--azure)" }}>{avgFbRating ? `${avgFbRating}★` : memberFbs.length > 0 ? memberFbs.length : "—"}</div>
                    <div style={{ fontSize: 10, color: "var(--ink3)", marginTop: 1 }}>Feedback</div>
                  </div>
                </div>

                {/* Total score badge */}
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 900, color: gc, lineHeight: 1 }}>{sc.total}</div>
                  <div style={{ fontSize: 10, color: "var(--ink3)" }}>{gradeLabel(sc.total)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
//  MENTOR VIEWS
// ─────────────────────────────────────────────
function useMentorTeamMembers(user) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const team = getTeam(user);
  useEffect(() => {
    if (!team) { setLoading(false); return; }
    sheetsAPI.get("Users").then(rows => {
      const teamMembers = rows.filter(r =>
        String(r.teamId || r.team || "").trim().toUpperCase() === team.id.toUpperCase() &&
        String(r.teamRole || "").toLowerCase() !== "mentor"
      );
      setMembers(teamMembers);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [team?.id]);
  return { members, loading, team };
}

function MentorDashboard({ user }) {
  const { members, loading, team } = useMentorTeamMembers(user);
  const name = (user.name || user.Name || user.email || "").split(" ").slice(0,2).join(" ");
  return (
    <div>
      <div className="banner">
        <div>
          <div className="banner-chip">Mentor · IEEE E-JUST EMBS SBC</div>
          <div className="banner-title">Welcome, {name}</div>
          <div className="banner-sub">{team ? team.challenge : "No team assigned"} · {members.length} Team Members</div>
        </div>
        <div className="bstats">
          {[[members.length,"Members"],[team?.meeting||"—","Meeting Time"]].map(([v,l])=>(
            <div key={l}><div className="bstat-val" style={{fontSize:typeof v==="string"&&v.length>6?12:undefined}}>{v}</div><div className="bstat-label">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="g4 mb6">
        <div className="stat"><div className="stat-icon">👥</div><div className="stat-val">{members.length}</div><div className="stat-label">Team Members</div></div>
        <div className="stat blue"><div className="stat-icon">🏥</div><div className="stat-val">{team?.id||"—"}</div><div className="stat-label">Team</div></div>
        <div className="stat green"><div className="stat-icon">📅</div><div className="stat-val">{team?.track||"—"}</div><div className="stat-label">Track</div></div>
        <div className="stat amber"><div className="stat-icon">🔬</div><div className="stat-val" style={{fontSize:11}}>{team?.challenge?.split(" ").slice(0,3).join(" ")||"—"}</div><div className="stat-label">Challenge</div></div>
      </div>
      {loading ? <div className="txt-muted" style={{padding:20}}>Loading team members…</div> : (
        <div className="card">
          <div className="card-header"><div className="card-title">Team Members</div></div>
          <div className="card-body" style={{padding:0}}>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>{members.length === 0 ? (
                <tr><td colSpan={4} style={{textAlign:"center",color:"var(--ink3)",padding:20}}>No team members found for Team {team?.id}</td></tr>
              ) : members.map((m,i)=>(
                <tr key={m.id||m.email||i}>
                  <td style={{fontWeight:600}}>{m.name||m.Name||m.email}</td>
                  <td className="txt-muted" style={{fontSize:12}}>{m.email}</td>
                  <td><span className="badge b-review">{m.teamRole||"Member"}</span></td>
                  <td><span className={`badge ${m.status==="active"?"b-qual":"b-phase"}`}>{m.status||"active"}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MentorMentees({ user }) {
  const { members, loading, team } = useMentorTeamMembers(user);
  if (loading) return <div className="txt-muted" style={{padding:20}}>Loading…</div>;
  if (!team) return <div className="card"><div className="card-body">No team assigned to your account.</div></div>;
  return (
    <div>
      <div style={{marginBottom:16,fontSize:14,color:"var(--ink3)"}}>
        Team {team.id} — {team.challenge}
      </div>
      <div className="g2">
        {members.length === 0 ? (
          <div className="card"><div className="card-body">No team members found for Team {team.id}.</div></div>
        ) : members.map((m,i)=>(
          <div key={m.id||m.email||i} className="card">
            <div className="card-body">
              <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
                <div className="sava" style={{width:48,height:48,fontSize:20}}>{(m.name||m.email||"?")[0]}</div>
                <div>
                  <div style={{fontSize:15,fontWeight:700}}>{m.name||m.Name||m.email}</div>
                  <div className="txt-muted">{m.email}</div>
                  <div style={{marginTop:4}}><span className="badge b-review">{m.teamRole||"Member"}</span></div>
                </div>
              </div>
              {[["Team",`Team ${team.id}`],["Challenge",team.challenge],["Status",m.status||"active"],["GitHub",m.github||"—"],["LinkedIn",m.linkedin||"—"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",borderBottom:"1px solid var(--frost)"}}>
                  <span className="txt-muted">{k}</span><span style={{fontWeight:600,maxWidth:200,textAlign:"right",wordBreak:"break-all"}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MentorMeetings({ user }) {
  const { pushToSheets, participants } = useContext(DataCtx);
  const myMentees = participants.filter(p=>user.mentees?.includes(p.id));
  const [form, setForm] = useState({ mentee:"", date:"", time:"", topics:[] });
  const agenda = ["Progress Review","Challenge Discussion","Direction Guidance","Resource Planning"];
  const toggle = (t) => setForm(f=>({...f,topics:f.topics.includes(t)?f.topics.filter(x=>x!==t):[...f.topics,t]}));
  return (
    <div className="g2">
      <div className="card">
        <div className="card-header"><div className="card-title">Schedule Meeting</div></div>
        <div className="card-body">
          <div className="fg"><label className="flabel">Mentee</label>
            <select className="finput fselect" value={form.mentee} onChange={e=>setForm({...form,mentee:e.target.value})}>
              <option value="">Select mentee...</option>
              {myMentees.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="fg"><label className="flabel">Date</label><input type="date" className="finput" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
          <div className="fg"><label className="flabel">Time</label><input type="time" className="finput" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></div>
          <div className="fg">
            <label className="flabel">Agenda Items</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {agenda.map(t=>(
                <div key={t} onClick={()=>toggle(t)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:"1.5px solid",borderColor:form.topics.includes(t)?"var(--violet)":"var(--frost)",background:form.topics.includes(t)?"rgba(91,59,245,.08)":"white",color:form.topics.includes(t)?"var(--violet)":"var(--ink3)"}}>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-p" onClick={()=>pushToSheets("Meetings",{...form,mentorId:user.id,duration:60,scheduledAt:new Date().toISOString()})}>Schedule & Save to Sheets</button>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Upcoming Meetings</div></div>
        <div className="card-body">
          {[
            {name:"Nour El-Sayed",date:"2026-03-04",time:"10:00",status:"Confirmed"},
            {name:"Omar Farid",  date:"2026-03-05",time:"14:00",status:"Confirmed"},
            {name:"Nour El-Sayed",date:"2026-03-11",time:"10:00",status:"Pending"},
          ].filter(m=>myMentees.some(p=>p.name===m.name)).map((m,i)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"12px 0",borderBottom:"1px solid var(--frost)",alignItems:"center"}}>
              <div className="sava" style={{width:34,height:34,fontSize:13}}>{m.name.split(" ").map(n=>n[0]).join("")}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600}}>{m.name}</div>
                <div className="txt-muted">{m.date} · {m.time} · 60 min</div>
              </div>
              <span className={`badge ${m.status==="Confirmed"?"b-qual":"b-review"}`}>{m.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaperReview({ user }) {
  const { pushToSheets, participants } = useContext(DataCtx);
  const myMentees = participants.filter(p=>user.mentees?.includes(p.id));
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Paper Review Portal</div><div className="card-sub">3 IEEE draft review rounds per mentee</div></div>
      <div className="card-body">
        {myMentees.map(p=>(
          <div key={p.id} style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div className="sava" style={{width:30,height:30,fontSize:11}}>{p.avatar}</div>
              <span style={{fontWeight:700,fontSize:14}}>{p.name}</span>
              <TrackBadge track={p.track} label={p.trackLabel}/>
            </div>
            {["Draft 1: Structure & Abstract","Draft 2: Results & Discussion","Draft 3: Final Polish"].map((d,i)=>(
              <div key={i} style={{padding:"14px",border:"1px solid var(--frost)",borderRadius:10,marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Round {i+1}</div>
                <div className="flex-between">
                  <span style={{fontSize:13,fontWeight:600}}>{d}</span>
                  <span className={`badge ${i===0?"b-qual":i===1?"b-review":"b-phase"}`} style={{background:i>1?"var(--snow)":""}}>
                    {i===0?"Reviewed":i===1?"Submitted":"Pending"}
                  </span>
                </div>
                {i===1&&(
                  <div>
                    <textarea className="finput ftextarea" style={{marginTop:10,minHeight:70}} placeholder="Add review feedback..." />
                    <button className="btn btn-p btn-sm" style={{marginTop:8}} onClick={()=>pushToSheets("PaperReviews",{mentorId:user.id,participantId:p.id,round:i+1,submittedAt:new Date().toISOString()})}>Submit Feedback → Sheets</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MenteeProgress({ user }) {
  const { participants } = useContext(DataCtx);
  const myMentees = participants.filter(p=>user.mentees?.includes(p.id));
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Mentee Progress Tracker</div></div>
      <div className="card-body" style={{padding:0}}>
        <table className="tbl">
          <thead><tr><th>Mentee</th><th>Phase</th><th>Progress</th><th>Portfolio</th><th>Interview</th><th>Novelty</th><th>Competition</th></tr></thead>
          <tbody>{myMentees.map(p=>(
            <tr key={p.id}>
              <td style={{fontWeight:600}}>{p.name}</td>
              <td><PhaseBadge phase={p.phase}/></td>
              <td style={{minWidth:130}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{flex:1}}><PBar val={(p.phase-1)} max={5}/></div>
                  <span className="mono" style={{fontSize:11}}>{Math.round(((p.phase-1)/5)*100)}%</span>
                </div>
              </td>
              <td className="mono">{p.portfolioScore}</td>
              <td className="mono">{p.interviewScore}</td>
              <td>{p.noveltyVerified?"✅":"⏳"}</td>
              <td style={{fontSize:12}}>{p.competitionEnrolled||"—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  SUPER ADMIN VIEWS
// ─────────────────────────────────────────────
function AdminDashboard({ user }) {
  const { syncStatus } = useContext(DataCtx);
  const [apps, setApps]       = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [appsData, reviewsData] = await Promise.all([
        sheetsAPI.get("Applications"),
        sheetsAPI.get("Reviews")
      ]);
      if (appsData && Array.isArray(appsData)) setApps(appsData);
      if (reviewsData && Array.isArray(reviewsData)) setReviews(reviewsData);
      setLoading(false);
    })();
  }, []);

  const getTopDecision = (appEmail) => {
    const appRevs = reviews.filter(r=>(r["applicationEmail"]||r["ApplicationEmail"]||"").toLowerCase()===(appEmail||"").toLowerCase());
    const decs = appRevs.map(r=>(r["decision"]||r["Decision"]||"").toLowerCase());
    if (decs.some(d=>d.includes("accept"))) return "Accepted";
    if (decs.some(d=>d.includes("wait"))) return "Waitlisted";
    if (decs.some(d=>d.includes("reject"))) return "Rejected";
    return "Pending";
  };

  const accepted   = apps.filter(a=>getTopDecision(a["Email"])==="Accepted").length;
  const waitlisted = apps.filter(a=>getTopDecision(a["Email"])==="Waitlisted").length;
  const rejected   = apps.filter(a=>getTopDecision(a["Email"])==="Rejected").length;
  const pending    = apps.filter(a=>getTopDecision(a["Email"])==="Pending").length;

  return (
    <div>
      <div className="banner" style={{marginBottom:24}}>
        <div>
          <div className="banner-chip">Super Admin · IEEE E-JUST EMBS SBC · Ri-So 2026</div>
          <div className="banner-title">Program Control Center</div>
          <div className="banner-sub">{loading ? "Connecting to Google Sheets..." : apps.length+" applications · "+reviews.length+" reviews submitted"}</div>
        </div>
        <div className="bstats">
          <div className="bstat"><div className="bstat-val">{loading?"...":apps.length}</div><div className="bstat-label">Applications</div></div>
          <div className="bstat"><div className="bstat-val">{loading?"...":reviews.length}</div><div className="bstat-label">Reviews</div></div>
        </div>
      </div>

      <div className="g4 mb6">
        {[[apps.length,"Total","👥",""],[pending,"Pending","⏳","amber"],[accepted,"Accepted","✅","green"],[waitlisted,"Waitlisted","◐","blue"]].map(([v,l,icon,c])=>(
          <div key={l} className={"stat "+c}>
            <div className="stat-icon">{icon}</div>
            <div className="stat-val">{loading?"...": v}</div>
            <div className="stat-label">{l}</div>
          </div>
        ))}
      </div>

      {!loading && apps.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">📥 Recent Applications</div><div className="card-sub">{apps.length} total</div></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div className="sync-dot"/><span className="sync-txt">Sheets Live</span>
            </div>
          </div>
          <div className="card-body" style={{padding:0}}>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Country</th><th>University</th><th>GPA</th><th>Track</th><th>Status</th></tr></thead>
              <tbody>{apps.slice(0,20).map((a,i)=>{
                const top = getTopDecision(a["Email"]);
                const bg = top==="Accepted"?"#D1FAE5":top==="Waitlisted"?"#FEF3C7":top==="Rejected"?"#FEE2E2":"var(--frost)";
                const fg = top==="Accepted"?"#065F46":top==="Waitlisted"?"#92400E":top==="Rejected"?"#991B1B":"var(--ink3)";
                return (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{a["Name"]||"—"}</td>
                    <td style={{fontSize:12,fontWeight:600}}>{a["Country"]||a["Nationality"]||"—"}</td>
                    <td style={{fontSize:12,color:"var(--ink3)"}}>{(a["University"]||"—").slice(0,28)}</td>
                    <td className="mono">{a["GPA"]||"—"}</td>
                    <td style={{fontSize:11}}>{(a["Target Track"]||"—").split(",")[0]}</td>
                    <td><span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:bg,color:fg}}>{top}</span></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && apps.length === 0 && (
        <div className="card"><div className="card-body" style={{textAlign:"center",padding:48,color:"var(--ink3)"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:14,fontWeight:600}}>No applications loaded</div>
          <div style={{fontSize:12,marginTop:6}}>Make sure your sheet is named exactly "Applications"</div>
        </div></div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
//  FILTRATION CENTER — Deep Competitive Review
// ─────────────────────────────────────────────

// 7 detailed criteria — total 100 pts
const CRITERIA = [
  {
    id: "academic", icon: "🎓", label: "Academic Standing", weight: 15,
    desc: "GPA strength, academic year maturity, faculty/department relevance",
    rubric: [
      { pts: 15, label: "Exceptional", detail: "GPA ≥ 3.5, 3rd year+, highly relevant faculty (Biomed/CS/Eng)" },
      { pts: 11, label: "Strong",      detail: "GPA 3.0–3.5, 2nd year+, somewhat relevant background" },
      { pts: 7,  label: "Average",     detail: "GPA 2.5–3.0, any year, adjacent field" },
      { pts: 3,  label: "Weak",        detail: "GPA < 2.5 or 1st year only" },
    ]
  },
  {
    id: "programming", icon: "💻", label: "Programming Skills", weight: 15,
    desc: "Self-assessed programming level + evidence of practical implementation",
    rubric: [
      { pts: 15, label: "Advanced/Expert", detail: "Advanced libraries (TF/PyTorch/OpenCV), real projects cited" },
      { pts: 11, label: "Intermediate",    detail: "Libraries like NumPy/Pandas, understands ML concepts" },
      { pts: 6,  label: "Beginner",        detail: "Basic syntax, no applied projects" },
      { pts: 2,  label: "None",            detail: "No programming background" },
    ]
  },
  {
    id: "math", icon: "📐", label: "Mathematical Maturity", weight: 10,
    desc: "Linear algebra, calculus, probability, statistics — depth matters for research",
    rubric: [
      { pts: 10, label: "Advanced",     detail: "Linear algebra + optimization + probability, research-ready" },
      { pts: 7,  label: "Intermediate", detail: "Probability + matrices, standard engineering math" },
      { pts: 4,  label: "Basic",        detail: "Calculus only or self-reported basic level" },
      { pts: 1,  label: "None",         detail: "No mathematical background mentioned" },
    ]
  },
  {
    id: "problem_solving", icon: "🧩", label: "Problem-Solving Essay", weight: 20,
    desc: "Q1 — Real technical challenge: clarity, systematic approach, learning, outcome",
    rubric: [
      { pts: 20, label: "Exceptional", detail: "Specific technical challenge, systematic debugging/research, clear outcome, generalizable lesson" },
      { pts: 15, label: "Strong",      detail: "Real problem with decent approach, some depth, mentions outcome" },
      { pts: 9,  label: "Average",     detail: "Vague problem or generic approach, limited technical depth" },
      { pts: 3,  label: "Weak",        detail: "No real problem, generic statements, no technical substance" },
    ]
  },
  {
    id: "methodology", icon: "🔬", label: "Research Methodology", weight: 20,
    desc: "Q2 — First-week plan for stroke/ECG objective: structure, prioritization, clinical awareness",
    rubric: [
      { pts: 20, label: "Exceptional", detail: "Day-by-day structured plan, literature review → data → modeling → validation, domain-aware (clinical markers)" },
      { pts: 15, label: "Strong",      detail: "Clear phased approach, mentions lit review + dataset, realistic scope" },
      { pts: 9,  label: "Average",     detail: "Broad plan without structure, misses key steps (e.g. no data exploration)" },
      { pts: 3,  label: "Weak",        detail: "Jumps to modeling without groundwork, or no plan at all" },
    ]
  },
  {
    id: "goals", icon: "🚀", label: "Goals & Vision", weight: 10,
    desc: "Q3 — Clarity of 12–18 month goals, alignment with IEEE publication + research output",
    rubric: [
      { pts: 10, label: "Exceptional", detail: "Specific measurable goals: publication target, skill roadmap, competition entry, career clarity" },
      { pts: 7,  label: "Strong",      detail: "Mentions publication + learning goals, mostly aligned with program" },
      { pts: 4,  label: "Average",     detail: "Generic aspirations, lacks specificity or alignment" },
      { pts: 1,  label: "Weak",        detail: "Vague or disconnected from program scope" },
    ]
  },
  {
    id: "motivation", icon: "🎯", label: "Motivation & Track Fit", weight: 10,
    desc: "Biomedical passion, track rationale quality, and portfolio evidence (LinkedIn/CV)",
    rubric: [
      { pts: 10, label: "Exceptional", detail: "Clear biomedical passion, highly specific track rationale, and strong portfolio evidence (projects/publications/impact referenced via CV/LinkedIn or provided text)" },
      { pts: 7,  label: "Strong",      detail: "Real interest + relevant track choice, with mostly concrete portfolio evidence (links or provided portfolio text); some details may be missing" },
      { pts: 4,  label: "Average",     detail: "Interest is present but generic; track rationale lacks specificity; portfolio evidence is limited or not clearly connected to the track" },
      { pts: 1,  label: "Weak",        detail: "Unclear motivation or mismatched track; minimal/no portfolio evidence, or rationale does not connect to program goals" },
    ]
  },
];

// Auto-score helpers from sheet data
function parseTechLevel(str) {
  const s = (str || "").toLowerCase();
  const progMatch = s.match(/programming[^|]*?:\s*(\w+)/);
  const mathMatch = s.match(/math[^:]*?:\s*(\w+)/);
  const libMatch  = s.match(/libraries?[:\s]+([^|]+)/i);
  const progLevel = progMatch?.[1] || "none";
  const mathLevel = mathMatch?.[1] || "none";
  const libs = libMatch?.[1]?.toLowerCase() || "";
  const hasAdvancedLibs = /tensorflow|pytorch|keras|opencv|sklearn|scikit/.test(libs);
  const hasIntermediateLibs = /numpy|pandas|matplotlib|seaborn/.test(libs);
  return { progLevel, mathLevel, libs, hasAdvancedLibs, hasIntermediateLibs };
}

function autoScore(app) {
  // Academic
  const gpa = parseFloat(app["GPA"]) || 0;
  const yr = (app["Academic Year"] || "").toLowerCase();
  let academic = 0;
  if (gpa >= 3.5) academic += 9; else if (gpa >= 3.0) academic += 6; else if (gpa >= 2.5) academic += 3; else academic += 1;
  if (yr.includes("grad") || yr.includes("master")) academic += 6;
  else if (yr.includes("4")) academic += 6;
  else if (yr.includes("3")) academic += 5;
  else if (yr.includes("2")) academic += 3;
  else academic += 1;
  academic = Math.min(academic, 15);

  // Programming — from Programming Skill column only
  const { progLevel, hasAdvancedLibs, hasIntermediateLibs } = parseTechLevel(app["Programming Skill"] || "");
  let programming = 0;
  if (progLevel === "advanced" || progLevel === "expert" || hasAdvancedLibs) programming = 15;
  else if (progLevel === "intermediate" || hasIntermediateLibs) programming = 11;
  else if (progLevel === "beginner") programming = 6;
  else programming = 2;

  // Math — derive from MCQ score since Math/Stats Skill now holds MCQ answers
  const mcq = getMCQScore(app);
  let math = 0;
  if (mcq.correct === 3) math = 10;
  else if (mcq.correct === 2) math = 7;
  else if (mcq.correct === 1) math = 4;
  else math = 1;

  return { academic, programming, math, problem_solving: 10, methodology: 10, goals: 5, motivation: 5 };
}

// ── GROQ API helper (FREE - 90 req/min, perfect for production) ────────
// Get your FREE key at: https://console.groq.com/keys (no credit card needed)
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY; // ← Get free key at console.groq.com/keys, paste here

async function callGroq(prompt, retries = 3) {
  if (!GROQ_KEY) return null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_KEY}`
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              {
                role: "system",
                content: "You are a JSON-only responder. You MUST return only a single valid JSON object. No markdown, no backticks, no explanation, no text before or after the JSON. Start your response with { and end with }."
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.3,  // lower = more deterministic JSON
            max_tokens: 1400,
            response_format: { type: "json_object" }  // forces JSON mode
          })
        }
      );
      
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "0") || (2 ** attempt * 2);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      return data.choices?.[0]?.message?.content || "";
      
    } catch(e) {
      if (attempt === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  
  throw new Error("Failed after retries.");
}

// Robust JSON extractor — handles partial/wrapped JSON
function extractJSON(text) {
  if (!text) throw new Error("Empty response from AI");
  
  // 1. Try direct parse first
  try { return JSON.parse(text); } catch {}
  
  // 2. Strip markdown fences
  const stripped = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try { return JSON.parse(stripped); } catch {}
  
  // 3. Extract first { ... } block
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)); } catch {}
  }
  
  // 4. Try to fix truncated JSON by closing open brackets
  let partial = stripped.slice(firstBrace !== -1 ? firstBrace : 0);
  let opens = (partial.match(/{/g) || []).length - (partial.match(/}/g) || []).length;
  let openArr = (partial.match(/\[/g) || []).length - (partial.match(/\]/g) || []).length;
  // close any dangling string
  if ((partial.match(/"/g) || []).length % 2 !== 0) partial += '"';
  while (openArr > 0) { partial += "]"; openArr--; }
  while (opens > 0) { partial += "}"; opens--; }
  try { return JSON.parse(partial); } catch {}
  
  throw new Error(`Could not parse AI response as JSON. Raw: ${text.slice(0, 200)}`);
}

function ApplicantCard({ app, adminName, adminEmail, existingDecision, allReviews, onDecision }) {
  const { pushToSheets, showToast } = useContext(DataCtx);
  const auto = autoScore(app);
  const [scores, setScores]       = useState(existingDecision?.scores ? (() => { try { return JSON.parse(existingDecision.scores); } catch { return auto; } })() : auto);
  const [decision, setDecision]   = useState(existingDecision?.decision || "");
  const [adminNote, setAdminNote] = useState(existingDecision?.note || "");
  
  // NEW: State for Track Checkboxes
  const [selectedTracks, setSelectedTracks] = useState(() => {
    try { return existingDecision?.selectedTracks ? JSON.parse(existingDecision.selectedTracks) : []; }
    catch { return []; }
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [essayOpen, setEssayOpen] = useState(false);
  const [activeRubric, setActiveRubric] = useState(null);
  const [cvOpen, setCvOpen]       = useState(false);
  const [usePortfolioInAI, setUsePortfolioInAI] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(!!existingDecision?.decision);
  const isEditMode = !!existingDecision?.reviewId;
  const [saveError, setSaveError] = useState("");
  const [showAllReviews, setShowAllReviews] = useState(false);


  const total = CRITERIA.reduce((sum, c) => sum + Math.min(scores[c.id]||0, c.weight), 0);
  const setScore = (id, val) => {
    const c = CRITERIA.find(x => x.id === id);
    setScores(s => ({ ...s, [id]: Math.min(c.weight, Math.max(0, val)) }));
    setSaved(false);
  };

  const TRACK_OPTIONS = ["Medical Imaging", "Signal Processing", "Biosensors", "Neuro", "Bioinformatics"];

  const fullEssay = app["Research Motivation"] || "";

  // Problem → until Methodology
  const ps = fullEssay.match(
    /Problem(?:\s*Solving)?\s*:\s*([\s\S]*?)(?=\n\s*Methodology\s*:)/i
  );

  // Methodology → until Goal
  const meth = fullEssay.match(
    /Methodology\s*:\s*([\s\S]*?)(?=\n\s*Goal\s*:)/i
  );

  // Goal → until end
  const goal = fullEssay.match(
    /Goal\s*:\s*([\s\S]*)/i
  );

  const essaySections = [
    ps   && { label: "🧩 Q1 — Problem Solving", text: ps[1].trim() },
    meth && { label: "🔬 Q2 — Methodology", text: meth[1].trim() },
    goal && { label: "🚀 Q3 — Goals", text: goal[1].trim() },
  ].filter(Boolean);

  if (!essaySections.length && fullEssay) essaySections.push({ label:"📝 Essays", text: fullEssay });

  const cvUrl = app["CV Link"] || "";
  const cvEmbed = (() => {
    const m = cvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    if (cvUrl.includes("drive.google.com")) return cvUrl.replace(/\/view.*$/, "/preview");
    return cvUrl;
  })();

  const linkedinUrl = app["LinkedIn"] || "";
  const linkedinText = app["LinkedIn Text"] || app["LinkedIn Summary"] || "";
  const cvText = app["CV Text"] || app["CV Summary"] || "";
  const trunc = (s, n) => {
    const str = (s || "").toString();
    if (!str) return "";
    if (str.length <= n) return str;
    return str.slice(0, n).trim() + "...(truncated)";
  };

  const runAI = async () => {
    if (!GROQ_KEY) { setAiFeedback({ error:"⚠ Groq API key not set. Get free key at https://console.groq.com/keys" }); return; }
    setAiLoading(true); setAiFeedback(null);
    try {
      const portfolioBlock = usePortfolioInAI
        ? `PORTFOLIO:\nLinkedIn URL: ${linkedinUrl || "Not provided"}\nLinkedIn Text: ${linkedinText ? trunc(linkedinText, 1800) : "Not provided"}\nCV URL: ${cvUrl || "Not provided"}\nCV Text: ${cvText ? trunc(cvText, 3500) : "Not provided"}`
        : `PORTFOLIO: Not included in this evaluation.`;
      const essayFull = trunc(fullEssay, 6500);

      const mcqForAI = getMCQScore(app);
      const mcqSummary = `Q1: ${mcqForAI.answers[0]||"No answer"} (${mcqForAI.answers[0]===MCQ_QUESTIONS[0].correct?"✓ Correct":"✗ Wrong"}), Q2: ${mcqForAI.answers[1]||"No answer"} (${mcqForAI.answers[1]===MCQ_QUESTIONS[1].correct?"✓ Correct":"✗ Wrong"}), Q3: ${mcqForAI.answers[2]||"No answer"} (${mcqForAI.answers[2]===MCQ_QUESTIONS[2].correct?"✓ Correct":"✗ Wrong"}) — ${mcqForAI.correct}/3 correct`;

      const prompt = `You are a senior researcher on the Ri-Sō IEEE EMBS SBC Research Program 2026 selection committee...
APPLICANT:
Name: ${app["Name"]} | University: ${app["University"]} | Country: ${app["Country"]||app["Nationality"]||"Not specified"}
Faculty: ${app["Faculty"]} / Dept: ${app["Department"]}
Year: ${app["Academic Year"]} | GPA: ${app["GPA"]}
Tracks: ${app["Target Track"]}
Programming: ${app["Programming Skill"]}
MCQ Results (3 technical questions): ${mcqSummary}
${portfolioBlock}
ESSAYS:
Q1: ${ps?.[1]?.trim()||"Not provided"}
Q2: ${meth?.[1]?.trim()||"Not provided"}
Q3: ${goal?.[1]?.trim()||"Not provided"}

Return ONLY valid JSON: {"scores": {"academic": <0-15>, "programming": <0-15>, "math": <0-10>, "problem_solving": <0-20>, "methodology": <0-20>, "goals": <0-10>, "motivation": <0-10>}, "totalScore": <0-100>, "recommendation": "Accept"|"Waitlist"|"Reject", "confidence": "High"|"Medium"|"Low", "strengths": [], "weaknesses": [], "evidenceBullets": [], "portfolioAssessment": "", "essayQ1": "", "essayQ2": "", "essayQ3": "", "trackFit": "", "motivationRationale": "", "admissionNote": ""}`;

      const text = await callGroq(prompt);
      const parsed = JSON.parse(text);
      setAiFeedback(parsed);
      if (parsed.scores) { setScores(parsed.scores); setSaved(false); }
    } catch(e) { setAiFeedback({ error: `Groq error: ${e.message}` }); }
    setAiLoading(false);
  };

  const handleSave = async (dec) => {
    const finalDec = dec || decision;
    if (!finalDec) return;
    setSaving(true);
    setSaveError("");
    
    try {
      const reviewData = {
        reviewId: existingDecision?.reviewId || `R${Date.now()}`,
        applicationEmail: app["Email"],
        applicantName: app["Name"],
        reviewerEmail: adminEmail,
        reviewerName: adminName,
        decision: finalDec,
        score: total,
        scores: JSON.stringify(scores),
        note: adminNote,
        selectedTracks: JSON.stringify(selectedTracks),
        aiRecommendation: aiFeedback?.recommendation || "",
        reviewedAt: new Date().toISOString()
      };

      // Always try to update by matching reviewerEmail + applicationEmail first.
      // If no match exists (first review), fall through to push a new row.
      const compositeMatchCol = "reviewerEmail";
      // We need BOTH reviewerEmail AND applicationEmail to match uniquely.
      // Strategy: use updateByMatch on a composite — or use updateByMatch on reviewId if exists.
      if (existingDecision?.reviewId) {
        // Update existing row by its reviewId
        const res = await sheetsAPI.updateByMatch("Reviews", "reviewId", existingDecision.reviewId, reviewData);
        if (!res || res.status === "error" || !res.matched) {
          // Fallback: push as new if match failed
          await pushToSheets("Reviews", reviewData);
        }
      } else {
        // New review — push fresh row
        await pushToSheets("Reviews", reviewData);
      }

      // Update the Applications row to reflect latest overall status
      await sheetsAPI.updateByMatch("Applications", "Email", app["Email"], {
        "Status": `Phase II: ${finalDec}`,
        "LastReviewedBy": adminName,
        "LastReviewedAt": new Date().toISOString(),
      });
      
      setDecision(finalDec);
      setSaved(true);
      onDecision(app["Email"], finalDec, total);
      showToast(existingDecision?.reviewId ? `✓ Review updated in Reviews sheet` : `✓ Review saved to Reviews sheet`);
      
    } catch(e) {
      setSaved(false);
      setSaveError(`Save failed: ${e?.message || "unknown error"}`);
    }
    setSaving(false);
  };

  const dc = (r) => r?.includes("Accept")?"#065F46":r?.includes("Wait")?"#92400E":"#991B1B";
  const db = (r) => r?.includes("Accept")?"#D1FAE5":r?.includes("Wait")?"#FEF3C7":"#FEE2E2";
  const dd = (r) => r?.includes("Accept")?"#A7F3D0":r?.includes("Wait")?"#FDE68A":"#FECACA";

  return (
    <div style={{background:"white",borderRadius:"0 0 14px 14px"}}>

      <div style={{padding:"12px 20px",background:"linear-gradient(135deg,rgba(91,59,245,.03),rgba(26,109,255,.02))",borderBottom:"1px solid var(--frost)",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center",fontSize:12}}>
          <span><b style={{color:"var(--ink3)"}}>✉</b> {app["Email"]}</span>
          <span><b style={{color:"var(--ink3)"}}>🌍</b> {app["Country"]||app["Nationality"]||"—"}</span>
          <span><b style={{color:"var(--ink3)"}}>🏫</b> {app["Faculty"]} · {app["Department"]}</span>
          <span><b style={{color:"var(--ink3)"}}>🗓</b> {app["Timestamp"] ? new Date(app["Timestamp"]).toLocaleDateString() : "—"}</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          {allReviews && allReviews.length > 0 && (
            <button onClick={()=>setShowAllReviews(!showAllReviews)}
              style={{padding:"6px 12px",background:showAllReviews?"var(--violet)":"rgba(91,59,245,.1)",color:showAllReviews?"white":"var(--violet)",borderRadius:7,fontSize:11,fontWeight:700,border:"1.5px solid var(--violet)",cursor:"pointer",transition:"all .2s"}}>
              {showAllReviews?"✕ Hide":"👁"} {allReviews.length} Review{allReviews.length > 1 ? 's' : ''}
            </button>
          )}
          {app["LinkedIn"] && app["LinkedIn"]!=="Not provided" &&
            <a href={app["LinkedIn"]} target="_blank" rel="noreferrer" style={{padding:"6px 12px",background:"#0077B5",color:"white",borderRadius:7,fontSize:11,fontWeight:700,textDecoration:"none"}}>🔗 LinkedIn</a>}
          {cvUrl && <>
            <button onClick={()=>setCvOpen(o=>!o)}
              style={{padding:"6px 14px",background:cvOpen?"var(--violet)":"white",color:cvOpen?"white":"var(--violet)",border:"1.5px solid var(--violet)",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
              {cvOpen?"✕ Close CV":"📄 View CV"}
            </button>
          </>}
        </div>
      </div>

      {showAllReviews && allReviews && allReviews.length > 0 && (
        <div style={{padding:16,background:"#F8F9FF",borderBottom:"1px solid var(--frost)"}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--ink2)",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>
            All Reviews ({allReviews.length})
          </div>
          <div style={{display:"grid",gap:10}}>
            {allReviews.map((rev, idx) => {
              const revEmail = rev["reviewerEmail"] || rev["ReviewerEmail"];
              const revName = rev["reviewerName"] || rev["ReviewerName"] || revEmail?.split("@")[0] || "Unknown";
              const revDec = rev["decision"] || rev["Decision"];
              const revScore = rev["score"] || rev["Score"] || 0;
              const revNote = rev["note"] || rev["Note"] || "";
              const revTracks = rev["selectedTracks"] ? (() => { try { return JSON.parse(rev["selectedTracks"]); } catch { return []; } })() : [];
              const revDate = rev["reviewedAt"] || rev["ReviewedAt"];
              const isCurrentAdmin = revEmail?.toLowerCase() === adminEmail?.toLowerCase();
              
              return (
                <div key={idx} style={{padding:12,background:"white",borderRadius:8,border: isCurrentAdmin ? "2px solid var(--violet)" : "1px solid var(--frost)",position:"relative"}}>
                  {isCurrentAdmin && <div style={{position:"absolute",top:-8,right:12,background:"var(--violet)",color:"white",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10}}>YOUR REVIEW</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:db(revDec),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:dc(revDec)}}>
                        {revName.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700}}>{revName}</div>
                        <div style={{fontSize:10,color:"var(--ink3)"}}>{revDate ? new Date(revDate).toLocaleDateString() : "—"}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontFamily:"Fraunces,serif",fontSize:18,fontWeight:800,color:dc(revDec)}}>{revScore}</span>
                      <span style={{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:db(revDec),color:dc(revDec)}}>{revDec}</span>
                    </div>
                  </div>
                  {revTracks.length > 0 && (
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                      {revTracks.map(t=><span key={t} style={{fontSize:9,fontWeight:700,background:"var(--snow)",color:"var(--ink2)",padding:"2px 6px",borderRadius:4}}>{t}</span>)}
                    </div>
                  )}
                  {revNote && <div style={{fontSize:11,color:"var(--ink2)",padding:"8px 10px",background:"var(--snow)",borderRadius:6,marginTop:4,lineHeight:1.6,fontStyle:"italic"}}>"{revNote}"</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cvOpen && (
        <div style={{borderBottom:"1px solid var(--frost)",background:"#f8f9ff"}}>
          {cvEmbed ? <iframe src={cvEmbed} style={{width:"100%",height:600,border:"none",display:"block"}} title="CV Preview"/> : <div style={{padding:20,textAlign:"center",color:"var(--ink3)"}}><a href={cvUrl} target="_blank" rel="noreferrer" style={{color:"var(--violet)",fontWeight:700}}>Open CV in new tab →</a></div>}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 390px",minHeight:480}}>

        {/* ── LEFT: Profile + Essays + Groq ── */}
        <div style={{padding:"18px 20px",borderRight:"1px solid var(--frost)",overflowY:"auto"}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            <span style={{padding:"4px 10px",background:"#EDE9FE",color:"#5B21B6",borderRadius:20,fontSize:11,fontWeight:700}}>GPA {app["GPA"]}</span>
            <span style={{padding:"4px 10px",background:"#DBEAFE",color:"#1E40AF",borderRadius:20,fontSize:11,fontWeight:700}}>{app["Academic Year"]}</span>
            <span style={{padding:"4px 10px",background:"#F0FDF4",color:"#166534",borderRadius:20,fontSize:11,fontWeight:600}}>{app["University"]}</span>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Target Tracks</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {(app["Target Track"]||"").split(",").map(t=><span key={t} style={{padding:"3px 9px",background:"rgba(91,59,245,.07)",color:"var(--violet)",borderRadius:20,fontSize:10,fontWeight:700,border:"1px solid rgba(91,59,245,.12)"}}>{t.trim()}</span>)}
            </div>
          </div>

          <div style={{marginBottom:12,padding:10,background:"var(--snow)",borderRadius:10,border:"1px solid var(--frost)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{background:"white",padding:"8px 10px",borderRadius:7,border:"1px solid var(--frost)"}}><div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",marginBottom:2}}>Programming</div><div style={{fontSize:11,fontWeight:600,lineHeight:1.4}}>{app["Programming Skill"]||"—"}</div></div>
            <div style={{background:"white",padding:"8px 10px",borderRadius:7,border:"1px solid var(--frost)"}}><div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",marginBottom:2}}>Math / Stats</div><div style={{fontSize:11,fontWeight:600,lineHeight:1.4}}>{app["Math/Stats Skill"]||"—"}</div></div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Application Essays</div>
            {essaySections.map((sec,i)=>(
              <div key={i} style={{marginBottom:6,border:"1px solid var(--frost)",borderRadius:9,overflow:"hidden"}}>
                <div style={{padding:"8px 12px",background:"var(--snow)",fontSize:11,fontWeight:700,color:"var(--ink2)",display:"flex",justifyContent:"space-between",cursor:"pointer",userSelect:"none"}} onClick={()=>setEssayOpen(o=>o===i?false:i)}>{sec.label} <span style={{color:"var(--mist)"}}>{essayOpen===i?"▲":"▼"}</span></div>
                {essayOpen===i && <div style={{padding:"10px 12px",fontSize:12,color:"var(--ink2)",lineHeight:1.8,maxHeight:220,overflowY:"auto",whiteSpace:"pre-wrap",background:"white"}}>{sec.text}</div>}
              </div>
            ))}
          </div>

          <div style={{marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:11,fontWeight:700,color:"var(--ink2)"}}><input type="checkbox" checked={usePortfolioInAI} onChange={(e)=>setUsePortfolioInAI(!!e.target.checked)}/> Include CV/LinkedIn in AI prompt</label>
          </div>
          <button onClick={runAI} disabled={aiLoading} style={{width:"100%",padding:"10px",background:aiFeedback&&!aiFeedback.error?"#ECFDF5":"linear-gradient(135deg,#4285F4,#34A853)",color:aiFeedback&&!aiFeedback.error?"#065F46":"white",border:aiFeedback&&!aiFeedback.error?"1.5px solid #A7F3D0":"none",borderRadius:9,fontSize:12,fontWeight:700,cursor:aiLoading?"not-allowed":"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:7,opacity:aiLoading?0.75:1}}>
            {aiLoading ? <><span style={{width:12,height:12,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/> Groq analyzing…</> : !GROQ_KEY ? "⚙ Set GROQ_KEY to enable AI" : aiFeedback&&!aiFeedback.error ? "✓ Groq Done — Re-run" : "✨ Run Groq AI Analysis"}
          </button>

          {aiFeedback&&!aiFeedback.error && (
            <div style={{border:"1px solid #A7F3D0",borderRadius:10,overflow:"hidden",fontSize:12}}>
              <div style={{padding:"9px 12px",background:"#ECFDF5",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontWeight:700,fontSize:10,color:"#065F46",textTransform:"uppercase",letterSpacing:.4}}>✦ Groq Evaluation</span><div style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontSize:9,color:"var(--ink3)"}}>Confidence: <b>{aiFeedback.confidence}</b></span><span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:800,background:db(aiFeedback.recommendation),color:dc(aiFeedback.recommendation)}}>{aiFeedback.recommendation}</span></div></div>
              <div style={{padding:12,background:"white",display:"flex",flexDirection:"column",gap:8}}>
                {aiFeedback.strengths?.length>0 && <div><div style={{fontSize:9,fontWeight:700,color:"#065F46",textTransform:"uppercase",marginBottom:3}}>✓ Strengths</div>{aiFeedback.strengths.map((s,i)=><div key={i} style={{fontSize:11,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}>• {s}</div>)}</div>}
                {aiFeedback.weaknesses?.length>0 && <div><div style={{fontSize:9,fontWeight:700,color:"#991B1B",textTransform:"uppercase",marginBottom:3}}>✗ Gaps</div>{aiFeedback.weaknesses.map((w,i)=><div key={i} style={{fontSize:11,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}>• {w}</div>)}</div>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{[["🧩 Q1",aiFeedback.essayQ1],["🔬 Q2",aiFeedback.essayQ2],["🚀 Q3",aiFeedback.essayQ3],["🎯 Fit",aiFeedback.trackFit]].filter(([,v])=>v).map(([l,v])=>(<div key={l} style={{padding:"7px 9px",background:"var(--snow)",borderRadius:7,border:"1px solid var(--frost)"}}><div style={{fontSize:8,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{fontSize:10,lineHeight:1.5,color:"var(--ink2)"}}>{v}</div></div>))}</div>
                {aiFeedback.portfolioAssessment && <div style={{padding:"9px 10px",background:"rgba(91,59,245,.04)",borderRadius:7,border:"1px solid rgba(91,59,245,.1)",fontSize:11,fontStyle:"italic",color:"var(--ink2)",lineHeight:1.6}}>📎 {aiFeedback.portfolioAssessment}</div>}
                {aiFeedback.evidenceBullets?.length>0 && <div><div style={{fontSize:9,fontWeight:700,color:"var(--violet)",textTransform:"uppercase",marginBottom:3}}>Evidence (verifiable)</div>{aiFeedback.evidenceBullets.map((e,i)=><div key={i} style={{fontSize:11,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}>• {e}</div>)}</div>}
                {aiFeedback.admissionNote && <div style={{padding:"9px 10px",background:"rgba(91,59,245,.04)",borderRadius:7,border:"1px solid rgba(91,59,245,.1)",fontSize:11,fontStyle:"italic",color:"var(--ink2)",lineHeight:1.6}}>📋 {aiFeedback.admissionNote}</div>}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Scorecard + Decision ── */}
        <div style={{padding:"16px 16px",background:"var(--snow)",display:"flex",flexDirection:"column",overflowY:"auto"}}>

          {isEditMode && (
            <div style={{marginBottom:8,padding:"8px 12px",background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",border:"1px solid #F59E0B",borderRadius:8,display:"flex",alignItems:"center",gap:8,fontSize:11}}>
              <span style={{fontSize:16}}>✏️</span>
              <div>
                <div style={{fontWeight:800,color:"#92400E"}}>Editing Previous Review</div>
                <div style={{color:"#78350F",fontSize:10}}>Originally saved {existingDecision?.reviewedAt ? new Date(existingDecision.reviewedAt).toLocaleDateString() : "earlier"} · Score was {existingDecision?.score}/100</div>
              </div>
            </div>
          )}
          <div style={{marginBottom:10,padding:"6px 10px",background:"rgba(91,59,245,.07)",borderRadius:7,fontSize:11,color:"var(--violet)",fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
            👤 {adminName}
            {saved && <span style={{marginLeft:"auto",color:"var(--jade)",fontSize:10,fontWeight:700}}>✓ {isEditMode ? "Updated" : "Saved"}</span>}
            {!saved && decision && <span style={{marginLeft:"auto",color:"var(--amber)",fontSize:10}}>● Unsaved changes</span>}
          </div>

          <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Scorecard</div>

          {CRITERIA.map(c=>{
            const pct=(scores[c.id]||0)/c.weight;
            const bar=pct>=0.7?"linear-gradient(90deg,#0F9F6E,#059669)":pct>=0.4?"linear-gradient(90deg,#E8860A,#F59E0B)":"linear-gradient(90deg,#E53E5C,#F87171)";
            const active=activeRubric===c.id;
            return (
              <div key={c.id} style={{marginBottom:8,padding:"9px 10px",background:"white",borderRadius:9,border:`1.5px solid ${active?"var(--violet)":"var(--frost)"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{cursor:"pointer",flex:1}} onClick={()=>setActiveRubric(active?null:c.id)}>
                    <span style={{fontWeight:700,fontSize:11}}>{c.icon} {c.label}</span><span style={{fontSize:9,color:"var(--ink3)",marginLeft:3}}>/{c.weight}</span>
                  </div>
                  <input type="number" min={0} max={c.weight} value={scores[c.id]||0} onChange={e=>setScore(c.id,parseInt(e.target.value)||0)} style={{width:38,padding:"2px 4px",border:`1px solid ${active?"var(--violet)":"var(--frost)"}`,borderRadius:5,fontSize:12,fontWeight:800,textAlign:"center",color:"var(--violet)",outline:"none"}}/>
                </div>
                <div style={{height:5,background:"var(--frost)",borderRadius:3,overflow:"hidden",cursor:"pointer",marginBottom:3}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setScore(c.id,Math.round((e.clientX-r.left)/r.width*c.weight));}}>
                  <div style={{height:"100%",width:`${pct*100}%`,background:bar,borderRadius:3,transition:"width .15s"}}/>
                </div>
                {active && (
                  <div style={{marginTop:6,fontSize:10,borderTop:"1px solid var(--frost)",paddingTop:5}}>
                    {c.rubric.map(r=><div key={r.pts} style={{display:"flex",gap:6,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}><b style={{minWidth:18,color:r.pts===c.weight?"#065F46":"#991B1B",fontSize:9}}>{r.pts}</b><span style={{fontSize:9,color:"var(--ink2)"}}><b>{r.label}:</b> {r.detail}</span></div>)}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{padding:"10px 12px",borderRadius:9,background:total>=75?db("Accept"):total>=50?db("Waitlist"):db("Reject"),border:`1px solid ${total>=75?dd("Accept"):total>=50?dd("Waitlist"):dd("Reject")}`,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontWeight:700,fontSize:12}}>Total Score</span><span style={{fontFamily:"Fraunces,serif",fontSize:26,fontWeight:900,color:total>=75?dc("Accept"):total>=50?dc("Waitlist"):dc("Reject")}}>{total}<span style={{fontSize:11,fontWeight:400,color:"var(--ink3)"}}>/100</span></span></div>
          </div>

          {/* NEW: Reviewer Track Selection */}
          <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.5,marginTop:6,marginBottom:6}}>Recommended Tracks</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
            {TRACK_OPTIONS.map(t => (
              <label key={t} style={{display:"flex",alignItems:"center",fontSize:10,cursor:"pointer",padding:"4px 8px",background:selectedTracks.includes(t)?"var(--violet)":"white",border:`1px solid ${selectedTracks.includes(t)?"var(--violet)":"var(--frost)"}`,borderRadius:6,color:selectedTracks.includes(t)?"white":"var(--ink2)",fontWeight:selectedTracks.includes(t)?700:600,transition:"all 0.2s"}}>
                <input type="checkbox" checked={selectedTracks.includes(t)} onChange={()=> { setSelectedTracks(p => p.includes(t) ? p.filter(x=>x!==t) : [...p, t]); setSaved(false); }} style={{display:"none"}} />
                {t}
              </label>
            ))}
          </div>

          <textarea value={adminNote} onChange={e=>{setAdminNote(e.target.value);setSaved(false);}} placeholder="Your review notes…" style={{width:"100%",padding:"8px 10px",border:"1.5px solid var(--frost)",borderRadius:8,fontSize:11,fontFamily:"'DM Sans',sans-serif",resize:"vertical",minHeight:48,outline:"none",marginBottom:8,background:"white",lineHeight:1.5}}/>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
            {[["✓ Accept","Accepted"],["◐ Waitlist","Waitlisted"],["✗ Reject","Rejected"]].map(([label,val])=>(
              <button key={val} onClick={()=>handleSave(val)} disabled={saving} style={{padding:"9px 4px",background:decision===val?db(val):"white",color:decision===val?dc(val):"var(--ink3)",border:`1.5px solid ${decision===val?dd(val):"var(--frost)"}`,borderRadius:8,fontSize:11,fontWeight:decision===val?800:600,cursor:"pointer",lineHeight:1.3,transition:"all .15s",opacity:saving?0.5:1}}>{label}</button>
            ))}
          </div>

          {saving && <div style={{textAlign:"center",fontSize:11,color:"var(--ink3)",padding:6}}>
            {isEditMode ? "🔄 Updating review…" : "💾 Saving to Reviews…"}
          </div>}
        </div>
      </div>
    </div>
  );
}

function AdminFiltration() {
  const { users } = useContext(DataCtx);
  const { user } = useContext(AuthCtx);
  const adminName = user?.name || user?.Name || user?.email?.split("@")[0] || "Admin";
  const adminEmail = user?.email || "";
  
  const [applicants, setApplicants] = useState([]);
  const [reviews, setReviews] = useState([]); // NEW: All reviews from Reviews sheet
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");
  const [decisions, setDecisions]   = useState({}); // Map: email → review
  const [current, setCurrent]       = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      
      // Load both Applications and Reviews sheets
      const [appsData, reviewsData] = await Promise.all([
        sheetsAPI.get("Applications"),
        sheetsAPI.get("Reviews")
      ]);
      
      if (appsData && Array.isArray(appsData) && appsData.length > 0) {
        setApplicants(appsData);
        
        // Process reviews data
        if (reviewsData && Array.isArray(reviewsData)) {
          setReviews(reviewsData);
          
          // Build decisions map for current admin
          const dec = {};
          reviewsData.forEach(r => {
            const email = r["applicationEmail"] || r["ApplicationEmail"];
            const reviewer = r["reviewerEmail"] || r["ReviewerEmail"];
            
            // Only load this admin's reviews
            if (reviewer && reviewer.toLowerCase() === adminEmail.toLowerCase()) {
              dec[email] = {
                reviewId: r["reviewId"] || r["ReviewId"],
                decision: r["decision"] || r["Decision"],
                score: r["score"] || r["Score"] || 0,
                note: r["note"] || r["Note"] || "",
                scores: r["scores"] || r["Scores"] || "",
                selectedTracks: r["selectedTracks"] || r["SelectedTracks"] || "",
                aiRecommendation: r["aiRecommendation"] || r["AiRecommendation"] || "",
                reviewedAt: r["reviewedAt"] || r["ReviewedAt"] || ""
              };
            }
          });
          setDecisions(dec);
        }
      } else {
        setError("Could not load Applications sheet. Make sure the sheet is named exactly 'Applications'.");
      }
      setLoading(false);
    })();
  }, [adminEmail]);

  const handleDecision = (email, dec, score) => {
    setDecisions(d => ({ ...d, [email]: { ...d[email], decision: dec, score } }));
  };

  const filtered = applicants.filter(a => {
    const dec = decisions[a["Email"]]?.decision;
    const mf = filter==="all" || (dec||"pending").toLowerCase()===filter || (!dec&&filter==="pending");
    const ms = !search || (a["Name"]||"").toLowerCase().includes(search.toLowerCase()) || (a["University"]||"").toLowerCase().includes(search.toLowerCase()) || (a["Email"]||"").toLowerCase().includes(search.toLowerCase());
    return mf && ms;
  });

  const stats = {
    total:     applicants.length,
    pending:   applicants.filter(a=>!decisions[a["Email"]]).length,
    accepted:  Object.values(decisions).filter(d=>d.decision==="Accepted").length,
    waitlisted:Object.values(decisions).filter(d=>d.decision==="Waitlisted").length,
    rejected:  Object.values(decisions).filter(d=>d.decision==="Rejected").length,
  };

  return (
    <div>
      <div className="g4 mb6">
        {[["Total",stats.total,"👥",""],["Pending",stats.pending,"⏳","amber"],["Accepted",stats.accepted,"✅","green"],["Waitlisted",stats.waitlisted,"◐","blue"]].map(([l,v,icon,c])=>(
          <div key={l} className={`stat ${c}`} style={{cursor:"pointer"}} onClick={()=>setFilter(l.toLowerCase()==="total"?"all":l.toLowerCase())}>
            <div className="stat-icon">{icon}</div><div className="stat-val">{v}</div><div className="stat-label">{l}</div>
          </div>
        ))}
      </div>
{/*       
      { {Object.keys(decisions).length > 0 && (
        <div style={{marginBottom:20,padding:"14px 18px",background:"rgba(91,59,245,.05)",border:"1px solid rgba(91,59,245,.12)",borderRadius:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--violet)",letterSpacing:.8,marginBottom:10}}>
            ✏️ YOUR PAST REVIEWS — Click to Edit
            <span style={{marginLeft:8,background:"var(--violet)",color:"white",fontSize:9,padding:"2px 8px",borderRadius:10}}>{Object.keys(decisions).length}</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(decisions).map(([email, dec]) => {
              const app = applicants.find(a => a["Email"]?.toLowerCase() === email.toLowerCase());
              if (!app) return null;
              const bg = dec.decision==="Accepted"?"#D1FAE5":dec.decision==="Waitlisted"?"#FEF3C7":"#FEE2E2";
              const fg = dec.decision==="Accepted"?"#065F46":dec.decision==="Waitlisted"?"#92400E":"#991B1B";
              return (
                <button key={email} onClick={() => setCurrent(email)}
                  style={{padding:"8px 14px",borderRadius:9,border:`1.5px solid ${fg}44`,background:bg,cursor:"pointer",textAlign:"left"}}>
                  <div style={{fontSize:12,fontWeight:700,color:fg}}>{app["Name"]}</div>
                  <div style={{fontSize:10,color:fg,opacity:.8}}>{dec.decision} · {dec.score}/100</div>
                </button>
              );
            })}
          </div>
        </div>
      )} }
       */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name, email, university…"
          style={{flex:1,minWidth:200,padding:"10px 14px",border:"1.5px solid var(--frost)",borderRadius:10,fontSize:13,outline:"none",background:"white",fontFamily:"'DM Sans',sans-serif"}}/>
        <div style={{display:"flex",gap:5}}>
          {["all","pending","accepted","waitlisted","rejected"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:"8px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:"1.5px solid",borderColor:filter===f?"var(--violet)":"var(--frost)",background:filter===f?"rgba(91,59,245,.08)":"white",color:filter===f?"var(--violet)":"var(--ink3)"}}>
              {f[0].toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{textAlign:"center",padding:60,color:"var(--ink3)"}}>⏳ Loading from Google Sheets…</div>}
      {error   && <div style={{padding:20,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,color:"#DC2626",fontSize:13}}>⚠ {error}</div>}
      {!loading&&!error&&filtered.length===0 && <div style={{textAlign:"center",padding:60,color:"var(--ink3)"}}>🔍 No applicants match.</div>}

      {!loading && filtered.map(app => {
        const email = app["Email"];
        const dec = decisions[email];
        const isOpen = current===email;
        const decBg = dec?.decision==="Accepted"?"#D1FAE5":dec?.decision==="Waitlisted"?"#FEF3C7":dec?.decision==="Rejected"?"#FEE2E2":"var(--r1)";
        const decFg = dec?.decision?"var(--ink)":"white";
        
        // Count all reviews for this applicant (from all admins)
        const allReviewsForApp = reviews.filter(r => 
          (r["applicationEmail"] || r["ApplicationEmail"] || "").toLowerCase() === email.toLowerCase()
        );
        
        return (
          <div key={email} style={{marginBottom:isOpen?0:10}}>
            <div onClick={()=>setCurrent(isOpen?null:email)}
              style={{padding:"13px 18px",background:"white",borderRadius:isOpen?"12px 12px 0 0":"12px",border:"1px solid var(--frost)",borderBottom:isOpen?"none":"1px solid var(--frost)",cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:isOpen?"var(--sh2)":"var(--sh1)",transition:"all .15s"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:decBg,display:"flex",alignItems:"center",justifyContent:"center",color:decFg,fontWeight:800,fontSize:12,flexShrink:0}}>
                {dec?.decision?(dec.decision==="Accepted"?"✓":dec.decision==="Waitlisted"?"◐":"✗"):(app["Name"]||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13}}>{app["Name"]}</div>
                <div style={{fontSize:11,color:"var(--ink3)",marginTop:1}}>{app["Country"]||app["Nationality"]||"—"} · {app["University"]} · GPA {app["GPA"]}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                {app["CV Link"] && <span style={{fontSize:10,color:"var(--violet)",fontWeight:700}}>📄 CV</span>}
                {allReviewsForApp.length > 0 && (
                  <span style={{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:"rgba(91,59,245,.1)",color:"var(--violet)"}}>
                    {allReviewsForApp.length} review{allReviewsForApp.length > 1 ? 's' : ''}
                  </span>
                )}
                {dec?.decision
                  ? <span style={{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:decBg,color:"var(--ink)"}}>{dec.decision} · {dec.score}/100</span>
                  : <span style={{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:"var(--frost)",color:"var(--ink3)"}}>Pending</span>}
                <span style={{color:"var(--mist)",fontSize:16}}>{isOpen?"▲":"▼"}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{border:"1px solid var(--frost)",borderTop:"none",borderRadius:"0 0 12px 12px",boxShadow:"var(--sh2)",marginBottom:10}}>
                <ApplicantCard
                  app={app}
                  adminName={adminName}
                  adminEmail={adminEmail}
                  existingDecision={dec}
                  allReviews={allReviewsForApp}
                  onDecision={handleDecision}
                />
              </div>
            )}
          </div>
        );
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}


function AdminTrackAssignment() {
  const { participants, pushToSheets, updateUser } = useContext(DataCtx);
  const [inputs, setInputs] = useState({ mlScore:70, modelingScore:65, electronicsScore:60, gpa:3.5, portfolioScore:75, interviewScore:72 });
  const [result, setResult] = useState(null);
  const set = (k,v) => setInputs(i=>({...i,[k]:v}));
  return (
    <div>
      <div className="g2 mb6">
        <div className="card">
          <div className="card-header"><div><div className="card-title">⚡ Track Assignment Engine</div><div className="card-sub">Enter Phase II scores to determine track</div></div></div>
          <div className="card-body">
            <div className="alert alert-info mb4">Top-Tier = composite ≥ 85 AND max domain score ≥ 80 → bypass Phase III</div>
            {[{k:"mlScore",l:"AI & ML Score"},{k:"modelingScore",l:"Modeling Score"},{k:"electronicsScore",l:"Electronics Score"}].map(f=>(
              <div key={f.k} className="fg">
                <label className="flabel">{f.l}: <span className="score-val">{inputs[f.k]}</span></label>
                <input type="range" min={0} max={100} className="frange" value={inputs[f.k]} onChange={e=>set(f.k,+e.target.value)}/>
              </div>
            ))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[{k:"gpa",l:"GPA",min:0,max:4,step:.1},{k:"portfolioScore",l:"Portfolio"},{k:"interviewScore",l:"Interview"}].map(f=>(
                <div key={f.k} className="fg">
                  <label className="flabel">{f.l}</label>
                  <input type="number" className="finput" min={f.min||0} max={f.max||100} step={f.step||1} value={inputs[f.k]} onChange={e=>set(f.k,+e.target.value)}/>
                </div>
              ))}
            </div>
            <button className="btn btn-p" style={{width:"100%"}} onClick={()=>setResult(assignTrack(inputs))}>Run Algorithm</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Assignment Result</div></div>
          <div className="card-body" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:280}}>
            {result?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:56,marginBottom:16}}>{result.icon}</div>
                <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>{result.track==="BYPASS"?"TOP-TIER BYPASS":`Track ${result.track}`}</div>
                <TrackBadge track={result.track==="BYPASS"?"BYPASS":result.track} label={result.label}/>
                <div className="txt-muted" style={{margin:"12px 0"}}>{result.track==="BYPASS"?"→ Proceed to Phase IV: Mentorship":`→ Phase III: Training, then Phase IV: Mentorship`}</div>
                <button className="btn btn-p" onClick={()=>pushToSheets("TrackAssignments",{track:result.track,label:result.label,assignedAt:new Date().toISOString()})}>Save → Google Sheets</button>
              </div>
            ):(
              <div style={{textAlign:"center",color:"var(--mist)"}}>
                <div style={{fontSize:52,marginBottom:12}}>⚡</div>
                <div style={{fontSize:14}}>Adjust scores and run the algorithm</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Bulk Assignment — All Participants</div></div>
        <div className="card-body" style={{padding:0}}>
          <table className="tbl">
            <thead><tr><th>Name</th><th>ML</th><th>Modeling</th><th>Electronics</th><th>Composite</th><th>Assigned Track</th><th>Phase</th><th>Apply</th></tr></thead>
            <tbody>{participants.map(p=>{
              const res=assignTrack(p); const comp=Math.round((p.portfolioScore*0.3)+(p.interviewScore*0.3)+(p.gpa*10*0.4));
              return(
                <tr key={p.id}>
                  <td style={{fontWeight:600}}>{p.name}</td>
                  <td className="mono">{p.mlScore}</td>
                  <td className="mono">{p.modelingScore}</td>
                  <td className="mono">{p.electronicsScore}</td>
                  <td className="mono" style={{fontWeight:700,color:"var(--violet)"}}>{comp}</td>
                  <td><TrackBadge track={res.track==="BYPASS"?"BYPASS":res.track} label={res.label}/></td>
                  <td>→ P{res.phase}</td>
                  <td>
                    <button className="btn btn-p btn-sm" onClick={()=>updateUser(p.id,{track:res.track==="BYPASS"?p.track||1:res.track, trackLabel:res.track==="BYPASS"?p.trackLabel:res.label, phase:res.phase, status:res.track==="BYPASS"?"Top-Tier":"Qualified"})}>
                      Apply
                    </button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminResourceMgmt() {
  const { pushToSheets } = useContext(DataCtx);
  const resources = [
    {name:"NVIDIA A100 GPU Node",category:"Compute",status:"Available",assigned:"P001, P004",qty:2},
    {name:"Arduino Mega 2560",   category:"Hardware",status:"Ordered",  assigned:"P003",      qty:5},
    {name:"ECG Sensor Module",   category:"Sensor",  status:"In Transit",assigned:"P003",    qty:3},
    {name:"Raspberry Pi 4 (8GB)",category:"Hardware",status:"Available",assigned:"P002",      qty:2},
    {name:"Lab Access Token",    category:"Lab",     status:"Active",   assigned:"P001",      qty:10},
  ];
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Resource Management</div><div className="card-sub">Track procurement & delivery status</div></div>
      <div className="card-body" style={{padding:0}}>
        <table className="tbl">
          <thead><tr><th>Resource</th><th>Category</th><th>Qty</th><th>Assigned</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>{resources.map((r,i)=>(
            <tr key={i}>
              <td style={{fontWeight:600}}>{r.name}</td>
              <td><span className="tag">{r.category}</span></td>
              <td className="mono">{r.qty}</td>
              <td className="txt-muted">{r.assigned}</td>
              <td><span className={`badge ${r.status==="Available"||r.status==="Active"?"b-qual":r.status==="In Transit"||r.status==="Ordered"?"b-review":"b-phase"}`}>{r.status}</span></td>
              <td>
                <select className="finput fselect" style={{padding:"4px 8px",fontSize:11,width:120}} onChange={e=>pushToSheets("Resources",{resource:r.name,status:e.target.value,updatedAt:new Date().toISOString()})}>
                  <option>Available</option><option>Ordered</option><option>In Transit</option><option>Delivered</option><option>Exhausted</option>
                </select>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function AdminMetrics() {
  const { participants } = useContext(DataCtx);
  return (
    <div>
      <div className="g3 mb6">
        {[{l:"Publication Rate",v:"73%",t:"Target: 80%"},{l:"Win Rate",v:"25%",t:"Target: 20-30%"},{l:"Novelty Verified",v:`${Math.round(participants.filter(p=>p.noveltyVerified).length/participants.length*100)}%`,t:"Target: 100%"}].map((m,i)=>(
          <div key={i} className="card">
            <div className="card-body" style={{textAlign:"center",padding:"28px 20px"}}>
              <div style={{fontFamily:"Fraunces,serif",fontSize:42,background:"var(--r1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{m.v}</div>
              <div style={{fontSize:14,fontWeight:700,marginTop:8}}>{m.l}</div>
              <div className="txt-muted">{m.t}</div>
              <div style={{marginTop:12}}><PBar val={parseInt(m.v)}/></div>
            </div>
          </div>
        ))}
      </div>
      <div className="g2">
        <div className="card">
          <div className="card-header"><div className="card-title">Competition Performance</div></div>
          <div className="card-body" style={{padding:0}}>
            <table className="tbl">
              <thead><tr><th>Competition</th><th>Enrolled</th><th>Deadline</th><th>Status</th></tr></thead>
              <tbody>{COMPETITIONS.map(c=>(
                <tr key={c.id}>
                  <td style={{fontWeight:600}}>{c.name}</td>
                  <td className="mono">{c.enrolled}</td>
                  <td className="mono" style={{fontSize:12}}>{c.deadline}</td>
                  <td><span className={`badge ${c.status==="Closing Soon"?"b-close":"b-open"}`}>{c.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Sync Status</div></div>
          <div className="card-body">
            {[["Participants",participants.length],["Assignments",12],["Novelty Assessments",3],["Resource Requests",8],["Meetings",6]].map(([s,r])=>(
              <div key={s} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--frost)",fontSize:13}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:"var(--jade)",fontSize:8}}>●</span><span style={{fontWeight:600}}>{s}</span></div>
                <span className="mono txt-muted">{r} rows</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const { users, participants, mentors, addUser, deleteUser, updateUser, pushToSheets } = useContext(DataCtx);
  const [modal, setModal] = useState(null); // "add-participant" | "add-mentor" | {edit: user}
  const [form, setForm] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const [activeTab, setActiveTab] = useState(0);

  const openAdd = (role) => {
    setForm({ role, name:"", email:"", password:"pass123", phase:1, gpa:0, mlScore:0, modelingScore:0, electronicsScore:0, portfolioScore:0, interviewScore:0, status:"Applied", nationality:"" });
    setModal("add");
  };
  const openEdit = (u) => { setForm({...u}); setModal("edit"); };

  const handleSave = () => {
    if (modal === "add") { addUser(form); }
    else { updateUser(form.id, form); }
    setModal(null);
  };

  const displayed = [users.filter(u=>u.role===ROLES.PARTICIPANT), users.filter(u=>u.role===ROLES.MENTOR), users.filter(u=>u.role===ROLES.SUPERADMIN)][activeTab];
  const tabLabels = [`Participants (${participants.length})`,`Mentors (${mentors.length})`,`Admins`];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
        <div className="tabs" style={{marginBottom:0,flex:1,marginRight:12}}>
          {tabLabels.map((t,i)=><button key={i} className={`tab ${activeTab===i?"active":""}`} onClick={()=>setActiveTab(i)}>{t}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-p btn-sm" onClick={()=>openAdd(activeTab===1?ROLES.MENTOR:ROLES.PARTICIPANT)}>+ Add {activeTab===1?"Mentor":"Participant"}</button>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{padding:0}}>
          <table className="tbl">
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th>{activeTab===0&&<><th>Phase</th><th>Track</th><th>Status</th><th>GPA</th></>}{activeTab===1&&<><th>Track</th><th>Mentees</th><th>Specialty</th></>}<th>Actions</th></tr></thead>
            <tbody>{displayed.map(u=>(
              <tr key={u.id}>
                <td className="mono" style={{fontSize:11,color:"var(--mist)"}}>{u.id}</td>
                <td style={{fontWeight:600}}>{u.name}</td>
                <td className="txt-muted">{u.email}</td>
                <td><span className={`pill-role pill-${u.role}`}>{u.role}</span></td>
                {activeTab===0&&<><td><PhaseBadge phase={u.phase}/></td><td><TrackBadge track={u.track} label={u.trackLabel}/></td><td><StatusBadge status={u.status}/></td><td className="mono">{u.gpa?.toFixed(1)}</td></>}
                {activeTab===1&&<><td><span className={`badge b-track-${u.track}`}>{u.track===1?"🧠 AI":u.track===2?"⚗️ Mod":"🔬 Bio"}</span></td><td className="mono">{u.mentees?.length||0}</td><td className="txt-muted">{u.specialty}</td></>}
                <td>
                  <div style={{display:"flex",gap:4}}>
                    <button className="btn btn-o btn-sm" onClick={()=>openEdit(u)}>Edit</button>
                    {u.role!==ROLES.SUPERADMIN&&<button className="btn btn-danger btn-sm" onClick={()=>deleteUser(u.id)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {modal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="card-title">{modal==="add"?"Add New User":"Edit User"}</div>
              <button className="mclose" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="g2">
                <div><div className="fg"><label className="flabel">Full Name</label><input className="finput" value={form.name||""} onChange={e=>set("name",e.target.value)}/></div></div>
                <div><div className="fg"><label className="flabel">Email</label><input className="finput" value={form.email||""} onChange={e=>set("email",e.target.value)}/></div></div>
                <div><div className="fg"><label className="flabel">Password</label><input className="finput" type="password" value={form.password||""} onChange={e=>set("password",e.target.value)}/></div></div>
                <div><div className="fg"><label className="flabel">Nationality</label><input className="finput" value={form.nationality||""} onChange={e=>set("nationality",e.target.value)}/></div></div>
              </div>
              {form.role===ROLES.PARTICIPANT&&(
                <div className="g2">
                  <div><div className="fg"><label className="flabel">Phase</label><input type="number" className="finput" min={1} max={6} value={form.phase||1} onChange={e=>set("phase",+e.target.value)}/></div></div>
                  <div><div className="fg"><label className="flabel">GPA</label><input type="number" className="finput" min={0} max={4} step={.1} value={form.gpa||0} onChange={e=>set("gpa",+e.target.value)}/></div></div>
                  <div><div className="fg"><label className="flabel">Portfolio Score</label><input type="number" className="finput" min={0} max={100} value={form.portfolioScore||0} onChange={e=>set("portfolioScore",+e.target.value)}/></div></div>
                  <div><div className="fg"><label className="flabel">Interview Score</label><input type="number" className="finput" min={0} max={100} value={form.interviewScore||0} onChange={e=>set("interviewScore",+e.target.value)}/></div></div>
                  <div><div className="fg"><label className="flabel">ML Score</label><input type="number" className="finput" min={0} max={100} value={form.mlScore||0} onChange={e=>set("mlScore",+e.target.value)}/></div></div>
                  <div><div className="fg"><label className="flabel">Status</label>
                    <select className="finput fselect" value={form.status||"Applied"} onChange={e=>set("status",e.target.value)}>
                      <option>Applied</option><option>Under Review</option><option>Qualified</option><option>Top-Tier</option><option>Rejected</option>
                    </select>
                  </div></div>
                </div>
              )}
              {form.role===ROLES.MENTOR&&(
                <div className="g2">
                  <div><div className="fg"><label className="flabel">Track</label>
                    <select className="finput fselect" value={form.track||1} onChange={e=>set("track",+e.target.value)}>
                      <option value={1}>1 — AI & Machine Learning</option>
                      <option value={2}>2 — Modeling & Simulation</option>
                      <option value={3}>3 — Biomedical Electronics</option>
                    </select>
                  </div></div>
                  <div><div className="fg"><label className="flabel">Specialty</label><input className="finput" value={form.specialty||""} onChange={e=>set("specialty",e.target.value)}/></div></div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-s" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-p" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSheetsConfig() {
  const { logs, pushToSheets } = useContext(DataCtx);
  const [url, setUrl] = useState("");
  return (
    <div>
      <div className="card mb6">
        <div className="card-header"><div><div className="card-title">Google Sheets Integration</div><div className="card-sub">Configure your deployed Google Apps Script Web App URL</div></div></div>
        <div className="card-body">
          <div className="alert alert-info mb4">
            📋 Deploy a Google Apps Script as a Web App and paste the URL below. All data pushes from the application will sync to your spreadsheet.
          </div>
          <div className="fg"><label className="flabel">Web App URL</label><input className="finput" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec"/></div>
          <button className="btn btn-p" onClick={()=>pushToSheets("_test",{test:true,timestamp:new Date().toISOString()})}>Test Connection</button>
          <div style={{marginTop:20}}>
            <div className="flabel">Required Sheets in your Spreadsheet:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
              {["Participants","Assignments","Meetings","PaperReviews","NoveltyAssessments","ResourceRequests","CompetitionEnrollments","CalendarRegistrations","TrackAssignments","Capstone","ResearchHub","Filtration","Users"].map(s=>(
                <span key={s} className="tag">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Activity Log (Last 50 Pushes)</div></div>
        <div className="card-body" style={{padding:0}}>
          {logs.length===0&&<div className="txt-muted" style={{padding:20}}>No activity yet. Actions will appear here.</div>}
          {logs.map((l,i)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"10px 16px",borderBottom:"1px solid var(--frost)",fontSize:12}}>
              <span style={{color:"var(--jade)",fontSize:8,marginTop:3}}>●</span>
              <span style={{fontWeight:600,color:"var(--violet)"}}>{l.sheet}</span>
              <span className="txt-muted" style={{flex:1}}>{JSON.stringify(l.data).slice(0,80)}…</span>
              <span className="mono txt-muted">{new Date(l.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  PROFILE VIEW (all roles)

// =============================================================
//  MCQ QUESTIONS — Correct answers defined here
// =============================================================
const MCQ_QUESTIONS = [
  {
    id: "Q1",
    question: "In machine learning, what is the primary purpose of cross-validation?",
    options: ["A) To increase training speed.", "B) To assess generalization and prevent overfitting.", "C) To automatically clean missing data.", "D) I don't know yet."],
    correct: "B",
    explanation: "Cross-validation evaluates how well a model generalizes to unseen data by testing on held-out folds, preventing overfitting."
  },
  {
    id: "Q2",
    question: "In biosignal processing, what does a High-Pass filter do?",
    options: ["A) It amplifies the overall signal voltage.", "B) It allows low frequencies to pass while attenuating high ones.", "C) It allows high frequencies to pass while removing baseline wander.", "D) I don't know yet."],
    correct: "C",
    explanation: "A high-pass filter passes frequencies above a cutoff, removing slow baseline drift (wander) common in ECG/EEG signals."
  },
  {
    id: "Q3",
    question: "For a highly imbalanced medical dataset (99% healthy, 1% sick), which metric is most informative?",
    options: ["A) Accuracy", "B) F1-Score / PR-AUC", "C) Mean Squared Error (MSE)", "D) I don't know yet."],
    correct: "B",
    explanation: "Accuracy is misleading (99% by always predicting healthy). F1-Score and PR-AUC properly capture performance on the rare positive class."
  },
];

function getMCQScore(app) {
  // Parses "Q1: B | Q2: C | Q3: B" format from Math/Stats Skill column
  const raw = (app["Math/Stats Skill"] || "").toString();
  const answers = ["", "", ""];

  // Try to extract Q1, Q2, Q3 answers from the pipe-delimited format
  const parts = raw.split("|").map(s => s.trim());
  parts.forEach(part => {
    const m = part.match(/Q(\d)\s*:\s*([A-Da-d])/i);
    if (m) {
      const idx = parseInt(m[1]) - 1;
      if (idx >= 0 && idx <= 2) answers[idx] = m[2].toUpperCase();
    }
  });

  // Fallback: also check dedicated columns if they exist
  if (!answers[0]) answers[0] = (app["Q1Answer"] || app["Q1 Answer"] || app["MCQ1"] || "").toString().trim().toUpperCase().charAt(0);
  if (!answers[1]) answers[1] = (app["Q2Answer"] || app["Q2 Answer"] || app["MCQ2"] || "").toString().trim().toUpperCase().charAt(0);
  if (!answers[2]) answers[2] = (app["Q3Answer"] || app["Q3 Answer"] || app["MCQ3"] || "").toString().trim().toUpperCase().charAt(0);

  let correct = 0;
  answers.forEach((ans, i) => {
    if (ans && ans === MCQ_QUESTIONS[i].correct) correct++;
  });
  return { answers, correct, total: 3 };
}

// =============================================================
//  PRO ADMIN DASHBOARD — Full Review Analytics + Filtration
// =============================================================

function ProAdminDashboard() {
  const { user } = useContext(AuthCtx); // ← use logged-in proadmin's OWN identity
  const [apps, setApps]       = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("overview");
  const [searchApp, setSearchApp] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [appsData, reviewsData] = await Promise.all([
        sheetsAPI.get("Applications"),
        sheetsAPI.get("Reviews")
      ]);
      if (appsData && Array.isArray(appsData)) setApps(appsData);
      if (reviewsData && Array.isArray(reviewsData)) setReviews(reviewsData);
      setLoading(false);
    })();
  }, []);

  const getDecision = (email) => {
    const appRevs = reviews.filter(r=>(r["applicationEmail"]||r["ApplicationEmail"]||"").toLowerCase()===(email||"").toLowerCase());
    const decs = appRevs.map(r=>(r["decision"]||r["Decision"]||"").toLowerCase());
    if (decs.some(d=>d.includes("accept"))) return "Accepted";
    if (decs.some(d=>d.includes("wait"))) return "Waitlisted";
    if (decs.some(d=>d.includes("reject"))) return "Rejected";
    return "Pending";
  };

  const accepted   = apps.filter(a=>getDecision(a["Email"])==="Accepted").length;
  const waitlisted = apps.filter(a=>getDecision(a["Email"])==="Waitlisted").length;
  const rejected   = apps.filter(a=>getDecision(a["Email"])==="Rejected").length;
  const pending    = apps.filter(a=>getDecision(a["Email"])==="Pending").length;

  // ── Reviewer analytics ──
  const reviewerMap = {};
  reviews.forEach(r => {
    const name = r["reviewerName"]||r["ReviewerName"]||r["reviewerEmail"]||r["ReviewerEmail"]||"Unknown";
    if (!reviewerMap[name]) reviewerMap[name] = { name, total:0, accepted:0, waitlisted:0, rejected:0, scores:[] };
    reviewerMap[name].total++;
    const dec = (r["decision"]||r["Decision"]||"").toLowerCase();
    if (dec.includes("accept")) reviewerMap[name].accepted++;
    else if (dec.includes("wait")) reviewerMap[name].waitlisted++;
    else if (dec.includes("reject")) reviewerMap[name].rejected++;
    const score = parseFloat(r["score"]||r["Score"]||0);
    if (score) reviewerMap[name].scores.push(score);
  });
  const reviewers = Object.values(reviewerMap).map(rv => ({
    ...rv, avgScore: rv.scores.length ? Math.round(rv.scores.reduce((a,b)=>a+b,0)/rv.scores.length) : 0
  }));

  // ── Aggregations ──
  const trackCounts = {};
  const countryCounts = {};
  const timelineCounts = {};
  const yearCounts = {};
  const gpaBuckets = { "3.5+":0, "3.0–3.5":0, "2.5–3.0":0, "<2.5":0 };
  const mcqScoreCounts = {0:0, 1:0, 2:0, 3:0};
  const facultyCounts = {};
  const genderCounts = {};
  let totalGpa = 0, gpaCount = 0;
  let allScores = reviews.map(r=>parseFloat(r["score"]||r["Score"]||0)).filter(Boolean);

  apps.forEach(a => {
    const t = (a["Target Track"]||"").split(",")[0].trim()||"Unknown";
    trackCounts[t] = (trackCounts[t]||0)+1;

    const c = (a["Country"] || a["Nationality"] || "Unknown").trim();
    countryCounts[c] = (countryCounts[c]||0)+1;

    const yr = (a["Academic Year"]||"Unknown").trim();
    yearCounts[yr] = (yearCounts[yr]||0)+1;

    const fac = (a["Faculty"]||"Unknown").trim();
    facultyCounts[fac] = (facultyCounts[fac]||0)+1;

    const gen = (a["Gender"]||"Not Specified").trim();
    genderCounts[gen] = (genderCounts[gen]||0)+1;

    if(a["Timestamp"]) {
      const d = new Date(a["Timestamp"]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timelineCounts[d] = (timelineCounts[d]||0)+1;
    }

    const g = parseFloat(a["GPA"])||0;
    if (g>0) { totalGpa+=g; gpaCount++; }
    if (g>=3.5) gpaBuckets["3.5+"]++;
    else if (g>=3.0) gpaBuckets["3.0–3.5"]++;
    else if (g>=2.5) gpaBuckets["2.5–3.0"]++;
    else if (g>0) gpaBuckets["<2.5"]++;

    const mcq = getMCQScore(a);
    mcqScoreCounts[mcq.correct] = (mcqScoreCounts[mcq.correct]||0)+1;
  });

  const avgGpa = gpaCount ? (totalGpa/gpaCount).toFixed(2) : "—";
  const avgScore = allScores.length ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length) : 0;
  const maxTrack = Math.max(...Object.values(trackCounts), 1);
  const maxCountry = Math.max(...Object.values(countryCounts), 1);
  const maxYear = Math.max(...Object.values(yearCounts), 1);
  const maxTimeline = Math.max(...Object.values(timelineCounts), 1);
  const maxFaculty = Math.max(...Object.values(facultyCounts), 1);
  const maxGpa = Math.max(...Object.values(gpaBuckets), 1);
  const maxMcq = Math.max(...Object.values(mcqScoreCounts), 1);

  const decBg = d => d==="Accepted"?"#D1FAE5":d==="Waitlisted"?"#FEF3C7":d==="Rejected"?"#FEE2E2":"var(--frost)";
  const decFg = d => d==="Accepted"?"#065F46":d==="Waitlisted"?"#92400E":d==="Rejected"?"#991B1B":"var(--ink3)";

  const CHART_COLORS = ["#5B3BF5","#1A6DFF","#0EA5C5","#0F9F6E","#E8860A","#E53E5C","#8B5CF6","#06B6D4","#10B981","#F59E0B"];

  const BarChart = ({ data, maxVal, color = "var(--r1)", height = 140, labelKey, valueKey }) => {
    const entries = Object.entries(data).sort((a,b)=>b[1]-a[1]);
    return (
      <div style={{display:"flex",alignItems:"flex-end",gap:6,height,padding:"0 4px",overflowX:"auto"}}>
        {entries.map(([label, val], i) => (
          <div key={label} style={{flex:"0 0 auto",minWidth:36,display:"flex",flexDirection:"column",alignItems:"center",gap:3}} title={`${label}: ${val}`}>
            <span style={{fontSize:9,fontWeight:700,color:"var(--ink2)"}}>{val}</span>
            <div style={{width:32,background:typeof color==="string"?color:CHART_COLORS[i%CHART_COLORS.length],borderRadius:"4px 4px 0 0",height:Math.max(6,val/maxVal*(height-30))+"px",transition:"height .4s"}}/>
            <span style={{fontSize:8,color:"var(--ink3)",textAlign:"center",maxWidth:42,lineHeight:1.2,wordBreak:"break-word",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:36}}>{label.length>8?label.slice(0,7)+"…":label}</span>
          </div>
        ))}
      </div>
    );
  };

  const DonutSlice = ({ data, size=120 }) => {
    const entries = Object.entries(data).filter(([,v])=>v>0);
    const total = entries.reduce((s,[,v])=>s+v,0);
    if (!total) return <div style={{width:size,height:size,borderRadius:"50%",background:"var(--frost)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"var(--ink3)"}}>No data</div>;
    let offset = 0;
    const r = size/2 - 10;
    const cx = size/2, cy = size/2;
    const circles = entries.map(([label, val], i) => {
      const pct = val/total;
      const dashArray = 2*Math.PI*r;
      const dash = pct*dashArray;
      const gap = dashArray - dash;
      const el = <circle key={label} cx={cx} cy={cy} r={r} fill="none" stroke={CHART_COLORS[i%CHART_COLORS.length]} strokeWidth={18} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*dashArray} style={{transform:`rotate(-90deg)`,transformOrigin:`${cx}px ${cy}px`}}/>;
      offset += pct;
      return el;
    });
    return (
      <div style={{position:"relative",width:size,height:size}}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{circles}</svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:"var(--ink)"}}>{total}</div>
          <div style={{fontSize:8,color:"var(--ink3)"}}>total</div>
        </div>
      </div>
    );
  };

  const filteredApps = apps.filter(a =>
    !searchApp || (a["Name"]||"").toLowerCase().includes(searchApp.toLowerCase()) ||
    (a["Email"]||"").toLowerCase().includes(searchApp.toLowerCase()) ||
    (a["University"]||"").toLowerCase().includes(searchApp.toLowerCase())
  );

  if (loading) return (
    <div style={{textAlign:"center",padding:80,color:"var(--ink3)"}}>
      <div style={{fontSize:40,marginBottom:16}}>⏳</div>
      <div style={{fontSize:14,fontWeight:600}}>Loading from Google Sheets…</div>
    </div>
  );

  return (
    <div>
      {/* ── HEADER BANNER ── */}
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:"var(--radL)",padding:"22px 28px",color:"white",marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",right:80,bottom:-60,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{position:"relative"}}>
          <div style={{background:"rgba(255,255,255,.12)",fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:20,letterSpacing:".5px",display:"inline-block",marginBottom:8}}>PRO ADMIN · READ-ONLY ANALYTICS</div>
          <div style={{fontFamily:"Fraunces,serif",fontSize:22,letterSpacing:"-.3px",marginTop:4}}>Filtration Analytics Center</div>
          <div style={{fontSize:12,opacity:.7,marginTop:4}}>{apps.length} applicants · {reviews.length} reviews · {reviewers.length} reviewer{reviewers.length!==1?"s":""}</div>
          <div style={{fontSize:10,opacity:.55,marginTop:6}}>Signed in as: {user?.name||user?.Name||user?.email||"—"} ({user?.email||"—"})</div>
        </div>
        <div style={{display:"flex",gap:20,position:"relative",flexWrap:"wrap"}}>
          {[[accepted,"Accepted","#86EFAC"],[waitlisted,"Waitlisted","#FCD34D"],[rejected,"Rejected","#F87171"],[pending,"Pending","#94A3B8"]].map(([v,l,c])=>(
            <div key={l} style={{textAlign:"center"}}><div style={{fontFamily:"Fraunces,serif",fontSize:28,color:c,letterSpacing:"-1px"}}>{v}</div><div style={{fontSize:10,opacity:.65,marginTop:2}}>{l}</div></div>
          ))}
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="g4 mb6">
        {[
          {icon:"📊",val:apps.length,label:"Total Applications"},
          {icon:"🎓",val:avgGpa,label:"Average GPA"},
          {icon:"🏆",val:avgScore?avgScore+"/100":"—",label:"Avg Review Score"},
          {icon:"👥",val:reviewers.length,label:"Active Reviewers"},
        ].map((s,i)=>(
          <div key={i} className="stat"><div className="stat-icon">{s.icon}</div><div className="stat-val" style={{fontSize:24}}>{s.val}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="tabs" style={{marginBottom:20}}>
        {[["overview","📊 Overview"],["demographics","🌍 Demographics"],["mcq","🧠 MCQ Analysis"],["reviewers","👤 Reviewers"],["applicants","📋 All Applicants"]].map(([id,label])=>(
          <button key={id} className={"tab "+(tab===id?"active":"")} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ════════════════════════════════════════ */}
      {tab==="overview" && (
        <div>
          {/* Decision + Timeline */}
          <div className="g2 mb6">
            <div className="card">
              <div className="card-header"><div><div className="card-title">Decision Breakdown</div><div className="card-sub">{apps.length} total applicants</div></div></div>
              <div className="card-body">
                {[["✅ Accepted",accepted,"#0F9F6E","#D1FAE5"],["◐ Waitlisted",waitlisted,"#E8860A","#FEF3C7"],["✗ Rejected",rejected,"#E53E5C","#FEE2E2"],["⏳ Pending",pending,"#6B7DB3","#EEF2FF"]].map(([label,val,color,bg])=>(
                  <div key={label} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:700}}>{label}</span>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontFamily:"DM Mono,monospace",fontSize:18,fontWeight:800,color}}>{val}</span>
                        <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:bg,color}}>{apps.length?Math.round(val/apps.length*100):0}%</span>
                      </div>
                    </div>
                    <div style={{height:10,background:"var(--frost)",borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",width:(apps.length?val/apps.length*100:0)+"%",background:color,borderRadius:5,transition:"width .6s"}}/></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Submission Timeline</div></div>
              <div className="card-body" style={{overflowX:"auto"}}>
                {Object.keys(timelineCounts).length > 0 ? (
                  <BarChart data={timelineCounts} maxVal={maxTimeline} color="var(--r1)" height={160}/>
                ) : <div className="txt-muted" style={{textAlign:"center",padding:40}}>No timestamp data</div>}
              </div>
            </div>
          </div>

          {/* GPA + Track */}
          <div className="g2 mb6">
            <div className="card">
              <div className="card-header"><div className="card-title">GPA Distribution</div></div>
              <div className="card-body">
                {Object.entries(gpaBuckets).map(([bucket,count],i)=>(
                  <div key={bucket} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:700,color:i===0?"#0F9F6E":i===1?"#1A6DFF":i===2?"#E8860A":"#E53E5C"}}>{bucket}</span>
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:700}}>{count} <span style={{color:"var(--ink3)",fontWeight:400,fontSize:10}}>({apps.length?Math.round(count/apps.length*100):0}%)</span></span>
                    </div>
                    <div style={{height:9,background:"var(--frost)",borderRadius:5,overflow:"hidden"}}>
                      <div style={{height:"100%",width:(count/maxGpa*100)+"%",background:i===0?"#0F9F6E":i===1?"#1A6DFF":i===2?"#E8860A":"#E53E5C",borderRadius:5,transition:"width .5s"}}/>
                    </div>
                  </div>
                ))}
                <div style={{textAlign:"center",marginTop:16,padding:"12px",background:"var(--snow)",borderRadius:10}}>
                  <div style={{fontSize:11,color:"var(--ink3)"}}>Cohort Average GPA</div>
                  <div style={{fontFamily:"Fraunces,serif",fontSize:32,background:"var(--r1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{avgGpa}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Target Track Preferences</div></div>
              <div className="card-body">
                {Object.entries(trackCounts).sort((a,b)=>b[1]-a[1]).map(([track,count],i)=>(
                  <div key={track} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:600}}>{track}</span>
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:700}}>{count}</span>
                    </div>
                    <div style={{height:9,background:"var(--frost)",borderRadius:5,overflow:"hidden"}}>
                      <div style={{height:"100%",width:(count/maxTrack*100)+"%",background:CHART_COLORS[i%CHART_COLORS.length],borderRadius:5,transition:"width .5s"}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review Score Distribution */}
          <div className="card">
            <div className="card-header"><div className="card-title">Review Score Distribution</div><div className="card-sub">Across all reviewer decisions</div></div>
            <div className="card-body">
              {(() => {
                const buckets = {"0–49":0,"50–59":0,"60–69":0,"70–74":0,"75–79":0,"80–89":0,"90–100":0};
                allScores.forEach(s=>{
                  if(s<50) buckets["0–49"]++;
                  else if(s<60) buckets["50–59"]++;
                  else if(s<70) buckets["60–69"]++;
                  else if(s<75) buckets["70–74"]++;
                  else if(s<80) buckets["75–79"]++;
                  else if(s<90) buckets["80–89"]++;
                  else buckets["90–100"]++;
                });
                const maxB = Math.max(...Object.values(buckets),1);
                const colors = ["#E53E5C","#E8860A","#E8860A","#1A6DFF","#0F9F6E","#0F9F6E","#0F9F6E"];
                return (
                  <div style={{display:"flex",gap:10,alignItems:"flex-end",height:100}}>
                    {Object.entries(buckets).map(([range,cnt],i)=>(
                      <div key={range} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <span style={{fontSize:9,fontWeight:700,color:"var(--ink2)"}}>{cnt}</span>
                        <div style={{width:"100%",background:colors[i],borderRadius:"4px 4px 0 0",height:Math.max(4,cnt/maxB*72)+"px"}}/>
                        <span style={{fontSize:8,color:"var(--ink3)",fontWeight:600}}>{range}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {tab==="demographics" && (
        <div>
          <div className="g2 mb6">
            {/* Country */}
            <div className="card">
              <div className="card-header"><div className="card-title">Country of Origin</div><div className="card-sub">{Object.keys(countryCounts).length} countries</div></div>
              <div className="card-body">
                <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:20}}>
                  <DonutSlice data={countryCounts} size={120}/>
                  <div style={{flex:1}}>
                    {Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,v],i)=>(
                      <div key={c} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <div style={{width:10,height:10,borderRadius:2,background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                        <span style={{fontSize:11,fontWeight:600,flex:1}}>{c}</span>
                        <span style={{fontFamily:"DM Mono,monospace",fontSize:11,fontWeight:700}}>{v}</span>
                        <span style={{fontSize:10,color:"var(--ink3)",minWidth:30,textAlign:"right"}}>{Math.round(v/apps.length*100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <BarChart data={countryCounts} maxVal={maxCountry} color="" height={120}/>
              </div>
            </div>

            {/* Year of Study */}
            <div className="card">
              <div className="card-header"><div className="card-title">Year of Study</div><div className="card-sub">Academic level distribution</div></div>
              <div className="card-body">
                <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:20}}>
                  <DonutSlice data={yearCounts} size={120}/>
                  <div style={{flex:1}}>
                    {Object.entries(yearCounts).sort((a,b)=>b[1]-a[1]).map(([yr,v],i)=>(
                      <div key={yr} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <div style={{width:10,height:10,borderRadius:2,background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                        <span style={{fontSize:11,fontWeight:600,flex:1}}>{yr}</span>
                        <span style={{fontFamily:"DM Mono,monospace",fontSize:11,fontWeight:700}}>{v}</span>
                        <span style={{fontSize:10,color:"var(--ink3)",minWidth:30,textAlign:"right"}}>{Math.round(v/apps.length*100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <BarChart data={yearCounts} maxVal={maxYear} color="" height={100}/>
              </div>
            </div>
          </div>

          <div className="g2 mb6">
            {/* Gender */}
            <div className="card">
              <div className="card-header"><div className="card-title">Gender Distribution</div></div>
              <div className="card-body" style={{display:"flex",gap:20,alignItems:"center"}}>
                <DonutSlice data={genderCounts} size={140}/>
                <div style={{flex:1}}>
                  {Object.entries(genderCounts).sort((a,b)=>b[1]-a[1]).map(([g,v],i)=>(
                    <div key={g} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:12,height:12,borderRadius:3,background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                          <span style={{fontSize:12,fontWeight:700}}>{g}</span>
                        </div>
                        <span style={{fontFamily:"DM Mono,monospace",fontWeight:700}}>{v} ({Math.round(v/apps.length*100)}%)</span>
                      </div>
                      <div style={{height:8,background:"var(--frost)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:(v/apps.length*100)+"%",background:CHART_COLORS[i%CHART_COLORS.length],borderRadius:4}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Faculty */}
            <div className="card">
              <div className="card-header"><div className="card-title">Faculty / Department</div></div>
              <div className="card-body">
                {Object.entries(facultyCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([fac,cnt],i)=>(
                  <div key={fac} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:11,fontWeight:600}}>{fac}</span>
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:11,fontWeight:700}}>{cnt}</span>
                    </div>
                    <div style={{height:7,background:"var(--frost)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:(cnt/maxFaculty*100)+"%",background:CHART_COLORS[i%CHART_COLORS.length],borderRadius:4}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {tab==="mcq" && (
        <div>
          <div className="g3 mb6">
            {MCQ_QUESTIONS.map((q,qi)=>{
              const letterCounts = {A:0,B:0,C:0,D:0};
              apps.forEach(a=>{
                const ans = (a[`Q${qi+1}Answer`]||a[`Q${qi+1} Answer`]||a[`MCQ${qi+1}`]||"").toString().trim().toUpperCase().charAt(0);
                if (letterCounts[ans]!==undefined) letterCounts[ans]++;
              });
              const total = Object.values(letterCounts).reduce((s,v)=>s+v,0)||1;
              return (
                <div key={q.id} className="card">
                  <div style={{background:"linear-gradient(135deg,rgba(91,59,245,.06),rgba(26,109,255,.04))",padding:"14px 18px",borderBottom:"1px solid var(--frost)"}}>
                    <div style={{fontSize:9,fontWeight:700,color:"var(--violet)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{q.id} · {["Cross-Validation","High-Pass Filter","Imbalanced Dataset"][qi]}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--ink)",lineHeight:1.5}}>{q.question}</div>
                  </div>
                  <div className="card-body">
                    {q.options.map((opt,oi)=>{
                      const letter = ["A","B","C","D"][oi];
                      const isCorrect = letter===q.correct;
                      const cnt = letterCounts[letter]||0;
                      const pct = Math.round(cnt/total*100);
                      return (
                        <div key={letter} style={{marginBottom:10,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${isCorrect?"#A7F3D0":"var(--frost)"}`,background:isCorrect?"#F0FDF4":"white"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                            <div style={{display:"flex",gap:7,alignItems:"center"}}>
                              <span style={{width:20,height:20,borderRadius:"50%",background:isCorrect?"#0F9F6E":"var(--frost)",color:isCorrect?"white":"var(--ink3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0}}>{letter}</span>
                              <span style={{fontSize:11,color:isCorrect?"var(--ink)":"var(--ink3)",fontWeight:isCorrect?700:500}}>{opt}</span>
                              {isCorrect&&<span style={{fontSize:9,fontWeight:700,color:"#0F9F6E",background:"#D1FAE5",padding:"2px 6px",borderRadius:10}}>✓ CORRECT</span>}
                            </div>
                            <span style={{fontFamily:"DM Mono,monospace",fontSize:11,fontWeight:700,color:isCorrect?"#0F9F6E":"var(--ink2)"}}>{cnt} ({pct}%)</span>
                          </div>
                          <div style={{height:5,background:"var(--frost)",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:pct+"%",background:isCorrect?"#0F9F6E":"#C7D2EC",borderRadius:3,transition:"width .4s"}}/>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{marginTop:10,padding:"9px 12px",background:"rgba(91,59,245,.05)",borderRadius:8,border:"1px solid rgba(91,59,245,.1)",fontSize:11,color:"var(--ink2)",lineHeight:1.6}}>
                      💡 {q.explanation}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">MCQ Score Summary</div><div className="card-sub">How many correct out of 3</div></div>
            <div className="card-body">
              <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-end",height:120,flex:1}}>
                  {[0,1,2,3].map(score=>{
                    const cnt = mcqScoreCounts[score]||0;
                    const total = apps.length||1;
                    return (
                      <div key={score} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                        <span style={{fontSize:12,fontWeight:800,color:score===3?"#0F9F6E":score===2?"#1A6DFF":score===1?"#E8860A":"#E53E5C"}}>{cnt}</span>
                        <div style={{width:"100%",background:score===3?"#0F9F6E":score===2?"#1A6DFF":score===1?"#E8860A":"#E53E5C",borderRadius:"6px 6px 0 0",height:Math.max(8,cnt/maxMcq*90)+"px"}}/>
                        <span style={{fontSize:11,fontWeight:700}}>{score}/3</span>
                        <span style={{fontSize:9,color:"var(--ink3)"}}>{Math.round(cnt/total*100)}%</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,minWidth:200}}>
                  {[
                    {label:"All Correct (3/3)",val:mcqScoreCounts[3]||0,color:"#0F9F6E",bg:"#D1FAE5"},
                    {label:"Strong (2/3)",val:mcqScoreCounts[2]||0,color:"#1A6DFF",bg:"#DBEAFE"},
                    {label:"Partial (1/3)",val:mcqScoreCounts[1]||0,color:"#E8860A",bg:"#FEF3C7"},
                    {label:"No Answers (0/3)",val:mcqScoreCounts[0]||0,color:"#E53E5C",bg:"#FEE2E2"},
                  ].map(s=>(
                    <div key={s.label} style={{padding:"10px 12px",borderRadius:10,background:s.bg,border:`1px solid ${s.color}22`}}>
                      <div style={{fontFamily:"Fraunces,serif",fontSize:24,color:s.color}}>{s.val}</div>
                      <div style={{fontSize:10,fontWeight:700,color:s.color,marginTop:2}}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {tab==="reviewers" && (
        <div>
          <div className="g2 mb6">
            {reviewers.map((rv,i)=>(
              <div key={rv.name} className="card">
                <div className="card-body">
                  <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
                    <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#1e1b4b,#5B3BF5)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:14,flexShrink:0}}>
                      {rv.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{rv.name}</div>
                      <div style={{fontSize:11,color:"var(--ink3)"}}>{rv.total} review{rv.total!==1?"s":""} · avg <b style={{color:"var(--violet)"}}>{rv.avgScore}/100</b></div>
                    </div>
                  </div>
                  {[["✅ Accepted",rv.accepted,"#0F9F6E","#D1FAE5"],["◐ Waitlisted",rv.waitlisted,"#E8860A","#FEF3C7"],["✗ Rejected",rv.rejected,"#E53E5C","#FEE2E2"]].map(([l,v,c,bg])=>(
                    <div key={l} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:11,fontWeight:600}}>{l}</span>
                        <span style={{fontFamily:"DM Mono,monospace",fontSize:11,fontWeight:700,color:c}}>{v} ({rv.total?Math.round(v/rv.total*100):0}%)</span>
                      </div>
                      <div style={{height:7,background:"var(--frost)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:(rv.total?v/rv.total*100:0)+"%",background:c,borderRadius:4}}/>
                      </div>
                    </div>
                  ))}
                  <div style={{marginTop:12,padding:"8px 12px",background:"var(--snow)",borderRadius:8,textAlign:"center"}}>
                    <span style={{fontSize:11,color:"var(--ink3)"}}>Avg Score: </span>
                    <span style={{fontFamily:"Fraunces,serif",fontSize:22,fontWeight:800,color:rv.avgScore>=75?"#0F9F6E":rv.avgScore>=55?"#E8860A":"#E53E5C"}}>{rv.avgScore}</span>
                    <span style={{fontSize:11,color:"var(--ink3)"}}>/100</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {reviewers.length===0 && <div className="card"><div className="card-body" style={{textAlign:"center",padding:48,color:"var(--ink3)"}}>No reviewer data yet</div></div>}
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {tab==="applicants" && (
        <div>
          <input value={searchApp} onChange={e=>setSearchApp(e.target.value)} placeholder="🔍 Search name, email, university…"
            style={{width:"100%",padding:"10px 14px",border:"1.5px solid var(--frost)",borderRadius:10,fontSize:13,outline:"none",background:"white",fontFamily:"'DM Sans',sans-serif",marginBottom:16}}/>
          <div className="card">
            <div className="card-body" style={{padding:0}}>
              <table className="tbl">
                <thead><tr><th>Name</th><th>Country</th><th>Year</th><th>GPA</th><th>Track</th><th>MCQ</th><th>Consensus</th><th>Avg Score</th></tr></thead>
                <tbody>{filteredApps.map((a,i)=>{
                  const appRevs = reviews.filter(r=>(r["applicationEmail"]||r["ApplicationEmail"]||"").toLowerCase()===(a["Email"]||"").toLowerCase());
                  const scores = appRevs.map(r=>parseFloat(r["score"]||r["Score"]||0)).filter(Boolean);
                  const avgSc = scores.length?Math.round(scores.reduce((x,y)=>x+y,0)/scores.length):0;
                  const top = getDecision(a["Email"]);
                  const mcq = getMCQScore(a);
                  return (
                    <tr key={i}>
                      <td><div style={{fontWeight:700,fontSize:12}}>{a["Name"]||"—"}</div><div style={{fontSize:10,color:"var(--ink3)"}}>{a["Email"]}</div></td>
                      <td style={{fontSize:12,fontWeight:600}}>{a["Country"]||a["Nationality"]||"—"}</td>
                      <td style={{fontSize:11}}>{a["Academic Year"]||"—"}</td>
                      <td className="mono" style={{fontWeight:700}}>{a["GPA"]||"—"}</td>
                      <td style={{fontSize:10}}>{(a["Target Track"]||"—").split(",")[0]}</td>
                      <td>
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          {[0,1,2].map(qi=>{
                            const letter = mcq.answers[qi]?.charAt(0)||"";
                            const isCorrect = letter===MCQ_QUESTIONS[qi].correct;
                            const hasAnswer = !!letter && letter!=="D";
                            return <span key={qi} style={{width:16,height:16,borderRadius:3,background:hasAnswer?(isCorrect?"#0F9F6E":"#E53E5C"):"var(--frost)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"white",flexShrink:0}} title={`Q${qi+1}: ${letter||"No answer"}`}>{letter||"?"}</span>;
                          })}
                          <span style={{fontFamily:"DM Mono,monospace",fontSize:10,fontWeight:800,color:mcq.correct===3?"#0F9F6E":mcq.correct===2?"#1A6DFF":mcq.correct===1?"#E8860A":"#E53E5C"}}>{mcq.correct}/3</span>
                        </div>
                      </td>
                      <td><span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:decBg(top),color:decFg(top)}}>{top}</span></td>
                      <td style={{fontFamily:"DM Mono,monospace",fontWeight:700,color:avgSc>=75?"#065F46":avgSc>=50?"#92400E":avgSc?"#991B1B":"var(--mist)"}}>{avgSc?avgSc+"/100":"—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function ProfileView({ user }) {
  const { updateUser } = useContext(DataCtx);
  const [form, setForm] = useState({...user});
  const [saved, setSaved] = useState(false);
  const [pwForm, setPwForm] = useState({ newPw: "", confirmPw: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = () => {
    const { password, ...profileFields } = form;
    updateUser(user.id, profileFields);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const savePassword = () => {
    if (!pwForm.newPw) { setPwMsg({ error: true, text: "Enter a new password." }); return; }
    if (pwForm.newPw.length < 6) { setPwMsg({ error: true, text: "Password must be at least 6 characters." }); return; }
    if (pwForm.newPw !== pwForm.confirmPw) { setPwMsg({ error: true, text: "Passwords don't match." }); return; }
    updateUser(user.id, { ...user, password: pwForm.newPw });
    setPwForm({ newPw: "", confirmPw: "" });
    setPwMsg({ error: false, text: "Password updated ✓" });
    setTimeout(() => setPwMsg(null), 3000);
  };

  const isParticipant = user.role === ROLES.PARTICIPANT;
  const team = getTeam(user);
  const isMedImaging = team?.track === "Medical Imaging";
  const isBioinfo    = team?.track === "Bioinformatics";
  const showKaggle   = isMedImaging || isBioinfo;

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      {/* ── LEFT: Editable fields ── */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">My Profile</div>
            {saved && <span style={{fontSize:12,color:"var(--jade)",fontWeight:700}}>✓ Saved!</span>}
          </div>
          <div className="card-body">
            {/* Avatar row */}
            <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:24,padding:16,background:"var(--snow)",borderRadius:12,border:"1px solid var(--frost)"}}>
              <Avatar user={user}/>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>{user.name||user.Name||"—"}</div>
                <div className="txt-muted">{user.email}</div>
                <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                  <span className={`pill-role pill-${user.role}`} style={{display:"inline-block"}}>{user.role}</span>
                  {team && <span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:"var(--frost)",color:"var(--ink2)"}}>Team {team.id} · {team.track}</span>}
                </div>
              </div>
            </div>

            <div className="fg"><label className="flabel">Full Name</label>
              <input className="finput" value={form.name||""} onChange={e=>set("name",e.target.value)}/>
            </div>
            {!isParticipant
              ? <div className="fg"><label className="flabel">Email</label><input className="finput" value={form.email||""} onChange={e=>set("email",e.target.value)}/></div>
              : <div className="fg"><label className="flabel">Email</label><input className="finput" value={form.email||""} disabled style={{opacity:0.6,cursor:"not-allowed"}}/></div>
            }
            <div style={{marginTop:8,padding:"14px 16px",borderRadius:12,border:"1px solid var(--frost)",background:"var(--snow)"}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--ink)",marginBottom:10}}>🔒 Change Password</div>
              <div className="fg" style={{marginBottom:8}}>
                <label className="flabel">New Password</label>
                <input className="finput" type="password" placeholder="At least 6 characters…" value={pwForm.newPw} onChange={e=>setPwForm(f=>({...f,newPw:e.target.value}))}/>
              </div>
              <div className="fg" style={{marginBottom:10}}>
                <label className="flabel">Confirm Password</label>
                <input className="finput" type="password" placeholder="Repeat new password…" value={pwForm.confirmPw} onChange={e=>setPwForm(f=>({...f,confirmPw:e.target.value}))}/>
              </div>
              {pwMsg && <div style={{fontSize:12,marginBottom:8,color:pwMsg.error?"var(--rose)":"var(--jade)",fontWeight:600}}>{pwMsg.text}</div>}
              <button className="btn btn-p btn-sm" onClick={savePassword}>Update Password</button>
            </div>
          </div>
        </div>

        {/* ── Social / Research Links ── */}
        <div className="card">
          <div className="card-header"><div className="card-title">🔗 Research Profiles</div><div className="card-sub">Visible to your team and AR</div></div>
          <div className="card-body">
            <div className="fg">
              <label className="flabel">LinkedIn URL</label>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14}}>💼</span>
                <input className="finput" style={{paddingLeft:34}} value={form.linkedin||""} onChange={e=>set("linkedin",e.target.value)} placeholder="https://linkedin.com/in/username"/>
              </div>
            </div>
            <div className="fg">
              <label className="flabel">GitHub URL</label>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14}}>🐙</span>
                <input className="finput" style={{paddingLeft:34}} value={form.github||""} onChange={e=>set("github",e.target.value)} placeholder="https://github.com/username"/>
              </div>
            </div>
            {showKaggle && (
              <div className="fg">
                <label className="flabel">Kaggle URL <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"var(--azure)"}}>{isMedImaging?"(Medical Imaging)":"(Bioinformatics)"}</span></label>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14}}>🏅</span>
                  <input className="finput" style={{paddingLeft:34}} value={form.kaggle||""} onChange={e=>set("kaggle",e.target.value)} placeholder="https://kaggle.com/username"/>
                </div>
              </div>
            )}
            <div className="fg">
              <label className="flabel">Short Bio</label>
              <textarea className="finput ftextarea" style={{minHeight:90}} value={form.bio||""} onChange={e=>set("bio",e.target.value)} placeholder="Tell your team about your background, interests, and what you're working on…"/>
            </div>
            <button className="btn btn-p" onClick={save}>Save All Changes → Google Sheets</button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Read-only account info + live link preview ── */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div className="card">
          <div className="card-header"><div className="card-title">Account Info</div></div>
          <div className="card-body" style={{padding:0}}>
            {[
              ["User ID",     user.id||"—"],
              ["Role",        user.role||"—"],
              ["Team",        team ? `Team ${team.id} — ${team.challenge.slice(0,40)}…` : "Not assigned"],
              ["Track",       team?.track||"—"],
              ["Meeting",     team?.meeting||"—"],
            ].map(([k,v]) => (
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"11px 20px",borderBottom:"1px solid var(--frost)",fontSize:13}}>
                <span style={{color:"var(--ink3)",fontWeight:600,minWidth:90}}>{k}</span>
                <span style={{fontWeight:600,textAlign:"right",maxWidth:260,wordBreak:"break-word"}}>{v}</span>
              </div>
            ))}
            {user.role===ROLES.MENTOR&&[
              ["Specialty",user.specialty],["Mentees",user.mentees?.join(", ")||"None"],
              ["Meetings",user.meetings],["Papers",user.papersReviewed],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"11px 20px",borderBottom:"1px solid var(--frost)",fontSize:13}}>
                <span style={{color:"var(--ink3)",fontWeight:600}}>{k}</span><span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
            {user.role===ROLES.SUPERADMIN&&(
              <div style={{padding:16}}><div className="alert alert-success">Full administrative access to all program data.</div></div>
            )}
          </div>
        </div>

        {/* Link preview */}
        {(form.linkedin||form.github||form.kaggle||form.bio) && (
          <div className="card">
            <div className="card-header"><div className="card-title">Your Public Profile Preview</div></div>
            <div className="card-body">
              {form.bio && <p style={{fontSize:13,color:"var(--ink2)",lineHeight:1.7,marginBottom:16,padding:"12px 14px",background:"var(--snow)",borderRadius:10}}>{form.bio}</p>}
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {[
                  {url:form.linkedin, icon:"💼", label:"LinkedIn",  color:"#0077B5"},
                  {url:form.github,   icon:"🐙", label:"GitHub",    color:"#24292e"},
                  {url:form.kaggle,   icon:"🏅", label:"Kaggle",    color:"#20BEFF"},
                ].filter(l=>l.url).map(l => (
                  <a key={l.label} href={l.url} target="_blank" rel="noreferrer"
                    style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:10,background:l.color,color:"#fff",textDecoration:"none",fontSize:13,fontWeight:700}}>
                    {l.icon} {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  APP SHELL (Sidebar + Routing)
// ─────────────────────────────────────────────
function AppShell() {
  const { user, logout } = useContext(AuthCtx);
  const { syncStatus } = useContext(DataCtx);
  const [nav, setNav] = useState("dashboard");
  const [subTab, setSubTab] = useState(0);

  // ── MULTI-TEAM SUPPORT ────────────────────────────────────────────────────
  // Parse comma-separated `teams` field (e.g. "A,D,G"), fall back to teamId/team
  const allTeamIds = (() => {
    const raw = (user?.teams || "").toString().trim();
    if (raw) return raw.split(",").map(t => t.trim()).filter(Boolean);
    const single = (user?.teamId || user?.team || "").toString().trim();
    return single ? [single] : [];
  })();
  const [activeTeamId, setActiveTeamId] = useState(allTeamIds[0] || "");
  const isMultiTeam = allTeamIds.length > 1;
  // Inject active team into user object so all child components pick it up via getTeam()
  const activeUser = { ...user, teamId: activeTeamId, team: activeTeamId };
  // ─────────────────────────────────────────────────────────────────────────

  // Safe accessors — handles both "name" and "Name" from Sheets, and missing fields
  const userName = user?.name || user?.Name || user?.email || "User";
  const userRole = (user?.role || user?.Role || "").toLowerCase().trim();
  const userFirstName = userName.split(" ")[0];
  const userInitials = userName.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase() || "U";

  // ── ROLE CONFIG ────────────────────────────────────────────────────────────
  // To add a new role in the future:
  //   1. Add the role string to the ROLES constant at the top of the file.
  //   2. Add a new entry here in ROLE_CONFIG with its nav items and page map.
  //   That's it — routing, sidebar, and titles are all derived automatically.
  // ──────────────────────────────────────────────────────────────────────────
  const ROLE_CONFIG = {
    [ROLES.PARTICIPANT]: {
      nav: [
        { id:"dashboard",    icon:"🏠", label:"Dashboard" },
        { id:"submit_task",  icon:"📤", label:"Submit Tasks" },
        { id:"my_grade",     icon:"🎓", label:"My Grade" },
        { id:"meetings",     icon:"📅", label:"Meeting Notes" },
        { id:"excuse",       icon:"📝", label:"Submit Excuse" },
        // { id:"progress",     icon:"📊", label:"My Progress" },
        // { id:"training",     icon:"📚", label:"Training Modules" },
        // { id:"research",     icon:"🔬", label:"Research Hub" },
        // { id:"resources",    icon:"⚙️", label:"Request Resources" },
        // { id:"calendar",     icon:"📅", label:"Enrichment Calendar" },
        { id:"profile",      icon:"👤", label:"My Profile" },
      ],
      pages: {
        dashboard:    <ParticipantDashboard user={activeUser}/>,
        submit_task:  <TaskSubmissionView user={activeUser}/>,
        my_grade:     <MyGradeView user={activeUser}/>,
        meetings:     <MeetingNotesView user={activeUser}/>,
        excuse:       <ExcuseFormView user={activeUser}/>,
        // progress:     <ParticipantProgress user={activeUser}/>,
        // training:     <TrainingModules user={activeUser}/>,
        // research:     <ResearchHub user={activeUser}/>,
        // resources:    <ResourceRequests user={activeUser}/>,
        // calendar:     <EnrichmentCalendar user={activeUser}/>,
      },
      defaultPage: "dashboard",
    },
    [ROLES.MENTOR]: {
      nav: [
        { id:"dashboard",  icon:"🏠", label:"Dashboard" },
        { id:"mentees",    icon:"👥", label:"Team Members" },
        { id:"tasks",      icon:"📋", label:"Team Tasks" },
        { id:"excuses",    icon:"📝", label:"Excuses" },
        { id:"meetings",   icon:"📅", label:"Meetings" },
        { id:"challenges", icon:"🏥", label:"MICCAI Challenges" },
        { id:"profile",    icon:"👤", label:"My Profile" },
      ],
      pages: {
        dashboard:  <MentorDashboard user={activeUser}/>,
        mentees:    <MentorMentees user={activeUser}/>,
        tasks:      <ARTaskManager user={activeUser}/>,
        excuses:    <ExcuseReviewView user={activeUser}/>,
        meetings:   <MeetingNotesView user={activeUser}/>,
        challenges: <MICCAIChallenges user={activeUser}/>,
      },
      defaultPage: "dashboard",
    },
    [ROLES.SUPERADMIN]: {
      nav: [
        { id:"dashboard",      icon:"🏠", label:"Dashboard" },
        { id:"users",          icon:"👥", label:"User Management" },
        { id:"filtration",     icon:"🔍", label:"Filtration Center" },
        { id:"assignment",     icon:"⚡", label:"Track Assignment" },
        { id:"resources_mgmt", icon:"📦", label:"Resource Management", badge:"5", badgeWarn:true },
        { id:"metrics",        icon:"📈", label:"Metrics Dashboard" },
        { id:"sheets",         icon:"📊", label:"Sheets Config" },
        { id:"team_grades",   icon:"🏆", label:"Team Grades" },
        { id:"team_tasks",    icon:"📋", label:"Team Tasks" },
        { id:"team_meetings", icon:"📅", label:"Team Meetings" },
        { id:"team_excuses",  icon:"📝", label:"Team Excuses" },
        { id:"profile",        icon:"👤", label:"My Profile" },
      ],
      pages: {
        dashboard:      <AdminDashboard user={activeUser}/>,
        users:          <AdminUsers/>,
        filtration:     <AdminFiltration/>,
        assignment:     <AdminTrackAssignment/>,
        resources_mgmt: <AdminResourceMgmt/>,
        metrics:        <AdminMetrics/>,
        sheets:         <AdminSheetsConfig/>,
        team_grades:    <TeamGradeOverview user={activeUser}/>,
        team_tasks:     <ARTaskManager user={activeUser}/>,
        team_meetings:  <MeetingNotesView user={activeUser}/>,
        team_excuses:   <ExcuseReviewView user={activeUser}/>,
      },
      defaultPage: "dashboard",
    },
    [ROLES.PROADMIN]: {
      nav: [
        { id:"dashboard",  icon:"🏠", label:"Dashboard" },
        { id:"analytics",  icon:"📊", label:"Review Analytics" },
        { id:"filtration", icon:"🔍", label:"Filtration Center" },
        { id:"profile",    icon:"👤", label:"My Profile" },
      ],
      pages: {
        dashboard:  <ProAdminDashboard/>,
        analytics:  <ProAdminDashboard/>,
        filtration: <AdminFiltration/>,
      },
      defaultPage: "dashboard",
    },
    // ─── ASSOCIATE RESEARCHER ───────────────────────────────────────────────
    [ROLES.ASSOCIATE_RESEARCHER]: {
      nav: [
        { id:"dashboard",  icon:"📊", label:"Team Overview" },
        { id:"tasks",      icon:"📋", label:"Manage Tasks", badge:"!", badgeWarn:true },
        { id:"meetings",   icon:"📅", label:"Meetings" },
        { id:"excuses",    icon:"📝", label:"Excuses" },
        { id:"grades",     icon:"🏆", label:"Grades" },
        { id:"challenges", icon:"🏥", label:"MICCAI Challenges" },
        { id:"profile",    icon:"👤", label:"My Profile" },
      ],
      pages: {
        dashboard:  <TeamGradeOverview user={activeUser}/>,
        tasks:      <ARTaskManager user={activeUser}/>,
        meetings:   <MeetingNotesView user={activeUser}/>,
        excuses:    <ExcuseReviewView user={activeUser}/>,
        grades:     <TeamGradeOverview user={activeUser}/>,
        challenges: <MICCAIChallenges user={activeUser}/>,
      },
      defaultPage: "dashboard",
    },

    // ─── TEAM ADMIN ─────────────────────────────────────────────────────────
    // Same access as AR + has access to superadmin MICCAI challenge switcher.
    // Also counted as a team member (can submit tasks, see own grades).
    [ROLES.TEAM_ADMIN]: {
      nav: [
        { id:"dashboard",  icon:"🏠", label:"Dashboard" },
        { id:"tasks",      icon:"📋", label:"Manage Tasks", badge:"!", badgeWarn:true },
        { id:"submit",     icon:"📤", label:"My Submissions" },
        { id:"grade",      icon:"🎓", label:"My Grade" },
        { id:"meetings",   icon:"📅", label:"Meetings" },
        { id:"excuses_r",  icon:"📝", label:"Review Excuses" },
        { id:"all_grades", icon:"🏆", label:"All Grades" },
        { id:"challenges", icon:"🏥", label:"Challenges" },
        { id:"profile",    icon:"👤", label:"My Profile" },
      ],
      pages: {
        dashboard:  <TeamAdminDashboard user={activeUser}/>,
        tasks:      <ARTaskManager user={activeUser}/>,
        submit:     <TaskSubmissionView user={activeUser}/>,
        grade:      <MyGradeView user={activeUser}/>,
        meetings:   <MeetingNotesView user={activeUser}/>,
        excuses_r:  <ExcuseReviewView user={activeUser}/>,
        all_grades: <TeamGradeOverview user={activeUser}/>,
        challenges: <MICCAIChallenges user={activeUser}/>,
      },
      defaultPage: "dashboard",
    },
    // ── ADD NEW ROLES HERE ──
  };

  // Strict exact-match lookup — never falls back to another role
  const roleConfig = ROLE_CONFIG[userRole] ?? null;

  // Derive sidebar items and page titles entirely from roleConfig
  const items = roleConfig
    ? [...roleConfig.nav, { id:"profile", icon:"👤", label:"My Profile" }]
        // deduplicate in case profile is already listed in the role's nav
        .filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx)
    : [];

  const titles = Object.fromEntries(
    items.map(item => [item.id, item.label])
  );

  const renderContent = () => {
    // Profile is always available to every role
    if (nav === "profile") return <ProfileView user={activeUser}/>;

    // Unknown / misconfigured role — show a clear diagnostic, never guess
    if (!roleConfig) {
      return (
        <div style={{padding:24}}>
          <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:12,padding:20,fontSize:13,color:"#92400E"}}>
            <b>⚠ Unknown role: "{userRole}"</b><br/>
            The <code>role</code> column in your Users sheet must be one of:{" "}
            {Object.keys(ROLE_CONFIG).map(r => <code key={r} style={{margin:"0 4px"}}>{r}</code>)}
            (all lowercase, no spaces).<br/><br/>
            <b>Your full user record from Sheets:</b>
            <pre style={{marginTop:8,fontSize:11,background:"white",padding:10,borderRadius:8,overflow:"auto",whiteSpace:"pre-wrap"}}>{JSON.stringify(user, null, 2)}</pre>
          </div>
        </div>
      );
    }

    // Render the page for this role, or its default if the nav id isn't found
    return roleConfig.pages[nav] ?? roleConfig.pages[roleConfig.defaultPage];
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="slogo">
          <div className="slogo-badge">IEEE E-JUST EMBS SBC</div>
          <div className="slogo-title">Ri-Sō 理創</div>
          <div className="slogo-sub">Research Program 2026</div>
        </div>
        <nav className="snav">
          {items.map(item=>(
            <div key={item.id} className={`snav-item ${nav===item.id?"active":""}`} onClick={()=>{ setNav(item.id); setSubTab(0); }}>
              <span className="snav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge&&<span className={`snav-badge ${item.badgeWarn?"warn":""}`}>{item.badge}</span>}
            </div>
          ))}
        </nav>
        <div className="sfoot">
          <div className="suser" onClick={()=>{ setNav("profile"); setSubTab(0); }}>
            <Avatar user={{...user, role: userRole}}/>
            <div>
              <div className="suser-name">{userName.split(" ").slice(0,2).join(" ")}</div>
              <div className="suser-role">{userRole} · Ri-Sō 2026</div>
            </div>
            <span className="suser-logout" title="Sign out" onClick={e=>{e.stopPropagation();logout();}}>⏻</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:16,fontWeight:700}}>{titles[nav]||"Dashboard"}</div>
            {isMultiTeam && (
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px 4px 10px",borderRadius:20,background:"rgba(91,59,245,.08)",border:"1px solid rgba(91,59,245,.2)"}}>
                <span style={{fontSize:11,fontWeight:700,color:"var(--violet)"}}>Team:</span>
                <select
                  value={activeTeamId}
                  onChange={e => setActiveTeamId(e.target.value)}
                  style={{fontSize:12,fontWeight:700,color:"var(--violet)",border:"none",background:"transparent",cursor:"pointer",outline:"none",padding:"0 4px"}}>
                  {allTeamIds.map(id => {
                    const t = TEAMS.find(t => t.id === id);
                    return <option key={id} value={id}>{id} — {t ? t.challenge.split("—")[0].trim() : id}</option>;
                  })}
                </select>
              </div>
            )}
          </div>
          <div className="topbar-right">
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div className="sync-dot" style={{background:syncStatus==="syncing"?"var(--amber)":"var(--jade)"}}/>
              <span className="sync-txt">{syncStatus==="syncing"?"Syncing…":"Sheets Live"}</span>
            </div>
            <button className="tbtn p" onClick={()=>setNav("profile")}>👤 {userFirstName}</button>
            <button className="tbtn s" onClick={logout}>Sign Out</button>
          </div>
        </header>
        <div className="content">{renderContent()}</div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ROOT — Page Router
// ─────────────────────────────────────────────
function AppRouter() {
  const { user } = useContext(AuthCtx);
  const [page, setPage] = useState("home"); // home | login | signup

  if (user) return <AppShell/>;
  if (page==="login") return <AuthPage onBack={()=>setPage("home")}/>;
  return <LandingPage onLogin={()=>setPage("login")}/>;
}

// ─────────────────────────────────────────────
//  EXPORT
// ─────────────────────────────────────────────
export default function App() {
  return (
    <>
      <style>{CSS}</style>
      <DataProvider>
        <AuthProviderWrapper/>
      </DataProvider>
    </>
  );
}

// Need to wrap because DataProvider must be parent of AuthProvider (auth needs addUser from DataCtx)
function AuthProviderWrapper() {
  return (
    <AuthProvider>
      <AppRouter/>
    </AuthProvider>
  );
}