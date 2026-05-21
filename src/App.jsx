import { useCallback, useEffect, useRef, useState } from "react";

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

function DonutChart({ data, total }) {
  const size = 180;
  const strokeWidth = 28;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const segment = {
      ...d,
      pct,
      dasharray: `${pct * circ} ${circ}`,
      dashoffset: -offset * circ,
    };
    offset += pct;
    return segment;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)" }}
    >
      {segments.map((segment, index) => (
        <circle
          key={index}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={segment.color}
          strokeWidth={strokeWidth}
          strokeDasharray={segment.dasharray}
          strokeDashoffset={segment.dashoffset}
          strokeLinecap="butt"
          style={{ transition: "all 0.6s ease" }}
        />
      ))}
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
  const [income, setIncome] = useState(DEFAULT_INCOME);
  const [expenses, setExpenses] = useState(DEFAULT_EXPENSES);
  const [invest, setInvest] = useState(0);
  const [emergencyMonths, setEmergencyMonths] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const [syncInput, setSyncInput] = useState("");
  const [copied, setCopied] = useState(false);
  const syncPanelRef = useRef(null);

  const applyNewSyncId = useCallback((id) => {
    const clean = id.trim().toUpperCase();
    if (!clean) return;
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
  }, []);

  useEffect(() => {
    loadData(syncId)
      .then((saved) => {
        if (saved) {
          if (saved.income) setIncome(saved.income);
          if (saved.expenses) setExpenses(saved.expenses);
          if (saved.invest != null) setInvest(saved.invest);
          if (saved.emergencyMonths != null) setEmergencyMonths(saved.emergencyMonths);
        }
        setLoaded(true);
      })
      .catch((err) => {
        setLoadError(err?.message ?? "Failed to load");
        setLoaded(true);
      });
  }, [syncId]);

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
        body: JSON.stringify({ income, expenses, invest, emergencyMonths }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `API ${res.status}`);
      setSuggestions(data.suggestions ?? "");
    } catch (err) {
      setSuggestionsError(err?.message ?? "Failed to generate suggestions");
    } finally {
      setSuggestionsLoading(false);
    }
  }, [income, expenses, invest, emergencyMonths]);

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
    if (!loaded) return;
    saveData(syncId, { income, expenses, invest, emergencyMonths }).then(() => {
      setSavedFlag(true);
      window.setTimeout(() => setSavedFlag(false), 2000);
    });
  }, [emergencyMonths, expenses, income, invest, loaded, syncId]);

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
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>Spending Plan</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["overview", "expenses", "income", "suggestions"].map((tab) => (
              <button
                key={tab}
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
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ position: "relative" }} ref={syncPanelRef}>
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
              background: savedFlag ? "#34C759" : loaded ? "#007AFF" : "#A0C4FF",
              color: "#fff",
              transition: "all 0.3s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              alignSelf: isMobile ? "stretch" : "auto",
            }}
          >
            {savedFlag ? "✓ Saved" : "Save"}
          </button>
        </div>
      </div>

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
                { label: "Monthly Income", value: totalIncome, color: "#34C759", sub: "Total earnings" },
                { label: "Monthly Expenses", value: totalExpenses + investMonthly, color: "#FF3B30", sub: "All outgoings" },
                {
                  label: savings >= 0 ? "Net Savings" : "Deficit",
                  value: Math.abs(savings),
                  color: savings >= 0 ? "#007AFF" : "#FF3B30",
                  sub: savings >= 0 ? "After all expenses" : "Over budget",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    padding: "20px 22px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  }}
                >
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
              <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Spending by Category</div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <DonutChart data={donutData} total={totalExpenses} />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E" }}>€{fmt(totalExpenses)}</div>
                      <div style={{ fontSize: 11, color: "#8E8E93" }}>total</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
                    {donutData.map((item) => (
                      <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 12, color: "#3C3C43", fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1C1C1E" }}>€{fmt(item.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Category Breakdown</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {categoryTotals.map((item) => {
                    const pct = totalIncome > 0 ? (item.value / totalIncome) * 100 : 0;
                    return (
                      <div key={item.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "#3C3C43" }}>
                            {(CATEGORY_COLORS[item.name] || CATEGORY_COLORS.Other).icon} {item.name}
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
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>💹 Monthly Investment</div>
                <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 14 }}>Allocated to S&amp;P 500 ETF</div>
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
                  Annual: <strong style={{ color: "#007AFF" }}>€{fmt(invest * 12)}</strong>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>🛡️ Emergency Fund</div>
                <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 14 }}>Target based on months of expenses</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[3, 6, 12].map((months) => (
                    <button
                      key={months}
                      onClick={() => setEmergencyMonths(months)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        background: emergencyMonths === months ? "#007AFF" : "#F2F2F7",
                        color: emergencyMonths === months ? "#fff" : "#3C3C43",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {months}m
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#3C3C43" }}>
                  Target: <strong style={{ fontSize: 18, color: "#FF9500" }}>€{fmt(emergencyTarget)}</strong>
                </div>
                <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>
                  {fmt(monthlyExpenses)}/mo × {emergencyMonths} months
                </div>
              </div>
            </div>
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
                  {category !== "All" && `${CATEGORY_COLORS[category]?.icon || ""} `}{category}
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
                  <div>Item</div>
                  <div>Category</div>
                  <div style={{ textAlign: "right" }}>Amount</div>
                  <div>Frequency</div>
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
                              <option key={category}>{category}</option>
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
                            {colorSet.icon} {item.category}
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
                            <div style={{ fontSize: 11, color: "#8E8E93" }}>€{fmt(monthly)}/mo</div>
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
                              <option key={frequency}>{frequency}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, color: "#8E8E93" }}>{item.frequency}</span>
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
                      placeholder="Name"
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
                        <option key={category}>{category}</option>
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
                        <option key={frequency}>{frequency}</option>
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
                      Add Expense
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
              <span style={{ fontSize: 14, fontWeight: 600, color: "#3C3C43" }}>Total Expenses</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#FF3B30", textAlign: "right" }}>
                €{fmt(totalExpenses)}
                <span style={{ fontSize: 12, color: "#8E8E93", fontWeight: 400 }}>/mo</span>
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
                  <div>Source</div>
                  <div style={{ textAlign: "right" }}>Amount</div>
                  <div>Frequency</div>
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
                            <div style={{ fontSize: 11, color: "#8E8E93" }}>€{fmt(monthly)}/mo</div>
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
                              <option key={frequency}>{frequency}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 13, color: "#8E8E93" }}>{item.frequency}</span>
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
                      placeholder="Income source"
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
                        <option key={frequency}>{frequency}</option>
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
                      Add Income Source
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: threeColGrid, gap: 12 }}>
              {[
                { label: "Total Income", value: totalIncome, color: "#34C759" },
                { label: "Total Expenses + Invest", value: totalExpenses + investMonthly, color: "#FF3B30" },
                { label: savings >= 0 ? "Remaining" : "Deficit", value: Math.abs(savings), color: savings >= 0 ? "#007AFF" : "#FF3B30" },
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
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1C1C1E" }}>AI Financial Advisor</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8E8E93" }}>
                  Personalized recommendations from a senior financial advisor, based on your plan.
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
                {suggestionsLoading ? "✨ Analyzing…" : suggestions ? "🔄 Regenerate" : "✨ Generate Suggestions"}
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
                Reviewing your spending plan… this usually takes 15–30 seconds.
              </div>
            )}

            {!suggestionsLoading && !suggestions && !suggestionsError && (
              <div style={{ marginTop: 24, padding: 32, textAlign: "center", color: "#8E8E93", fontSize: 14, lineHeight: 1.6 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🤔</div>
                Click <strong>Generate Suggestions</strong> to get personalized advice on optimizing expenses and investment strategy.
              </div>
            )}

            {suggestions && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #F2F2F7" }}>
                {renderMarkdown(suggestions)}
                <p style={{ marginTop: 24, fontSize: 11, color: "#8E8E93", fontStyle: "italic" }}>
                  ⚠️ Suggestions are AI-generated and for informational purposes only. Not financial advice. Consult a licensed advisor before making significant financial decisions.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
