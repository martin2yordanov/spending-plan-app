import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/clerk-react";
import { LANGUAGES, LANG_KEY, makeT } from "./i18n";
import { FREQUENCIES, freqToMonthly, fmt, computeHealthScore, computeEmergencyFundCoverage, scoreColor, scoreLabelKey, parseAmount } from "./utils.js";

export const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const CATEGORY_COLORS = {
  Child: { bg: "#FFF0F5", accent: "#FF6B8A", icon: "👶" },
  Bills: { bg: "#F0F4FF", accent: "#5B8AF5", icon: "🏠" },
  Food: { bg: "#F0FFF4", accent: "#34C759", icon: "🍽️" },
  Car: { bg: "#FFF8F0", accent: "#FF9500", icon: "🚗" },
  Entertainment: { bg: "#F5F0FF", accent: "#AF52DE", icon: "🎭" },
  Personal: { bg: "#F0FFFE", accent: "#32ADE6", icon: "👤" },
  Medical: { bg: "#FFF0F0", accent: "#FF3B30", icon: "💊" },
  Holidays: { bg: "#FFFFF0", accent: "#FFCC00", icon: "✈️" },
  Other: { bg: "#F5F5F5", accent: "#6C6C70", icon: "📦" },
  Savings: { bg: "#F0FFF4", accent: "#30D158", icon: "💰" },
};

// Emoji choices offered when creating a brand-new category — a small,
// curated set covering common expense themes (kept short so the grid stays
// simple on mobile). Changing this list is always safe for existing data:
// a category stores the actual emoji character it was created with (see
// getCategoryMeta), not an index/reference into this array, so categories
// created with an emoji later removed from here keep rendering it fine.
const CATEGORY_EMOJI_CHOICES = [
  "🛒", "🏠", "💡", "👩", "👨", "🚗", "⛽", "🚌", "✈️",
  "🏖️", "🎓", "📚", "☕", "🍔", "🍕", "🍺", "🍷",
  "🎬", "🎮", "🎵", "📱", "💻", "👕", "👟", "🎁",
  "🏥", "💊", "🐱", "🐶", "🎨", "⚽", "🔧", "📦",
];

// Deterministic accent color for a custom category that has no explicit
// color of its own, so re-renders (and reloads) always pick the same shade.
const CATEGORY_PALETTE = ["#5AC8FA", "#FF6B8A", "#34C759", "#FF9500", "#AF52DE", "#32ADE6", "#FF3B30", "#FFCC00", "#30D158", "#5856D6"];
function paletteColorForKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

// Custom categories (new ones, or renames of built-ins) live in a
// `customCategories` map keyed by the same stable identifier stored on each
// expense (`{ [key]: { label?, icon?, color? } }`). These two helpers are
// the single place that resolves "how does this category look/read" so
// every render site (chips, dropdowns, charts, modal, PDF) stays in sync.
function getCategoryMeta(key, customCategories) {
  const custom = customCategories[key];
  const base = CATEGORY_COLORS[key];
  const accent = custom?.color ?? base?.accent ?? paletteColorForKey(key);
  return {
    icon: custom?.icon ?? base?.icon ?? "📦",
    accent,
    bg: base?.bg ?? `${accent}18`,
  };
}
function getCategoryLabel(key, customCategories, t) {
  return customCategories[key]?.label ?? t.cat(key);
}

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

const SYNC_KEY = "spending_sync_id";

function getSyncId() {
  let id = localStorage.getItem(SYNC_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem(SYNC_KEY, id);
  }
  return id;
}

async function loadData(id) {
  const res = await fetch(`/api/data?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return await res.json();
}

async function saveData(id, data) {
  const res = await fetch(`/api/data?id=${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
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
            style={{ border: "none", background: "transparent", color: "#6C6C70", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 }}
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

function CategoryModal({ cat, label, color, icon, catExpenses, closing, onClose, onUpdate, onDelete, t, fmt }) {
  const [editingId, setEditingId] = useState(null);
  const [amountStr, setAmountStr] = useState("");
  const catTotal = catExpenses.reduce((s, e) => s + freqToMonthly(e.amount, e.frequency), 0);

  const startEditing = (expense) => {
    setEditingId(expense.id);
    setAmountStr(String(expense.amount));
  };
  const commitAmount = (expenseId, currentAmount) => {
    const n = parseFloat(amountStr);
    onUpdate(expenseId, "amount", isNaN(n) ? currentAmount : n);
  };

  useEffect(() => {
    const scrollY = window.scrollY;
    const prev = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

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
              <div style={{ fontSize: 11, color: "#6C6C70", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>
                {t("categoryBreakdown")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", letterSpacing: "-0.5px" }}>
                {icon} {label}
              </div>
              <div style={{ fontSize: 13, color: color, fontWeight: 600, marginTop: 2 }}>
                €{fmt(catTotal)} / {t.freq("Monthly").toLowerCase()}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t("close")}
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
              <div style={{ textAlign: "center", padding: "40px 0", color: "#6C6C70", fontSize: 14 }}>
                {t("no_expenses_in_cat")}
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
                          <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_amount")} (€)</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={amountStr}
                            onChange={e => setAmountStr(e.target.value)}
                            onBlur={() => commitAmount(expense.id, expense.amount)}
                            style={{
                              fontSize: 16, fontWeight: 700, color: color, width: "100%",
                              border: "none", borderBottom: `2px solid ${color}`,
                              background: "transparent", outline: "none", paddingBottom: 2,
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_frequency")}</div>
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
                          🗑 {t("btn_delete")}
                        </button>
                        <button
                          onClick={() => { commitAmount(expense.id, expense.amount); setEditingId(null); }}
                          style={{
                            padding: "7px 18px", borderRadius: 10, border: "none",
                            background: color, color: "#fff", fontSize: 13,
                            fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          {t("btn_done")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                      onClick={() => startEditing(expense)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 2 }}>{expense.name}</div>
                        <div style={{ fontSize: 12, color: "#6C6C70" }}>
                          €{fmt(expense.amount)} · {t.freq(expense.frequency)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: color }}>€{fmt(monthly)}<span style={{ fontSize: 11, fontWeight: 400, color: "#6C6C70" }}>/mo</span></div>
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

// Bottom-sheet dialog for creating a brand-new expense category: a name
// field plus a small curated emoji grid. Mirrors CategoryModal's visual
// language (same slide-up sheet, same MODAL_CSS keyframes) so it reads as
// a natural extension of the app rather than a bolted-on feature.
function NewCategoryModal({ closing, onClose, onCreate, existingLabels, t }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const scrollY = window.scrollY;
    const prev = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed || !icon) return;
    if (existingLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("categoryExists"));
      return;
    }
    onCreate(trimmed, icon);
  };

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
            maxWidth: 420,
            maxHeight: "88vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            padding: "22px 22px 28px",
            animation: `${closing ? "sheetOut" : "sheetIn"} 0.3s cubic-bezier(0.32,0.72,0,1) forwards`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1C1C1E" }}>{t("createCategoryTitle")}</div>
            <button
              onClick={onClose}
              aria-label={t("close")}
              style={{
                width: 32, height: 32, borderRadius: "50%", border: "none",
                background: "#F2F2F7", cursor: "pointer", fontSize: 14, color: "#3C3C43", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >✕</button>
          </div>

          <input
            autoFocus
            placeholder={t("ph_categoryName")}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            style={{
              fontSize: 16, fontWeight: 600, color: "#1C1C1E",
              border: "none", borderBottom: "2px solid #007AFF",
              background: "transparent", outline: "none", padding: "6px 0",
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: "#FF3B30", marginTop: 6 }}>{error}</div>
          )}

          <div style={{ fontSize: 11, color: "#6C6C70", textTransform: "uppercase", letterSpacing: 0.5, margin: "20px 0 10px" }}>
            {t("pickEmoji")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))", gap: 8 }}>
            {CATEGORY_EMOJI_CHOICES.map((e) => {
              const selected = icon === e;
              return (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  aria-label={e}
                  style={{
                    width: 42, height: 42, borderRadius: 12,
                    border: selected ? "2px solid #007AFF" : "1.5px solid transparent",
                    background: selected ? "#E3F0FF" : "#F9F9FB",
                    fontSize: 20, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
            <button
              onClick={onClose}
              style={{ padding: "9px 18px", borderRadius: 12, border: "1.5px solid #E5E5EA", background: "#fff", color: "#3C3C43", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              {t("btn_cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || !icon}
              style={{
                padding: "9px 18px", borderRadius: 12, border: "none",
                background: name.trim() && icon ? "#007AFF" : "#A0C4FF",
                color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: name.trim() && icon ? "pointer" : "default",
              }}
            >
              + {t("btn_create")}
            </button>
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
      {/* Visual layer: pop-out + thicken on hover. pointerEvents is off so its
          own animation can never move the hit target it's drawn from — that
          feedback loop (hover moves the shape -> cursor falls off it ->
          un-hover -> shape snaps back -> re-hover -> ...) is what caused the
          flicker at segment edges. */}
      {segments.map((segment, index) => {
        const isActive = activeCategory === segment.name;
        const hasActive = activeCategory !== null;
        const dx = isActive ? POP * Math.cos(segment.midAngle) : 0;
        const dy = isActive ? POP * Math.sin(segment.midAngle) : 0;
        return (
          <circle
            key={`visual-${index}`}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={segment.color}
            strokeWidth={isActive ? strokeWidth + 5 : strokeWidth}
            strokeDasharray={segment.dasharray}
            strokeDashoffset={segment.dashoffset}
            strokeLinecap="butt"
            pointerEvents="none"
            style={{
              transform: `translate(${dx}px, ${dy}px)`,
              transition: "transform 0.22s ease, stroke-width 0.22s ease, opacity 0.22s ease",
              opacity: hasActive && !isActive ? 0.3 : 1,
            }}
          />
        );
      })}
      {/* Hit-test layer: fixed geometry regardless of hover state, wide
          enough to cover the popped-out visual so hovering the animated
          wedge always still counts as hovering its (stationary) hit area. */}
      {segments.map((segment, index) => {
        const isActive = activeCategory === segment.name;
        return (
          <circle
            key={`hit-${index}`}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth + POP + 6}
            strokeDasharray={segment.dasharray}
            strokeDashoffset={segment.dashoffset}
            strokeLinecap="butt"
            pointerEvents="stroke"
            style={{ opacity: 0, cursor: "pointer" }}
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
  const [syncId] = useState(() => getSyncId());
  const [income, setIncome] = useState(EXAMPLE_INCOME);
  const [expenses, setExpenses] = useState(EXAMPLE_EXPENSES);
  const [invest, setInvest] = useState(EXAMPLE_INVEST);
  const [investStr, setInvestStr] = useState(String(EXAMPLE_INVEST));
  const [investLabel, setInvestLabel] = useState(EXAMPLE_INVEST_LABEL);
  const [activeCategory, setActiveCategory] = useState(null);
  const [catModalCat, setCatModalCat] = useState(null);
  const [catModalClosing, setCatModalClosing] = useState(false);
  const [showInvestMenu, setShowInvestMenu] = useState(false);
  const investMenuRef = useRef(null);
  const [emergencyMonths, setEmergencyMonths] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [auth, setAuth] = useState(null); // { userId, email } when signed in, else null
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [undoInfo, setUndoInfo] = useState(null); // { name, restore } for the delete-undo toast
  const undoTimerRef = useRef(null);
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
  const expensesSectionRef = useRef(null);
  const incomeSectionRef = useRef(null);
  const editingExpenseStateRef = useRef({ id: null, amountStr: "" });
  const editingIncomeStateRef = useRef({ id: null, amountStr: "" });
  const [activeTab, setActiveTab] = useState("overview");
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingIncomeAmountStr, setEditingIncomeAmountStr] = useState("");
  const [editingIncomeFocusField, setEditingIncomeFocusField] = useState("name");
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingExpenseAmountStr, setEditingExpenseAmountStr] = useState("");
  const [editingExpenseFocusField, setEditingExpenseFocusField] = useState("name");
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
  const [savingsAccounts, setSavingsAccounts] = useState([]);
  const [addingSavings, setAddingSavings] = useState(false);
  const [newSavings, setNewSavings] = useState({ name: "", amount: 0, target: "", targetMonth: "", type: "cash" });
  const [editingSavings, setEditingSavings] = useState(null);
  const [categoryLimits, setCategoryLimits] = useState({});
  const [editingLimitCat, setEditingLimitCat] = useState(null);
  const [limitInput, setLimitInput] = useState("");
  const [bills, setBills] = useState([]);
  const [savedFlag, setSavedFlag] = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [customCategories, setCustomCategories] = useState({}); // { [key]: { label?, icon?, color? } }
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryModalClosing, setNewCategoryModalClosing] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [renameInput, setRenameInput] = useState("");
  const lastCategoryTapRef = useRef({ key: null, time: 0 });
  const [suggestions, setSuggestions] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);

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

  const closeNewCategoryModal = useCallback(() => {
    setNewCategoryModalClosing(true);
    setTimeout(() => { setShowNewCategoryModal(false); setNewCategoryModalClosing(false); }, 300);
  }, []);

  // Keep the editable investment text field in sync when the value changes
  // from elsewhere (slider, loading saved data).
  useEffect(() => { setInvestStr(String(invest)); }, [invest]);

  // Delete-with-undo: run the delete, then offer a 6s window to restore.
  const deleteWithUndo = useCallback((name, doDelete, restore) => {
    doDelete();
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ name, restore });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 6000);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo((info) => {
      info?.restore();
      return null;
    });
  }, []);

  // Every category the app knows about — the fixed built-ins plus any
  // custom ones the user created — regardless of whether an expense
  // currently uses it. Drives the filter chips and every category <select>.
  const allCategoryKeys = useMemo(() => {
    const keys = [...new Set([...Object.keys(CATEGORY_COLORS), ...Object.keys(customCategories)])];
    return keys.sort((a, b) => getCategoryLabel(a, customCategories, t).localeCompare(getCategoryLabel(b, customCategories, t)));
  }, [customCategories, t]);

  // Single/double click (or tap) unification: a normal click/tap selects
  // the filter as before; a second one landing within the window opens
  // rename. Works the same for touch and mouse, so it doesn't depend on the
  // browser's native dblclick timing/support.
  const handleCategoryChipActivate = useCallback((category) => {
    if (category === "All") { setFilterCat("All"); return; }
    const now = Date.now();
    const last = lastCategoryTapRef.current;
    if (last.key === category && now - last.time < 400) {
      lastCategoryTapRef.current = { key: null, time: 0 };
      setRenamingCategory(category);
      setRenameInput(getCategoryLabel(category, customCategories, t));
    } else {
      lastCategoryTapRef.current = { key: category, time: now };
      setFilterCat(category);
    }
  }, [customCategories, t]);

  const openRenameCategory = useCallback((category) => {
    setRenamingCategory(category);
    setRenameInput(getCategoryLabel(category, customCategories, t));
  }, [customCategories, t]);

  const commitRenameCategory = useCallback(() => {
    setRenamingCategory((key) => {
      const label = renameInput.trim();
      if (key && label) {
        setCustomCategories((current) => ({ ...current, [key]: { ...current[key], label } }));
      }
      return null;
    });
    setRenameInput("");
  }, [renameInput]);

  const cancelRenameCategory = useCallback(() => {
    setRenamingCategory(null);
    setRenameInput("");
  }, []);

  const handleCreateCategory = useCallback((name, icon) => {
    const key = name.trim();
    if (!key) return;
    setCustomCategories((current) => ({ ...current, [key]: { icon } }));
    setFilterCat(key);
    closeNewCategoryModal();
  }, [closeNewCategoryModal]);

  useEffect(() => {
    // Logged out: show example demo data, no backend reads/writes.
    if (!auth?.userId) {
      skipNextSaveRef.current = true;
      setIncome(EXAMPLE_INCOME);
      setExpenses(EXAMPLE_EXPENSES);
      setInvest(EXAMPLE_INVEST);
      setEmergencyMonths(3);
      setCategoryLimits({});
      setBills([]);
      setCustomCategories({});
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
          if (saved.savingsAccounts) setSavingsAccounts(saved.savingsAccounts);
          if (saved.categoryLimits) setCategoryLimits(saved.categoryLimits);
          if (saved.bills) setBills(saved.bills);
          if (saved.customCategories) setCustomCategories(saved.customCategories);
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
              if (legacy.savingsAccounts) setSavingsAccounts(legacy.savingsAccounts);
              if (legacy.categoryLimits) setCategoryLimits(legacy.categoryLimits);
              if (legacy.bills) setBills(legacy.bills);
              if (legacy.customCategories) setCustomCategories(legacy.customCategories);
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
    setSaveError(false);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveData(auth.userId, { income, expenses, invest, investLabel, emergencyMonths, savingsAccounts, categoryLimits, bills, customCategories })
        .then(() => {
          setIsDirty(false);
          setSaveError(false);
          setSavedFlag(true);
          setTimeout(() => setSavedFlag(false), 2000);
        })
        .catch(() => {
          setIsDirty(false);
          setSaveError(true);
        });
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [loaded, income, expenses, invest, investLabel, emergencyMonths, savingsAccounts, categoryLimits, bills, customCategories, auth?.userId]);

  // Warn before leaving with unsaved (or failed-to-save) changes.
  useEffect(() => {
    if (!auth?.userId) return;
    function onBeforeUnload(e) {
      if (isDirty || saveError) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, saveError, auth?.userId]);

  useEffect(() => {
    if (!showInvestMenu) return;
    function handleClick(e) {
      if (investMenuRef.current && !investMenuRef.current.contains(e.target)) {
        setShowInvestMenu(false);
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

  // Keep refs mirroring the latest in-progress edit so the click-outside
  // handler below (a stable, mount-once listener) always sees current
  // values without needing to resubscribe on every keystroke.
  useEffect(() => {
    editingExpenseStateRef.current = { id: editingExpense, amountStr: editingExpenseAmountStr };
  }, [editingExpense, editingExpenseAmountStr]);
  useEffect(() => {
    editingIncomeStateRef.current = { id: editingIncome, amountStr: editingIncomeAmountStr };
  }, [editingIncome, editingIncomeAmountStr]);

  // Clicking outside the Expenses/Income table while a row is being edited
  // commits the pending amount and closes the row, instead of leaving it
  // stuck open.
  useEffect(() => {
    function handleClickOutsideTables(e) {
      const exp = editingExpenseStateRef.current;
      if (exp.id != null && expensesSectionRef.current && !expensesSectionRef.current.contains(e.target)) {
        updateExpense(exp.id, "amount", exp.amountStr);
        setEditingExpense(null);
      }
      const inc = editingIncomeStateRef.current;
      if (inc.id != null && incomeSectionRef.current && !incomeSectionRef.current.contains(e.target)) {
        setIncome((current) =>
          current.map((item) =>
            item.id === inc.id ? { ...item, amount: parseAmount(inc.amountStr, item.amount) } : item,
          ),
        );
        setEditingIncome(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutsideTables);
    return () => document.removeEventListener("mousedown", handleClickOutsideTables);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads latest state via refs, intentionally mount-once
  }, []);

  const totalIncome = income.reduce((sum, item) => sum + freqToMonthly(item.amount, item.frequency), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + freqToMonthly(item.amount, item.frequency), 0);
  const totalSavingsBalance = savingsAccounts.reduce((sum, a) => sum + (a.amount || 0), 0);
  const investMonthly = freqToMonthly(invest, "Monthly");
  const savings = totalIncome - totalExpenses - investMonthly;
  // Let the slider grow past its default 1000 ceiling so it never misrepresents
  // a larger value typed into the number field.
  const investSliderMax = Math.max(1000, Math.ceil(invest / 100) * 100);

  // Shared handlers for the editable investment number field (Overview + Savings).
  const onInvestInput = (v) => {
    setInvestStr(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setInvest(n);
  };
  const onInvestBlur = () => {
    const n = parseFloat(investStr);
    const val = isNaN(n) ? 0 : n;
    setInvest(val);
    setInvestStr(String(val));
  };

  const categories = [...new Set(expenses.map((item) => item.category))].sort();
  const categoryTotals = categories
    .map((category) => ({
      name: category,
      value: expenses
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + freqToMonthly(item.amount, item.frequency), 0),
      color: getCategoryMeta(category, customCategories).accent,
    }))
    .sort((a, b) => b.value - a.value);

  const monthlyExpenses = totalExpenses + investMonthly;
  const emergencyTarget = monthlyExpenses * emergencyMonths;
  // Emergency Fund coverage is the user's real safety net, not just money
  // explicitly labeled "Emergency Fund" — every savings account contributes,
  // weighted by how reliably it could be tapped (see computeEmergencyFundCoverage).
  const emergencyCoverage = useMemo(() => computeEmergencyFundCoverage(savingsAccounts), [savingsAccounts]);
  const emergencyCoveragePct = emergencyTarget > 0 ? (emergencyCoverage.total / emergencyTarget) * 100 : 0;

  // Safe-to-spend: what's left this month spread over the remaining days (incl. today).
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeftInMonth = daysInMonth - now.getDate() + 1;
  const safeToSpendDaily = savings / daysLeftInMonth;

  const generateSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ income, expenses, invest, investLabel, emergencyMonths, savingsAccounts, totalSavingsBalance, categoryLimits, bills, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `API ${res.status}`);
      setSuggestions(data.suggestions ?? "");
    } catch {
      // Show a friendly message instead of leaking internal error strings.
      setSuggestionsError(t("advisorError"));
    } finally {
      setSuggestionsLoading(false);
    }
  }, [income, expenses, invest, investLabel, emergencyMonths, savingsAccounts, totalSavingsBalance, categoryLimits, bills, lang, t]);

  // Manual retry used by the "Couldn't save" indicator in the header.
  const retrySave = useCallback(() => {
    if (!loaded || !auth?.userId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveError(false);
    setIsDirty(true);
    saveData(auth.userId, { income, expenses, invest, investLabel, emergencyMonths, savingsAccounts, categoryLimits, bills, customCategories })
      .then(() => {
        setIsDirty(false);
        setSaveError(false);
        setSavedFlag(true);
        window.setTimeout(() => setSavedFlag(false), 2000);
      })
      .catch(() => {
        setIsDirty(false);
        setSaveError(true);
      });
  }, [emergencyMonths, expenses, income, invest, investLabel, loaded, auth, savingsAccounts, categoryLimits, bills, customCategories]);

  const handleExportPDF = useCallback(() => {
    const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    const tIncome = income.reduce((s, i) => s + freqToMonthly(i.amount, i.frequency), 0);
    const tExpenses = expenses.reduce((s, e) => s + freqToMonthly(e.amount, e.frequency), 0);
    const tInvest = invest;
    const tSavings = tIncome - tExpenses - tInvest;
    const score = computeHealthScore(tIncome, tExpenses, tInvest, emergencyCoverage.total);

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
          <td colspan="3" style="padding:8px 10px;font-weight:700;font-size:12px">${getCategoryMeta(cat, customCategories).icon} ${getCategoryLabel(cat, customCategories, t)}</td>
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
      </div>
      <p style="margin-top:14px;font-size:12.5px;color:#555;line-height:1.5">
        ${t("report_emergencyCoverage", { total: fmt(emergencyCoverage.total), dedicated: fmt(emergencyCoverage.dedicated), savings: fmt(emergencyCoverage.fromSavings) })}
      </p>` : "";

    const savingsHtml = (savingsAccounts && savingsAccounts.length) ? `
      <h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #30D158;color:#30D158">${t("savings_title")}</h2>
      <table>
        <thead><tr><th>${t("col_account")}</th><th>${t("goal_label")}</th><th style="text-align:right">${t("col_balance")}</th></tr></thead>
        <tbody>
          ${savingsAccounts.map(a => {
            const bal = Number(a.amount) || 0;
            const target = Number(a.target) || 0;
            const goal = target > 0 ? `€${fmt(target)}${a.targetMonth ? ` · ${a.targetMonth}` : ""} (${((bal / target) * 100).toFixed(0)}%)` : "—";
            const typeTag = a.type === "emergency" ? ` <span style="font-size:10px;color:#007AFF">(${t("type_emergency")})</span>`
              : a.type === "investment" ? ` <span style="font-size:10px;color:#AF52DE">(${t("type_investment")}, 80%)</span>`
              : "";
            return `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-weight:600">${a.name}${typeTag}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#888">${goal}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#30D158">€${fmt(bal)}</td>
            </tr>`;
          }).join("")}
          <tr><td colspan="2" style="padding:8px 10px;font-weight:700">${t("totalSavings")}</td><td style="padding:8px 10px;text-align:right;font-weight:800;color:#30D158">€${fmt(savingsAccounts.reduce((s, a) => s + (Number(a.amount) || 0), 0))}</td></tr>
        </tbody>
      </table>` : "";

    const billsHtml = (bills && bills.length) ? `
      <h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #FF9500;color:#FF9500">${t("bills_title")}</h2>
      <table>
        <thead><tr><th>${t("ph_billName")}</th><th>${t("bill_dueDay")}</th><th style="text-align:right">${t("col_amount")}</th></tr></thead>
        <tbody>
          ${bills.map(b => `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-weight:600">${b.name}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#888">${t("bill_dayOfMonth", { d: b.dueDay })}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700">€${fmt(Number(b.amount) || 0)}</td>
          </tr>`).join("")}
          <tr><td colspan="2" style="padding:8px 10px;font-weight:700">${t("bills_total")}</td><td style="padding:8px 10px;text-align:right;font-weight:800">€${fmt(bills.reduce((s, b) => s + (Number(b.amount) || 0), 0))}</td></tr>
        </tbody>
      </table>` : "";

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
    @media print { #dl-bar { display: none !important } body { padding: 0 } }
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
      const bar = document.getElementById('dl-bar');
      // Fallback to the browser's print-to-PDF if the CDN library is unavailable
      // (e.g. offline or blocked).
      if (typeof html2pdf === 'undefined') {
        window.print();
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Generating…';
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
      }).catch(function() {
        bar.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = '⬇ Download PDF';
        window.print();
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

  ${savingsHtml}
  ${billsHtml}

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
  }, [income, expenses, invest, investLabel, emergencyMonths, emergencyCoverage, savingsAccounts, bills, customCategories, syncId, auth, t]);

  const updateExpense = (id, field, value) => {
    setExpenses((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "amount" ? parseAmount(value, item.amount) : value }
          : item,
      ),
    );
  };

  const deleteExpense = (id) => {
    const removed = expenses.find((item) => item.id === id);
    const idx = expenses.findIndex((item) => item.id === id);
    if (!removed) return;
    deleteWithUndo(
      removed.name,
      () => setExpenses((current) => current.filter((item) => item.id !== id)),
      () => setExpenses((current) => {
        const next = current.slice();
        next.splice(Math.min(idx, next.length), 0, removed);
        return next;
      }),
    );
  };

  const updateIncome = (id, field, value) => {
    setIncome((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "amount" ? parseAmount(value, item.amount) : value }
          : item,
      ),
    );
  };

  // Income amount editing uses a string buffer so decimals ("12.5") survive
  // re-renders; the number is committed on blur/done.
  const startEditingIncome = (item, focusField = "name") => {
    setEditingIncome(item.id);
    setEditingIncomeAmountStr(String(item.amount));
    setEditingIncomeFocusField(focusField);
  };
  const commitIncomeAmount = (id) => {
    setIncome((current) =>
      current.map((item) =>
        item.id === id ? { ...item, amount: parseAmount(editingIncomeAmountStr, item.amount) } : item,
      ),
    );
  };

  const deleteIncome = (id) => {
    const removed = income.find((item) => item.id === id);
    const idx = income.findIndex((item) => item.id === id);
    if (!removed) return;
    setEditingIncome(null);
    deleteWithUndo(
      removed.name,
      () => setIncome((current) => current.filter((item) => item.id !== id)),
      () => setIncome((current) => {
        const next = current.slice();
        next.splice(Math.min(idx, next.length), 0, removed);
        return next;
      }),
    );
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

  const deleteSavings = (id) => {
    const removed = savingsAccounts.find((a) => a.id === id);
    const idx = savingsAccounts.findIndex((a) => a.id === id);
    if (!removed) return;
    setEditingSavings(null);
    deleteWithUndo(
      removed.name,
      () => setSavingsAccounts((current) => current.filter((a) => a.id !== id)),
      () => setSavingsAccounts((current) => {
        const next = current.slice();
        next.splice(Math.min(idx, next.length), 0, removed);
        return next;
      }),
    );
  };

  const filteredExpenses = filterCat === "All" ? expenses : expenses.filter((item) => item.category === filterCat);
  // Show every category with spending so the drawn segments always sum to the
  // total shown in the donut's center (avoids a phantom empty wedge).
  const donutData = categoryTotals.filter((c) => c.value > 0);
  const contentWidth = isMobile ? "100%" : 960;
  const threeColGrid = isMobile ? "1fr" : "repeat(3, 1fr)";
  const twoColGrid = isMobile ? "1fr" : "1fr 1fr";

  // Header save-status pill (signed-in only): saving / saved / retry.
  const saveStatus = (
    saveError ? (
      <button
        onClick={retrySave}
        style={{
          padding: "6px 12px", borderRadius: 20, border: "1.5px solid #FFD2CF",
          background: "#FFF0EF", color: "#FF3B30", fontSize: 12, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
        }}
      >
        ⚠ {t("saveFailed")} · {t("retry")}
      </button>
    ) : isDirty ? (
      <span style={{ fontSize: 12, fontWeight: 500, color: "#6C6C70", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF9500", display: "inline-block" }} />
        {t("saving")}
      </span>
    ) : savedFlag ? (
      <span style={{ fontSize: 12, fontWeight: 500, color: "#34C759", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
        ✓ {t("saved")}
      </span>
    ) : null
  );

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
        {isMobile ? (
          /* ── Mobile header ── */
          <div style={{ maxWidth: contentWidth, margin: "0 auto" }}>
            {/* Row 1: title + icon actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, paddingBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px" }}>{t("appTitle")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isSignedIn && saveStatus}
                {/* Language icon */}
                <div style={{ position: "relative" }} ref={langMenuRef}>
                  <button
                    onClick={() => setShowLangMenu(v => !v)}
                    aria-label="Language"
                    style={{
                      width: 34, height: 34, borderRadius: "50%", border: "1.5px solid #E5E5EA",
                      background: showLangMenu ? "#F2F2F7" : "#fff", cursor: "pointer",
                      fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {LANGUAGES.find(l => l.code === lang)?.flag}
                  </button>
                  {showLangMenu && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0,
                      background: "#fff", border: "1.5px solid #E5E5EA", borderRadius: 12,
                      padding: 6, minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 200,
                    }}>
                      {LANGUAGES.map(l => (
                        <button key={l.code} onClick={() => changeLang(l.code)} style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%",
                          padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                          fontSize: 14, fontWeight: lang === l.code ? 700 : 500,
                          background: lang === l.code ? "#F2F2F7" : "transparent", color: "#1C1C1E", textAlign: "left",
                        }}>
                          <span style={{ fontSize: 16 }}>{l.flag}</span>
                          {l.label}
                          {lang === l.code && <span style={{ marginLeft: "auto", color: "#007AFF" }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auth (UserButton or SignIn) */}
                {CLERK_ENABLED && <AuthBridge onAuthChange={handleAuthChange} isMobile={false} signInLabel={t("signIn")} />}
              </div>
            </div>

            {/* Row 2: tabs in a single scrollable row, with a right fade to hint
                that more tabs lie off-screen. */}
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, paddingRight: 24,
                scrollbarWidth: "none", msOverflowStyle: "none",
              }}>
                {["overview", "expenses", "income", "savings", "suggestions"].map(tab => (
                  <button
                    key={tab}
                    ref={el => { tabRefs.current[tab] = el; }}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flexShrink: 0,
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      background: activeTab === tab ? "#007AFF" : "transparent",
                      color: activeTab === tab ? "#fff" : "#3C3C43",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t(`tab_${tab}`)}
                  </button>
                ))}
              </div>
              <div style={{
                position: "absolute", right: 0, top: 0, bottom: 8, width: 28,
                pointerEvents: "none",
                background: "linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.95))",
              }} />
            </div>
          </div>
        ) : (
          /* ── Desktop header ── */
          <div
            style={{
              maxWidth: contentWidth,
              margin: "0 auto",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 56,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>💳</span>
              <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>{t("appTitle")}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["overview", "expenses", "income", "savings", "suggestions"].map((tab) => (
                <button
                  key={tab}
                  ref={(el) => { tabRefs.current[tab] = el; }}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 500,
                    background: activeTab === tab ? "#007AFF" : "transparent",
                    color: activeTab === tab ? "#fff" : "#3C3C43",
                    transition: "all 0.2s",
                  }}
                >
                  {t(`tab_${tab}`)}
                </button>
              ))}
            </div>
            {isSignedIn && saveStatus}
            <div style={{ position: "relative" }} ref={langMenuRef}>
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                title="Language"
                style={{
                  padding: "7px 12px", borderRadius: 20, border: "1.5px solid #E5E5EA",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: showLangMenu ? "#F2F2F7" : "#fff", color: "#3C3C43",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {LANGUAGES.find((l) => l.code === lang)?.flag} {lang.toUpperCase()}
              </button>
              {showLangMenu && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  background: "#fff", border: "1.5px solid #E5E5EA", borderRadius: 12,
                  padding: 6, minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 200,
                }}>
                  {LANGUAGES.map((l) => (
                    <button key={l.code} onClick={() => changeLang(l.code)} style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontSize: 14, fontWeight: lang === l.code ? 700 : 500,
                      background: lang === l.code ? "#F2F2F7" : "transparent",
                      color: "#1C1C1E", textAlign: "left",
                    }}>
                      <span style={{ fontSize: 16 }}>{l.flag}</span>
                      {l.label}
                      {lang === l.code && <span style={{ marginLeft: "auto", color: "#007AFF" }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {CLERK_ENABLED && <AuthBridge onAuthChange={handleAuthChange} isMobile={false} signInLabel={t("signIn")} />}
          </div>
        )}
      </div>

      {loaded && (!CLERK_ENABLED || (!isSignedIn)) && (
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
            <span>📊 {CLERK_ENABLED ? t("demoBanner") : t("localBanner")}</span>
          </div>
        </div>
      )}

      {loadError && loaded && isSignedIn && (
        <div style={{ background: "#FFF0EF", borderBottom: "1px solid #FFD2CF", padding: isMobile ? "10px 16px" : "10px 24px" }}>
          <div style={{ maxWidth: contentWidth, margin: "0 auto", fontSize: 13, color: "#C0261C", display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️ {t("loadFailed")}</span>
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
                borderRadius: 18,
                padding: isMobile ? "18px 20px" : "20px 24px",
                marginBottom: 14,
                color: "#fff",
                background: savings >= 0
                  ? "linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%)"
                  : "linear-gradient(135deg, #FF3B30 0%, #FF9500 100%)",
                boxShadow: savings >= 0 ? "0 6px 24px rgba(0,122,255,0.25)" : "0 6px 24px rgba(255,59,48,0.25)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", opacity: 0.85, marginBottom: 4 }}>
                  {savings >= 0 ? `☀️ ${t("sts_title")}` : `⚠️ ${t("sts_overTitle")}`}
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1 }}>
                  €{fmt(Math.abs(safeToSpendDaily))}
                  <span style={{ fontSize: 15, fontWeight: 500, opacity: 0.85 }}>{t("sts_perDay")}</span>
                </div>
              </div>
              <div style={{ textAlign: isMobile ? "left" : "right", fontSize: 13, fontWeight: 500, opacity: 0.95, lineHeight: 1.5 }}>
                {savings >= 0
                  ? t("sts_leftThisMonth", { x: fmt(savings) })
                  : t("sts_overThisMonth", { x: fmt(Math.abs(savings)) })}
                <br />
                {t("sts_daysLeft", { n: daysLeftInMonth })}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: threeColGrid,
                gap: 14,
                marginBottom: 20,
              }}
            >
              {[
                { label: t("card_monthlyIncome"), value: totalIncome, color: "#34C759", sub: t("card_totalEarnings"), pct: null, tab: "income" },
                { label: t("card_monthlyExpenses"), value: totalExpenses, color: "#FF3B30", sub: t("card_allOutgoings"), pct: totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : null, tab: "expenses" },
                {
                  label: savings >= 0 ? t("card_netSavings") : t("card_deficit"),
                  value: Math.abs(savings),
                  color: savings >= 0 ? "#007AFF" : "#FF3B30",
                  sub: savings >= 0 ? t("card_afterAll") : t("card_overBudget"),
                  pct: totalIncome > 0 ? (savings / totalIncome) * 100 : null,
                  tab: "savings",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  onClick={() => card.tab && setActiveTab(card.tab)}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    padding: "20px 22px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: card.tab ? "pointer" : "default",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={e => { if (card.tab) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6C6C70",
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
                    <div style={{ fontSize: 12, color: "#6C6C70", marginTop: 4 }}>{card.sub}</div>
                  </div>
                  {card.pct !== null && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        fontSize: 22, fontWeight: 700, color: card.color, opacity: 0.8,
                        letterSpacing: "-0.5px",
                      }}>
                        {card.pct >= 0 ? "" : "−"}{Math.abs(card.pct).toFixed(0)}%
                      </div>
                      <div style={{ fontSize: 10, color: "#6C6C70", marginTop: 2 }}>{t("ofIncome")}</div>
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
                            <div style={{ fontSize: 10, color: "#6C6C70", maxWidth: 60, lineHeight: 1.2 }}>{getCategoryLabel(ac.name, customCategories, t)}</div>
                          </>
                        ) : null;
                      })() : (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E" }}>€{fmt(totalExpenses)}</div>
                          <div style={{ fontSize: 11, color: "#6C6C70" }}>{t("total")}</div>
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
                          <div style={{ flex: 1, fontSize: 12, color: "#3C3C43", fontWeight: isActive ? 700 : 500 }}>{getCategoryLabel(item.name, customCategories, t)}</div>
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
                    const limit = parseFloat(categoryLimits[item.name]) || 0;
                    const limitPct = limit > 0 ? (item.value / limit) * 100 : 0;
                    const overLimit = limit > 0 && limitPct > 100;
                    const nearLimit = limit > 0 && !overLimit && limitPct >= 90;
                    const barPct = limit > 0 ? limitPct : pct;
                    const barColor = overLimit ? "#FF3B30" : nearLimit ? "#FF9500" : item.color;
                    const isEditingLimit = editingLimitCat === item.name;
                    const commitLimit = () => {
                      const n = parseFloat(limitInput);
                      setCategoryLimits((current) => {
                        const next = { ...current };
                        if (isNaN(n) || n <= 0) delete next[item.name];
                        else next[item.name] = n;
                        return next;
                      });
                      setEditingLimitCat(null);
                      setLimitInput("");
                    };
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#1C1C1E" : "#3C3C43", display: "flex", alignItems: "center", gap: 6 }}>
                            {getCategoryMeta(item.name, customCategories).icon} {getCategoryLabel(item.name, customCategories, t)}
                            {overLimit && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#FF3B30", padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>
                                {t("overLimit")}
                              </span>
                            )}
                            {nearLimit && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#FF9500", padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>
                                {t("nearLimit")}
                              </span>
                            )}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                            €{fmt(item.value)}{" "}
                            <span style={{ color: overLimit ? "#FF3B30" : nearLimit ? "#FF9500" : "#6C6C70", fontWeight: limit > 0 ? 600 : 400 }}>
                              {limit > 0 ? `/ €${fmt(limit)} (${limitPct.toFixed(0)}%)` : `(${pct.toFixed(0)}%)`}
                            </span>
                          </span>
                        </div>
                        <div style={{ background: "#F2F2F7", borderRadius: 4, height: 6, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(barPct, 100)}%`,
                              height: "100%",
                              background: barColor,
                              borderRadius: 4,
                              transition: "width 0.6s ease, background 0.3s ease",
                            }}
                          />
                        </div>
                        <div style={{ marginTop: 3 }} onClick={(e) => e.stopPropagation()}>
                          {isEditingLimit ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                autoFocus
                                type="text"
                                inputMode="decimal"
                                value={limitInput}
                                onChange={(e) => setLimitInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") commitLimit(); if (e.key === "Escape") { setEditingLimitCat(null); setLimitInput(""); } }}
                                placeholder={t("ph_limit")}
                                style={{
                                  width: 90, fontSize: 12, fontWeight: 600, color: item.color,
                                  border: "none", borderBottom: `2px solid ${item.color}`,
                                  background: "transparent", outline: "none", padding: "1px 0",
                                }}
                              />
                              <button
                                onClick={commitLimit}
                                style={{ border: "none", background: item.color, color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 8, cursor: "pointer" }}
                              >
                                {t("btn_save_limit")}
                              </button>
                              {limit > 0 && (
                                <button
                                  onClick={() => {
                                    setCategoryLimits((current) => {
                                      const next = { ...current };
                                      delete next[item.name];
                                      return next;
                                    });
                                    setEditingLimitCat(null);
                                    setLimitInput("");
                                  }}
                                  style={{ border: "none", background: "transparent", color: "#FF3B30", fontSize: 11, fontWeight: 600, padding: "3px 4px", cursor: "pointer" }}
                                >
                                  {t("removeLimit")}
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingLimitCat(item.name); setLimitInput(limit > 0 ? String(limit) : ""); }}
                              style={{ border: "none", background: "transparent", color: limit > 0 ? "#6C6C70" : "#007AFF", fontSize: 11, fontWeight: 500, padding: 0, cursor: "pointer" }}
                            >
                              {limit > 0 ? `✎ ${t("editLimit")}` : `+ ${t("setLimit")}`}
                            </button>
                          )}
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
                    max={investSliderMax}
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
                      type="text"
                      inputMode="decimal"
                      aria-label={t("monthlyInvestment")}
                      value={investStr}
                      onChange={(event) => onInvestInput(event.target.value)}
                      onBlur={onInvestBlur}
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
                <div style={{ marginTop: 10, fontSize: 12, color: "#6C6C70" }}>
                  {t("annual")}: <strong style={{ color: "#007AFF" }}>€{fmt(invest * 12)}</strong>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>🛡️ {t("emergencyFund")}</div>
                <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 10 }}>{t("emergencySub")}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[0, 3, 6, 12].map((months) => (
                    <button
                      key={months}
                      onClick={() => setEmergencyMonths(months)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        background: emergencyMonths === months ? (months === 0 ? "#FF3B30" : "#007AFF") : "#F2F2F7",
                        color: emergencyMonths === months ? "#fff" : "#3C3C43",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {months === 0 ? t("noFund") : `${months}m`}
                    </button>
                  ))}
                </div>

                {/* Current coverage: dedicated Emergency Fund entries + eligible
                    savings/investments, weighted by liquidity — shown regardless
                    of the target above, since "how protected am I right now"
                    matters even before a goal is set. Kept as one compact block
                    (rather than a separate boxed section) to keep this card's
                    height in line with Monthly Investment alongside it. */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#3C3C43", fontWeight: 500 }}>{t("currentCoverage")}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "#007AFF" }}>€{fmt(emergencyCoverage.total)}</span>
                </div>
                {(() => {
                  const breakdown = [
                    emergencyCoverage.dedicated > 0 ? t("coverageFromDedicated", { x: fmt(emergencyCoverage.dedicated) }) : null,
                    emergencyCoverage.fromSavings > 0 ? t("coverageFromSavings", { x: fmt(emergencyCoverage.fromSavings) }) : null,
                  ].filter(Boolean).join(" · ");
                  return breakdown ? (
                    <div style={{ fontSize: 10.5, color: "#6C6C70", marginBottom: emergencyMonths > 0 ? 6 : 0 }}>{breakdown}</div>
                  ) : null;
                })()}

                {emergencyMonths === 0 ? (
                  emergencyCoverage.total === 0 && (
                    <div style={{ fontSize: 12, color: "#FF3B30", fontWeight: 500 }}>{t("noFundNote")}</div>
                  )
                ) : (
                  <>
                    <div style={{ background: "#F2F2F7", borderRadius: 4, height: 5, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(emergencyCoveragePct, 100)}%`,
                          height: "100%",
                          background: emergencyCoveragePct >= 100 ? "#34C759" : "#007AFF",
                          borderRadius: 4,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                      <span style={{ fontSize: 10.5, color: "#6C6C70" }}>{t("target")}: €{fmt(emergencyTarget)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: emergencyCoveragePct >= 100 ? "#34C759" : "#3C3C43" }}>
                        {emergencyCoveragePct >= 100 ? t("goal_reached") : `${emergencyCoveragePct.toFixed(0)}%`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {(() => {
              const score = computeHealthScore(totalIncome, totalExpenses, investMonthly, emergencyCoverage.total);
              if (!score) return null;
              const color = scoreColor(score.total);
              const weakest = [...score.breakdown].filter(b => b.noteKey).sort((a, b) => a.score - b.score)[0];
              return (
                <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{t("healthScore")}</div>
                      <div style={{ fontSize: 12, color: "#6C6C70" }}>{t("healthSub")}</div>
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
                      <div style={{ fontSize: 11, color: "#6C6C70", marginTop: 2 }}>{t("outOf100")}</div>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                      {score.breakdown.map((item) => (
                        <div key={item.labelKey}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#3C3C43" }}>{t(item.labelKey)}</span>
                            <span style={{ fontSize: 12, color: "#6C6C70" }}>
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
          <div ref={expensesSectionRef}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              {["All", ...allCategoryKeys].map((category) => {
                if (category !== "All" && renamingCategory === category) {
                  const meta = getCategoryMeta(category, customCategories);
                  return (
                    <input
                      key={category}
                      autoFocus
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      onBlur={commitRenameCategory}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRenameCategory();
                        if (e.key === "Escape") cancelRenameCategory();
                      }}
                      size={Math.max(6, renameInput.length + 1)}
                      style={{
                        padding: "5px 13px",
                        borderRadius: 20,
                        border: `1.5px solid ${meta.accent}`,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#1C1C1E",
                        outline: "none",
                        background: "#fff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      }}
                    />
                  );
                }
                const meta = category !== "All" ? getCategoryMeta(category, customCategories) : null;
                const label = category === "All" ? t("all") : getCategoryLabel(category, customCategories, t);
                return (
                  <button
                    key={category}
                    onClick={() => handleCategoryChipActivate(category)}
                    onDoubleClick={() => category !== "All" && openRenameCategory(category)}
                    title={category !== "All" ? t("hint_renameCategory") : undefined}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      background: filterCat === category ? meta?.accent || "#007AFF" : "#fff",
                      color: filterCat === category ? "#fff" : "#3C3C43",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      transition: "all 0.2s",
                    }}
                  >
                    {meta && `${meta.icon} `}{label}
                  </button>
                );
              })}
              <button
                onClick={() => setShowNewCategoryModal(true)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1.5px dashed #C7C7CC",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "transparent",
                  color: "#007AFF",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                + {t("newCategory")}
              </button>
            </div>

            {/* ── Mobile card layout ── */}
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredExpenses.map((item) => {
                  const colorSet = getCategoryMeta(item.category, customCategories);
                  const color = colorSet.accent;
                  const isEditing = editingExpense === item.id;
                  const monthly = freqToMonthly(item.amount, item.frequency);
                  return (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: 16, padding: "14px 16px",
                        background: isEditing ? `${color}12` : "#fff",
                        border: `1.5px solid ${isEditing ? color : "transparent"}`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input
                            autoFocus
                            value={item.name}
                            onChange={e => updateExpense(item.id, "name", e.target.value)}
                            style={{
                              fontSize: 15, fontWeight: 600, color: "#1C1C1E",
                              border: "none", borderBottom: `2px solid ${color}`,
                              background: "transparent", outline: "none", width: "100%", paddingBottom: 2,
                            }}
                          />
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_category")}</div>
                              <select
                                value={item.category}
                                onChange={e => updateExpense(item.id, "category", e.target.value)}
                                style={{
                                  fontSize: 13, width: "100%", border: "none",
                                  borderBottom: `2px solid ${color}`, background: "transparent",
                                  outline: "none", paddingBottom: 2, color: "#1C1C1E",
                                }}
                              >
                                {allCategoryKeys.map(cat => (
                                  <option key={cat} value={cat}>{getCategoryLabel(cat, customCategories, t)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_amount")} (€)</div>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingExpenseAmountStr}
                                onChange={e => setEditingExpenseAmountStr(e.target.value)}
                                onBlur={() => {
                                  const n = parseFloat(editingExpenseAmountStr);
                                  updateExpense(item.id, "amount", isNaN(n) ? item.amount : n);
                                }}
                                style={{
                                  fontSize: 16, fontWeight: 700, color, width: "100%",
                                  border: "none", borderBottom: `2px solid ${color}`,
                                  background: "transparent", outline: "none", paddingBottom: 2,
                                }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_frequency")}</div>
                              <select
                                value={item.frequency}
                                onChange={e => updateExpense(item.id, "frequency", e.target.value)}
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
                              onClick={() => { deleteExpense(item.id); setEditingExpense(null); }}
                              style={{
                                padding: "7px 14px", borderRadius: 10, border: "none",
                                background: "#FF3B3015", color: "#FF3B30", fontSize: 13,
                                fontWeight: 600, cursor: "pointer",
                              }}
                            >
                              🗑 {t("btn_delete")}
                            </button>
                            <button
                              onClick={() => {
                                const n = parseFloat(editingExpenseAmountStr);
                                updateExpense(item.id, "amount", isNaN(n) ? item.amount : n);
                                setEditingExpense(null);
                              }}
                              style={{
                                padding: "7px 18px", borderRadius: 10, border: "none",
                                background: color, color: "#fff", fontSize: 13,
                                fontWeight: 600, cursor: "pointer",
                              }}
                            >
                              {t("btn_done")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                          onClick={() => {
                            setEditingExpense(item.id);
                            setEditingExpenseAmountStr(String(item.amount));
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 3 }}>{item.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{
                                fontSize: 11, color: colorSet.accent, fontWeight: 600,
                                background: colorSet.bg, padding: "2px 7px", borderRadius: 5,
                              }}>
                                {colorSet.icon} {getCategoryLabel(item.category, customCategories, t)}
                              </span>
                              <span style={{ fontSize: 12, color: "#6C6C70" }}>· {t.freq(item.frequency)}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color }}>€{fmt(item.amount)}</div>
                            <div style={{ fontSize: 11, color: "#6C6C70" }}>€{fmt(monthly)}{t("perMo")}</div>
                          </div>
                          <div style={{ color: "#C7C7CC", fontSize: 13 }}>›</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
            /* ── Desktop table layout ── */
            <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div>
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #F2F2F7",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 72px",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6C6C70",
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
                  const colorSet = getCategoryMeta(item.category, customCategories);
                  const isEditing = editingExpense === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "12px 20px",
                        borderBottom: index < filteredExpenses.length - 1 ? "1px solid #F2F2F7" : "none",
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr 72px",
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
                            setEditingExpenseAmountStr(String(item.amount));
                            setEditingExpenseFocusField("name");
                          }
                        }}
                        style={{ cursor: isEditing ? "default" : "pointer" }}
                      >
                        {isEditing ? (
                          <input
                            ref={(el) => { if (el && editingExpenseFocusField === "name") el.focus(); }}
                            value={item.name}
                            onChange={(event) => updateExpense(item.id, "name", event.target.value)}
                            style={{
                              width: "100%", border: "none",
                              borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent", fontSize: 14, fontWeight: 500,
                              outline: "none", padding: "2px 0",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                        )}
                      </div>
                      <div
                        onClick={() => {
                          if (!isEditing) {
                            setEditingExpense(item.id);
                            setEditingExpenseAmountStr(String(item.amount));
                            setEditingExpenseFocusField("category");
                          }
                        }}
                        style={{ cursor: isEditing ? "default" : "pointer" }}
                      >
                        {isEditing ? (
                          <select
                            ref={(el) => { if (el && editingExpenseFocusField === "category") el.focus(); }}
                            value={item.category}
                            onChange={(event) => updateExpense(item.id, "category", event.target.value)}
                            style={{
                              border: "none", borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent", fontSize: 12, outline: "none",
                              padding: "2px 0", width: "100%",
                            }}
                          >
                            {allCategoryKeys.map((category) => (
                              <option key={category} value={category}>{getCategoryLabel(category, customCategories, t)}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            fontSize: 12, color: colorSet.accent, fontWeight: 600,
                            background: colorSet.bg, padding: "3px 8px", borderRadius: 6,
                          }}>
                            {colorSet.icon} {getCategoryLabel(item.category, customCategories, t)}
                          </span>
                        )}
                      </div>
                      <div
                        onClick={() => {
                          if (!isEditing) {
                            setEditingExpense(item.id);
                            setEditingExpenseAmountStr(String(item.amount));
                            setEditingExpenseFocusField("amount");
                          }
                        }}
                        style={{ textAlign: "right", cursor: isEditing ? "default" : "pointer" }}
                      >
                        {isEditing ? (
                          <input
                            ref={(el) => { if (el && editingExpenseFocusField === "amount") { el.focus(); el.select(); } }}
                            type="text"
                            inputMode="decimal"
                            value={editingExpenseAmountStr}
                            onChange={e => setEditingExpenseAmountStr(e.target.value)}
                            onBlur={() => {
                              const n = parseFloat(editingExpenseAmountStr);
                              updateExpense(item.id, "amount", isNaN(n) ? item.amount : n);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const n = parseFloat(editingExpenseAmountStr);
                                updateExpense(item.id, "amount", isNaN(n) ? item.amount : n);
                                setEditingExpense(null);
                              }
                              if (e.key === "Escape") setEditingExpense(null);
                            }}
                            style={{
                              width: "100%", border: "none",
                              borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent", fontSize: 14, fontWeight: 600,
                              outline: "none", textAlign: "right", padding: "2px 0",
                            }}
                          />
                        ) : (
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>€{fmt(item.amount)}</div>
                            <div style={{ fontSize: 11, color: "#6C6C70" }}>€{fmt(monthly)}{t("perMo")}</div>
                          </div>
                        )}
                      </div>
                      <div>
                        {isEditing ? (
                          <select
                            value={item.frequency}
                            onChange={(event) => updateExpense(item.id, "frequency", event.target.value)}
                            style={{
                              border: "none", borderBottom: `2px solid ${colorSet.accent}`,
                              background: "transparent", fontSize: 12, outline: "none",
                              padding: "2px 0", width: "100%",
                            }}
                          >
                            {FREQUENCIES.map((frequency) => (
                              <option key={frequency} value={frequency}>{t.freq(frequency)}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, color: "#6C6C70" }}>{t.freq(item.frequency)}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {isEditing && (
                          <button
                            onClick={() => {
                              const n = parseFloat(editingExpenseAmountStr);
                              updateExpense(item.id, "amount", isNaN(n) ? item.amount : n);
                              setEditingExpense(null);
                            }}
                            aria-label={t("btn_done")}
                            style={{
                              width: 28, height: 28, borderRadius: "50%", border: "none",
                              background: "#E8FFF0", color: "#34C759", cursor: "pointer",
                              fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => deleteExpense(item.id)}
                          aria-label={t("btn_delete")}
                          style={{
                            width: 28, height: 28, borderRadius: "50%", border: "none",
                            background: "#FFE5E5", color: "#FF3B30", cursor: "pointer",
                            fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
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
                      gridTemplateColumns: "2fr 1fr 1fr 1fr 72px",
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
                      {allCategoryKeys.map((category) => (
                        <option key={category} value={category}>{getCategoryLabel(category, customCategories, t)}</option>
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
            )} {/* end isMobile ternary */}

            {/* Mobile: Add Expense button (shown below cards) */}
            {isMobile && (
              addingExpense ? (
                <div style={{
                  marginTop: 10, background: "#fff", borderRadius: 16,
                  padding: "16px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  display: "flex", flexDirection: "column", gap: 12,
                  border: "2px solid #007AFF",
                }}>
                  <input
                    autoFocus
                    placeholder={t("ph_name")}
                    value={newExpense.name}
                    onChange={e => setNewExpense(c => ({ ...c, name: e.target.value }))}
                    style={{
                      fontSize: 15, fontWeight: 600, border: "none",
                      borderBottom: "2px solid #007AFF", background: "transparent",
                      outline: "none", paddingBottom: 2,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_category")}</div>
                      <select
                        value={newExpense.category}
                        onChange={e => setNewExpense(c => ({ ...c, category: e.target.value }))}
                        style={{ fontSize: 13, width: "100%", border: "none", borderBottom: "2px solid #007AFF", background: "transparent", outline: "none" }}
                      >
                        {allCategoryKeys.map(cat => (
                          <option key={cat} value={cat}>{getCategoryLabel(cat, customCategories, t)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_amount")} (€)</div>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={newExpense.amount || ""}
                        onChange={e => setNewExpense(c => ({ ...c, amount: e.target.value }))}
                        onBlur={e => setNewExpense(c => ({ ...c, amount: parseFloat(e.target.value) || 0 }))}
                        style={{
                          fontSize: 16, fontWeight: 700, color: "#007AFF", width: "100%",
                          border: "none", borderBottom: "2px solid #007AFF",
                          background: "transparent", outline: "none", paddingBottom: 2,
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_frequency")}</div>
                      <select
                        value={newExpense.frequency}
                        onChange={e => setNewExpense(c => ({ ...c, frequency: e.target.value }))}
                        style={{ fontSize: 13, width: "100%", border: "none", borderBottom: "2px solid #007AFF", background: "transparent", outline: "none" }}
                      >
                        {FREQUENCIES.map(f => <option key={f} value={f}>{t.freq(f)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <button
                      onClick={() => setAddingExpense(false)}
                      style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#F2F2F7", color: "#3C3C43", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      {t("btn_cancel")}
                    </button>
                    <button
                      onClick={addExpense}
                      style={{ padding: "7px 18px", borderRadius: 10, border: "none", background: "#007AFF", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      + {t("addExpense")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingExpense(true)}
                  style={{
                    marginTop: 10, width: "100%", padding: "14px", borderRadius: 16,
                    border: "2px dashed #C7C7CC", background: "transparent",
                    color: "#007AFF", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> {t("addExpense")}
                </button>
              )
            )}

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
                <span style={{ fontSize: 12, color: "#6C6C70", fontWeight: 400 }}>{t("perMo")}</span>
              </span>
            </div>
          </div>
        )}

        {activeTab === "income" && (
          <div ref={incomeSectionRef}>
            {/* ── Mobile income card layout ── */}
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {income.map((item) => {
                  const monthly = freqToMonthly(item.amount, item.frequency);
                  const isEditing = editingIncome === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: 16, padding: "14px 16px",
                        background: isEditing ? "#F0FFF4" : "#fff",
                        border: `1.5px solid ${isEditing ? "#34C759" : "transparent"}`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input
                            autoFocus
                            value={item.name}
                            onChange={e => updateIncome(item.id, "name", e.target.value)}
                            style={{
                              fontSize: 15, fontWeight: 600, color: "#1C1C1E",
                              border: "none", borderBottom: "2px solid #34C759",
                              background: "transparent", outline: "none", width: "100%", paddingBottom: 2,
                            }}
                          />
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_amount")} (€)</div>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingIncomeAmountStr}
                                onChange={e => setEditingIncomeAmountStr(e.target.value)}
                                onBlur={() => commitIncomeAmount(item.id)}
                                style={{
                                  fontSize: 16, fontWeight: 700, color: "#34C759", width: "100%",
                                  border: "none", borderBottom: "2px solid #34C759",
                                  background: "transparent", outline: "none", paddingBottom: 2,
                                }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_frequency")}</div>
                              <select
                                value={item.frequency}
                                onChange={e => updateIncome(item.id, "frequency", e.target.value)}
                                style={{
                                  fontSize: 13, width: "100%", border: "none",
                                  borderBottom: "2px solid #34C759", background: "transparent",
                                  outline: "none", paddingBottom: 2, color: "#1C1C1E",
                                }}
                              >
                                {FREQUENCIES.map(f => <option key={f} value={f}>{t.freq(f)}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <button
                              onClick={() => deleteIncome(item.id)}
                              style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#FF3B3015", color: "#FF3B30", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                            >
                              🗑 {t("btn_delete")}
                            </button>
                            <button
                              onClick={() => { commitIncomeAmount(item.id); setEditingIncome(null); }}
                              style={{ padding: "7px 18px", borderRadius: 10, border: "none", background: "#34C759", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                            >
                              {t("btn_done")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                          onClick={() => startEditingIncome(item)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 2 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: "#6C6C70" }}>{t.freq(item.frequency)}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#34C759" }}>€{fmt(item.amount)}</div>
                            <div style={{ fontSize: 11, color: "#6C6C70" }}>€{fmt(monthly)}{t("perMo")}</div>
                          </div>
                          <div style={{ color: "#C7C7CC", fontSize: 13 }}>›</div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {addingIncome ? (
                  <div style={{
                    background: "#fff", borderRadius: 16, padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    display: "flex", flexDirection: "column", gap: 12, border: "2px solid #34C759",
                  }}>
                    <input
                      autoFocus
                      placeholder={t("ph_incomeSource")}
                      value={newIncome.name}
                      onChange={e => setNewIncome(c => ({ ...c, name: e.target.value }))}
                      style={{ fontSize: 15, fontWeight: 600, border: "none", borderBottom: "2px solid #34C759", background: "transparent", outline: "none", paddingBottom: 2 }}
                    />
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_amount")} (€)</div>
                        <input
                          type="text" inputMode="decimal" placeholder="0"
                          value={newIncome.amount || ""}
                          onChange={e => setNewIncome(c => ({ ...c, amount: e.target.value }))}
                          onBlur={e => setNewIncome(c => ({ ...c, amount: parseFloat(e.target.value) || 0 }))}
                          style={{ fontSize: 16, fontWeight: 700, color: "#34C759", width: "100%", border: "none", borderBottom: "2px solid #34C759", background: "transparent", outline: "none", paddingBottom: 2 }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_frequency")}</div>
                        <select
                          value={newIncome.frequency}
                          onChange={e => setNewIncome(c => ({ ...c, frequency: e.target.value }))}
                          style={{ fontSize: 13, width: "100%", border: "none", borderBottom: "2px solid #34C759", background: "transparent", outline: "none" }}
                        >
                          {FREQUENCIES.map(f => <option key={f} value={f}>{t.freq(f)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <button onClick={() => setAddingIncome(false)} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#F2F2F7", color: "#3C3C43", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("btn_cancel")}
                      </button>
                      <button onClick={addIncome} style={{ padding: "7px 18px", borderRadius: 10, border: "none", background: "#34C759", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        + {t("addIncome")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingIncome(true)}
                    style={{
                      width: "100%", padding: "14px", borderRadius: 16,
                      border: "2px dashed #C7C7CC", background: "transparent",
                      color: "#34C759", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> {t("addIncome")}
                  </button>
                )}
              </div>
            ) : (
            /* ── Desktop income table layout ── */
            <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
              <div>
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #F2F2F7",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 72px",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6C6C70",
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
                        gridTemplateColumns: "2fr 1fr 1fr 72px",
                        gap: 8,
                        alignItems: "center",
                        background: isEditing ? "#F0FFF4" : "transparent",
                      }}
                    >
                      <div onClick={() => (isEditing ? null : startEditingIncome(item, "name"))} style={{ cursor: isEditing ? "default" : "pointer" }}>
                        {isEditing ? (
                          <input
                            ref={(el) => { if (el && editingIncomeFocusField === "name") el.focus(); }}
                            value={item.name}
                            onChange={(event) => updateIncome(item.id, "name", event.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { commitIncomeAmount(item.id); setEditingIncome(null); } if (e.key === "Escape") setEditingIncome(null); }}
                            style={{ width: "100%", border: "none", borderBottom: "2px solid #34C759", background: "transparent", fontSize: 15, fontWeight: 600, outline: "none" }}
                          />
                        ) : (
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</span>
                        )}
                      </div>
                      <div
                        onClick={() => (isEditing ? null : startEditingIncome(item, "amount"))}
                        style={{ textAlign: "right", cursor: isEditing ? "default" : "pointer" }}
                      >
                        {isEditing ? (
                          <input
                            ref={(el) => { if (el && editingIncomeFocusField === "amount") { el.focus(); el.select(); } }}
                            type="text"
                            inputMode="decimal"
                            value={editingIncomeAmountStr}
                            onChange={(event) => setEditingIncomeAmountStr(event.target.value)}
                            onBlur={() => commitIncomeAmount(item.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") { commitIncomeAmount(item.id); setEditingIncome(null); } if (e.key === "Escape") setEditingIncome(null); }}
                            style={{ width: "100%", border: "none", borderBottom: "2px solid #34C759", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", textAlign: "right" }}
                          />
                        ) : (
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#34C759" }}>€{fmt(item.amount)}</div>
                            <div style={{ fontSize: 11, color: "#6C6C70" }}>€{fmt(monthly)}{t("perMo")}</div>
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
                          <span style={{ fontSize: 13, color: "#6C6C70" }}>{t.freq(item.frequency)}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {isEditing && (
                          <button
                            onClick={() => { commitIncomeAmount(item.id); setEditingIncome(null); }}
                            aria-label={t("btn_done")}
                            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#E8FFF0", color: "#34C759", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => deleteIncome(item.id)}
                          aria-label={t("btn_delete")}
                          style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#FFE5E5", color: "#FF3B30", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {addingIncome ? (
                  <div style={{ padding: "14px 20px", borderTop: "2px solid #34C759", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 72px", gap: 8, alignItems: "center", background: "#F0FFF4" }}>
                    <input
                      placeholder={t("ph_incomeSource")}
                      value={newIncome.name}
                      onChange={(event) => setNewIncome((current) => ({ ...current, name: event.target.value }))}
                      style={{ border: "none", borderBottom: "2px solid #34C759", background: "transparent", fontSize: 15, fontWeight: 600, outline: "none" }}
                    />
                    <input
                      type="number" placeholder="0"
                      value={newIncome.amount || ""}
                      onChange={(event) => setNewIncome((current) => ({ ...current, amount: parseFloat(event.target.value) || 0 }))}
                      style={{ border: "none", borderBottom: "2px solid #34C759", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", textAlign: "right" }}
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
                    <button onClick={addIncome} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#34C759", color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      +
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #F2F2F7" }}>
                    <button
                      onClick={() => setAddingIncome(true)}
                      style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "#34C759", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: 0 }}
                    >
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#E6FFF0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>+</span>
                      {t("addIncome")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            )} {/* end isMobile ternary for income */}

            <div style={{ display: "grid", gridTemplateColumns: threeColGrid, gap: 12 }}>
              {[
                { label: t("totalIncome"), value: totalIncome, color: "#34C759" },
                { label: t("totalExpInvest"), value: totalExpenses + investMonthly, color: "#FF3B30" },
                { label: savings >= 0 ? t("remaining") : t("card_deficit"), value: Math.abs(savings), color: savings >= 0 ? "#007AFF" : "#FF3B30" },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}
                >
                  <div style={{ fontSize: 11, color: "#6C6C70", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>€{fmt(card.value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "savings" && (
          <div>
            {/* Savings accounts list */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E", marginBottom: 10 }}>
                💰 {t("savings_title")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {savingsAccounts.map((account) => {
                  const isEditing = editingSavings === account.id;
                  return (
                    <div
                      key={account.id}
                      style={{
                        borderRadius: 16, padding: "14px 16px",
                        background: isEditing ? "#F0FFF4" : "#fff",
                        border: `1.5px solid ${isEditing ? "#30D158" : "transparent"}`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input
                            autoFocus
                            value={account.name}
                            onChange={e => setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, name: e.target.value } : a))}
                            style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E", border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", width: "100%", paddingBottom: 2 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_balance")} (€)</div>
                            <input
                              type="text" inputMode="decimal"
                              value={account.amount}
                              onChange={e => setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, amount: e.target.value } : a))}
                              onBlur={e => {
                                const n = parseFloat(e.target.value);
                                setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, amount: isNaN(n) ? 0 : n } : a));
                              }}
                              style={{ fontSize: 16, fontWeight: 700, color: "#30D158", width: "100%", border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", paddingBottom: 2 }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("accountType")}</div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {["cash", "emergency", "investment"].map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, type } : a))}
                                  style={{
                                    flex: 1, padding: "6px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                                    fontSize: 11, fontWeight: 600,
                                    background: (account.type || "cash") === type ? "#30D158" : "#F2F2F7",
                                    color: (account.type || "cash") === type ? "#fff" : "#3C3C43",
                                  }}
                                >
                                  {t(`type_${type}`)}
                                </button>
                              ))}
                            </div>
                            {account.type === "investment" && (
                              <div style={{ fontSize: 10, color: "#6C6C70", marginTop: 4 }}>{t("investmentWeightNote")}</div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("goal_targetAmount")}</div>
                              <input
                                type="text" inputMode="decimal" placeholder={t("goal_optional")}
                                value={account.target ?? ""}
                                onChange={e => setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, target: e.target.value } : a))}
                                onBlur={e => {
                                  const n = parseFloat(e.target.value);
                                  setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, target: isNaN(n) || n <= 0 ? "" : n } : a));
                                }}
                                style={{ fontSize: 14, fontWeight: 600, color: "#30D158", width: "100%", border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", paddingBottom: 2 }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("goal_targetMonth")}</div>
                              <input
                                type="month"
                                value={account.targetMonth ?? ""}
                                onChange={e => setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, targetMonth: e.target.value } : a))}
                                style={{ fontSize: 13, width: "100%", border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", paddingBottom: 2, color: "#1C1C1E" }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <button
                              onClick={() => deleteSavings(account.id)}
                              style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#FF3B3015", color: "#FF3B30", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                            >
                              🗑 {t("btn_delete")}
                            </button>
                            <button
                              onClick={() => {
                                setSavingsAccounts(s => s.map(a => a.id === account.id ? { ...a, amount: parseFloat(a.amount) || 0 } : a));
                                setEditingSavings(null);
                              }}
                              style={{ padding: "7px 18px", borderRadius: 10, border: "none", background: "#30D158", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                            >
                              {t("btn_done")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ cursor: "pointer" }} onClick={() => setEditingSavings(account.id)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E" }}>{account.name}</div>
                                {account.type === "emergency" && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#007AFF", background: "#007AFF15", padding: "1px 6px", borderRadius: 6 }}>
                                    🛡️ {t("type_emergency")}
                                  </span>
                                )}
                                {account.type === "investment" && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#AF52DE", background: "#AF52DE15", padding: "1px 6px", borderRadius: 6 }}>
                                    📈 {t("type_investment")}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: "#6C6C70" }}>{t("col_balance")}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#30D158" }}>€{fmt(account.amount || 0)}</div>
                            </div>
                            <div style={{ color: "#C7C7CC", fontSize: 13 }}>›</div>
                          </div>
                          {(() => {
                            const target = parseFloat(account.target) || 0;
                            if (target <= 0) return null;
                            const balance = parseFloat(account.amount) || 0;
                            const goalPct = Math.min(100, (balance / target) * 100);
                            const reached = balance >= target;
                            let neededLine = null;
                            if (!reached && /^\d{4}-\d{2}$/.test(account.targetMonth || "")) {
                              const [ty, tm] = account.targetMonth.split("-").map(Number);
                              const today = new Date();
                              const monthsLeft = (ty - today.getFullYear()) * 12 + (tm - 1 - today.getMonth());
                              const monthlyNeeded = monthsLeft > 0 ? (target - balance) / monthsLeft : target - balance;
                              neededLine = monthsLeft > 0
                                ? t("goal_needed", { x: fmt(monthlyNeeded) })
                                : t("goal_pastDue", { x: fmt(target - balance) });
                            }
                            return (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
                                  <span style={{ fontSize: 11, color: "#6C6C70" }}>
                                    🎯 {t("goal_label")}: €{fmt(target)}
                                    {account.targetMonth && /^\d{4}-\d{2}$/.test(account.targetMonth) ? ` · ${account.targetMonth}` : ""}
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: reached ? "#30D158" : "#3C3C43" }}>
                                    {reached ? t("goal_reached") : `${goalPct.toFixed(0)}%`}
                                  </span>
                                </div>
                                <div style={{ background: "#F2F2F7", borderRadius: 4, height: 6, overflow: "hidden" }}>
                                  <div style={{ width: `${goalPct}%`, height: "100%", background: "#30D158", borderRadius: 4, transition: "width 0.6s ease" }} />
                                </div>
                                {neededLine && (
                                  <div style={{ fontSize: 11, color: "#6C6C70", marginTop: 4 }}>{neededLine}</div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
                {addingSavings ? (
                  <div style={{ background: "#fff", borderRadius: 16, padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 12, border: "2px solid #30D158" }}>
                    <input
                      autoFocus
                      placeholder={t("ph_accountName")}
                      value={newSavings.name}
                      onChange={e => setNewSavings(c => ({ ...c, name: e.target.value }))}
                      style={{ fontSize: 15, fontWeight: 600, border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", paddingBottom: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("col_balance")} (€)</div>
                      <input
                        type="text" inputMode="decimal" placeholder="0"
                        value={newSavings.amount || ""}
                        onChange={e => setNewSavings(c => ({ ...c, amount: e.target.value }))}
                        onBlur={e => setNewSavings(c => ({ ...c, amount: parseFloat(e.target.value) || 0 }))}
                        style={{ fontSize: 16, fontWeight: 700, color: "#30D158", width: "100%", border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", paddingBottom: 2 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("accountType")}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["cash", "emergency", "investment"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setNewSavings(c => ({ ...c, type }))}
                            style={{
                              flex: 1, padding: "6px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                              fontSize: 11, fontWeight: 600,
                              background: (newSavings.type || "cash") === type ? "#30D158" : "#F2F2F7",
                              color: (newSavings.type || "cash") === type ? "#fff" : "#3C3C43",
                            }}
                          >
                            {t(`type_${type}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("goal_targetAmount")}</div>
                        <input
                          type="text" inputMode="decimal" placeholder={t("goal_optional")}
                          value={newSavings.target || ""}
                          onChange={e => setNewSavings(c => ({ ...c, target: e.target.value }))}
                          style={{ fontSize: 14, fontWeight: 600, color: "#30D158", width: "100%", border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", paddingBottom: 2 }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#6C6C70", marginBottom: 4 }}>{t("goal_targetMonth")}</div>
                        <input
                          type="month"
                          value={newSavings.targetMonth || ""}
                          onChange={e => setNewSavings(c => ({ ...c, targetMonth: e.target.value }))}
                          style={{ fontSize: 13, width: "100%", border: "none", borderBottom: "2px solid #30D158", background: "transparent", outline: "none", paddingBottom: 2, color: "#1C1C1E" }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <button onClick={() => { setAddingSavings(false); setNewSavings({ name: "", amount: 0, target: "", targetMonth: "", type: "cash" }); }} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#F2F2F7", color: "#3C3C43", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("btn_cancel")}
                      </button>
                      <button
                        onClick={() => {
                          if (!newSavings.name) return;
                          setSavingsAccounts(s => [...s, {
                            id: Date.now(),
                            name: newSavings.name,
                            amount: parseFloat(newSavings.amount) || 0,
                            target: parseFloat(newSavings.target) > 0 ? parseFloat(newSavings.target) : "",
                            targetMonth: newSavings.targetMonth || "",
                            type: newSavings.type || "cash",
                          }]);
                          setNewSavings({ name: "", amount: 0, target: "", targetMonth: "", type: "cash" });
                          setAddingSavings(false);
                        }}
                        style={{ padding: "7px 18px", borderRadius: 10, border: "none", background: "#30D158", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        + {t("addSavings")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingSavings(true)}
                    style={{ width: "100%", padding: "14px", borderRadius: 16, border: "2px dashed #C7C7CC", background: "transparent", color: "#30D158", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> {t("addSavings")}
                  </button>
                )}
              </div>

              {savingsAccounts.length > 0 && (
                <div style={{ marginTop: 12, background: "#fff", borderRadius: 14, padding: "14px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#3C3C43" }}>{t("totalSavings")}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#30D158" }}>€{fmt(totalSavingsBalance)}</span>
                </div>
              )}
            </div>

            {/* Monthly investment section */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>💹 {t("monthlyInvestment")}</div>
              <div style={{ fontSize: 12, color: "#6C6C70", marginBottom: 14 }}>{t("savings_sub")}</div>
              <div style={{ position: "relative", marginBottom: 14 }} ref={investMenuRef}>
                <button
                  onClick={() => { setShowInvestMenu(v => !v); setInvestCustomInput(""); }}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#007AFF", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}
                >
                  {investLabel} ▾
                </button>
                {showInvestMenu && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1.5px solid #E5E5EA", borderRadius: 14, padding: 6, minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 200 }}>
                    {INVEST_TYPES.map((opt) => (
                      <button key={opt} onClick={() => { setInvestLabel(opt); setShowInvestMenu(false); setInvestCustomInput(""); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: investLabel === opt ? "#F2F2F7" : "transparent", color: "#1C1C1E", fontSize: 13, fontWeight: investLabel === opt ? 700 : 400, cursor: "pointer" }}
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
                  type="range" min={0} max={investSliderMax} step={10} value={invest}
                  onChange={(event) => setInvest(Number(event.target.value))}
                  style={{ flex: 1, width: "100%", accentColor: "#007AFF" }}
                />
                <div style={{ background: "#F2F2F7", borderRadius: 10, padding: "6px 12px", minWidth: isMobile ? "100%" : 80, textAlign: "center" }}>
                  <input
                    type="text" inputMode="decimal" aria-label={t("monthlyInvestment")}
                    value={investStr}
                    onChange={(event) => onInvestInput(event.target.value)}
                    onBlur={onInvestBlur}
                    style={{ width: "100%", border: "none", background: "transparent", textAlign: "center", fontSize: 15, fontWeight: 700, color: "#007AFF", outline: "none" }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#6C6C70" }}>
                {t("annual")}: <strong style={{ color: "#007AFF" }}>€{fmt(invest * 12)}</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === "suggestions" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1C1C1E" }}>{t("advisorTitle")}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6C6C70" }}>
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
              <div style={{ marginTop: 24, padding: 32, textAlign: "center", color: "#6C6C70", fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💭</div>
                {t("advisorLoading")}
              </div>
            )}

            {!suggestionsLoading && !suggestions && !suggestionsError && (
              <div style={{ marginTop: 24, padding: 32, textAlign: "center", color: "#6C6C70", fontSize: 14, lineHeight: 1.6 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🤔</div>
                {t("advisorEmpty")}
              </div>
            )}

            {suggestions && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #F2F2F7" }}>
                {renderMarkdown(suggestions)}
                <p style={{ marginTop: 24, fontSize: 11, color: "#6C6C70", fontStyle: "italic" }}>
                  ⚠️ {t("disclaimer")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {catModalCat && (() => {
        const catInfo = categoryTotals.find(c => c.name === catModalCat);
        const icon = getCategoryMeta(catModalCat, customCategories).icon;
        const catExpenses = expenses.filter(e => e.category === catModalCat);
        return (
          <CategoryModal
            cat={catModalCat}
            label={getCategoryLabel(catModalCat, customCategories, t)}
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

      {showNewCategoryModal && (
        <NewCategoryModal
          closing={newCategoryModalClosing}
          onClose={closeNewCategoryModal}
          onCreate={handleCreateCategory}
          existingLabels={allCategoryKeys.map((k) => getCategoryLabel(k, customCategories, t))}
          t={t}
        />
      )}

      {undoInfo && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: isMobile ? 20 : 28,
            transform: "translateX(-50%)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "#1C1C1E",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 14,
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <span style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t("deletedItem", { name: undoInfo.name })}
          </span>
          <button
            onClick={handleUndo}
            style={{
              border: "none", background: "transparent", color: "#5AC8FA",
              fontSize: 13.5, fontWeight: 700, cursor: "pointer", padding: 0, flexShrink: 0,
            }}
          >
            {t("undo")}
          </button>
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
