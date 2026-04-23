import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

// ─── Admin password ───────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "grad2026admin";

// ─── Department config ────────────────────────────────────────────────────────
const DEPT = {
  ACC: { label: "Accounting",       color: "#16a34a", bg: "#dcfce7", border: "#86efac", text: "#166534" },
  IR:  { label: "Int'l Relations",  color: "#4f46e5", bg: "#e0e7ff", border: "#a5b4fc", text: "#3730a3" },
  MLS: { label: "MLS",              color: "#c2410c", bg: "#ffedd5", border: "#fdba74", text: "#7c2d12" },
  IT:  { label: "Info Technology",  color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
  AR:  { label: "Architecture",     color: "#475569", bg: "#f1f5f9", border: "#cbd5e1", text: "#334155" },
  EL:  { label: "Electronics",      color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd", text: "#1e3a8a" },
  CS:  { label: "Comp. Science",    color: "#be185d", bg: "#fce7f3", border: "#f9a8d4", text: "#831843" },
  NONE:{ label: "General",          color: "#b45309", bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
};

const DEPT_FIELD = {
  ACC: "A", IR: "A", MLS: "A",
  IT: "B", AR: "B", EL: "B", CS: "B", NONE: "A",
};

const getDept = (id) => {
  const n = parseInt(id.slice(1));
  if (id[0] === "A") {
    if ((n >= 1 && n <= 10) || (n >= 37 && n <= 45)) return "ACC";
    if (n >= 11 && n <= 17) return "IR";
    if (n >= 23 && n <= 36) return "MLS";
    return "NONE";
  }
  if (id[0] === "B") {
    if (n >= 1  && n <= 15) return "IT";
    if (n >= 16 && n <= 17) return "AR";
    if (n >= 18 && n <= 22) return "EL";
    if (n >= 23 && n <= 28) return "CS";
  }
  return "NONE";
};

const FIELDS = {
  A: {
    name: "Field A", subtitle: "Front Yard", size: "33m × 27m",
    topLeft:  ["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10"],
    topRight: ["A37","A38","A39","A40","A41","A42","A43","A44","A45"],
    rightCol: ["A11","A12","A13","A14","A15","A16","A17"],
    bottom:   ["A27","A26","A25","A24","A23","A22","A21","A20","A19","A18"],
    leftCol:  ["A36","A35","A34","A33","A32","A31","A30","A29","A28"],
  },
  B: {
    name: "Field B", subtitle: "Backyard", size: "30m × 27m",
    topLeft:  ["B8","B9","B10","B11","B12","B13","B14","B15"],
    topRight: [],
    rightCol: ["B16","B17","B18","B19","B20","B21"],
    bottom:   ["B28","B27","B26","B25","B24","B23","B22"],
    leftCol:  ["B7","B6","B5","B4","B3","B2","B1"],
  },
};

const allBoothIds = (field) => {
  const f = FIELDS[field];
  return [...f.topLeft, ...f.topRight, ...f.rightCol, ...f.bottom, ...f.leftCol];
};

const BS = 36, BG = 2;

const exportCSV = (reservations) => {
  const rows = [["Booth", "Department", "Student Name", "CUE ID", "Email", "Reserved At"]];
  Object.entries(reservations)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach(([id, r]) => {
      rows.push([id, r.dept, r.name, r.cueId, r.email, r.ts ? new Date(r.ts).toLocaleString() : ""]);
    });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "booth-reservations.csv"; a.click();
  URL.revokeObjectURL(url);
};

// ─── Department selector ──────────────────────────────────────────────────────
function DeptSelector({ onSelect }) {
  const [hov, setHov] = useState(null);
  const depts = Object.entries(DEPT).filter(([k]) => k !== "NONE");
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #0c2340 0%, #1a3f6f 100%)", color: "#fff", padding: "22px 28px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Class of 2026 · Pre-Graduation Event</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>Booth Reservation Map</h1>
      </div>
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 28px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1a3f6f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>1</div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1a3f6f" }}>Select your department</span>
        <span style={{ color: "#94a3b8" }}>→</span>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e2e8f0", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>2</div>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8" }}>Choose a booth</span>
        <span style={{ color: "#94a3b8" }}>→</span>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e2e8f0", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>3</div>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8" }}>Confirm details</span>
      </div>
      <div style={{ padding: "32px 28px" }}>
        <p style={{ fontSize: 15, color: "#475569", marginBottom: 24, fontWeight: 500 }}>
          Which department are you from? You will only be able to reserve booths assigned to your department.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, maxWidth: 720 }}>
          {depts.map(([key, cfg]) => (
            <div key={key} onClick={() => onSelect(key)} onMouseEnter={() => setHov(key)} onMouseLeave={() => setHov(null)}
              style={{ width: 175, padding: "20px 18px", borderRadius: 12, border: `2px solid ${hov === key ? cfg.color : cfg.border}`, background: hov === key ? cfg.bg : "#fff", cursor: "pointer", transform: hov === key ? "translateY(-3px)" : "none", boxShadow: hov === key ? `0 8px 24px ${cfg.color}33` : "0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.15s ease" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: cfg.bg, border: `2px solid ${cfg.border}`, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, background: cfg.color }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: cfg.text, marginBottom: 3 }}>{key}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{cfg.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Field {DEPT_FIELD[key]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, required, accentColor, focused, onFocus, onBlur, type = "text" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label} {required && <span style={{ color: accentColor }}>*</span>}
      </label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${focused ? accentColor : "#e2e8f0"}`, borderRadius: 8, fontSize: 14, outline: "none", background: "#f8fafc", color: "#1e293b", transition: "border-color 0.15s" }}
        onFocus={onFocus} onBlur={onBlur} />
    </div>
  );
}

// ─── Booth ────────────────────────────────────────────────────────────────────
function Booth({ id, reservations, onSelect, isAdmin, onAdminDelete, selectedDept }) {
  const dept = getDept(id);
  const cfg = DEPT[dept];
  const res = reservations[id];
  const reserved = !!res;
  const [hov, setHov] = useState(false);
  const locked = !isAdmin && selectedDept && dept !== selectedDept;

  return (
    <div
      onClick={() => { if (locked) return; if (isAdmin && reserved) { onAdminDelete(id); return; } if (!reserved) onSelect(id); }}
      onMouseEnter={() => !locked && setHov(true)} onMouseLeave={() => setHov(false)}
      title={locked ? `${id}: not available for your department` : reserved ? (isAdmin ? `${id} — ${res.name} · Click to cancel` : `${id} — Already reserved`) : `${id}: ${cfg.label} — click to reserve`}
      style={{
        width: BS, height: BS, margin: BG, borderRadius: 5, flexShrink: 0,
        opacity: locked ? 0.2 : 1,
        border: `2px solid ${reserved ? (isAdmin && hov ? "#ef4444" : "#d1d5db") : hov ? cfg.color : cfg.border}`,
        background: reserved ? (isAdmin && hov ? "#fee2e2" : "#f3f4f6") : hov ? cfg.bg : cfg.bg,
        color: reserved ? (isAdmin && hov ? "#ef4444" : "#9ca3af") : cfg.text,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontSize: 8, fontWeight: 700,
        cursor: locked ? "not-allowed" : reserved ? (isAdmin ? "pointer" : "default") : "pointer",
        transform: hov && !locked ? "scale(1.18)" : "scale(1)",
        boxShadow: hov && !locked ? `0 4px 14px ${reserved ? "#ef444444" : cfg.color + "55"}` : "none",
        zIndex: hov ? 20 : 1, position: "relative", transition: "all 0.12s ease",
      }}
    >
      {reserved ? (<><span style={{ fontSize: 13, lineHeight: 1 }}>{isAdmin && hov ? "✕" : "✓"}</span><span style={{ fontSize: 7 }}>{id}</span></>) : <span>{id}</span>}
    </div>
  );
}

// ─── Field map ────────────────────────────────────────────────────────────────
function FieldMap({ field, reservations, onSelect, isAdmin, onAdminDelete, selectedDept }) {
  const f = FIELDS[field];
  const rb = (id) => <Booth key={id} id={id} reservations={reservations} onSelect={onSelect} isAdmin={isAdmin} onAdminDelete={onAdminDelete} selectedDept={selectedDept} />;
  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "inline-block", background: "#fff", border: "2px solid #e2e8f0", borderRadius: 10, padding: 8, boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex" }}>{f.topLeft.map(rb)}</div>
          <div style={{ flex: 1, minWidth: 14, height: BS + BG * 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#fef9c3", border: "1px dashed #ca8a04", borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 700, color: "#92400e", whiteSpace: "nowrap" }}>ENTRANCE</div>
          </div>
          {f.topRight.length > 0 && <div style={{ display: "flex" }}>{f.topRight.map(rb)}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>{f.leftCol.map(rb)}</div>
          <div style={{ flex: 1, minWidth: 160, margin: 4, borderRadius: 7, background: "linear-gradient(155deg, #4ade80 0%, #22c55e 45%, #15803d 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            {[...Array(6)].map((_, i) => <div key={i} style={{ position: "absolute", top: `${10 + i * 16}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.12)" }} />)}
            <div style={{ background: "rgba(0,0,0,0.22)", color: "#fff", borderRadius: 7, padding: "10px 18px", textAlign: "center", backdropFilter: "blur(2px)" }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{f.name}</div>
              <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{f.subtitle} · {f.size}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>{f.rightCol.map(rb)}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ display: "flex" }}>{f.bottom.map(rb)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ boothId, onClose, onConfirm, loading }) {
  const [name, setName] = useState("");
  const [cueId, setCueId] = useState("");
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState({});
  const dept = getDept(boothId);
  const cfg = DEPT[dept];
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid = name.trim().length > 1 && cueId.trim().length > 2 && emailValid;
  const foc = (k) => ({ focused: focused[k], onFocus: () => setFocused(f => ({...f, [k]: true})), onBlur: () => setFocused(f => ({...f, [k]: false})) });

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 30px 90px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Reserve Booth</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{boothId}</div>
            <div style={{ display: "inline-block", marginTop: 8, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{cfg.label}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <FormField label="Student Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required accentColor={cfg.color} {...foc("name")} />
        <FormField label="CUE ID" value={cueId} onChange={e => setCueId(e.target.value)} placeholder="e.g. CUE-2026-1234" required accentColor={cfg.color} {...foc("cueId")} />
        <FormField label="Student Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@cue.edu" required type="email" accentColor={cfg.color} {...foc("email")} />
        {email.length > 3 && !emailValid && <div style={{ fontSize: 11, color: "#ef4444", marginTop: -10, marginBottom: 10 }}>Please enter a valid email address.</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", border: "1.5px solid #e2e8f0", borderRadius: 9, background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#64748b" }}>Cancel</button>
          <button onClick={() => valid && !loading && onConfirm(boothId, { name: name.trim(), cueId: cueId.trim(), email: email.trim() })} disabled={!valid || loading}
            style={{ flex: 2, padding: "11px 0", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, color: "#fff", background: valid && !loading ? cfg.color : "#cbd5e1", cursor: valid && !loading ? "pointer" : "not-allowed", transition: "background 0.2s" }}>
            {loading ? "Saving…" : "Confirm Reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin login ──────────────────────────────────────────────────────────────
function AdminLogin({ onClose, onSuccess }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(false);
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 30px 90px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Admin Access</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Enter the admin password to manage reservations.</div>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }} onKeyDown={e => e.key === "Enter" && (pw === ADMIN_PASSWORD ? onSuccess() : setErr(true))} placeholder="Admin password"
          style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${err ? "#ef4444" : "#e2e8f0"}`, borderRadius: 8, fontSize: 14, outline: "none", marginBottom: 6 }} autoFocus />
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>Incorrect password.</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", border: "1.5px solid #e2e8f0", borderRadius: 9, background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#64748b" }}>Cancel</button>
          <button onClick={() => pw === ADMIN_PASSWORD ? onSuccess() : setErr(true)} style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, color: "#fff", background: "#0c2340", cursor: "pointer" }}>Enter</button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin panel ──────────────────────────────────────────────────────────────
function AdminPanel({ reservations, onDelete, onDeleteAll, onClose }) {
  const entries = Object.entries(reservations).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const [filter, setFilter] = useState("");
  const filtered = entries.filter(([id, r]) =>
    id.toLowerCase().includes(filter.toLowerCase()) ||
    r.name.toLowerCase().includes(filter.toLowerCase()) ||
    (r.cueId || "").toLowerCase().includes(filter.toLowerCase()) ||
    (r.email || "").toLowerCase().includes(filter.toLowerCase()) ||
    (r.dept || "").toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.8)", backdropFilter: "blur(8px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 90px rgba(0,0,0,0.4)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Admin Panel</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{entries.length} total reservations</div>
          </div>
          <button onClick={() => exportCSV(reservations)} style={{ padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#475569" }}>⬇ Export CSV</button>
          <button onClick={() => { if (confirm("Delete ALL reservations?")) onDeleteAll(); }} style={{ padding: "7px 14px", border: "1px solid #fca5a5", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#ef4444" }}>Clear All</button>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 20, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "12px 22px", borderBottom: "1px solid #f1f5f9" }}>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by booth, name, CUE ID, email, or department…"
            style={{ width: "100%", padding: "9px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", background: "#f8fafc" }} />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No results</div>
          : filtered.map(([id, res]) => {
            const cfg = DEPT[res.dept || getDept(id)];
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ width: 42, height: 42, borderRadius: 7, flexShrink: 0, background: cfg.bg, border: `2px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: cfg.text }}>{id}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{res.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{res.cueId} · {res.email}</div>
                  {res.ts && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{new Date(res.ts).toLocaleString()}</div>}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: cfg.text, background: cfg.bg, borderRadius: 5, padding: "3px 8px", flexShrink: 0 }}>{res.dept}</div>
                <button onClick={() => { if (confirm(`Cancel reservation for booth ${id}?`)) onDelete(id); }} style={{ padding: "6px 12px", border: "1px solid #fca5a5", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#ef4444", flexShrink: 0 }}>Cancel</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: type === "error" ? "#ef4444" : "#0f172a", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 3000, boxShadow: "0 8px 30px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <span style={{ color: type === "error" ? "#fecaca" : "#4ade80" }}>{type === "error" ? "✕" : "✓"}</span>{msg}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [reservations, setReservations] = useState({});
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [activeField, setActiveField] = useState("A");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "ok" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast({ msg: "", type: "ok" }), 3500); };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reservations"), (snap) => {
      const data = {};
      snap.forEach(doc => { data[doc.id] = doc.data(); });
      setReservations(data);
      setLoading(false);
    }, () => { showToast("Connection error.", "error"); setLoading(false); });
    return () => unsub();
  }, []);

  const handleDeptSelect = (dept) => {
    setSelectedDept(dept);
    setActiveField(DEPT_FIELD[dept]);
  };

  const handleTitleClick = () => {
    const next = adminClickCount + 1;
    setAdminClickCount(next);
    if (next >= 5) { setShowAdminLogin(true); setAdminClickCount(0); }
  };

  const handleConfirm = async (boothId, data) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "reservations", boothId), { ...data, dept: getDept(boothId), ts: Date.now() });
      setSelectedBooth(null);
      showToast(`Booth ${boothId} reserved for ${data.name}!`);
    } catch { showToast("Failed to save. Please try again.", "error"); }
    setSaving(false);
  };

  const handleAdminDelete = async (boothId) => {
    try { await deleteDoc(doc(db, "reservations", boothId)); showToast(`Booth ${boothId} cancelled.`); }
    catch { showToast("Failed to cancel.", "error"); }
  };

  const handleDeleteAll = async () => {
    try {
      await Promise.all(Object.keys(reservations).map(id => deleteDoc(doc(db, "reservations", id))));
      setShowAdminPanel(false); showToast("All reservations cleared.");
    } catch { showToast("Failed to clear.", "error"); }
  };

  const stats = (field) => { const ids = allBoothIds(field); const res = ids.filter(id => reservations[id]).length; return { total: ids.length, res, free: ids.length - res }; };
  const sA = stats("A"), sB = stats("B");
  const deptCfg = selectedDept ? DEPT[selectedDept] : null;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", background: "#f1f5f9" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🎓</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Loading floor plan…</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Connecting to database</div>
      </div>
    </div>
  );

  if (!selectedDept && !isAdmin) return (
    <>
      <DeptSelector onSelect={handleDeptSelect} />
      {showAdminLogin && <AdminLogin onClose={() => setShowAdminLogin(false)} onSuccess={() => { setIsAdmin(true); setShowAdminLogin(false); setSelectedDept("ACC"); showToast("Admin mode enabled."); }} />}
    </>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0c2340 0%, #1a3f6f 100%)", color: "#fff", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div onClick={handleTitleClick} style={{ cursor: "default", userSelect: "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Class of 2026 · Pre-Graduation Event</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>Booth Reservation Map</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isAdmin && <button onClick={() => setShowAdminPanel(true)} style={{ padding: "8px 16px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, background: "rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#fff" }}>⚙ Admin Panel</button>}
          {[{ label: "Field A", s: sA }, { label: "Field B", s: sB }].map(({ label, s }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 9, padding: "10px 16px", textAlign: "center", minWidth: 88 }}>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{s.free}</div>
              <div style={{ fontSize: 9, color: "#93c5fd", marginTop: 3, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label} Free</div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{s.res} / {s.total}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Dept + step bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {deptCfg && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: deptCfg.bg, border: `1.5px solid ${deptCfg.border}`, borderRadius: 7, padding: "5px 12px", display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: deptCfg.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: deptCfg.text }}>{selectedDept} — {deptCfg.label}</span>
            </div>
            {!isAdmin && <button onClick={() => setSelectedDept(null)} style={{ fontSize: 12, color: "#64748b", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>← Change</button>}
          </div>
        )}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
          {isAdmin ? "⚠ Admin mode — click reserved booth to cancel" : `Only ${deptCfg?.label} booths are available to you`}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 20px", display: "flex" }}>
        {["A", "B"].map(f => {
          const active = activeField === f;
          const s = stats(f);
          return (
            <button key={f} onClick={() => setActiveField(f)} style={{ padding: "14px 20px", border: "none", borderBottom: active ? "3px solid #1a3f6f" : "3px solid transparent", background: "none", cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 500, color: active ? "#1a3f6f" : "#64748b", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
              {FIELDS[f].name} · {FIELDS[f].subtitle}
              <span style={{ background: active ? "#1a3f6f" : "#e2e8f0", color: active ? "#fff" : "#64748b", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{s.free} free</span>
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {Object.entries(DEPT).filter(([k]) => k !== "NONE").map(([key, cfg]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: "4px 9px", opacity: !isAdmin && selectedDept && selectedDept !== key ? 0.35 : 1 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: cfg.color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.text }}>{key}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 9px" }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>✓</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>Reserved</span>
          </div>
        </div>
        <FieldMap field={activeField} reservations={reservations} onSelect={setSelectedBooth} isAdmin={isAdmin} onAdminDelete={handleAdminDelete} selectedDept={isAdmin ? null : selectedDept} />
      </div>

      {selectedBooth && <Modal boothId={selectedBooth} onClose={() => setSelectedBooth(null)} onConfirm={handleConfirm} loading={saving} />}
      {showAdminLogin && <AdminLogin onClose={() => setShowAdminLogin(false)} onSuccess={() => { setIsAdmin(true); setShowAdminLogin(false); setSelectedDept("ACC"); showToast("Admin mode enabled."); }} />}
      {showAdminPanel && <AdminPanel reservations={reservations} onDelete={handleAdminDelete} onDeleteAll={handleDeleteAll} onClose={() => setShowAdminPanel(false)} />}
      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
