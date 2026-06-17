import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/clerk-react";
import { LANGUAGES, LANG_KEY, makeT } from "./i18n";

export const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const FREQUENCIES = ["Monthly", "Annual", "Weekly", "Quarterly", "Bi-weekly"];

const freqToMonthly = (amount, freq) => {
  switch (freq) {
    case "Monthly":
      return amount;
    case "Annual":
      return amount / 12;
    case "Weekly":
      return (amount * 52.142857) / 12;
    case "Quarterly":
      return amount / 3;
    case "Bi-weekly":
      return (amount * 26.071429) / 12;
    default:
      return amount;
  }
};

const CATEGORY_COLORS = {
  Child: { bg: "#FFF0F5", accent: "#FF6B8A", icon: "👶" },
  Bills: { bg: "#F0F4FF", accent: "#5B8AF5", icon: "🏠" },
  Food: { bg: "#F0FFF4", accent: "#34C759", icon: "🍽️" },
  Car: { bg: "#FFF8F0", accent: "#FF9500", icon: "🚗" },
  Entertainment: { bg: "#F5F0FF", accent: "#AF52DE", icon: "🎭" },
  Personal: { bg: "#F0FFFE", accent: "#32ADE6", icon: "👤" },
  Medical: { bg: "#FFF0F0", accent: "#FF3B30", icon: "💊" },
  Holidays: { bg: "#FFFFF0", accent: "#FFCC00", icon: "✈️" },
  Other: { bg: "#F5F5F5", accent: "#8E8E93", icon: "📦" },
  Savings: { bg: "#F0FFF4", accent: "#30D158", icon: "💰" },
};

const DEFAULT_EXPENSES = [
  { id: 1, name: "Hot Water", type: "Utilities", category: "Bills", amount: 0, frequency: "Monthly" },
  { id: 2, name: "Electricity Bill", type: "Utilities", category: "Bills", amount: 0, frequency: "Monthly" },
  { id: 3, name: "Internet & TV", type: "Utilities", category: "Bills", amount: 0, frequency: "Monthly" },
  { id: 4, name: "Water Bill & Ent fee", type: "Utilities", category: "Bills", amount: 0, frequency: "Monthly" },
  { id: 5, name: "Petrol", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Monthly" },
  { id: 6, name: "Public Transport", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Monthly" },
  { id: 7, name: "Vignette", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Annual" },
  { id: 8, name: "CBA Card", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Annual" },
  { id: 9, name: "Car Insurance", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Annual" },
  { id: 10, name: "Car Maintenance & Repairs", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Annual" },
  { id: 11, name: "Car Taxes", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Annual" },
  { id: 12, name: "Car Fines", type: "Transport & Auto", category: "Car", amount: 0, frequency: "Annual" },
  { id: 13, name: "Spotify / DuoLingo / MentalUp", type: "Subscriptions", category: "Bills", amount: 0, frequency: "Annual" },
  { id: 14, name: "Clothes / Shoes", type: "Personal", category: "Personal", amount: 0, frequency: "Annual" },
  { id: 15, name: "Computer / Gadgets", type: "Personal", category: "Personal", amount: 0, frequency: "Monthly" },
  { id: 16, name: "Other Purchases", type: "Personal", category: "Personal", amount: 0, frequency: "Monthly" },
  { id: 17, name: "Doctors and Medical", type: "Medical", category: "Medical", amount: 0, frequency: "Monthly" },
  { id: 18, name: "Butcher Shop", type: "Groceries", category: "Food", amount: 0, frequency: "Monthly" },
  { id: 19, name: "Supermarket", type: "Groceries", category: "Food", amount: 0, frequency: "Monthly" },
  { id: 20, name: "Bars / Pub", type: "Entertainment", category: "Entertainment", amount: 0, frequency: "Monthly" },
  { id: 21, name: "Sports", type: "Entertainment", category: "Entertainment", amount: 0, frequency: "Monthly" },
  { id: 22, name: "Cinema", type: "Entertainment", category: "Entertainment", amount: 0, frequency: "Quarterly" },
  { id: 23, name: "Restaurants / Cafes / Take-away", type: "Groceries", category: "Food", amount: 0, frequency: "Weekly" },
  { id: 24, name: "Holidays", type: "Holidays", category: "Holidays", amount: 0, frequency: "Annual" },
  { id: 25, name: "Child Support", type: "Child", category: "Child", amount: 0, frequency: "Monthly" },
  { id: 26, name: "School", type: "Child", category: "Child", amount: 0, frequency: "Annual" },
  { id: 27, name: "Clothes and Toys", type: "Child", category: "Child", amount: 0, frequency: "Annual" },
  { id: 28, name: "Child Activities", type: "Child", category: "Child", amount: 0, frequency: "Monthly" },
  { id: 29, name: "Trip to Burgas – Petrol", type: "Child", category: "Child", amount: 0, frequency: "Monthly" },
  { id: 30, name: "Trip to Burgas – Apartment", type: "Child", category: "Child", amount: 0, frequency: "Monthly" },
  { id: 31, name: "Lawyers", type: "Child", category: "Child", amount: 0, frequency: "Annual" },
  { id: 32, name: "Fathers", type: "Personal", category: "Personal", amount: 0, frequency: "Monthly" },
];

const DEFAULT_INCOME = [
  { id: 1, name: "Salary", amount: 0, frequency: "Monthly" },
];

// Realistic sample data shown to logged-out visitors and seeded for brand-new
// accounts on first sign-in, so the app looks alive instead of empty.
const EXAMPLE_INCOME = [
  { id: 1, name: "Salary", amount: 3000, frequency: "Monthly" },
  { id: 2, name: "Side Projects", amount: 500, frequency: "Monthly" },
];

const EXAMPLE_INVEST = 250;
const EXAMPLE_INVEST_LABEL = "S&P 500 ETF";

const INVEST_TYPES = [
  "S&P 500 ETF",
  "World Index ETF",
  "Stocks & Equities",
  "Bonds / Fixed Income",
  "Real Estate / REITs",
  "Pension Fund",
  "Mutual Fund",
  "Crypto",
  "Gold & Commodities",
  "Money Market / Savings",
  "Mixed Portfolio",
];

const EXAMPLE_AMOUNTS = {
  1: 25, 2: 70, 3: 35, 4: 20, 5: 120, 6: 30, 7: 100, 8: 50, 9: 400, 10: 600,
  11: 120, 12: 50, 13: 180, 14: 800, 15: 40, 16: 60, 17: 50, 18: 80, 19: 400,
  20: 60, 21: 40, 22: 30, 23: 40, 24: 2000, 25: 200, 26: 1200, 27: 400, 28: 80,
  29: 50, 30: 60, 31: 300, 32: 50,
};

const EXAMPLE_EXPENSES = DEFAULT_EXPENSES.map((e) => ({
  ...e,
  amount: EXAMPLE_AMOUNTS[e.id] ?? 0,
}));

function renderMarkdown(text) {
  // Lightweight inline renderer: handles headings, bullets, bold, and paragraph breaks.
  const lines = text.split("\n");
  const nodes = [];
  let buffer = [];
  const flushPara = (key) => {
    if (buffer.length === 0) return;
    nodes.push(
      <p key={`p-${key}`} style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55, color: "#1C1C1E" }}>
        {renderInline(buffer.join(" "))}
      </p>,
    );
    buffer = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { flushPara(i); continue; }
    if (trimmed.startsWith("### ")) {
      flushPara(i);
      nodes.push(
        <h3 key={`h-${i}`} style={{ margin: "20px 0 10px", fontSize: 17, fontWeight: 700, color: "#1C1C1E" }}>
          {trimmed.slice(4)}
        </h3>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushPara(i);
      nodes.push(
        <h2 key={`h-${i}`} style={{ margin: "22px 0 12px", fontSize: 19, fontWeight: 700, color: "#1C1C1E" }}>
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (/^[-*]\s/.test(trimmed)) {
      flushPara(i);
      nodes.push(
        <div key={`li-${i}`} style={{ display: "flex", gap: 8, margin: "0 0 6px", fontSize: 14, lineHeight: 1.55, color: "#1C1C1E" }}>
          <span style={{ color: "#007AFF", fontWeight: 700 }}>•</span>
          <span style={{ flex: 1 }}>{renderInline(trimmed.replace(/^[-*]\s/, ""))}</span>
        </div>,
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushPara(i);
      const num = trimmed.match(/^(\d+)\./)[1];
      nodes.push(
        <div key={`ol-${i}`} style={{ display: "flex", gap: 8, margin: "0 0 6px", fontSize: 14, lineHeight: 1.55, color: "#1C1C1E" }}>
          <span style={{ color: "#007AFF", fontWeight: 700, minWidth: 18 }}>{num}.</span>
          <span style={{ flex: 1 }}>{renderInline(trimmed.replace(/^\d+\.\s/, ""))}</span>
        </div>,
      );
    } else {
      buffer.push(trimmed);
    }
  }
  flushPara("end");
  return nodes;
}

function renderInline(text) {
  // Bold via **...**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
}

function fmt(n) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

const SYNC_KEY = "spending_sync_id";

function getSyncId() {
  let id = localStorage.getItem(SYNC_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem(SYNC_KEY, id);
  }
  return id;
}

function setSyncId(id) {
  localStorage.setItem(SYNC_KEY, id);
}

async function loadData(id) {
  const res = await fetch(`/api/data?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return await res.json();
}

async function saveData(id, data) {
  await fetch(`/api/data?id=${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function computeHealthScore(totalIncome, totalExpenses, invest, emergencyMonths) {
  if (totalIncome <= 0) return null;
  const net = totalIncome - totalExpenses - invest;
  const savingsRate = net / totalIncome;
  const investRate = invest / totalIncome;
  const expenseRatio = totalExpenses / totalIncome;

  const savingsScore  = Math.round(Math.min(1, Math.max(0, savingsRate / 0.20)) * 25);
  const emergencyScore = Math.round(Math.min(1, emergencyMonths / 6) * 25);
  const investScore   = Math.round(Math.min(1, Math.max(0, investRate / 0.10)) * 25);
  const expenseScore  = Math.round(Math.min(1, Math.max(0, (0.90 - expenseRatio) / 0.40)) * 25);

  return {
    total: savingsScore + emergencyScore + investScore + expenseScore,
    breakdown: [
      {
        labelKey: "score_savingsRate", score: savingsScore,
        value: `${(savingsRate * 100).toFixed(0)}%`, target: "≥20%",
        noteKey: savingsScore < 25 ? "note_savings" : null,
        noteVars: { x: fmt(Math.max(0, totalIncome * 0.20 - net)) },
      },
      {
        labelKey: "score_emergencyFund", score: emergencyScore,
        value: `${emergencyMonths}mo`, target: "6mo",
        noteKey: emergencyScore < 25 ? "note_emergency" : null,
        noteVars: { x: fmt(totalExpenses * 6) },
      },
      {
        labelKey: "score_investmentRate", score: investScore,
        value: `${(investRate * 100).toFixed(0)}%`, target: "≥10%",
        noteKey: investScore < 25 ? "note_invest" : null,
        noteVars: { x: fmt(Math.max(0, totalIncome * 0.10 - invest)) },
      },
      {
        labelKey: "score_expenseRatio", score: expenseScore,
        value: `${(expenseRatio * 100).toFixed(0)}%`, target: "≤50%",
        noteKey: expenseScore < 25 ? "note_expense" : null,
        noteVars: { p: (expenseRatio * 100).toFixed(0), x: fmt(Math.max(0, totalExpenses - totalIncome * 0.50)) },
      },
    ],
  };
}

function scoreColor(s) {
  if (s >= 80) return "#34C759";
  if (s >= 60) return "#007AFF";
  if (s >= 40) return "#FF9500";
  return "#FF3B30";
}

function scoreLabelKey(s) {
  if (s >= 80) return "scoreLabel_excellent";
  if (s >= 60) return "scoreLabel_good";
  if (s >= 40) return "scoreLabel_fair";
  return "scoreLabel_needsWork";
}

// Bridges Clerk auth state up to App. Only rendered when Clerk is configured.
function AuthBridge({ onAuthChange, isMobile, signInLabel }) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    onAuthChange(
      isSignedIn
        ? { userId: user.id, email: user.primaryEmailAddress?.emailAddress ?? null }
        : null,
    );
  }, [isLoaded, isSignedIn, user, onAuthChange]);

  if (!isLoaded) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", alignSelf: isMobile ? "stretch" : "auto" }}>
      {isSignedIn ? (
        <UserButton afterSignOutUrl="/" />
      ) : (
        <SignInButton mode="modal">
          <button
            style={{
              padding: "7px 16px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background: "#1C1C1E",
              color: "#fff",
              width: isMobile ? "100%" : "auto",
            }}
          >
            {signInLabel}
          </button>
        </SignInButton>
      )}
    </div>
  );
}

// First-login coachmark overlay: dims the screen and points an arrow at each
// target element (the nav tabs), with a short how-to per step.
function Walkthrough({ steps, onFinish, labels }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[index];

  useEffect(() => {
    function update() {
      const el = step.getTarget?.();
      const r = el ? el.getBoundingClientRect() : null;
      setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    }
    update();
    const id = setTimeout(update, 60); // re-measure after layout settles
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  const isLast = index === steps.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;

  // Tooltip placement: below the target if we have one, else centered.
  const tipWidth = Math.min(320, vw - 32);
  let tipTop, tipLeft, arrow = false;
  if (rect) {
    tipTop = rect.top + rect.height + 16;
    tipLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - tipWidth / 2, vw - tipWidth - 16));
    arrow = true;
  } else {
    tipTop = typeof window !== "undefined" ? window.innerHeight / 2 - 90 : 200;
    tipLeft = Math.max(16, vw / 2 - tipWidth / 2);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      {/* Spotlight cut-out (or full dim when no target) */}
      {rect ? (
        <div
          style={{
            position: "fixed",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 14,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            border: "2px solid #fff",
            pointerEvents: "none",
            transition: "all 0.3s ease",
          }}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: "fixed",
          top: tipTop,
          left: tipLeft,
          width: tipWidth,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
          zIndex: 9999,
        }}
      >
        {arrow && (
          <div
            style={{
              position: "absolute",
              top: -8,
              left: Math.max(16, Math.min((rect.left + rect.width / 2) - tipLeft - 8, tipWidth - 32)),
              width: 16,
              height: 16,
              background: "#fff",
              transform: "rotate(45deg)",
              boxShadow: "-2px -2px 4px rgba(0,0,0,0.04)",
            }}
          />
        )}
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E", marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#3C3C43", marginBottom: 16 }}>{step.text}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={onFinish}
            style={{ border: "none", background: "transparent", color: "#8E8E93", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 }}
          >
            {labels.skip}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#C7C7CC" }}>{index + 1} / {steps.length}</span>
            <button
              onClick={() => (isLast ? onFinish() : setIndex((i) => i + 1))}
              style={{
                border: "none",
                background: "#007AFF",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                padding: "8px 18px",
                borderRadius: 20,
              }}
            >
              {isLast ? labels.gotit : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MODAL_CSS = `
@keyframes backdropIn  { from { background: rgba(0,0,0,0) } to { background: rgba(0,0,0,0.45) } }
@keyframes backdropOut { from { background: rgba(0,0,0,0.45) } to { background: rgba(0,0,0,0) } }
@keyframes sheetIn  { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes sheetOut { from { transform: translateY(0) } to { transform: translateY(100%) } }
`;

function CategoryModal({ cat, color, icon, catExpenses, closing, onClose, onUpdate, onDelete, t, fmt }) {
  const [editingId, setEditingId] = useState(null);
  const catTotal = catExpenses.reduce((s, e) => s + freqToMonthly(e.amount, e.frequency), 0);

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 2000,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          animation: `${closing ? "backdropOut" : "backdropIn"} 0.3s ease forwards`,
          background: closing ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "24px 24px 0 0",
            width: "100%",
            maxWidth: 620,
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            animation: `${closing ? "sheetOut" : "sheetIn"} 0.3s cubic-bezier(0.32,0.72,0,1) forwards`,
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "22px 22px 18px",
            borderBottom: `3px solid ${color}30`,
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>
                {t("categoryBreakdown")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", letterSpacing: "-0.5px" }}>
                {icon} {t.cat(cat)}
              </div>
              <div style={{ fontSize: 13, color: color, fontWeight: 600, marginTop: 2 }}>
                €{fmt(catTotal)} / {t.freq("Monthly").toLowerCase()}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 34, height: 34, borderRadius: "50%", border: "none",
                background: "#F2F2F7", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, color: "#3C3C43", fontWeight: 700, flexShrink: 0,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#E5E5EA"}
              onMouseLeave={e => e.currentTarget.style.background = "#F2F2F7"}
            >✕</button>
          </div>

          {/* Expense list */}
          <div style={{ overflowY: "auto", padding: "14px 16px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
            {catExpenses.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#8E8E93", fontSize: 14 }}>
                No expenses in this category
              </div>
            )}
            {catExpenses.map((expense) => {
              const isEditing = editingId === expense.id;
              const monthly = freqToMonthly(expense.amount, expense.frequency);
              return (
                <div
                  key={expense.id}
                  style={{
                    borderRadius: 16, padding: "14px 16px",
                    background: isEditing ? `${color}12` : "#F9F9FB",
                    border: `1.5px solid ${isEditing ? color : "transparent"}`,
                    transition: "all 0.2s ease",
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <input
                        autoFocus
                        value={expense.name}
                        onChange={e => onUpdate(expense.id, "name", e.target.value)}
                        style={{
                          fontSize: 15, fontWeight: 600, color: "#1C1C1E",
                          border: "none", borderBottom: `2px solid ${color}`,
                          background: "transparent", outline: "none", width: "100%", paddingBottom: 2,
                        }}
                      />
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#8E8E93", marginBottom: 4 }}>Amount (€)</div>
                          <input
                            type="number"
                            value={expense.amount}
                            onChange={e => onUpdate(expense.id, "amount", e.target.value)}
                            style={{
                              fontSize: 16, fontWeight: 700, color: color, width: "100%",
                              border: "none", borderBottom: `2px solid ${color}`,
                              background: "transparent", outline: "none", paddingBottom: 2,
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#8E8E93", marginBottom: 4 }}>Frequency</div>
                          <select
                            value={expense.frequency}
                            onChange={e => onUpdate(expense.id, "frequency", e.target.value)}
                            style={{
                              fontSize: 13, width: "100%", border: "none",
                              borderBottom: `2px solid ${color}`, background: "transparent",
                              outline: "none", paddingBottom: 2, color: "#1C1C1E",
                            }}
                          >
                            {FREQUENCIES.map(f => <option key={f} value={f}>{t.freq(f)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <button
                          onClick={() => { onDelete(expense.id); setEditingId(null); }}
                          style={{
                            padding: "7px 14px", borderRadius: 10, border: "none",
                            background: "#FF3B3015", color: "#FF3B30", fontSize: 13,
                            fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          🗑 Delete
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            padding: "7px 18px", borderRadius: 10, border: "none",
                            background: color, color: "#fff", fontSize: 13,
                            fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                      onClick={() => setEditingId(expense.id)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 2 }}>{expense.name}</div>
                        <div style={{ fontSize: 12, color: "#8E8E93" }}>
                          €{fmt(expense.amount)} · {t.freq(expense.frequency)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: color }}>€{fmt(monthly)}<span style={{ fontSize: 11, fontWeight: 400, color: "#8E8E93" }}>/mo</span></div>
                      </div>
                      <div style={{ color: "#C7C7CC", fontSize: 13 }}>›</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function DonutChart({ data, total, activeCategory, onCategoryChange }) {
  const size = 180;
  const strokeWidth = 28;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const midAngle = (offset + pct / 2) * 2 * Math.PI;
    const segment = { ...d, pct, dasharray: `${pct * circ} ${circ}`, dashoffset: -offset * circ, midAngle };
    offset += pct;
    return segment;
  });

  const POP = 9;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)", overflow: "visible" }}
    >
      {segments.map((segment, index) => {
        const isActive = activeCategory === segment.name;
        const hasActive = activeCategory !== null;
        const dx = isActive ? POP * Math.cos(segment.midAngle) : 0;
        const dy = isActive ? POP * Math.sin(segment.midAngle) : 0;
        return (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={segment.color}
            strokeWidth={isActive ? strokeWidth + 5 : strokeWidth}
            strokeDasharray={segment.dasharray}
            strokeDashoffset={segment.dashoffset}
            strokeLinecap="butt"
            style={{
              transform: `translate(${dx}px, ${dy}px)`,
              transition: "transform 0.22s ease, stroke-width 0.22s ease, opacity 0.22s ease",
              opacity: hasActive && !isActive ? 0.3 : 1,
              cursor: "pointer",
            }}
            onMouseEnter={() => onCategoryChange(segment.name)}
            onMouseLeave={() => onCategoryChange(null)}
            onClick={() => onCategoryChange(isActive ? null : segment.name)}
          />
        );
      })}
    </svg>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

export default function App() {
  const isMobile = useIsMobile();
  const [syncId, setSyncIdState] = useState(() => getSyncId());
  const [income, setIncome] = useState(EXAMPLE_INCOME);
  const [expenses, setExpenses] = useState(EXAMPLE_EXPENSES);
  const [invest, setInvest] = useState(EXAMPLE_INVEST);
  const [investLabel, setInvestLabel] = useState(EXAMPLE_INVEST_LABEL);
  const [activeCategory, setActiveCategory] = useState(null);
  const [catModalCat, setCatModalCat] = useState(null);
  const [catModalClosing, setCatModalClosing] = useState(false);
  const [showInvestMenu, setShowInvestMenu] = useState(false);
  const [investCustomInput, setInvestCustomInput] = useState("");
  const investMenuRef = useRef(null);
  const [emergencyMonths, setEmergencyMonths] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const [syncInput, setSyncInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const syncPanelRef = useRef(null);
  const [auth, setAuth] = useState(null); // { userId, email } when signed in, else null
  const [isDirty, setIsDirty] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || "en"; } catch { return "en"; }
  });
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef(null);
  const t = useMemo(() => makeT(lang), [lang]);
  const changeLang = useCallback((code) => {
    setLang(code);
    setShowLangMenu(false);
    try { localStorage.setItem(LANG_KEY, code); } catch { /* ignore */ }
  }, []);
  const autoSaveTimerRef = useRef(null);
  const skipNextSaveRef = useRef(false);
  const tabRefs = useRef({});

  // Data is only persisted for signed-in users (keyed by Clerk user id).
  // Logged-out visitors see read-only example data.
  const isSignedIn = !!auth?.userId;
  const handleAuthChange = useCallback((a) => setAuth(a), []);

  const finishWalkthrough = useCallback(() => {
    setShowWalkthrough(false);
    if (auth?.userId) {
      try { localStorage.setItem(`walkthrough_done_${auth.userId}`, "1"); } catch { /* ignore */ }
    }
  }, [auth]);

  const openCatModal = useCallback((catName) => {
    setCatModalCat(catName);
    setCatModalClosing(false);
  }, []);

  const closeCatModal = useCallback(() => {
    setCatModalClosing(true);
    setTimeout(() => { setCatModalCat(null); setCatModalClosing(false); }, 300);
  }, []);

  const applyNewSyncId = useCallback((id) => {
    const clean = id.trim().toUpperCase();
    if (!clean) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSyncId(clean);
    setSyncIdState(clean);
    setLoaded(false);
    setLoadError(null);
    setIncome(DEFAULT_INCOME);
    setExpenses(DEFAULT_EXPENSES);
    setInvest(0);
    setEmergencyMonths(3);
    setSyncInput("");
    setShowSync(false);
    setIsDirty(false);
  }, []);

  const handleImportFromOldAccount = useCallback(async () => {
    const oldId = importInput.trim();
    if (!oldId || !auth?.userId) return;
    setImportLoading(true);
    setImportError(null);
    setImportSuccess(false);
    try {
      const data = await loadData(oldId);
      if (!data || (!data.income && !data.expenses)) {
        setImportError("No data found for that account ID. Please double-check and try again.");
        return;
      }
      skipNextSaveRef.current = true;
      if (data.income) setIncome(data.income);
      if (data.expenses) setExpenses(data.expenses);
      if (data.invest != null) setInvest(data.invest);
      if (data.investLabel) setInvestLabel(data.investLabel);
      if (data.emergencyMonths != null) setEmergencyMonths(data.emergencyMonths);
      await saveData(auth.userId, data);
      setImportSuccess(true);
      setImportInput("");
      setTimeout(() => { setShowImport(false); setImportSuccess(false); }, 1800);
    } catch (err) {
      setImportError(err?.message ?? "Failed to import data");
    } finally {
      setImportLoading(false);
    }
  }, [importInput, auth?.userId]);

  useEffect(() => {
    // Logged out: show example demo data, no backend reads/writes.
    if (!auth?.userId) {
      skipNextSaveRef.current = true;
      setIncome(EXAMPLE_INCOME);
      setExpenses(EXAMPLE_EXPENSES);
      setInvest(EXAMPLE_INVEST);
      setEmergencyMonths(3);
      setLoadError(null);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    setLoaded(false);
    const userId = auth.userId;
    loadData(userId)
      .then((saved) => {
        if (cancelled) return;
        skipNextSaveRef.current = true;
        if (saved && (saved.expenses || saved.income)) {
          // Returning user: load their real data.
          if (saved.income) setIncome(saved.income);
          if (saved.expenses) setExpenses(saved.expenses);
          if (saved.invest != null) setInvest(saved.invest);
          if (saved.investLabel) setInvestLabel(saved.investLabel);
          if (saved.emergencyMonths != null) setEmergencyMonths(saved.emergencyMonths);
          setLoaded(true);
        } else {
          // Brand-new account: check for pre-auth sync code data first.
          let oldSyncId = null;
          try { oldSyncId = localStorage.getItem(SYNC_KEY); } catch { /* ignore */ }
          const tryMigrateSync = oldSyncId
            ? loadData(oldSyncId).catch(() => null)
            : Promise.resolve(null);
          tryMigrateSync.then((legacy) => {
            if (cancelled) return;
            if (legacy && (legacy.income || legacy.expenses)) {
              // Migrate pre-auth data into the new Clerk account.
              skipNextSaveRef.current = true;
              if (legacy.income) setIncome(legacy.income);
              if (legacy.expenses) setExpenses(legacy.expenses);
              if (legacy.invest != null) setInvest(legacy.invest);
              if (legacy.investLabel) setInvestLabel(legacy.investLabel);
              if (legacy.emergencyMonths != null) setEmergencyMonths(legacy.emergencyMonths);
              saveData(userId, legacy).finally(() => { if (!cancelled) setLoaded(true); });
            } else {
              // Truly new account: seed example data and run walkthrough.
              setIncome(EXAMPLE_INCOME);
              setExpenses(EXAMPLE_EXPENSES);
              setInvest(EXAMPLE_INVEST);
              setEmergencyMonths(3);
              saveData(userId, {
                income: EXAMPLE_INCOME,
                expenses: EXAMPLE_EXPENSES,
                invest: EXAMPLE_INVEST,
                emergencyMonths: 3,
              }).finally(() => { if (!cancelled) setLoaded(true); });
              let seen = false;
              try { seen = !!localStorage.getItem(`walkthrough_done_${userId}`); } catch { /* ignore */ }
              if (!seen) setShowWalkthrough(true);
            }
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        skipNextSaveRef.current = true;
        setLoadError(err?.message ?? "Failed to load");
        setLoaded(true);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.userId]);

  // Debounced auto-save: persist 2s after the last change (signed-in only).
  useEffect(() => {
    if (!loaded || !auth?.userId) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    setIsDirty(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveData(auth.userId, { income, expenses, invest, investLabel, emergencyMonths }).then(() => {
        setIsDirty(false);
        setSavedFlag(true);
        setTimeout(() => setSavedFlag(false), 2000);
      });
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [loaded, income, expenses, invest, investLabel, emergencyMonths, auth?.userId]);

  useEffect(() => {
    if (!showSync) return;
    function handleClick(e) {
      if (syncPanelRef.current && !syncPanelRef.current.contains(e.target)) {
        setShowSync(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSync]);

  useEffect(() => {
    if (!showInvestMenu) return;
    function handleClick(e) {
      if (investMenuRef.current && !investMenuRef.current.contains(e.target)) {
        setShowInvestMenu(false);
        setInvestCustomInput("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showInvestMenu]);

  useEffect(() => {
    if (!showLangMenu) return;
    function handleClick(e) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showLangMenu]);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    name: "",
    type: "",
    category: "Personal",
    amount: 0,
    frequency: "Monthly",
  });
  const [addingIncome, setAddingIncome] = useState(false);
  const [newIncome, setNewIncome] = useState({ name: "", amount: 0, frequency: "Monthly" });
  const [savedFlag, setSavedFlag] = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [suggestions, setSuggestions] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);

  const generateSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ income, expenses, invest, investLabel, emergencyMonths, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `API ${res.status}`);
      setSuggestions(data.suggestions ?? "");
    } catch (err) {
      setSuggestionsError(err?.message ?? "Failed to generate suggestions");
    } finally {
      setSuggestionsLoading(false);
    }
  }, [income, expenses, invest, emergencyMonths, lang]);

  const totalIncome = income.reduce((sum, item) => sum + freqToMonthly(item.amount, item.frequency), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + freqToMonthly(item.amount, item.frequency), 0);
  const investMonthly = freqToMonthly(invest, "Monthly");
  const savings = totalIncome - totalExpenses - investMonthly;

  const categories = [...new Set(expenses.map((item) => item.category))].sort();
  const categoryTotals = categories
    .map((category) => ({
      name: category,
      value: expenses
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + freqToMonthly(item.amount, item.frequency), 0),
      color: (CATEGORY_COLORS[category] || CATEGORY_COLORS.Other).accent,
    }))
    .sort((a, b) => b.value - a.value);

  const monthlyExpenses = totalExpenses + investMonthly;
  const emergencyTarget = monthlyExpenses * emergencyMonths;

  const handleSave = useCallback(() => {
    if (!loaded || !auth?.userId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    saveData(auth.userId, { income, expenses, invest, investLabel, emergencyMonths }).then(() => {
      setIsDirty(false);
      setSavedFlag(true);
      window.setTimeout(() => setSavedFlag(false), 2000);
    });
  }, [emergencyMonths, expenses, income, invest, loaded, auth]);

  const handleExportPDF = useCallback(() => {
    const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    const tIncome = income.reduce((s, i) => s + freqToMonthly(i.amount, i.frequency), 0);
    const tExpenses = expenses.reduce((s, e) => s + freqToMonthly(e.amount, e.frequency), 0);
    const tInvest = invest;
    const tSavings = tIncome - tExpenses - tInvest;
    const score = computeHealthScore(tIncome, tExpenses, tInvest, emergencyMonths);

    const expensesByCat = {};
    for (const e of expenses) {
      const cat = e.category || "Other";
      if (!expensesByCat[cat]) expensesByCat[cat] = [];
      expensesByCat[cat].push(e);
    }

    const catRows = Object.entries(expensesByCat).map(([cat, items]) => {
      const catTotal = items.reduce((s, e) => s + freqToMonthly(e.amount, e.frequency), 0);
      const itemRows = items.map(e => `
        <tr>
          <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;color:#444">${e.name}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;text-align:right">€${fmt(e.amount)}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;color:#888">${t.freq(e.frequency)}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;text-align:right;color:#555">€${fmt(freqToMonthly(e.amount, e.frequency))}${t("perMo")}</td>
        </tr>`).join("");
      return `
        <tr style="background:#f5f5f7">
          <td colspan="3" style="padding:8px 10px;font-weight:700;font-size:12px">${(CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other).icon} ${t.cat(cat)}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:12px">€${fmt(catTotal)}${t("perMo")}</td>
        </tr>${itemRows}`;
    }).join("");

    const scoreHtml = score ? `
      <h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #007AFF;color:#007AFF">${t("healthScore")}</h2>
      <div style="display:flex;align-items:center;gap:24px;padding:16px;background:#f8f8f8;border-radius:8px">
        <div style="text-align:center;min-width:80px">
          <div style="font-size:52px;font-weight:800;color:${scoreColor(score.total)};line-height:1">${score.total}</div>
          <div style="font-size:13px;font-weight:600;color:${scoreColor(score.total)};margin-top:4px">${t(scoreLabelKey(score.total))}</div>
        </div>
        <table style="flex:1;border-collapse:collapse;font-size:13px">
          ${score.breakdown.map(b => `
            <tr>
              <td style="padding:4px 8px">${t(b.labelKey)}</td>
              <td style="padding:4px 8px;color:#888">${b.value} / ${b.target}</td>
              <td style="padding:4px 8px;text-align:right;font-weight:700;color:${scoreColor(b.score * 4)}">${b.score}/25</td>
            </tr>`).join("")}
        </table>
      </div>` : "";

    const ownerLine = auth?.email ? auth.email : `#${syncId}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Spending Plan — ${date}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;padding:40px;color:#1C1C1E;font-size:14px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #e0e0e0;letter-spacing:.5px}
    #dl-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#007AFF;color:#fff;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    #dl-btn:hover{background:#0062cc}
    #dl-btn:disabled{background:#A0C4FF;cursor:default}
  </style>
</head>
<body>
  <div id="dl-bar" style="position:sticky;top:0;z-index:99;background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);border-bottom:1px solid #e0e0e0;padding:12px 40px;display:flex;align-items:center;justify-content:space-between;margin:-40px -40px 32px">
    <span style="font-size:14px;font-weight:600;color:#1C1C1E">💳 ${t("appTitle")} &nbsp;·&nbsp; <span style="font-weight:400;color:#888">${date}</span></span>
    <button id="dl-btn" onclick="downloadPDF()">⬇ Download PDF</button>
  </div>
  <script>
    function downloadPDF() {
      const btn = document.getElementById('dl-btn');
      btn.disabled = true;
      btn.textContent = 'Generating…';
      const bar = document.getElementById('dl-bar');
      bar.style.display = 'none';
      html2pdf().set({
        margin: 10,
        filename: 'spending-plan.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(document.body).save().then(function() {
        bar.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = '⬇ Download PDF';
      });
    }
  </script>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
    <div>
      <h1 style="font-size:24px;font-weight:800;margin-bottom:4px">💳 ${t("appTitle")}</h1>
      <p style="color:#888;font-size:13px">${date} &nbsp;·&nbsp; ${ownerLine}</p>
    </div>
  </div>

  <div style="display:flex;gap:12px;margin:8px 0 4px">
    ${[
      [t("card_monthlyIncome"),  `€${fmt(tIncome)}`,              "#34C759"],
      [t("card_monthlyExpenses"),`€${fmt(tExpenses)}`,            "#FF3B30"],
      [t("monthlyInvestment"),   `€${fmt(tInvest)}`,              "#007AFF"],
      [tSavings >= 0 ? t("card_netSavings") : t("card_deficit"), `€${fmt(Math.abs(tSavings))}`, tSavings >= 0 ? "#007AFF" : "#FF3B30"],
    ].map(([label, value, color]) => `
      <div style="flex:1;padding:14px;background:#f8f8f8;border-radius:8px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${label}</div>
        <div style="font-size:20px;font-weight:800;color:${color}">${value}</div>
      </div>`).join("")}
  </div>

  ${scoreHtml}

  <h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #34C759;color:#34C759">${t("tab_income")}</h2>
  <table>
    <thead><tr><th>${t("col_source")}</th><th>${t("col_frequency")}</th><th>${t("col_amount")}</th><th style="text-align:right">${t.freq("Monthly")}</th></tr></thead>
    <tbody>
      ${income.map(i => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-weight:600">${i.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#888">${t.freq(i.frequency)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">€${fmt(i.amount)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#34C759">€${fmt(freqToMonthly(i.amount, i.frequency))}${t("perMo")}</td>
        </tr>`).join("")}
    </tbody>
  </table>

  <h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #FF3B30;color:#FF3B30">${t("tab_expenses")}</h2>
  <table>
    <thead><tr><th>${t("col_item")}</th><th style="text-align:right">${t("col_amount")}</th><th>${t("col_frequency")}</th><th style="text-align:right">${t.freq("Monthly")}</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  <p style="margin-top:36px;font-size:11px;color:#bbb;text-align:center">For personal planning purposes only. Not financial advice.</p>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [income, expenses, invest, investLabel, emergencyMonths, syncId, auth, t]);

  const updateExpense = (id, field, value) => {
    setExpenses((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "amount" ? parseFloat(value) || 0 : value,
            }
          : item,
      ),
    );
  };

  const deleteExpense = (id) => {
    setExpenses((current) => current.filter((item) => item.id !== id));
  };

  const updateIncome = (id, field, value) => {
    setIncome((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "amount" ? parseFloat(value) || 0 : value,
            }
          : item,
      ),
    );
  };

  const deleteIncome = (id) => {
    setIncome((current) => current.filter((item) => item.id !== id));
  };

  const addExpense = () => {
    if (!newExpense.name) {
      return;
    }

    setExpenses((current) => [...current, { ...newExpense, id: Date.now() }]);
    setNewExpense({ name: "", type: "", category: "Personal", amount: 0, frequency: "Monthly" });
    setAddingExpense(false);
  };

  const addIncome = () => {
    if (!newIncome.name) {
      return;
    }

    setIncome((current) => [...current, { ...newIncome, id: Date.now() }]);
    setNewIncome({ name: "", amount: 0, frequency: "Monthly" });
    setAddingIncome(false);
  };

  const filteredExpenses = filterCat === "All" ? expenses : expenses.filter((item) => item.category === filterCat);
  const donutData = categoryTotals.slice(0, 8);
  const contentWidth = isMobile ? "100%" : 960;
  const threeColGrid = isMobile ? "1fr" : "repeat(3, 1fr)";
  const twoColGrid = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
        background: "#F2F2F7",
        minHeight: "100vh",
        color: "#1C1C1E",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          padding: isMobile ? "0 16px" : "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: contentWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: isMobile ? 12 : 0,
            minHeight: isMobile ? "auto" : 56,
            padding: isMobile ? "14px 0" : 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>💳</span>
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>{t("appTitle")}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["overview", "expenses", "income", "suggestions"].map((tab) => (
              <button
                key={tab}
                ref={(el) => { tabRefs.current[tab] = el; }}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  background: activeTab === tab ? "#007AFF" : "transparent",
                  color: activeTab === tab ? "#fff" : "#3C3C43",
                  transition: "all 0.2s",
                }}
              >
                {t(`tab_${tab}`)}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", display: "none" }} ref={syncPanelRef}>
            <button
              onClick={() => { setShowSync((v) => !v); setSyncInput(""); }}
              title="Sync across devices"
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: "1.5px solid #E5E5EA",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: showSync ? "#F2F2F7" : "#fff",
                color: "#3C3C43",
                display: "flex",
                alignItems: "center",
                gap: 5,
                alignSelf: isMobile ? "stretch" : "auto",
              }}
            >
              🔗 Sync
            </button>
            {showSync && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                background: "#fff",
                border: "1.5px solid #E5E5EA",
                borderRadius: 16,
                padding: 20,
                width: 280,
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                zIndex: 100,
              }}>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#1C1C1E" }}>Your sync code</p>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: "#8E8E93", lineHeight: 1.4 }}>
                  Share this code with another device to see the same data.
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <div style={{
                    flex: 1,
                    background: "#F2F2F7",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: 4,
                    color: "#007AFF",
                    textAlign: "center",
                    fontFamily: "monospace",
                  }}>
                    {syncId}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(syncId).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    style={{
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      background: copied ? "#34C759" : "#007AFF",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      transition: "background 0.2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#1C1C1E" }}>Use another code</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={syncInput}
                    onChange={(e) => setSyncInput(e.target.value.toUpperCase())}
                    placeholder="Enter code…"
                    maxLength={10}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1.5px solid #E5E5EA",
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: 3,
                      fontFamily: "monospace",
                      outline: "none",
                      textTransform: "uppercase",
                    }}
                  />
                  <button
                    onClick={() => applyNewSyncId(syncInput)}
                    disabled={!syncInput.trim()}
                    style={{
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "none",
                      cursor: syncInput.trim() ? "pointer" : "default",
                      background: syncInput.trim() ? "#007AFF" : "#E5E5EA",
                      color: syncInput.trim() ? "#fff" : "#8E8E93",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
          {isSignedIn && (
            <button
              onClick={() => { setShowImport(true); setImportInput(""); setImportError(null); setImportSuccess(false); }}
              title="Import data from a previous account"
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: "1.5px solid #E5E5EA",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: "#fff",
                color: "#3C3C43",
                display: "flex",
                alignItems: "center",
                gap: 5,
                alignSelf: isMobile ? "stretch" : "auto",
              }}
            >
              ↓ Import
            </button>
          )}
          {isSignedIn && (
            <button
              onClick={handleSave}
              disabled={!loaded}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: "none",
                cursor: loaded ? "pointer" : "default",
                fontSize: 13,
                fontWeight: 600,
                background: savedFlag ? "#34C759" : !loaded ? "#A0C4FF" : isDirty ? "#FF9500" : "#007AFF",
                color: "#fff",
                transition: "all 0.3s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                alignSelf: isMobile ? "stretch" : "auto",
              }}
            >
              {savedFlag ? `✓ ${t("saved")}` : isDirty ? `● ${t("save")}` : t("save")}
            </button>
          )}
          <div style={{ position: "relative", alignSelf: isMobile ? "stretch" : "auto" }} ref={langMenuRef}>
            <button
              onClick={() => setShowLangMenu((v) => !v)}
              title="Language"
              style={{
                padding: "7px 12px",
                borderRadius: 20,
                border: "1.5px solid #E5E5EA",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: showLangMenu ? "#F2F2F7" : "#fff",
                color: "#3C3C43",
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: isMobile ? "100%" : "auto",
                justifyContent: "center",
              }}
            >
              {LANGUAGES.find((l) => l.code === lang)?.flag} {lang.toUpperCase()}
            </button>
            {showLangMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "#fff",
                  border: "1.5px solid #E5E5EA",
                  borderRadius: 12,
                  padding: 6,
                  minWidth: 160,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  zIndex: 200,
                }}
              >
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => changeLang(l.code)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: lang === l.code ? 700 : 500,
                      background: lang === l.code ? "#F2F2F7" : "transparent",
                      color: "#1C1C1E",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{l.flag}</span>
                    {l.label}
                    {lang === l.code && <span style={{ marginLeft: "auto", color: "#007AFF" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {CLERK_ENABLED && <AuthBridge onAuthChange={handleAuthChange} isMobile={isMobile} signInLabel={t("signIn")} />}
        </div>
      </div>

      {CLERK_ENABLED && !isSignedIn && loaded && (
        <div
          style={{
            background: "#FFF8E6",
            borderBottom: "1px solid #FFE8B0",
            padding: isMobile ? "10px 16px" : "10px 24px",
          }}
        >
          <div
            style={{
              maxWidth: contentWidth,
              margin: "0 auto",
              fontSize: 13,
              color: "#8A6D00",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>📊 {t("demoBanner")}</span>
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: contentWidth,
          margin: "0 auto",
          padding: isMobile ? "16px 16px 32px" : "24px 24px 48px",
        }}
      >
        {activeTab === "overview" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: threeColGrid,
                gap: 14,
                marginBottom: 20,
              }}
            >
              {[
                { label: t("card_monthlyIncome"), value: totalIncome, color: "#34C759", sub: t("card_totalEarnings"), pct: null },
                { label: t("card_monthlyExpenses"), value: totalExpenses + investMonthly, color: "#FF3B30", sub: t("card_allOutgoings"), pct: totalIncome > 0 ? ((totalExpenses + investMonthly) / totalIncome) * 100 : null },
                {
                  label: savings >= 0 ? t("card_netSavings") : t("card_deficit"),
                  value: Math.abs(savings),
                  color: savings >= 0 ? "#007AFF" : "#FF3B30",
                  sub: savings >= 0 ? t("card_afterAll") : t("card_overBudget"),
                  pct: totalIncome > 0 ? (savings / totalIncome) * 100 : null,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    padding: "20px 22px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8E8E93",
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: 6,
                      }}
                    >
                      {card.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: card.color, letterSpacing: "-1px" }}>
                      €{fmt(card.value)}
                    </div>
                    <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>{card.sub}</div>
                  </div>
                  {card.pct !== null && (
                    <div style={{
                      fontSize: 22, fontWeight: 700, color: card.color, opacity: 0.8,
                      letterSpacing: "-0.5px", flexShrink: 0,
                    }}>
                      {card.pct >= 0 ? "" : "−"}{Math.abs(card.pct).toFixed(0)}%
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: twoColGrid,
                gap: 14,
                marginBottom: 14,
              }}
            >
              <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{t("spendingByCategory")}</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <DonutChart data={donutData} total={totalExpenses} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        textAlign: "center",
                        pointerEvents: "none",
                      }}
                    >
                      {activeCategory ? (() => {
                        const ac = donutData.find(d => d.name === activeCategory);
                        return ac ? (
                          <>
                            <div style={{ fontSize: 15, fontWeight: 700, color: ac.color }}>€{fmt(ac.value)}</div>
                            <div style={{ fontSize: 10, color: "#8E8E93", maxWidth: 60, lineHeight: 1.2 }}>{t.cat(ac.name)}</div>
                          </>
                        ) : null;
                      })() : (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E" }}>€{fmt(totalExpenses)}</div>
                          <div style={{ fontSize: 11, color: "#8E8E93" }}>{t("total")}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
                    {donutData.map((item) => {
                      const isActive = activeCategory === item.name;
                      const hasActive = activeCategory !== null;
                      return (
                        <div
                          key={item.name}
                          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                            opacity: hasActive && !isActive ? 0.4 : 1,
                            transition: "opacity 0.22s ease",
                          }}
                          onMouseEnter={() => setActiveCategory(item.name)}
                          onMouseLeave={() => setActiveCategory(null)}
                          onClick={() => setActiveCategory(isActive ? null : item.name)}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0,
                            transform: isActive ? "scale(1.6)" : "scale(1)",
                            transition: "transform 0.22s ease",
                          }} />
                          <div style={{ flex: 1, fontSize: 12, color: "#3C3C43", fontWeight: isActive ? 700 : 500 }}>{t.cat(item.name)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1C1C1E" }}>€{fmt(item.value)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{t("categoryBreakdown")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {categoryTotals.map((item) => {
                    const pct = totalIncome > 0 ? (item.value / totalIncome) * 100 : 0;
                    const isActive = activeCategory === item.name;
                    const hasActive = activeCategory !== null;
                    return (
                      <div
                        key={item.name}
                        style={{
                          borderRadius: 10, padding: "5px 8px", margin: "0 -8px",
                          background: isActive ? `${item.color}18` : "transparent",
                          opacity: hasActive && !isActive ? 0.4 : 1,
                          transition: "background 0.22s ease, opacity 0.22s ease",
                          cursor: "pointer",
                        }}
                        onMouseEnter={() => setActiveCategory(item.name)}
                        onMouseLeave={() => setActiveCategory(null)}
                        onClick={() => openCatModal(item.name)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#1C1C1E" : "#3C3C43" }}>
                            {(CATEGORY_COLORS[item.name] || CATEGORY_COLORS.Other).icon} {t.cat(item.name)}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                            €{fmt(item.value)} <span style={{ color: "#8E8E93", fontWeight: 400 }}>({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div style={{ background: "#F2F2F7", borderRadius: 4, height: 6, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              height: "100%",
                              background: item.color,
                              borderRadius: 4,
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: twoColGrid, gap: 14 }}>
              <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>💹 {t("monthlyInvestment")}</div>
                <div style={{ position: "relative", marginBottom: 14 }} ref={investMenuRef}>
                  <button
                    onClick={() => { setShowInvestMenu(v => !v); setInvestCustomInput(""); }}
                    style={{
                      background: "none", border: "none", padding: 0, cursor: "pointer",
                      fontSize: 12, color: "#007AFF", fontWeight: 500, display: "flex",
                      alignItems: "center", gap: 4,
                    }}
                  >
                    {investLabel} ▾
                  </button>
                  {showInvestMenu && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 6px)", left: 0,
                      background: "#fff", border: "1.5px solid #E5E5EA", borderRadius: 14,
                      padding: 6, minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                      zIndex: 200,
                    }}>
                      {INVEST_TYPES.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => { setInvestLabel(opt); setShowInvestMenu(false); setInvestCustomInput(""); }}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "8px 12px", borderRadius: 8, border: "none",
                            background: investLabel === opt ? "#F2F2F7" : "transparent",
                            color: "#1C1C1E", fontSize: 13,
                            fontWeight: investLabel === opt ? 700 : 400, cursor: "pointer",
                          }}
                        >
                          {investLabel === opt && <span style={{ color: "#007AFF", marginRight: 6 }}>✓</span>}
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={10}
                    value={invest}
                    onChange={(event) => setInvest(Number(event.target.value))}
                    style={{ flex: 1, width: "100%", accentColor: "#007AFF" }}
                  />
                  <div
                    style={{
                      background: "#F2F2F7",
                      borderRadius: 10,
                      padding: "6px 12px",
                      minWidth: isMobile ? "100%" : 80,
                      textAlign: "center",
                    }}
                  >
                    <input
                      type="number"
                      value={invest}
                      onChange={(event) => setInvest(parseFloat(event.target.value) || 0)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#007AFF",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#8E8E93" }}>
                  {t("annual")}: <strong style={{ color: "#007AFF" }}>€{fmt(invest * 12)}</strong>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>🛡️ {t("emergencyFund")}</div>
                <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 14 }}>{t("emergencySub")}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[0, 3, 6, 12].map((months) => (
                    <button
                      key={months}
                      onClick={() => setEmergencyMonths(months)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        background: emergencyMonths === months ? (months === 0 ? "#FF3B30" : "#007AFF") : "#F2F2F7",
                        color: emergencyMonths === months ? "#fff" : "#3C3C43",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {months === 0 ? t("noFund") : `${months}m`}
                    </button>
                  ))}
                </div>
                {emergencyMonths === 0 ? (
                  <div style={{ fontSize: 13, color: "#FF3B30", fontWeight: 500 }}>
                    {t("noFundNote")}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "#3C3C43" }}>
                      {t("target")}: <strong style={{ fontSize: 18, color: "#FF9500" }}>€{fmt(emergencyTarget)}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>
                      {t("perMonthMonths", { x: fmt(monthlyExpenses), n: emergencyMonths })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {(() => {
              const score = computeHealthScore(totalIncome, totalExpenses, investMonthly, emergencyMonths);
              if (!score) return null;
              const color = scoreColor(score.total);
              const weakest = [...score.breakdown].filter(b => b.noteKey).sort((a, b) => a.score - b.score)[0];
              return (
                <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{t("healthScore")}</div>
                      <div style={{ fontSize: 12, color: "#8E8E93" }}>{t("healthSub")}</div>
                    </div>
                    <button
                      onClick={handleExportPDF}
                      style={{
                        padding: "7px 14px", borderRadius: 20, border: "1.5px solid #E5E5EA",
                        cursor: "pointer", fontSize: 13, fontWeight: 600, background: "#fff",
                        color: "#3C3C43", display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      📄 {t("report")}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 24, alignItems: "center", flexDirection: isMobile ? "column" : "row" }}>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 64, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-3px" }}>{score.total}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color, marginTop: 4 }}>{t(scoreLabelKey(score.total))}</div>
                      <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>{t("outOf100")}</div>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                      {score.breakdown.map((item) => (
                        <div key={item.labelKey}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#3C3C43" }}>{t(item.labelKey)}</span>
                            <span style={{ fontSize: 12, color: "#8E8E93" }}>
                              {item.value} <span style={{ color: "#C7C7CC" }}>/ {item.target}</span>
                              <span style={{ marginLeft: 8, fontWeight: 700, color: scoreColor(item.score * 4) }}>{item.score}/25</span>
                            </span>
                          </div>
                          <div style={{ background: "#F2F2F7", borderRadius: 4, height: 6, overflow: "hidden" }}>
                            <div style={{ width: `${(item.score / 25) * 100}%`, height: "100%", background: scoreColor(item.score * 4), borderRadius: 4, transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {weakest && (
                    <div style={{ marginTop: 16, padding: "10px 14px", background: "#FFF8F0", borderRadius: 10, fontSize: 13, color: "#3C3C43" }}>
                      <span style={{ color: "#FF9500", fontWeight: 700 }}>↑ {t("biggestOpportunity")}: </span>{t(weakest.noteKey, weakest.noteVars)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "expenses" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["All", ...categories].map((category) => (
                <button
                  key={category}
                  onClick={() => setFilterCat(category)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    background: filterCat === category ? CATEGORY_COLORS[category]?.accent || "#007AFF" : "#fff",
                    color: filterCat === category ? "#fff" : "#3C3C43",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    transition: "all 0.2s",
                  }}
                >
                  {category !== "All" && `${CATEGORY_COLORS[category]?.icon || ""} `}{category === "All" ? t("all") : t.cat(category)}
                </button>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflowX: "auto" }}>
              <div style={{ minWidth: isMobile ? 720 : "auto" }}>
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #F2F2F7",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 40px",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#8E8E93",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <div>{t("col_item")}</div>
                  <div>{t("col_category")}</div>
                  <div style={{ textAlign: "right" }}>{t("col_amount")}</div>
                  <div>{t("col_frequency")}</div>
                  <div></div>
                </div>
                {filteredExpenses.map((item, index) => {
                  const monthly = freqToMonthly(item.amount, item.frequency);
                  const colorSet = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
                  const isEditing = editingExpense === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "12px 20px",
                        borderBottom: index < filteredExpenses.length - 1 ? "1px solid #F2F2F7" : "none",
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                        gap: 8,
                        alignItems: "center",
                        background: isEditing ? colorSet.bg : "transparent",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        onClick={() => {
                          if (!isEditing) {
                            setEditingExpense(item.id);
                          }
                        }}
                        style={{ cursor: isEditing ? "default" : "pointer" }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={item.name}
                            onChange={(event) => updateExpense(item.id, "name", event.target.value)}
                            style={{
                              width: "100%",
                              border: "none",
                              borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent",
                              fontSize: 14,
                              fontWeight: 500,
                              outline: "none",
                              padding: "2px 0",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                        )}
                      </div>
                      <div>
                        {isEditing ? (
                          <select
                            value={item.category}
                            onChange={(event) => updateExpense(item.id, "category", event.target.value)}
                            style={{
                              border: "none",
                              borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent",
                              fontSize: 12,
                              outline: "none",
                              padding: "2px 0",
                              width: "100%",
                            }}
                          >
                            {Object.keys(CATEGORY_COLORS).map((category) => (
                              <option key={category} value={category}>{t.cat(category)}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color: colorSet.accent,
                              fontWeight: 600,
                              background: colorSet.bg,
                              padding: "3px 8px",
                              borderRadius: 6,
                            }}
                          >
                            {colorSet.icon} {t.cat(item.category)}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(event) => updateExpense(item.id, "amount", event.target.value)}
                            style={{
                              width: "100%",
                              border: "none",
                              borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent",
                              fontSize: 14,
                              fontWeight: 600,
                              outline: "none",
                              textAlign: "right",
                              padding: "2px 0",
                            }}
                          />
                        ) : (
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>€{fmt(item.amount)}</div>
                            <div style={{ fontSize: 11, color: "#8E8E93" }}>€{fmt(monthly)}{t("perMo")}</div>
                          </div>
                        )}
                      </div>
                      <div>
                        {isEditing ? (
                          <select
                            value={item.frequency}
                            onChange={(event) => updateExpense(item.id, "frequency", event.target.value)}
                            style={{
                              border: "none",
                              borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent",
                              fontSize: 12,
                              outline: "none",
                              padding: "2px 0",
                              width: "100%",
                            }}
                          >
                            {FREQUENCIES.map((frequency) => (
                              <option key={frequency} value={frequency}>{t.freq(frequency)}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, color: "#8E8E93" }}>{t.freq(item.frequency)}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {isEditing && (
                          <button
                            onClick={() => { handleSave(); setEditingExpense(null); }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              border: "none",
                              background: "#E8FFF0",
                              color: "#34C759",
                              cursor: "pointer",
                              fontSize: 16,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => deleteExpense(item.id)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: "none",
                            background: "#FFE5E5",
                            color: "#FF3B30",
                            cursor: "pointer",
                            fontSize: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                {addingExpense ? (
                  <div
                    style={{
                      padding: "14px 20px",
                      borderTop: "2px solid #007AFF",
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr 40px",
                      gap: 8,
                      alignItems: "center",
                      background: "#F0F4FF",
                    }}
                  >
                    <input
                      placeholder={t("ph_name")}
                      value={newExpense.name}
                      onChange={(event) => setNewExpense((current) => ({ ...current, name: event.target.value }))}
                      style={{
                        border: "none",
                        borderBottom: "2px solid #007AFF",
                        background: "transparent",
                        fontSize: 14,
                        fontWeight: 500,
                        outline: "none",
                        padding: "4px 0",
                      }}
                    />
                    <select
                      value={newExpense.category}
                      onChange={(event) => setNewExpense((current) => ({ ...current, category: event.target.value }))}
                      style={{ border: "none", borderBottom: "2px solid #007AFF", background: "transparent", fontSize: 12, outline: "none" }}
                    >
                      {Object.keys(CATEGORY_COLORS).map((category) => (
                        <option key={category} value={category}>{t.cat(category)}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="0"
                      value={newExpense.amount || ""}
                      onChange={(event) =>
                        setNewExpense((current) => ({ ...current, amount: parseFloat(event.target.value) || 0 }))
                      }
                      style={{
                        border: "none",
                        borderBottom: "2px solid #007AFF",
                        background: "transparent",
                        fontSize: 14,
                        fontWeight: 600,
                        outline: "none",
                        textAlign: "right",
                      }}
                    />
                    <select
                      value={newExpense.frequency}
                      onChange={(event) => setNewExpense((current) => ({ ...current, frequency: event.target.value }))}
                      style={{ border: "none", borderBottom: "2px solid #007AFF", background: "transparent", fontSize: 12, outline: "none" }}
                    >
                      {FREQUENCIES.map((frequency) => (
                        <option key={frequency} value={frequency}>{t.freq(frequency)}</option>
                      ))}
                    </select>
                    <button
                      onClick={addExpense}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "none",
                        background: "#007AFF",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #F2F2F7" }}>
                    <button
                      onClick={() => setAddingExpense(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "none",
                        background: "transparent",
                        color: "#007AFF",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "#E3F0FF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}
                      >
                        +
                      </span>
                      {t("addExpense")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                background: "#fff",
                borderRadius: 14,
                padding: "14px 20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#3C3C43" }}>{t("totalExpenses")}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#FF3B30", textAlign: "right" }}>
                €{fmt(totalExpenses)}
                <span style={{ fontSize: 12, color: "#8E8E93", fontWeight: 400 }}>{t("perMo")}</span>
              </span>
            </div>
          </div>
        )}

        {activeTab === "income" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14, overflowX: "auto" }}>
              <div style={{ minWidth: isMobile ? 620 : "auto" }}>
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #F2F2F7",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 40px",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#8E8E93",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <div>{t("col_source")}</div>
                  <div style={{ textAlign: "right" }}>{t("col_amount")}</div>
                  <div>{t("col_frequency")}</div>
                  <div></div>
                </div>
                {income.map((item, index) => {
                  const monthly = freqToMonthly(item.amount, item.frequency);
                  const isEditing = editingIncome === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "14px 20px",
                        borderBottom: index < income.length - 1 ? "1px solid #F2F2F7" : "none",
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr auto",
                        gap: 8,
                        alignItems: "center",
                        background: isEditing ? "#F0FFF4" : "transparent",
                      }}
                    >
                      <div onClick={() => setEditingIncome(isEditing ? null : item.id)} style={{ cursor: "pointer" }}>
                        {isEditing ? (
                          <input
                            value={item.name}
                            onChange={(event) => updateIncome(item.id, "name", event.target.value)}
                            style={{
                              width: "100%",
                              border: "none",
                              borderBottom: "2px solid #34C759",
                              background: "transparent",
                              fontSize: 15,
                              fontWeight: 600,
                              outline: "none",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</span>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(event) => updateIncome(item.id, "amount", event.target.value)}
                            style={{
                              width: "100%",
                              border: "none",
                              borderBottom: "2px solid #34C759",
                              background: "transparent",
                              fontSize: 16,
                              fontWeight: 700,
                              outline: "none",
                              textAlign: "right",
                            }}
                          />
                        ) : (
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#34C759" }}>€{fmt(item.amount)}</div>
                            <div style={{ fontSize: 11, color: "#8E8E93" }}>€{fmt(monthly)}{t("perMo")}</div>
                          </div>
                        )}
                      </div>
                      <div>
                        {isEditing ? (
                          <select
                            value={item.frequency}
                            onChange={(event) => updateIncome(item.id, "frequency", event.target.value)}
                            style={{ border: "none", borderBottom: "2px solid #34C759", background: "transparent", fontSize: 13, outline: "none" }}
                          >
                            {FREQUENCIES.map((frequency) => (
                              <option key={frequency} value={frequency}>{t.freq(frequency)}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 13, color: "#8E8E93" }}>{t.freq(item.frequency)}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {isEditing && (
                          <button
                            onClick={() => { handleSave(); setEditingIncome(null); }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              border: "none",
                              background: "#E8FFF0",
                              color: "#34C759",
                              cursor: "pointer",
                              fontSize: 16,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => deleteIncome(item.id)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: "none",
                            background: "#FFE5E5",
                            color: "#FF3B30",
                            cursor: "pointer",
                            fontSize: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {addingIncome ? (
                  <div
                    style={{
                      padding: "14px 20px",
                      borderTop: "2px solid #34C759",
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 40px",
                      gap: 8,
                      alignItems: "center",
                      background: "#F0FFF4",
                    }}
                  >
                    <input
                      placeholder={t("ph_incomeSource")}
                      value={newIncome.name}
                      onChange={(event) => setNewIncome((current) => ({ ...current, name: event.target.value }))}
                      style={{ border: "none", borderBottom: "2px solid #34C759", background: "transparent", fontSize: 15, fontWeight: 600, outline: "none" }}
                    />
                    <input
                      type="number"
                      placeholder="0"
                      value={newIncome.amount || ""}
                      onChange={(event) => setNewIncome((current) => ({ ...current, amount: parseFloat(event.target.value) || 0 }))}
                      style={{
                        border: "none",
                        borderBottom: "2px solid #34C759",
                        background: "transparent",
                        fontSize: 16,
                        fontWeight: 700,
                        outline: "none",
                        textAlign: "right",
                      }}
                    />
                    <select
                      value={newIncome.frequency}
                      onChange={(event) => setNewIncome((current) => ({ ...current, frequency: event.target.value }))}
                      style={{ border: "none", borderBottom: "2px solid #34C759", background: "transparent", fontSize: 13, outline: "none" }}
                    >
                      {FREQUENCIES.map((frequency) => (
                        <option key={frequency} value={frequency}>{t.freq(frequency)}</option>
                      ))}
                    </select>
                    <button
                      onClick={addIncome}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "none",
                        background: "#34C759",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #F2F2F7" }}>
                    <button
                      onClick={() => setAddingIncome(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "none",
                        background: "transparent",
                        color: "#34C759",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "#E6FFF0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}
                      >
                        +
                      </span>
                      {t("addIncome")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: threeColGrid, gap: 12 }}>
              {[
                { label: t("totalIncome"), value: totalIncome, color: "#34C759" },
                { label: t("totalExpInvest"), value: totalExpenses + investMonthly, color: "#FF3B30" },
                { label: savings >= 0 ? t("remaining") : t("card_deficit"), value: Math.abs(savings), color: savings >= 0 ? "#007AFF" : "#FF3B30" },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    padding: "16px 18px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#8E8E93",
                      fontWeight: 500,
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {card.label}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>€{fmt(card.value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "suggestions" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1C1C1E" }}>{t("advisorTitle")}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8E8E93" }}>
                  {t("advisorSub")}
                </p>
              </div>
              <button
                onClick={generateSuggestions}
                disabled={suggestionsLoading || !loaded}
                style={{
                  padding: "10px 18px",
                  borderRadius: 22,
                  border: "none",
                  cursor: suggestionsLoading || !loaded ? "default" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  background: suggestionsLoading ? "#A0C4FF" : "#007AFF",
                  color: "#fff",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {suggestionsLoading ? `✨ ${t("analyzing")}` : suggestions ? `🔄 ${t("regenerate")}` : `✨ ${t("generate")}`}
              </button>
            </div>

            {suggestionsError && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "#FFE5E5", color: "#C00", fontSize: 13 }}>
                {suggestionsError}
              </div>
            )}

            {suggestionsLoading && !suggestions && (
              <div style={{ marginTop: 24, padding: 32, textAlign: "center", color: "#8E8E93", fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💭</div>
                {t("advisorLoading")}
              </div>
            )}

            {!suggestionsLoading && !suggestions && !suggestionsError && (
              <div style={{ marginTop: 24, padding: 32, textAlign: "center", color: "#8E8E93", fontSize: 14, lineHeight: 1.6 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🤔</div>
                {t("advisorEmpty")}
              </div>
            )}

            {suggestions && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #F2F2F7" }}>
                {renderMarkdown(suggestions)}
                <p style={{ marginTop: 24, fontSize: 11, color: "#8E8E93", fontStyle: "italic" }}>
                  ⚠️ {t("disclaimer")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {catModalCat && (() => {
        const catInfo = categoryTotals.find(c => c.name === catModalCat);
        const icon = (CATEGORY_COLORS[catModalCat] || CATEGORY_COLORS.Other).icon;
        const catExpenses = expenses.filter(e => e.category === catModalCat);
        return (
          <CategoryModal
            cat={catModalCat}
            color={catInfo?.color || "#007AFF"}
            icon={icon}
            catExpenses={catExpenses}
            closing={catModalClosing}
            onClose={closeCatModal}
            onUpdate={updateExpense}
            onDelete={deleteExpense}
            t={t}
            fmt={fmt}
          />
        );
      })()}

      {showImport && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowImport(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#1C1C1E" }}>
              Import from old account
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#8E8E93", lineHeight: 1.5 }}>
              Enter your old Clerk user ID (starts with <code style={{ fontFamily: "monospace", background: "#F2F2F7", padding: "1px 4px", borderRadius: 4 }}>user_</code>). You can find it in the Clerk dashboard or your browser&apos;s local storage under a previous session.
            </p>
            <input
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="user_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
                border: "1.5px solid #E5E5EA", outline: "none", fontFamily: "monospace",
                boxSizing: "border-box", marginBottom: 12,
              }}
            />
            {importError && (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#FF3B30" }}>{importError}</p>
            )}
            {importSuccess && (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#34C759", fontWeight: 600 }}>
                ✓ Data imported successfully!
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowImport(false)}
                style={{
                  padding: "9px 18px", borderRadius: 12, border: "1.5px solid #E5E5EA",
                  background: "#fff", color: "#3C3C43", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportFromOldAccount}
                disabled={!importInput.trim() || importLoading}
                style={{
                  padding: "9px 18px", borderRadius: 12, border: "none",
                  background: importInput.trim() && !importLoading ? "#007AFF" : "#A0C4FF",
                  color: "#fff", fontSize: 14, fontWeight: 600,
                  cursor: importInput.trim() && !importLoading ? "pointer" : "default",
                }}
              >
                {importLoading ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWalkthrough && (
        <Walkthrough
          onFinish={finishWalkthrough}
          labels={{ skip: t("wt_skip"), next: t("wt_next"), gotit: t("wt_gotit") }}
          steps={[
            { title: t("wt_welcome_title"), text: t("wt_welcome_text"), getTarget: () => null },
            { title: t("wt_income_title"), text: t("wt_income_text"), getTarget: () => tabRefs.current.income },
            { title: t("wt_expenses_title"), text: t("wt_expenses_text"), getTarget: () => tabRefs.current.expenses },
            { title: t("wt_overview_title"), text: t("wt_overview_text"), getTarget: () => tabRefs.current.overview },
          ]}
        />
      )}
    </div>
  );
}
