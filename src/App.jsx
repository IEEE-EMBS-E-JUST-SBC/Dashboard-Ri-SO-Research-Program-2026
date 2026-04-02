import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ─────────────────────────────────────────────
//  CONSTANTS & DATA
// ─────────────────────────────────────────────
const ROLES = { SUPERADMIN: "superadmin", MENTOR: "mentor", PARTICIPANT: "participant" };

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
  }
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
    sheetsAPI.update("Users", id, patch);
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
  const refreshedUser = user
    ? (users.find(u => u.id === user.id) || user)
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
          className="auth-input" type="email" placeholder="you@ejust.edu.eg"
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
          Use your registered E-JUST email and password.<br/>
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
  const cls = user?.role === ROLES.MENTOR ? "sava mentor" : user?.role === ROLES.SUPERADMIN ? "sava admin" : "sava";
  return <div className={cls}>{user?.avatar || "?"}</div>;
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
  return (
    <div>
      <div className="card mb6">
        <div className="card-header"><div className="card-title">6-Phase Progress</div></div>
        <div className="card-body">
          <div className="phase-line" style={{marginBottom:24}}>
            {PHASES.map(ph => (
              <div key={ph.id} className={`ph-item ${ph.id<p.phase?"done":""} ${ph.id===p.phase?"current":""}`}>
                <div className="ph-circle" style={{width:46,height:46,fontSize:18}}>{ph.id<p.phase?"✓":ph.icon}</div>
                <div className="ph-name">{ph.name}</div>
              </div>
            ))}
          </div>
          {PHASES.map(ph => (
            <div key={ph.id} style={{display:"flex",gap:14,padding:"14px 0",borderBottom:"1px solid var(--frost)",alignItems:"center"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:ph.id<p.phase?"var(--r1)":ph.id===p.phase?"rgba(91,59,245,.1)":"var(--snow)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{ph.id<p.phase?"✓":ph.icon}</div>
              <div style={{flex:1}}>
                <div className="flex-between" style={{marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:ph.id<=p.phase?"var(--ink)":"var(--mist)"}}>Phase {ph.id}: {ph.name}</span>
                  <span className={`badge ${ph.id<p.phase?"b-qual":ph.id===p.phase?"b-review":"b-phase"}`} style={{background:ph.id>p.phase?"var(--snow)":""}}>
                    {ph.id<p.phase?"Completed":ph.id===p.phase?"In Progress":"Upcoming"}
                  </span>
                </div>
                <div className="txt-muted">{ph.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="g3">
        {[{l:"Technical Score",v:Math.max(p.mlScore,p.modelingScore,p.electronicsScore),t:80},{l:"Portfolio Score",v:p.portfolioScore,t:75},{l:"Interview Score",v:p.interviewScore,t:75}].map(s => (
          <div key={s.l} className="card">
            <div className="card-body" style={{textAlign:"center",padding:"28px 20px"}}>
              <div style={{fontFamily:"Fraunces,serif",fontSize:42,background:"var(--r1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{s.v}</div>
              <div style={{fontSize:14,fontWeight:700,marginTop:8}}>{s.l}</div>
              <div className="txt-muted">Target: {s.t}+</div>
              <div style={{marginTop:12}}><PBar val={s.v} color={s.v>=s.t?"pfill-g":""}/></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrainingModules({ user }) {
  const { pushToSheets } = useContext(DataCtx);
  const [tab, setTab] = useState(0);
  const [sub, setSub] = useState({ week:"", note:"" });
  const modules = [
    { id:"M1", title:"Introduction to Biomedical AI",               track:"All",   type:"Lecture",  dur:"2h 15m", done:true  },
    { id:"M2", title:"Deep Learning for Medical Imaging",           track:"AI & ML",type:"Lecture", dur:"3h 00m", done:true  },
    { id:"M3", title:"CNNs in TensorFlow",                          track:"AI & ML",type:"Lab",     dur:"1h 45m", done:false },
    { id:"M4", title:"Research Methodology & Ethics",               track:"All",   type:"Workshop", dur:"2h 30m", done:false },
    { id:"M5", title:"Literature Review & IEEE Formatting",         track:"All",   type:"Webinar",  dur:"1h 30m", done:false },
  ];
  return (
    <div>
      <div className="tabs">
        {["Video Lectures","Reading List","Submit Assignment","Capstone Project"].map((t,i)=>(
          <button key={i} className={`tab ${tab===i?"active":""}`} onClick={()=>setTab(i)}>{t}</button>
        ))}
      </div>
      {tab===0&&(
        <div className="card">
          <div className="card-header"><div className="card-title">Training Modules</div><div className="txt-muted">{modules.filter(m=>m.done).length}/{modules.length} completed</div></div>
          <div className="card-body" style={{padding:0}}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Title</th><th>Track</th><th>Type</th><th>Duration</th><th>Status</th><th></th></tr></thead>
              <tbody>{modules.map(m=>(
                <tr key={m.id}>
                  <td className="mono" style={{color:"var(--mist)",fontSize:11}}>{m.id}</td>
                  <td style={{fontWeight:600}}>{m.title}</td>
                  <td><span className="tag">{m.track}</span></td>
                  <td><span className="tag">{m.type}</span></td>
                  <td className="mono" style={{fontSize:12}}>{m.dur}</td>
                  <td><span className={`badge ${m.done?"b-qual":"b-review"}`}>{m.done?"Done":"Pending"}</span></td>
                  <td><button className="btn btn-o btn-sm">{m.done?"Rewatch":"Watch"}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab===1&&(
        <div className="card">
          <div className="card-header"><div className="card-title">Curated Reading List</div></div>
          <div className="card-body">
            {["Goodfellow et al. — Deep Learning (MIT Press, 2016)","Litjens et al. — Survey of Deep Learning in Medical Image Analysis","IEEE EMBS Guidelines for Clinical AI Research","Python for Data Science Handbook — VanderPlas"].map((r,i)=>(
              <div key={i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid var(--frost)",alignItems:"center"}}>
                <span style={{fontSize:20}}>📖</span>
                <span style={{fontSize:13,fontWeight:500,flex:1}}>{r}</span>
                <button className="btn btn-o btn-sm">IEEE Xplore →</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab===2&&(
        <div className="card">
          <div className="card-header"><div className="card-title">Weekly Assignment Submission</div></div>
          <div className="card-body">
            <div className="fg"><label className="flabel">Week Number</label>
              <select className="finput fselect" value={sub.week} onChange={e=>setSub({...sub,week:e.target.value})}>
                <option value="">Select week...</option>
                {[1,2,3,4,5,6,7,8].map(w=><option key={w}>Week {w}</option>)}
              </select>
            </div>
            <div className="fg"><label className="flabel">Notes / Summary</label>
              <textarea className="finput ftextarea" value={sub.note} onChange={e=>setSub({...sub,note:e.target.value})} placeholder="Describe what you completed this week..." />
            </div>
            <div className="fg"><label className="flabel">Upload File (PDF/ZIP)</label><input type="file" className="finput" style={{paddingTop:6}} /></div>
            <button className="btn btn-p" onClick={()=>pushToSheets("Assignments",{participantId:user.id,week:sub.week,note:sub.note,submittedAt:new Date().toISOString()})}>Submit → Google Sheets</button>
          </div>
        </div>
      )}
      {tab===3&&(
        <div className="card">
          <div className="card-header"><div className="card-title">Capstone Project Portal</div></div>
          <div className="card-body">
            <div className="alert alert-info">📌 The capstone project is the culminating deliverable of Phase III and foundation for Phase IV–VI research.</div>
            <div className="fg"><label className="flabel">Project Title</label><input className="finput" placeholder="e.g. Federated Learning for Multi-Site MRI Tumor Segmentation" /></div>
            <div className="fg"><label className="flabel">Abstract (max 250 words)</label><textarea className="finput ftextarea" style={{minHeight:100}} /></div>
            <div className="fg"><label className="flabel">GitHub Repository URL</label><input className="finput" placeholder="https://github.com/..." /></div>
            <div className="fg"><label className="flabel">Status</label>
              <select className="finput fselect"><option>Planning</option><option>In Progress</option><option>Review Ready</option><option>Submitted</option></select>
            </div>
            <button className="btn btn-p" onClick={()=>pushToSheets("Capstone",{participantId:user.id,submittedAt:new Date().toISOString()})}>Save & Push to Sheets</button>
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
  const { pushToSheets } = useContext(DataCtx);
  return (
    <div>
      <div className="g3 mb6">
        {COMPETITIONS.map(c=>(
          <div key={c.id} className="card">
            <div style={{padding:"14px 18px 0"}}><span className={`badge ${c.status==="Closing Soon"?"b-close":"b-open"}`}>{c.status}</span></div>
            <div className="card-body">
              <div style={{fontSize:32,marginBottom:8}}>{c.id==="C001"?"🧠":c.id==="C002"?"🏥":"🔬"}</div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{c.name}</div>
              <div className="txt-muted">Track: {c.track===1?"AI & ML":c.track===2?"Modeling":"Electronics"}</div>
              <div className="txt-muted" style={{marginBottom:12}}>Deadline: <span className="mono" style={{fontWeight:600,color:"var(--ink)"}}>{c.deadline}</span></div>
              <button className="btn btn-p btn-sm" onClick={()=>pushToSheets("CompetitionEnrollments",{participantId:user.id,competition:c.name,enrolledAt:new Date().toISOString()})}>Enroll & Track</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Submission Tracker</div></div>
        <div className="card-body" style={{padding:0}}>
          <table className="tbl">
            <thead><tr><th>Competition</th><th>Track</th><th>Deadline</th><th>Enrolled</th><th>Status</th></tr></thead>
            <tbody>{COMPETITIONS.map(c=>(
              <tr key={c.id}>
                <td style={{fontWeight:600}}>{c.name}</td>
                <td><TrackBadge track={c.track} label={c.track===1?"AI & ML":c.track===2?"Modeling":"Electronics"}/></td>
                <td className="mono" style={{fontSize:12}}>{c.deadline}</td>
                <td>{c.enrolled}</td>
                <td><span className={`badge ${c.status==="Closing Soon"?"b-close":"b-open"}`}>{c.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ResourceRequests({ user }) {
  const { pushToSheets } = useContext(DataCtx);
  const resources = [
    {id:"R1",name:"HPC / GPU Cluster Access",  desc:"NVIDIA A100 compute nodes",         icon:"🖥️", type:"Compute"},
    {id:"R2",name:"Lab Access (Wet Lab)",        desc:"Biomedical wet lab for hardware",    icon:"🔬", type:"Lab"},
    {id:"R3",name:"Arduino Mega 2560",           desc:"Microcontroller for prototypes",     icon:"⚡", type:"Hardware"},
    {id:"R4",name:"Raspberry Pi 4 (8GB)",        desc:"Edge computing for wearables",       icon:"🍓", type:"Hardware"},
    {id:"R5",name:"ECG/EEG Sensor Module",       desc:"AD8232 ECG + ADS1299 EEG board",    icon:"📡", type:"Sensor"},
    {id:"R6",name:"Overleaf Premium",            desc:"Full collaboration for IEEE writing",icon:"🌿", type:"Software"},
  ];
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Request Research Resources</div><div className="card-sub">All requests tracked in Google Sheets</div></div>
      <div className="card-body" style={{padding:0}}>
        {resources.map(r=>(
          <div key={r.id} style={{display:"flex",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid var(--frost)"}}>
            <span style={{fontSize:24,marginRight:14}}>{r.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}>{r.name}</div>
              <div className="txt-muted">{r.desc}</div>
            </div>
            <span className="tag" style={{marginRight:10}}>{r.type}</span>
            <button className="btn btn-p btn-sm" onClick={()=>pushToSheets("ResourceRequests",{participantId:user.id,resource:r.name,type:r.type,requestedAt:new Date().toISOString(),status:"Pending"})}>Request</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnrichmentCalendar({ user }) {
  const { pushToSheets } = useContext(DataCtx);
  return (
    <div>
      <div className="g4 mb6">
        {[{l:"Total Events",v:"12",icon:"📅"},{l:"Webinars",v:"8",icon:"🎙️"},{l:"Workshops",v:"4",icon:"🛠️"},{l:"Registered",v:"3",icon:"✅"}].map(s=>(
          <div key={s.l} className="stat"><div className="stat-icon">{s.icon}</div><div className="stat-val">{s.v}</div><div className="stat-label">{s.l}</div></div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">March 2026 — Enrichment Calendar</div></div>
        <div className="card-body" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {WEBINARS.map(w=>(
            <div key={w.id} className="event-box">
              <div className="edate"><div className="emon">{new Date(w.date).toLocaleString("en",{month:"short"})}</div><div className="eday">{new Date(w.date).getDate()}</div></div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600}}>{w.title}</div>
                <div className="txt-muted">{w.type} · {w.speaker} · {w.registered} registered</div>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <button className="btn btn-p btn-sm" onClick={()=>pushToSheets("CalendarRegistrations",{event:w.title,participantId:user.id})}>Register</button>
                  <button className="btn btn-o btn-sm">Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MENTOR VIEWS
// ─────────────────────────────────────────────
function MentorDashboard({ user }) {
  const { participants } = useContext(DataCtx);
  const myMentees = participants.filter(p=>user.mentees?.includes(p.id));
  return (
    <div>
      <div className="banner">
        <div>
          <div className="banner-chip">Mentor · IEEE E-JUST EMBS SBC</div>
          <div className="banner-title">Welcome, {(user.name||user.Name||user.email||"").split(" ").slice(0,2).join(" ")}</div>
          <div className="banner-sub">Track {user.track}: {user.specialty} · {user.mentees?.length||0} Mentees</div>
        </div>
        <div className="bstats">
          {[[(user.mentees?.length||0),"Mentees"],[user.meetings,"Meetings"],[user.papersReviewed,"Papers"]].map(([v,l])=>(
            <div key={l}><div className="bstat-val">{v}</div><div className="bstat-label">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="g4 mb6">
        <div className="stat"><div className="stat-icon">👥</div><div className="stat-val">{myMentees.length}</div><div className="stat-label">Active Mentees</div></div>
        <div className="stat blue"><div className="stat-icon">📊</div><div className="stat-val">{myMentees.length?`${Math.round(myMentees.reduce((a,b)=>a+((b.phase-1)/5*100),0)/myMentees.length)}%`:"—"}</div><div className="stat-label">Avg Progress</div></div>
        <div className="stat green"><div className="stat-icon">📝</div><div className="stat-val">{user.papersReviewed}</div><div className="stat-label">Drafts Reviewed</div></div>
        <div className="stat amber"><div className="stat-icon">📅</div><div className="stat-val">2</div><div className="stat-label">Meetings This Week</div></div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">My Mentees</div></div>
        <div className="card-body" style={{padding:0}}>
          <table className="tbl">
            <thead><tr><th>Name</th><th>Phase</th><th>Track</th><th>Progress</th><th>Novelty</th><th>Competition</th></tr></thead>
            <tbody>{myMentees.map(p=>(
              <tr key={p.id}>
                <td style={{fontWeight:600}}>{p.name}</td>
                <td><PhaseBadge phase={p.phase}/></td>
                <td><TrackBadge track={p.track} label={p.trackLabel}/></td>
                <td style={{minWidth:130}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}><PBar val={(p.phase-1)} max={5}/></div>
                    <span className="mono" style={{fontSize:11}}>{Math.round(((p.phase-1)/5)*100)}%</span>
                  </div>
                </td>
                <td>{p.noveltyVerified?<span className="badge b-qual">✓</span>:<span className="badge b-review">Pending</span>}</td>
                <td style={{fontSize:12}}>{p.competitionEnrolled||"—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MentorMentees({ user }) {
  const { participants } = useContext(DataCtx);
  const myMentees = participants.filter(p=>user.mentees?.includes(p.id));
  return (
    <div className="g2">
      {myMentees.map(p=>(
        <div key={p.id} className="card">
          <div className="card-body">
            <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
              <div className="sava" style={{width:48,height:48,fontSize:20}}>{p.avatar}</div>
              <div>
                <div style={{fontSize:15,fontWeight:700}}>{p.name}</div>
                <div className="txt-muted">{p.email}</div>
                <div style={{marginTop:4}}><TrackBadge track={p.track} label={p.trackLabel}/></div>
              </div>
            </div>
            {[["Phase",`P${p.phase}: ${PHASES[p.phase-1]?.name}`],["Status",p.status],["Nationality",p.nationality],["GPA",p.gpa?.toFixed(1)],["Portfolio",`${p.portfolioScore}/100`],["Interview",`${p.interviewScore}/100`]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",borderBottom:"1px solid var(--frost)"}}>
                <span className="txt-muted">{k}</span><span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
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
  const [loading, setLoading] = useState(true);
  const [debug, setDebug]     = useState({ step:"starting…" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const d = { step:"fetching…" };

      try {
        d.url = `${SHEETS_URL}?action=get&sheet=Applications`;
        d.step = "fetch started";

        const r = await fetch(d.url);
        d.httpStatus = r.status;
        d.step = "response received";

        const text = await r.text();
        d.rawLength = text.length;
        d.rawPreview = text.slice(0, 600);
        d.step = "text read";

        if (!text || text.length === 0) {
          d.step = "ERROR: empty response";
          setDebug({ ...d });
          setLoading(false);
          return;
        }

        // Check if it's HTML (redirect/error page) instead of JSON
        if (text.trim().startsWith("<")) {
          d.step = "ERROR: got HTML not JSON — proxy redirect or CORS issue";
          setDebug({ ...d });
          setLoading(false);
          return;
        }

        const json = JSON.parse(text);
        d.jsonStatus = json.status;
        d.jsonMessage = json.message || "";
        d.step = "JSON parsed";

        if (json.status === "ok" && Array.isArray(json.data)) {
          d.rowCount = json.data.length;
          d.firstRowKeys = json.data[0] ? Object.keys(json.data[0]).join(" | ") : "no rows";
          d.step = `SUCCESS: ${json.data.length} rows loaded`;
          setApps(json.data);
        } else {
          d.step = `Sheets returned: status=${json.status} message=${json.message}`;
        }
      } catch(e) {
        d.step = `EXCEPTION: ${e.message}`;
        d.stack = e.stack?.slice(0, 200);
      }

      setDebug({ ...d });
      setLoading(false);
    })();
  }, []);

  const isSuccess = debug.step?.startsWith("SUCCESS");

  return (
    <div>
      {/* Banner */}
      <div className="banner" style={{marginBottom:20}}>
        <div>
          <div className="banner-chip">Super Admin · IEEE E-JUST EMBS SBC · Ri-Sō 2026</div>
          <div className="banner-title">Program Control Center</div>
          <div className="banner-sub">{loading ? "Connecting to Google Sheets…" : `${apps.length} applications loaded`}</div>
        </div>
        <div className="bstats">
          <div className="bstat"><div className="bstat-val">{loading ? "…" : apps.length}</div><div className="bstat-label">Applications</div></div>
          <div className="bstat"><div className="bstat-val">{syncStatus}</div><div className="bstat-label">Sheets Status</div></div>
        </div>
      </div>

      {/* ALWAYS-VISIBLE DEBUG PANEL */}
      <div style={{background:"#0F172A",color:"#E2E8F0",borderRadius:14,padding:20,marginBottom:24,fontFamily:"monospace",fontSize:12,lineHeight:2}}>
        <div style={{color:"#FACC15",fontWeight:700,fontSize:13,marginBottom:12}}>
          🔧 Connection Debug Panel
          <span style={{marginLeft:12,fontSize:10,color:"#94A3B8",fontFamily:"sans-serif",fontWeight:400}}>
            (shows what the API actually returns — remove once working)
          </span>
        </div>

        <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>Status:</span>
          <span style={{color: isSuccess ? "#86EFAC" : debug.step?.startsWith("ERROR") || debug.step?.startsWith("EXCEPTION") ? "#F87171" : "#FCD34D", fontWeight:700}}>
            {debug.step || "—"}
          </span>
        </div>

        {debug.url && <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>URL called:</span><span style={{color:"#CBD5E1"}}>{debug.url}</span></div>}
        {debug.httpStatus !== undefined && <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>HTTP status:</span><span style={{color: debug.httpStatus===200?"#86EFAC":"#F87171"}}>{debug.httpStatus}</span></div>}
        {debug.rawLength !== undefined && <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>Response length:</span><span>{debug.rawLength} chars</span></div>}
        {debug.jsonStatus && <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>JSON status field:</span><span style={{color: debug.jsonStatus==="ok"?"#86EFAC":"#F87171"}}>{debug.jsonStatus}</span></div>}
        {debug.jsonMessage && <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>JSON message:</span><span style={{color:"#F87171"}}>{debug.jsonMessage}</span></div>}
        {debug.rowCount !== undefined && <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>Rows found:</span><span style={{color:"#86EFAC",fontWeight:700}}>{debug.rowCount}</span></div>}
        {debug.firstRowKeys && <div><span style={{color:"#94A3B8",minWidth:180,display:"inline-block"}}>Column headers:</span><span style={{color:"#86EFAC"}}>{debug.firstRowKeys}</span></div>}

        {debug.rawPreview && (
          <div style={{marginTop:12}}>
            <div style={{color:"#94A3B8",marginBottom:4}}>Raw response preview:</div>
            <div style={{background:"#1E293B",padding:"10px 14px",borderRadius:8,color:"#CBD5E1",wordBreak:"break-all",maxHeight:120,overflowY:"auto",fontSize:11,lineHeight:1.6}}>
              {debug.rawPreview}
            </div>
          </div>
        )}

        {!isSuccess && (
          <div style={{marginTop:14,padding:"12px 14px",background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.3)",borderRadius:8,color:"#FCA5A5",fontSize:11,lineHeight:2,fontFamily:"sans-serif"}}>
            <b style={{color:"#F87171"}}>Common fixes:</b><br/>
            1. Sheet must be named exactly <b>"Applications"</b> (capital A, no spaces)<br/>
            2. Your Vite proxy rewrites <code>/sheets-api</code> → the Apps Script URL — make sure <code>npm run dev</code> is running<br/>
            3. Apps Script must be deployed as <b>"Anyone"</b> can access (not "Anyone with Google account")<br/>
            4. After any script change, you must <b>create a new deployment</b> (not just save)
          </div>
        )}
      </div>

      {/* Data display — only if loaded */}
      {!loading && apps.length > 0 && (
        <>
          <div className="g4 mb6">
            {[
              [apps.length, "Total Applications","👥",""],
              [apps.filter(a=>!a["Reviewed"]).length,"Pending Review","⏳","amber"],
              [apps.filter(a=>a["Status"]?.includes("Qualif")).length,"Qualified","✅","green"],
              [apps.filter(a=>a["Status"]?.includes("Reject")).length,"Rejected","",""],
            ].map(([v,l,icon,c])=>(
              <div key={l} className={`stat ${c}`}>
                <div className="stat-icon">{icon}</div>
                <div className="stat-val">{v}</div>
                <div className="stat-label">{l}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div><div className="card-title">📥 Applications — Live from Sheets</div><div className="card-sub">{apps.length} total</div></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div className="sync-dot"/><span className="sync-txt">Sheets Live</span>
              </div>
            </div>
            <div className="card-body" style={{padding:0}}>
              <table className="tbl">
                <thead><tr><th>Name</th><th>University</th><th>GPA</th><th>Year</th><th>Track</th><th>Status</th></tr></thead>
                <tbody>{apps.slice(0,30).map((a,i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{a["Name"]||"—"}</td>
                    <td style={{fontSize:12,color:"var(--ink3)"}}>{(a["University"]||"—").slice(0,30)}</td>
                    <td className="mono">{a["GPA"]||"—"}</td>
                    <td style={{fontSize:12}}>{a["Academic Year"]||"—"}</td>
                    <td style={{fontSize:11,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(a["Target Track"]||"—").split(",")[0]}</td>
                    <td><span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:"#FEF3C7",color:"#92400E"}}>{a["Status"]||"Pending"}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
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

  // Programming
  const { progLevel, hasAdvancedLibs, hasIntermediateLibs } = parseTechLevel(
    (app["Programming Skill"] || "") + " " + (app["Math/Stats Skill"] || "")
  );
  let programming = 0;
  if (progLevel === "advanced" || progLevel === "expert" || hasAdvancedLibs) programming = 15;
  else if (progLevel === "intermediate" || hasIntermediateLibs) programming = 11;
  else if (progLevel === "beginner") programming = 6;
  else programming = 2;

  // Math
  const { mathLevel } = parseTechLevel(app["Math/Stats Skill"] || "");
  let math = 0;
  if (mathLevel === "advanced") math = 10;
  else if (mathLevel === "intermediate") math = 7;
  else if (mathLevel === "basic") math = 4;
  else math = 1;

  return { academic, programming, math, problem_solving: 10, methodology: 10, goals: 5, motivation: 5 };
}

// ── GROQ API helper (FREE - 90 req/min, perfect for production) ────────
// Get your FREE key at: https://console.groq.com/keys (no credit card needed)
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY; // ← Get free key at console.groq.com/keys, paste here

async function callGroq(prompt) {
  if (!GROQ_KEY) return null;
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
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1400
      })
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.choices?.[0]?.message?.content || "";
  return text.replace(/```json[\s\S]*?```|```/g, (m) => m.startsWith("```json") ? m.slice(7,-3).trim() : "").trim() || text.trim();
}

function ApplicantCard({ app, adminName, adminEmail, existingDecision, allReviews, onDecision }) {
  const { pushToSheets, showToast } = useContext(DataCtx);
  const auto = autoScore(app);
  const [scores, setScores]       = useState(existingDecision?.scores ? (() => { try { return JSON.parse(existingDecision.scores); } catch { return auto; } })() : auto);
  const [decision, setDecision]   = useState(existingDecision?.decision || "");
  const [adminNote, setAdminNote] = useState(existingDecision?.note || "");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [essayOpen, setEssayOpen] = useState(false);
  const [activeRubric, setActiveRubric] = useState(null);
  const [cvOpen, setCvOpen]       = useState(false);
  const [usePortfolioInAI, setUsePortfolioInAI] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(!!existingDecision?.decision);
  const [saveError, setSaveError] = useState("");
  const [showAllReviews, setShowAllReviews] = useState(false);

  const total = CRITERIA.reduce((sum, c) => sum + Math.min(scores[c.id]||0, c.weight), 0);
  const setScore = (id, val) => {
    const c = CRITERIA.find(x => x.id === id);
    setScores(s => ({ ...s, [id]: Math.min(c.weight, Math.max(0, val)) }));
    setSaved(false);
  };

  // Parse essays into Q1/Q2/Q3 sections
  const fullEssay = app["Research Motivation"] || "";
  const ps   = fullEssay.match(/Problem\s*Solving[:\-\s]*([\s\S]*?)(?=Methodology\s*[:\-\s]*|Goal\s*[:\-\s]*|$)/i);
  const meth = fullEssay.match(/Methodology[:\-\s]*([\s\S]*?)(?=Goal\s*[:\-\s]*|Problem\s*Solving\s*[:\-\s]*|$)/i);
  const goal = fullEssay.match(/Goal\s*[:\-\s]*([\s\S]*?)(?=Methodology\s*[:\-\s]*|Problem\s*Solving\s*[:\-\s]*|$)/i);
  const essaySections = [
    ps   && { label:"🧩 Q1 — Problem Solving", text: ps[1].trim() },
    meth && { label:"🔬 Q2 — Methodology",      text: meth[1].trim() },
    goal && { label:"🚀 Q3 — Goals",             text: goal[1].trim() },
  ].filter(Boolean);
  if (!essaySections.length && fullEssay) essaySections.push({ label:"📝 Essays", text: fullEssay });

  // CV embed
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
        ? `PORTFOLIO (DO NOT ASSUME YOU CAN OPEN LINKS. Only use the provided text if present):
LinkedIn URL: ${linkedinUrl || "Not provided"}
LinkedIn Text: ${linkedinText ? trunc(linkedinText, 1800) : "Not provided"}
CV URL: ${cvUrl || "Not provided"}
CV Text: ${cvText ? trunc(cvText, 3500) : "Not provided"}`
        : `PORTFOLIO: Not included in this evaluation.`;
      const essayFull = trunc(fullEssay, 6500);

      const prompt = `You are a senior researcher on the Ri-Sō IEEE EMBS SBC Research Program 2026 selection committee — competitive biomedical engineering program at E-JUST, targeting IEEE publication.

APPLICANT:
Name: ${app["Name"]} | University: ${app["University"]}
Faculty: ${app["Faculty"]} / Dept: ${app["Department"]}
Year: ${app["Academic Year"]} | GPA: ${app["GPA"]}
Tracks: ${app["Target Track"]}
Programming: ${app["Programming Skill"]}
Math/Stats: ${app["Math/Stats Skill"]}

${portfolioBlock}

ESSAYS:
Q1 - Problem Solving: ${ps?.[1]?.trim()||"Not provided"}
Q2 - Methodology (ECG/stroke): ${meth?.[1]?.trim()||"Not provided"}
Q3 - Goals (12-18 months): ${goal?.[1]?.trim()||"Not provided"}

ESSAYS FULL TEXT (for evidence only; do not hallucinate missing portfolio content):
${essayFull || "Not provided"}

Return ONLY valid JSON (absolutely no markdown, no text outside the JSON object):
{
  "scores": {"academic": <0-15>, "programming": <0-15>, "math": <0-10>, "problem_solving": <0-20>, "methodology": <0-20>, "goals": <0-10>, "motivation": <0-10>},
  "totalScore": <0-100>,
  "recommendation": "Accept"|"Waitlist"|"Reject",
  "confidence": "High"|"Medium"|"Low",
  "strengths": ["s1","s2","s3","s4","s5"],
  "weaknesses": ["w1","w2","w3"],
  "evidenceBullets": ["Evidence 1 (from the provided text)","Evidence 2","Evidence 3","Evidence 4","Evidence 5"],
  "portfolioAssessment": "2 sentences: summarize only what is verifiable from CV/LinkedIn text (or explicitly state that only links were provided and full text is missing)",
  "essayQ1": "2 sentences on Q1 quality (specific challenge, method, outcome)",
  "essayQ2": "2 sentences on Q2 methodology depth (data -> model -> validation, domain awareness)",
  "essayQ3": "1-2 sentences on goal alignment (12-18 months, deliverables, publication logic)",
  "trackFit": "1 sentence on track suitability (maps evidence to track needs)",
  "motivationRationale": "2-3 sentences linking biomedical motivation + track rationale + portfolio evidence (or explicitly state missing portfolio text)",
  "admissionNote": "2 sentences final recommendation"
}
Be rigorous — this is competitive.`;

      const text = await callGroq(prompt);
      const parsed = JSON.parse(text);
      setAiFeedback(parsed);
      if (parsed.scores) { setScores(parsed.scores); setSaved(false); }
    } catch(e) { setAiFeedback({ error: `Groq error: ${e.message}` }); }
    setAiLoading(false);
  };

  // Save decision to Reviews sheet (NEW APPROACH)
  const handleSave = async (dec) => {
    const finalDec = dec || decision;
    if (!finalDec) return;
    setSaving(true);
    setSaveError("");
    
    try {
      const reviewId = existingDecision?.reviewId || `R${Date.now()}`;
      
      const reviewData = {
        reviewId: reviewId,
        applicationEmail: app["Email"],
        applicantName: app["Name"],
        reviewerEmail: adminEmail,
        reviewerName: adminName,
        decision: finalDec,
        score: total,
        scores: JSON.stringify(scores),
        note: adminNote,
        aiRecommendation: aiFeedback?.recommendation || "",
        reviewedAt: new Date().toISOString()
      };
      
      // If this is an update to existing review, use updateByMatch
      // Otherwise, push new review
      let result;
      if (existingDecision?.reviewId) {
        result = await sheetsAPI.update("Reviews", reviewId, reviewData);
      } else {
        result = await pushToSheets("Reviews", reviewData);
      }
      
      // Also update the Applications sheet with summary info
      await sheetsAPI.updateByMatch("Applications", "Email", app["Email"], {
        "Status": `Phase II: ${finalDec}`,
        "LastReviewedBy": adminName,
        "LastReviewedAt": new Date().toISOString(),
        "ReviewCount": (allReviews?.length || 0) + (existingDecision ? 0 : 1)
      });
      
      setDecision(finalDec);
      setSaved(true);
      onDecision(app["Email"], finalDec, total);
      showToast(`✓ Review saved to Reviews sheet`);
      
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

      {/* Info strip */}
      <div style={{padding:"12px 20px",background:"linear-gradient(135deg,rgba(91,59,245,.03),rgba(26,109,255,.02))",borderBottom:"1px solid var(--frost)",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center",fontSize:12}}>
          <span><b style={{color:"var(--ink3)"}}>✉</b> {app["Email"]}</span>
          <span><b style={{color:"var(--ink3)"}}>📱</b> {app["Phone"]||"—"}</span>
          <span><b style={{color:"var(--ink3)"}}>🏫</b> {app["Faculty"]} · {app["Department"]}</span>
          <span><b style={{color:"var(--ink3)"}}>🗓</b> {app["Timestamp"] ? new Date(app["Timestamp"]).toLocaleDateString() : "—"}</span>
          {app["Gender"] && <span><b style={{color:"var(--ink3)"}}>👤</b> {app["Gender"]}</span>}
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
            <a href={cvUrl} target="_blank" rel="noreferrer" style={{padding:"6px 10px",background:"var(--snow)",color:"var(--ink2)",border:"1px solid var(--frost)",borderRadius:7,fontSize:11,fontWeight:700,textDecoration:"none"}}>↗</a>
          </>}
        </div>
      </div>

      {/* All Reviews Panel */}
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
              const revDate = rev["reviewedAt"] || rev["ReviewedAt"];
              const isCurrentAdmin = revEmail?.toLowerCase() === adminEmail?.toLowerCase();
              
              return (
                <div key={idx} style={{
                  padding:12,
                  background:"white",
                  borderRadius:8,
                  border: isCurrentAdmin ? "2px solid var(--violet)" : "1px solid var(--frost)",
                  position:"relative"
                }}>
                  {isCurrentAdmin && (
                    <div style={{position:"absolute",top:-8,right:12,background:"var(--violet)",color:"white",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10}}>
                      YOUR REVIEW
                    </div>
                  )}
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
                  {revNote && (
                    <div style={{fontSize:11,color:"var(--ink2)",padding:"8px 10px",background:"var(--snow)",borderRadius:6,marginTop:8,lineHeight:1.6,fontStyle:"italic"}}>
                      "{revNote}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CV Embed */}
      {cvOpen && (
        <div style={{borderBottom:"1px solid var(--frost)",background:"#f8f9ff"}}>
          {cvEmbed ? (
            <iframe src={cvEmbed} style={{width:"100%",height:600,border:"none",display:"block"}} title="CV Preview"/>
          ) : (
            <div style={{padding:20,textAlign:"center",color:"var(--ink3)"}}>
              <a href={cvUrl} target="_blank" rel="noreferrer" style={{color:"var(--violet)",fontWeight:700}}>Open CV in new tab →</a>
            </div>
          )}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 390px",minHeight:480}}>

        {/* ── LEFT: Profile + Essays + Groq ── */}
        <div style={{padding:"18px 20px",borderRight:"1px solid var(--frost)",overflowY:"auto"}}>

          {/* Chips */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            <span style={{padding:"4px 10px",background:"#EDE9FE",color:"#5B21B6",borderRadius:20,fontSize:11,fontWeight:700}}>GPA {app["GPA"]}</span>
            <span style={{padding:"4px 10px",background:"#DBEAFE",color:"#1E40AF",borderRadius:20,fontSize:11,fontWeight:700}}>{app["Academic Year"]}</span>
            <span style={{padding:"4px 10px",background:"#F0FDF4",color:"#166534",borderRadius:20,fontSize:11,fontWeight:600,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{app["University"]}</span>
          </div>

          {/* Tracks */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Target Tracks</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {(app["Target Track"]||"").split(",").map(t=>(
                <span key={t} style={{padding:"3px 9px",background:"rgba(91,59,245,.07)",color:"var(--violet)",borderRadius:20,fontSize:10,fontWeight:700,border:"1px solid rgba(91,59,245,.12)"}}>{t.trim()}</span>
              ))}
            </div>
          </div>

          {/* Tech */}
          <div style={{marginBottom:12,padding:10,background:"var(--snow)",borderRadius:10,border:"1px solid var(--frost)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{background:"white",padding:"8px 10px",borderRadius:7,border:"1px solid var(--frost)"}}>
              <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",marginBottom:2}}>Programming</div>
              <div style={{fontSize:11,fontWeight:600,lineHeight:1.4}}>{app["Programming Skill"]||"—"}</div>
            </div>
            <div style={{background:"white",padding:"8px 10px",borderRadius:7,border:"1px solid var(--frost)"}}>
              <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",marginBottom:2}}>Math / Stats</div>
              <div style={{fontSize:11,fontWeight:600,lineHeight:1.4}}>{app["Math/Stats Skill"]||"—"}</div>
            </div>
          </div>

          {/* Essays */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Application Essays</div>
            {essaySections.map((sec,i)=>(
              <div key={i} style={{marginBottom:6,border:"1px solid var(--frost)",borderRadius:9,overflow:"hidden"}}>
                <div style={{padding:"8px 12px",background:"var(--snow)",fontSize:11,fontWeight:700,color:"var(--ink2)",display:"flex",justifyContent:"space-between",cursor:"pointer",userSelect:"none"}}
                  onClick={()=>setEssayOpen(o=>o===i?false:i)}>
                  {sec.label} <span style={{color:"var(--mist)"}}>{essayOpen===i?"▲":"▼"}</span>
                </div>
                {essayOpen===i && (
                  <div style={{padding:"10px 12px",fontSize:12,color:"var(--ink2)",lineHeight:1.8,maxHeight:220,overflowY:"auto",whiteSpace:"pre-wrap",background:"white"}}>
                    {sec.text}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Groq button */}
          <div style={{marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:11,fontWeight:700,color:"var(--ink2)"}}>
              <input
                type="checkbox"
                checked={usePortfolioInAI}
                onChange={(e)=>setUsePortfolioInAI(!!e.target.checked)}
              />
              Include CV/LinkedIn in AI prompt
            </label>
            <div style={{fontSize:10,color:"var(--ink3)",maxWidth:340,lineHeight:1.4}}>
              Uses provided links/text only. The AI cannot open documents from URLs.
            </div>
          </div>
          <button onClick={runAI} disabled={aiLoading}
            style={{width:"100%",padding:"10px",background:aiFeedback&&!aiFeedback.error?"#ECFDF5":"linear-gradient(135deg,#4285F4,#34A853)",color:aiFeedback&&!aiFeedback.error?"#065F46":"white",border:aiFeedback&&!aiFeedback.error?"1.5px solid #A7F3D0":"none",borderRadius:9,fontSize:12,fontWeight:700,cursor:aiLoading?"not-allowed":"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:7,opacity:aiLoading?0.75:1}}>
            {aiLoading
              ? <><span style={{width:12,height:12,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/> Groq analyzing…</>
              : !GROQ_KEY ? "⚙ Set GROQ_KEY to enable AI"
              : aiFeedback&&!aiFeedback.error ? "✓ Groq Done — Re-run" : "✨ Run Groq AI Analysis"}
          </button>

          {/* AI Results */}
          {aiFeedback&&!aiFeedback.error && (
            <div style={{border:"1px solid #A7F3D0",borderRadius:10,overflow:"hidden",fontSize:12}}>
              <div style={{padding:"9px 12px",background:"#ECFDF5",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:700,fontSize:10,color:"#065F46",textTransform:"uppercase",letterSpacing:.4}}>✦ Groq Evaluation</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontSize:9,color:"var(--ink3)"}}>Confidence: <b>{aiFeedback.confidence}</b></span>
                  <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:800,background:db(aiFeedback.recommendation),color:dc(aiFeedback.recommendation)}}>{aiFeedback.recommendation}</span>
                </div>
              </div>
              <div style={{padding:12,background:"white",display:"flex",flexDirection:"column",gap:8}}>
                {aiFeedback.strengths?.length>0 && <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#065F46",textTransform:"uppercase",marginBottom:3}}>✓ Strengths</div>
                  {aiFeedback.strengths.map((s,i)=><div key={i} style={{fontSize:11,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}>• {s}</div>)}
                </div>}
                {aiFeedback.weaknesses?.length>0 && <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#991B1B",textTransform:"uppercase",marginBottom:3}}>✗ Gaps</div>
                  {aiFeedback.weaknesses.map((w,i)=><div key={i} style={{fontSize:11,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}>• {w}</div>)}
                </div>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[["🧩 Q1",aiFeedback.essayQ1],["🔬 Q2",aiFeedback.essayQ2],["🚀 Q3",aiFeedback.essayQ3],["🎯 Fit",aiFeedback.trackFit]].filter(([,v])=>v).map(([l,v])=>(
                    <div key={l} style={{padding:"7px 9px",background:"var(--snow)",borderRadius:7,border:"1px solid var(--frost)"}}>
                      <div style={{fontSize:8,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",marginBottom:2}}>{l}</div>
                      <div style={{fontSize:10,lineHeight:1.5,color:"var(--ink2)"}}>{v}</div>
                    </div>
                  ))}
                </div>
                {aiFeedback.portfolioAssessment && (
                  <div style={{padding:"9px 10px",background:"rgba(91,59,245,.04)",borderRadius:7,border:"1px solid rgba(91,59,245,.1)",fontSize:11,fontStyle:"italic",color:"var(--ink2)",lineHeight:1.6}}>
                    📎 {aiFeedback.portfolioAssessment}
                  </div>
                )}
                {aiFeedback.evidenceBullets?.length>0 && (
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:"var(--violet)",textTransform:"uppercase",marginBottom:3}}>Evidence (verifiable)</div>
                    {aiFeedback.evidenceBullets.map((e,i)=>(
                      <div key={i} style={{fontSize:11,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}>• {e}</div>
                    ))}
                  </div>
                )}
                {aiFeedback.admissionNote && (
                  <div style={{padding:"9px 10px",background:"rgba(91,59,245,.04)",borderRadius:7,border:"1px solid rgba(91,59,245,.1)",fontSize:11,fontStyle:"italic",color:"var(--ink2)",lineHeight:1.6}}>
                    📋 {aiFeedback.admissionNote}
                  </div>
                )}
              </div>
            </div>
          )}
          {aiFeedback?.error && (
            <div style={{padding:10,background:"#FEF2F2",color:"#DC2626",borderRadius:8,fontSize:11,lineHeight:1.6}}>
              {aiFeedback.error}
              {!GROQ_KEY && <div style={{marginTop:6,padding:"6px 8px",background:"white",borderRadius:5,fontSize:10}}>Get free key → <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{color:"#4285F4",fontWeight:700}}>console.groq.com/keys</a></div>}
            </div>
          )}
        </div>

        {/* ── RIGHT: Scorecard + Decision ── */}
        <div style={{padding:"16px 16px",background:"var(--snow)",display:"flex",flexDirection:"column",overflowY:"auto"}}>

          <div style={{marginBottom:10,padding:"6px 10px",background:"rgba(91,59,245,.07)",borderRadius:7,fontSize:11,color:"var(--violet)",fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
            👤 {adminName}
            {saved && <span style={{marginLeft:"auto",color:"var(--jade)",fontSize:10,fontWeight:700}}>✓ Saved to Reviews</span>}
            {!saved && decision && <span style={{marginLeft:"auto",color:"var(--amber)",fontSize:10}}>● Unsaved changes</span>}
          </div>

          <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Scorecard</div>

          {CRITERIA.map(c=>{
            const pct=(scores[c.id]||0)/c.weight;
            const bar=pct>=0.7?"linear-gradient(90deg,#0F9F6E,#059669)":pct>=0.4?"linear-gradient(90deg,#E8860A,#F59E0B)":"linear-gradient(90deg,#E53E5C,#F87171)";
            const active=activeRubric===c.id;
            return (
              <div key={c.id} style={{marginBottom:8,padding:"9px 10px",background:"white",borderRadius:9,border:`1.5px solid ${active?"var(--violet)":"var(--frost)"}`,transition:"border .15s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{cursor:"pointer",flex:1}} onClick={()=>setActiveRubric(active?null:c.id)}>
                    <span style={{fontWeight:700,fontSize:11}}>{c.icon} {c.label}</span>
                    <span style={{fontSize:9,color:"var(--ink3)",marginLeft:3}}>/{c.weight}</span>
                    <span style={{fontSize:8,color:"var(--violet)",marginLeft:5}}>{active?"▲":"▼"}</span>
                  </div>
                  <input type="number" min={0} max={c.weight} value={scores[c.id]||0}
                    onChange={e=>setScore(c.id,parseInt(e.target.value)||0)}
                    style={{width:38,padding:"2px 4px",border:`1px solid ${active?"var(--violet)":"var(--frost)"}`,borderRadius:5,fontSize:12,fontWeight:800,textAlign:"center",color:"var(--violet)",background:"white",outline:"none"}}/>
                </div>
                <div style={{height:5,background:"var(--frost)",borderRadius:3,overflow:"hidden",cursor:"pointer",marginBottom:3}}
                  onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setScore(c.id,Math.round((e.clientX-r.left)/r.width*c.weight));}}>
                  <div style={{height:"100%",width:`${pct*100}%`,background:bar,borderRadius:3,transition:"width .15s"}}/>
                </div>
                <div style={{display:"flex",gap:2}}>
                  {c.rubric.map(r=>(
                    <button key={r.pts} onClick={()=>setScore(c.id,r.pts)}
                      style={{flex:1,fontSize:7,padding:"2px 1px",borderRadius:3,border:"1px solid",borderColor:scores[c.id]===r.pts?"var(--violet)":"var(--frost)",background:scores[c.id]===r.pts?"rgba(91,59,245,.1)":"white",color:scores[c.id]===r.pts?"var(--violet)":"var(--ink3)",cursor:"pointer",fontWeight:scores[c.id]===r.pts?700:400,lineHeight:1.3,textAlign:"center"}}>
                      {r.pts}<br/><span style={{fontSize:6}}>{r.label}</span>
                    </button>
                  ))}
                </div>
                {active && (
                  <div style={{marginTop:6,fontSize:10,borderTop:"1px solid var(--frost)",paddingTop:5}}>
                    {c.rubric.map(r=>(
                      <div key={r.pts} style={{display:"flex",gap:6,padding:"2px 0",borderBottom:"1px solid var(--frost)"}}>
                        <b style={{minWidth:18,color:r.pts===c.weight?"#065F46":r.pts>=c.weight*.66?"#0369A1":r.pts>=c.weight*.33?"#92400E":"#991B1B",fontSize:9}}>{r.pts}</b>
                        <span style={{fontSize:9,color:"var(--ink2)"}}><b>{r.label}:</b> {r.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Total */}
          <div style={{padding:"10px 12px",borderRadius:9,background:total>=75?db("Accept"):total>=50?db("Waitlist"):db("Reject"),border:`1px solid ${total>=75?dd("Accept"):total>=50?dd("Waitlist"):dd("Reject")}`,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:700,fontSize:12}}>Total Score</span>
              <span style={{fontFamily:"Fraunces,serif",fontSize:26,fontWeight:900,color:total>=75?dc("Accept"):total>=50?dc("Waitlist"):dc("Reject")}}>{total}<span style={{fontSize:11,fontWeight:400,color:"var(--ink3)"}}>/100</span></span>
            </div>
            <div style={{height:4,background:"rgba(0,0,0,.07)",borderRadius:2,overflow:"hidden",marginTop:5}}>
              <div style={{height:"100%",width:`${total}%`,background:total>=75?"linear-gradient(90deg,#0F9F6E,#059669)":total>=50?"linear-gradient(90deg,#E8860A,#F59E0B)":"linear-gradient(90deg,#E53E5C,#F87171)",borderRadius:2,transition:"width .3s"}}/>
            </div>
          </div>

          {/* Note */}
          <textarea value={adminNote} onChange={e=>{setAdminNote(e.target.value);setSaved(false);}}
            placeholder="Your review notes…"
            style={{width:"100%",padding:"8px 10px",border:"1.5px solid var(--frost)",borderRadius:8,fontSize:11,fontFamily:"'DM Sans',sans-serif",resize:"vertical",minHeight:48,outline:"none",marginBottom:8,background:"white",lineHeight:1.5}}/>

          {/* Decisions — always re-editable */}
          <div style={{fontSize:9,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>
            {decision ? `Decision: ${decision} · click to change` : "Make Decision"}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
            {[["✓ Accept","Accepted"],["◐ Waitlist","Waitlisted"],["✗ Reject","Rejected"]].map(([label,val])=>(
              <button key={val} onClick={()=>handleSave(val)} disabled={saving}
                style={{padding:"9px 4px",background:decision===val?db(val):"white",color:decision===val?dc(val):"var(--ink3)",border:`1.5px solid ${decision===val?dd(val):"var(--frost)"}`,borderRadius:8,fontSize:11,fontWeight:decision===val?800:600,cursor:"pointer",lineHeight:1.3,transition:"all .15s",opacity:saving?0.5:1}}>
                {label}
              </button>
            ))}
          </div>

          {saving && <div style={{textAlign:"center",fontSize:11,color:"var(--ink3)",padding:6}}>💾 Saving to Reviews sheet…</div>}
          {saved&&!saving && (
            <div style={{padding:"7px 10px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:7,fontSize:11,fontWeight:700,color:"#065F46",textAlign:"center"}}>
              ✓ Saved to Reviews sheet
            </div>
          )}
          {saveError && !saving && (
            <div style={{marginTop:6,padding:"7px 10px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:7,fontSize:11,fontWeight:700,color:"#991B1B",textAlign:"center"}}>
              {saveError}
            </div>
          )}
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
                <div style={{fontSize:11,color:"var(--ink3)",marginTop:1}}>{app["University"]} · GPA {app["GPA"]} · {app["Academic Year"]}</div>
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
// ─────────────────────────────────────────────
function ProfileView({ user }) {
  const { updateUser, pushToSheets } = useContext(DataCtx);
  const [form, setForm] = useState({...user});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = () => { updateUser(user.id, form); pushToSheets("ProfileUpdates",{id:user.id,updatedAt:new Date().toISOString()}); };
  return (
    <div className="g2">
      <div className="card">
        <div className="card-header"><div className="card-title">My Profile</div></div>
        <div className="card-body">
          <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:24,padding:16,background:"var(--snow)",borderRadius:12}}>
            <Avatar user={user}/>
            <div>
              <div style={{fontWeight:700,fontSize:16}}>{user.name}</div>
              <div className="txt-muted">{user.email}</div>
              <span className={`pill-role pill-${user.role}`} style={{display:"inline-block",marginTop:6}}>{user.role}</span>
            </div>
          </div>
          <div className="fg"><label className="flabel">Full Name</label><input className="finput" value={form.name||""} onChange={e=>set("name",e.target.value)}/></div>
          <div className="fg"><label className="flabel">Email</label><input className="finput" value={form.email||""} onChange={e=>set("email",e.target.value)}/></div>
          <div className="fg"><label className="flabel">New Password (leave blank to keep current)</label><input className="finput" type="password" placeholder="New password..." onChange={e=>e.target.value&&set("password",e.target.value)}/></div>
          {user.role===ROLES.PARTICIPANT&&(
            <div className="fg"><label className="flabel">Nationality</label><input className="finput" value={form.nationality||""} onChange={e=>set("nationality",e.target.value)}/></div>
          )}
          <button className="btn btn-p" onClick={save}>Save Changes → Google Sheets</button>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Account Info</div></div>
        <div className="card-body">
          {user.role===ROLES.PARTICIPANT&&[
            ["User ID",user.id],["Phase",`P${user.phase}: ${PHASES[user.phase-1]?.name}`],["Track",user.trackLabel||"Unassigned"],
            ["Status",user.status],["GPA",user.gpa?.toFixed(1)],["Portfolio",`${user.portfolioScore}/100`],
            ["Interview",`${user.interviewScore}/100`],["Nationality",user.nationality],
            ["Novelty Verified",user.noveltyVerified?"Yes ✅":"No ⏳"],["Competition",user.competitionEnrolled||"None"],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--frost)",fontSize:13}}>
              <span className="txt-muted">{k}</span><span style={{fontWeight:600}}>{v}</span>
            </div>
          ))}
          {user.role===ROLES.MENTOR&&[
            ["User ID",user.id],["Specialty",user.specialty],["Track",user.track],["Mentees",user.mentees?.join(", ")||"None"],["Meetings",user.meetings],["Papers Reviewed",user.papersReviewed],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--frost)",fontSize:13}}>
              <span className="txt-muted">{k}</span><span style={{fontWeight:600}}>{v}</span>
            </div>
          ))}
          {user.role===ROLES.SUPERADMIN&&<div className="alert alert-success">You have full administrative access to all program data.</div>}
        </div>
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

  // Safe accessors — handles both "name" and "Name" from Sheets, and missing fields
  const userName = user?.name || user?.Name || user?.email || "User";
  const userRole = (user?.role || user?.Role || "").toLowerCase().trim();
  const userFirstName = userName.split(" ")[0];
  const userInitials = userName.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase() || "U";

  const navConfig = {
    [ROLES.PARTICIPANT]: [
      { id:"dashboard", icon:"🏠", label:"Dashboard" },
      { id:"progress",  icon:"📊", label:"My Progress" },
      { id:"training",  icon:"📚", label:"Training Modules", badge:"3" },
      { id:"research",  icon:"🔬", label:"Research Hub" },
      { id:"novelty",   icon:"💡", label:"Novelty Tool" },
      { id:"competitions",icon:"🏆",label:"Competitions" },
      { id:"resources", icon:"⚙️", label:"Request Resources" },
      { id:"calendar",  icon:"📅", label:"Enrichment Calendar" },
      { id:"profile",   icon:"👤", label:"My Profile" },
    ],
    [ROLES.MENTOR]: [
      { id:"dashboard", icon:"🏠", label:"Dashboard" },
      { id:"mentees",   icon:"👥", label:"My Mentees" },
      { id:"meetings",  icon:"📅", label:"Meeting Scheduler" },
      { id:"review",    icon:"📝", label:"Paper Review", badge:"2" },
      { id:"progress",  icon:"📊", label:"Progress Tracking" },
      { id:"profile",   icon:"👤", label:"My Profile" },
    ],
    [ROLES.SUPERADMIN]: [
      { id:"dashboard",    icon:"🏠", label:"Dashboard" },
      { id:"users",        icon:"👥", label:"User Management" },
      { id:"filtration",   icon:"🔍", label:"Filtration Center" },
      { id:"assignment",   icon:"⚡", label:"Track Assignment" },
      { id:"resources_mgmt",icon:"📦",label:"Resource Management", badge:"5", badgeWarn:true },
      { id:"metrics",      icon:"📈", label:"Metrics Dashboard" },
      { id:"sheets",       icon:"📊", label:"Sheets Config" },
      { id:"profile",      icon:"👤", label:"My Profile" },
    ],
  };

  const titles = {
    dashboard:"Dashboard",progress:"Progress",training:"Training Modules",research:"Research Hub",
    novelty:"Novelty Assessment",competitions:"Competitions",resources:"Request Resources",calendar:"Enrichment Calendar",
    mentees:"My Mentees",meetings:"Meeting Scheduler",review:"Paper Review",
    users:"User Management",filtration:"Filtration Center",assignment:"Track Assignment Engine",
    resources_mgmt:"Resource Management",metrics:"Metrics Dashboard",sheets:"Sheets Config",
    profile:"My Profile",
  };

  const renderContent = () => {
    if (nav==="profile") return <ProfileView user={user}/>;
    if (userRole===ROLES.PARTICIPANT) {
      const map = { dashboard:<ParticipantDashboard user={user}/>, progress:<ParticipantProgress user={user}/>, training:<TrainingModules user={user}/>, research:<ResearchHub user={user}/>, novelty:<NoveltyTool user={user}/>, competitions:<CompetitionsView user={user}/>, resources:<ResourceRequests user={user}/>, calendar:<EnrichmentCalendar user={user}/> };
      return map[nav]||<ParticipantDashboard user={user}/>;
    }
    if (userRole===ROLES.MENTOR) {
      const map = { dashboard:<MentorDashboard user={user}/>, mentees:<MentorMentees user={user}/>, meetings:<MentorMeetings user={user}/>, review:<PaperReview user={user}/>, progress:<MenteeProgress user={user}/> };
      return map[nav]||<MentorDashboard user={user}/>;
    }
    if (userRole===ROLES.SUPERADMIN) {
      const map = { dashboard:<AdminDashboard user={user}/>, users:<AdminUsers/>, filtration:<AdminFiltration/>, assignment:<AdminTrackAssignment/>, resources_mgmt:<AdminResourceMgmt/>, metrics:<AdminMetrics/>, sheets:<AdminSheetsConfig/> };
      return map[nav]||<AdminDashboard user={user}/>;
    }
    // Fallback — unknown role, show raw user data to help debug
    return (
      <div style={{padding:24}}>
        <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:12,padding:20,fontSize:13,color:"#92400E"}}>
          <b>⚠ Unknown role: "{userRole}"</b><br/>
          Your Users sheet must have a <code>role</code> column with value: <code>superadmin</code>, <code>mentor</code>, or <code>participant</code> (lowercase).<br/><br/>
          <b>Your user data from Sheets:</b><br/>
          <pre style={{marginTop:8,fontSize:11,background:"white",padding:10,borderRadius:8,overflow:"auto"}}>{JSON.stringify(user, null, 2)}</pre>
        </div>
      </div>
    );
  };

  const items = navConfig[userRole] || navConfig[ROLES.SUPERADMIN] || [];

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
          <div style={{fontSize:16,fontWeight:700}}>{titles[nav]||"Dashboard"}</div>
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