import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

const ADMIN_PASSWORD = "grad2026admin";

// ─── Departments ──────────────────────────────────────────────────────────────
const DEPT = {
  AR:    { label: "Architecture",         color: "#4f46e5", bg: "#e0e7ff", border: "#a5b4fc", text: "#3730a3" },
  BM:    { label: "Business Management",  color: "#d97706", bg: "#fef3c7", border: "#fcd34d", text: "#78350f" },
  ACC:   { label: "Accounting",           color: "#16a34a", bg: "#dcfce7", border: "#86efac", text: "#166534" },
  MLS:   { label: "Medical Lab Sciences", color: "#be185d", bg: "#fce7f3", border: "#f9a8d4", text: "#831843" },
  IR:    { label: "Int'l Relations",      color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
  CSIT:  { label: "CS&IT",               color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
  EL:    { label: "English Language",     color: "#0891b2", bg: "#cffafe", border: "#67e8f9", text: "#164e63" },
  PLAIN: { label: "Field 3",             color: "#4a9030", bg: "#edf5e6", border: "#4a9030", text: "#2a5a18" },
  NONE:  { label: "General",             color: "#b45309", bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
};

const DEPT_FIELD = {
  AR: "A", BM: "A", ACC: "A", MLS: "A", IR: "A",
  CSIT: "B", EL: "B",
  PLAIN: "C", NONE: "A",
};

const FIELD_NAMES = { A: "Field 1", B: "Field 2", C: "Field 3" };

const getDept = (id) => {
  const n = parseInt(id.slice(1));
  if (id[0] === "A") {
    if (n >= 1  && n <= 13) return "AR";
    if (n >= 14 && n <= 22) return "BM";
    if (n >= 23 && n <= 34) return "ACC";
    if (n >= 35 && n <= 53) return "MLS";
    if (n >= 54 && n <= 58) return "IR";
  }
  if (id[0] === "B") {
    if (n >= 1  && n <= 22) return "CSIT";
    if (n >= 23 && n <= 29) return "EL";
  }
  if (id[0] === "C") return "PLAIN";
  return "NONE";
};

// ─── Field layouts ────────────────────────────────────────────────────────────
const FIELDS = {
  A: {
    name: "Field 1", subtitle: "Football Yard", size: "42m × 45m",
    cornerTopLeft: "A1",
    topRow:     ["A2","A3","A4","A5","A6","A7","A8","A9","A10","A11","A12"],
    rightCol:   ["A13","A14","A15","A16","A17","A18","A19","A20","A21","A22"],
    bottomRow:  ["A34","A33","A32","A31","A30","A29","A28","A27","A26","A25","A24","A23"],
    leftCol:    [],
    middleRows: [
      ["A35","A36","A37","A38","A39","A40","A41","A42","A43","A44","A45","A46"],
      ["A47","A48","A49","A50","A51","A52","A53","A54","A55","A56","A57","A58"],
    ],
  },
  B: {
    name: "Field 2", subtitle: "Back Yard", size: "32m × 30m",
    topRow:     ["B1","B2","B3","B4","B5","B6"],
    rightCol:   [],
    bottomRow:  ["B15","B14","B13","B12","B11","B10","B9","B8","B7"],
    leftCol:    ["B22","B21","B20","B19","B18","B17","B16"],
    middleRows: [["B23","B24","B25","B26","B27","B28","B29"]],
  },
  C: {
    name: "Field 3", subtitle: "Side Yard", size: "20m × 30m",
    topRow:        ["C1","C2","C3","C4"],
    rightColUpper: ["C5","C6","C7"],
    rightColLower: ["C8","C9","C10"],
    bottomRow:     ["C14","C13","C12","C11"],
    leftCol:       ["C21","C20","C19","C18","C17","C16","C15"],
    middleRows:    [],
  },
};

const allBoothIds = (field) => {
  const f = FIELDS[field];
  return [
    ...(f.cornerTopLeft ? [f.cornerTopLeft] : []),
    ...(f.topRow||[]),
    ...(f.rightCol||[]),
    ...(f.rightColUpper||[]),
    ...(f.rightColLower||[]),
    ...(f.bottomRow||[]),
    ...(f.leftCol||[]),
    ...((f.middleRows||[]).flat()),
  ];
};

// ─── CSV export ───────────────────────────────────────────────────────────────
const exportCSV = (reservations) => {
  const rows = [["Booth","Field","Department","Student Name","CUE ID","Email","Reserved At"]];
  Object.entries(reservations)
    .sort(([a],[b]) => a.localeCompare(b,undefined,{numeric:true}))
    .forEach(([id,r]) => rows.push([
      id,
      id[0]==="A"?"Field 1":id[0]==="B"?"Field 2":"Field 3",
      r.dept, r.name, r.cueId, r.email,
      r.ts ? new Date(r.ts).toLocaleString() : ""
    ]));
  const csv = rows.map(r => r.map(c=>`"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download="booth-reservations.csv"; a.click();
  URL.revokeObjectURL(url);
};

// ─── Pixel constants ──────────────────────────────────────────────────────────
const BS = 36; // 3m booth facing-width
const PD = 48; // 4m perimeter booth depth

// ─── Corner/entrance block ────────────────────────────────────────────────────
function Corner({ x, y, w, h, type, label }) {
  const ent = type === "ent";
  return (
    <div style={{
      position:"absolute", left:x, top:y, width:w, height:h,
      background: ent ? "#fef3c7" : "#fde8e2",
      border: `1.5px solid ${ent ? "#d97706" : "#c04030"}`,
      borderRadius:3, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontSize:6.5, fontWeight:600, textAlign:"center",
      color: ent ? "#92400e" : "#7a2018", lineHeight:1.2, padding:2,
    }}>
      <span>{label}</span>
    </div>
  );
}

// ─── Field center / walkway label ─────────────────────────────────────────────
function GreenLabel({ x, y, w, h, name, size, booths, walkway }) {
  if (w <= 0 || h <= 0) return null;
  return (
    <div style={{position:"absolute",left:x,top:y,width:w,height:h,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
      {walkway ? (
        <div style={{background:"rgba(0,0,0,.22)",padding:"2px 10px",borderRadius:3}}>
          <span style={{fontSize:8,color:"rgba(255,255,255,.8)",fontWeight:500}}>{walkway}</span>
        </div>
      ) : (
        <div style={{background:"rgba(0,0,0,.25)",borderRadius:6,padding:"8px 14px",textAlign:"center",backdropFilter:"blur(2px)"}}>
          <div style={{fontSize:12,fontWeight:900,color:"rgba(255,255,255,.95)"}}>{name}</div>
          <div style={{fontSize:8,color:"rgba(255,255,255,.7)",marginTop:2}}>{size}</div>
          <div style={{fontSize:10,fontWeight:700,color:"#a0e070",marginTop:3}}>{booths} booths</div>
        </div>
      )}
    </div>
  );
}

// ─── Booth ────────────────────────────────────────────────────────────────────
function Booth({ id, bw, bh, reservations, onSelect, isAdmin, onAdminCancel, selectedDept }) {
  const dept = getDept(id);
  const cfg = DEPT[dept];
  const res = reservations[id];
  const reserved = !!res;
  const [hov, setHov] = useState(false);
  const locked = !isAdmin && selectedDept && dept !== selectedDept;

  return (
    <div
      onClick={() => {
        if (locked) return;
        if (isAdmin && reserved) { onAdminCancel(id); return; }
        if (!reserved) onSelect(id);
      }}
      onMouseEnter={() => !locked && setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={
        locked ? `${id}: only for ${getDept(id)} dept` :
        reserved ? (isAdmin ? `${id} — ${res.name} · Click to cancel` : `${id} — Already reserved`) :
        `${id}: ${cfg.label} — click to reserve`
      }
      style={{
        width:bw, height:bh, boxSizing:"border-box", borderRadius:3,
        opacity: locked ? 0.18 : 1,
        border:`1.5px solid ${reserved?(isAdmin&&hov?"#ef4444":"#d1d5db"):hov?cfg.color:cfg.border}`,
        background: reserved?(isAdmin&&hov?"#fee2e2":"#f3f4f6"):cfg.bg,
        color: reserved?(isAdmin&&hov?"#ef4444":"#9ca3af"):cfg.text,
        display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", gap:1, fontSize:7, fontWeight:700, lineHeight:1,
        cursor: locked?"not-allowed":reserved?(isAdmin?"pointer":"default"):"pointer",
        transform: hov&&!locked?"scale(1.12)":"scale(1)",
        boxShadow: hov&&!locked?`0 3px 10px ${reserved?"#ef444433":cfg.color+"33"}`:"none",
        zIndex: hov?10:1, position:"relative",
        transition:"all 0.1s ease",
      }}
    >
      {reserved ? (
        <><span style={{fontSize:11}}>{isAdmin&&hov?"✕":"✓"}</span><span style={{fontSize:6}}>{id}</span></>
      ) : (
        <span style={{fontSize: Math.min(bw,bh)>34?8:7}}>{id}</span>
      )}
    </div>
  );
}

// ─── Field A map (42m×45m, 58 booths) ────────────────────────────────────────
function FieldAMap({ reservations, onSelect, isAdmin, onAdminCancel, selectedDept }) {
  const FW=504, FH=540, TW=36, RC_X=468;
  const MID1_Y=FH/2-BS, MID2_Y=FH/2;
  const rb = (id,bw,bh) => <Booth key={id} id={id} bw={bw} bh={bh} reservations={reservations} onSelect={onSelect} isAdmin={isAdmin} onAdminCancel={onAdminCancel} selectedDept={selectedDept}/>;
  return (
    <div style={{position:"relative",width:FW,height:FH,background:"#1b6b3a",border:"2px solid #134f2a",borderRadius:6,flexShrink:0}}>
      {/* A1 corner booth (top-left) */}
      <div style={{position:"absolute",left:0,top:0}}>{rb("A1",TW,PD)}</div>
      {/* Non-usable at position 2 */}
      <Corner x={TW} y={0} w={BS} h={PD} type="nu" label="N/U" />
      {/* Top-right entrance (3m) */}
      <Corner x={RC_X} y={0}     w={BS} h={PD} type="ent" label="ENT" />
      {/* Bottom-right entrance/N/U */}
      <Corner x={RC_X} y={FH-PD} w={BS} h={PD} type="ent" label="ENT N/U" />
      <GreenLabel x={TW} y={PD} w={RC_X-TW} h={MID1_Y-PD} name="Field 1" size="42m × 45m" booths={58} />
      <GreenLabel x={TW} y={MID2_Y+BS} w={RC_X-TW} h={FH-PD-MID2_Y-BS} walkway="Walkway" />
      {/* Top row A2–A12: start after A1(36) + N/U(36) = x=72 */}
      {FIELDS.A.topRow.map((id,i)      => <div key={id} style={{position:"absolute",left:TW+BS+i*BS,top:0}}>{rb(id,BS,PD)}</div>)}
      {/* Right col A13–A22: width=BS=36 (3m) */}
      {FIELDS.A.rightCol.map((id,i)    => <div key={id} style={{position:"absolute",left:RC_X,top:PD+i*BS}}>{rb(id,BS,BS)}</div>)}
      {/* Bottom row A23–A34: starts at x=0 */}
      {FIELDS.A.bottomRow.map((id,i)   => <div key={id} style={{position:"absolute",left:i*BS,top:FH-PD}}>{rb(id,BS,PD)}</div>)}
      {FIELDS.A.middleRows[0].map((id,i)=> <div key={id} style={{position:"absolute",left:i*BS,top:MID1_Y}}>{rb(id,BS,BS)}</div>)}
      {FIELDS.A.middleRows[1].map((id,i)=> <div key={id} style={{position:"absolute",left:i*BS,top:MID2_Y}}>{rb(id,BS,BS)}</div>)}
    </div>
  );
}

// ─── Field B map (32m×30m, 29 booths) ────────────────────────────────────────
function FieldBMap({ reservations, onSelect, isAdmin, onAdminCancel, selectedDept }) {
  const FW=384, FH=360, CN=PD;
  const ENW=10*12, ENT_X=FW-ENW; // entrance 10m=120px, starts at x=264
  const MID_Y=Math.round((FH-BS)/2); // vertically centered = 162px
  const MID_X=PD+2*BS;               // offset 2 booth-widths from left col = 120px
  const rb = (id,bw,bh) => <Booth key={id} id={id} bw={bw} bh={bh} reservations={reservations} onSelect={onSelect} isAdmin={isAdmin} onAdminCancel={onAdminCancel} selectedDept={selectedDept}/>;
  return (
    <div style={{position:"relative",width:FW,height:FH,background:"#1b6b3a",border:"2px solid #134f2a",borderRadius:6,flexShrink:0}}>
      <Corner x={0}      y={0}     w={CN}  h={PD}  type="nu"  label="N/U" />
      <Corner x={ENT_X}  y={0}     w={ENW} h={PD}  type="ent" label="ENTRANCE — 10 m" />
      <Corner x={0}      y={FH-CN} w={CN}  h={CN}  type="nu"  label="N/U" />
      {/* No bottom-right corner — right column removed */}
      <GreenLabel x={PD} y={PD} w={ENT_X-PD} h={FH-2*PD} name="Field 2" size="32m × 30m" booths={29} />
      {/* Top row B1–B6 (6 booths) */}
      {FIELDS.B.topRow.map((id,i)    => <div key={id} style={{position:"absolute",left:CN+i*BS,top:0}}>{rb(id,BS,PD)}</div>)}
      {/* Bottom row B7–B15 (9 booths, right-to-left labeling) */}
      {FIELDS.B.bottomRow.map((id,i) => <div key={id} style={{position:"absolute",left:CN+i*BS,top:FH-PD}}>{rb(id,BS,PD)}</div>)}
      {/* Left col B16–B22 (7 booths, top to bottom) */}
      {FIELDS.B.leftCol.map((id,i)   => <div key={id} style={{position:"absolute",left:0,top:PD+i*BS}}>{rb(id,CN,BS)}</div>)}
      {/* Middle row B23–B29 (7 booths, offset from left col) */}
      {FIELDS.B.middleRows[0].map((id,i) => <div key={id} style={{position:"absolute",left:MID_X+i*BS,top:MID_Y}}>{rb(id,BS,BS)}</div>)}
    </div>
  );
}

// ─── Field C map (20m×30m, 21 booths) ────────────────────────────────────────
function FieldCMap({ reservations, onSelect, isAdmin, onAdminCancel, selectedDept }) {
  const FW=240, FH=360, CN=PD, RC_X=240-PD;
  const ENT_Y = PD + 3*BS + 6;    // 162
  const LOWER_Y = ENT_Y + BS + 6; // 204
  const rb = (id,bw,bh) => <Booth key={id} id={id} bw={bw} bh={bh} reservations={reservations} onSelect={onSelect} isAdmin={isAdmin} onAdminCancel={onAdminCancel} selectedDept={selectedDept}/>;
  return (
    <div style={{position:"relative",width:FW,height:FH,background:"#1b6b3a",border:"2px solid #134f2a",borderRadius:6,flexShrink:0}}>
      <Corner x={0}    y={0}     w={CN} h={PD} type="nu"  label="N/U" />
      <Corner x={RC_X} y={0}     w={PD} h={PD} type="nu"  label="N/U" />
      <Corner x={0}    y={FH-PD} w={CN} h={PD} type="nu"  label="N/U" />
      <Corner x={RC_X} y={FH-PD} w={PD} h={PD} type="nu"  label="N/U" />
      <Corner x={RC_X} y={ENT_Y} w={PD} h={BS} type="ent" label="ENT 3m" />
      <GreenLabel x={PD} y={PD} w={RC_X-PD} h={FH-2*PD} name="Field 3" size="20m × 30m" booths={21} />
      {FIELDS.C.topRow.map((id,i)        => <div key={id} style={{position:"absolute",left:CN+i*BS,top:0}}>{rb(id,BS,PD)}</div>)}
      {FIELDS.C.rightColUpper.map((id,i) => <div key={id} style={{position:"absolute",left:RC_X,top:PD+i*BS}}>{rb(id,PD,BS)}</div>)}
      {FIELDS.C.rightColLower.map((id,i) => <div key={id} style={{position:"absolute",left:RC_X,top:LOWER_Y+i*BS}}>{rb(id,PD,BS)}</div>)}
      {FIELDS.C.bottomRow.map((id,i)     => <div key={id} style={{position:"absolute",left:CN+i*BS,top:FH-PD}}>{rb(id,BS,PD)}</div>)}
      {FIELDS.C.leftCol.map((id,i)       => <div key={id} style={{position:"absolute",left:0,top:PD+i*BS}}>{rb(id,CN,BS)}</div>)}
    </div>
  );
}

function FieldMap({ field, ...props }) {
  if (field==="A") return <FieldAMap {...props}/>;
  if (field==="B") return <FieldBMap {...props}/>;
  if (field==="C") return <FieldCMap {...props}/>;
  return null;
}

// ─── Department selector ──────────────────────────────────────────────────────
const CUE_NAVY = "#0d1f5c";
const CUE_CYAN = "#29b6d4";
const CUE_LOGO_B64 = "data:image/png;base64,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";

function DeptSelector({ onSelect }) {
  const [hov, setHov] = useState(null);
  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:`linear-gradient(135deg,${CUE_NAVY},#1a3a8f)`,color:"#fff",padding:"18px 28px",display:"flex",alignItems:"center",gap:18}}>
        
        <div onClick={()=>{}} style={{userSelect:"none"}}>
          <div style={{fontSize:10,fontWeight:700,color:CUE_CYAN,letterSpacing:".12em",textTransform:"uppercase",marginBottom:5}}>Catholic University in Erbil · Class of 2026</div>
          <h1 style={{margin:0,fontSize:22,fontWeight:900,letterSpacing:"-.02em"}}>Pre-Graduation Booth Reservation</h1>
        </div>
      </div>
      <div style={{background:"#fff",borderBottom:`2px solid ${CUE_CYAN}`,padding:"13px 28px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        {[{n:1,label:"Select your department",active:true},{n:2,label:"Choose a booth"},{n:3,label:"Confirm details"}].map(({n,label,active})=>(
          <span key={n} style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:26,height:26,borderRadius:"50%",background:active?CUE_NAVY:"#e2e8f0",color:active?"#fff":"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0}}>{n}</span>
            <span style={{fontSize:14,fontWeight:active?700:500,color:active?CUE_NAVY:"#94a3b8"}}>{label}</span>
            {n<3 && <span style={{color:"#94a3b8"}}>→</span>}
          </span>
        ))}
      </div>
      <div style={{padding:"32px 28px"}}>
        <p style={{fontSize:15,color:"#475569",marginBottom:24,fontWeight:500}}>Which department are you from? You will only be able to reserve booths assigned to your department.</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:14,maxWidth:720}}>
          {Object.entries(DEPT).filter(([k])=>k!=="NONE"&&k!=="PLAIN").map(([key,cfg])=>(
            <div key={key} onClick={()=>onSelect(key)} onMouseEnter={()=>setHov(key)} onMouseLeave={()=>setHov(null)}
              style={{width:170,padding:"20px 18px",borderRadius:12,border:`2px solid ${hov===key?cfg.color:cfg.border}`,background:hov===key?cfg.bg:"#fff",cursor:"pointer",transform:hov===key?"translateY(-3px)":"none",boxShadow:hov===key?`0 8px 24px ${cfg.color}33`:"0 1px 4px rgba(0,0,0,.06)",transition:"all .15s ease"}}>
              <div style={{width:36,height:36,borderRadius:8,background:cfg.bg,border:`2px solid ${cfg.border}`,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{width:16,height:16,borderRadius:3,background:cfg.color}}/>
              </div>
              <div style={{fontSize:16,fontWeight:800,color:cfg.text,marginBottom:3}}>{key}</div>
              <div style={{fontSize:12,color:"#64748b"}}>{cfg.label}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>{FIELD_NAMES[DEPT_FIELD[key]]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, required, accentColor, focused, onFocus, onBlur, type="text" }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:"#475569",marginBottom:5,letterSpacing:".04em",textTransform:"uppercase"}}>
        {label} {required&&<span style={{color:accentColor}}>*</span>}
      </label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${focused?accentColor:"#e2e8f0"}`,borderRadius:8,fontSize:14,outline:"none",background:"#f8fafc",color:"#1e293b",transition:"border-color .15s"}}
        onFocus={onFocus} onBlur={onBlur}/>
    </div>
  );
}

// ─── Reservation modal ────────────────────────────────────────────────────────
function Modal({ boothId, onClose, onConfirm, loading }) {
  const [name, setName] = useState("");
  const [cueId, setCueId] = useState("");
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState({});
  const cfg = DEPT[getDept(boothId)];
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid = name.trim().length>1 && cueId.trim().length>2 && emailValid;
  const foc = (k) => ({focused:focused[k], onFocus:()=>setFocused(f=>({...f,[k]:true})), onBlur:()=>setFocused(f=>({...f,[k]:false}))});

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#fff",borderRadius:14,padding:28,width:"100%",maxWidth:400,boxShadow:"0 30px 90px rgba(0,0,0,.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Reserve Booth</div>
            <div style={{fontSize:30,fontWeight:900,color:"#0f172a",lineHeight:1}}>{boothId}</div>
            <div style={{display:"inline-block",marginTop:8,background:cfg.bg,color:cfg.text,border:`1px solid ${cfg.border}`,borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:700}}>{cfg.label}</div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",border:"none",background:"#f1f5f9",cursor:"pointer",fontSize:18,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <FormField label="Student Name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" required accentColor={cfg.color} {...foc("name")}/>
        <FormField label="CUE ID" value={cueId} onChange={e=>setCueId(e.target.value)} placeholder="e.g. CUEAC22001" required accentColor={cfg.color} {...foc("cueId")}/>
        <FormField label="Student Email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="studentID@cue.edu.krd" required type="email" accentColor={cfg.color} {...foc("email")}/>
        {email.length>3&&!emailValid&&<div style={{fontSize:11,color:"#ef4444",marginTop:-10,marginBottom:10}}>Please enter a valid email address.</div>}
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{flex:1,padding:"11px 0",border:"1.5px solid #e2e8f0",borderRadius:9,background:"#fff",cursor:"pointer",fontSize:14,fontWeight:600,color:"#64748b"}}>Cancel</button>
          <button onClick={()=>valid&&!loading&&onConfirm(boothId,{name:name.trim(),cueId:cueId.trim(),email:email.trim()})} disabled={!valid||loading}
            style={{flex:2,padding:"11px 0",border:"none",borderRadius:9,fontSize:14,fontWeight:700,color:"#fff",background:valid&&!loading?cfg.color:"#cbd5e1",cursor:valid&&!loading?"pointer":"not-allowed",transition:"background .2s"}}>
            {loading?"Saving…":"Confirm Reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm cancel modal (replaces browser confirm) ─────────────────────────
function ConfirmCancelModal({ boothId, reservation, onConfirm, onCancel }) {
  if (!boothId) return null;
  const cfg = DEPT[getDept(boothId)];
  return (
    <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.65)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:24,maxWidth:340,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:8}}>Cancel this reservation?</div>
        <div style={{fontSize:13,color:"#475569",marginBottom:4}}>
          Booth <strong style={{color:cfg.text}}>{boothId}</strong> — {cfg.label}
        </div>
        {reservation&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:18}}>{reservation.name} · {reservation.cueId} · {reservation.email}</div>}
        <div style={{display:"flex",gap:10,marginTop:18}}>
          <button onClick={onCancel} style={{flex:1,padding:"10px",border:"1.5px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,color:"#64748b"}}>Keep it</button>
          <button onClick={()=>onConfirm(boothId)} style={{flex:2,padding:"10px",border:"none",borderRadius:8,background:"#ef4444",cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff"}}>Yes, cancel it</button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin login ──────────────────────────────────────────────────────────────
function AdminLogin({ onClose, onSuccess }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(false);
  const attempt = () => pw===ADMIN_PASSWORD ? onSuccess() : setErr(true);
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#fff",borderRadius:14,padding:28,width:"100%",maxWidth:340,boxShadow:"0 30px 90px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:20,fontWeight:900,color:"#0f172a",marginBottom:6}}>Admin Access</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Enter the admin password to manage all reservations.</div>
        <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Admin password"
          style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${err?"#ef4444":"#e2e8f0"}`,borderRadius:8,fontSize:14,outline:"none",marginBottom:6}} autoFocus/>
        {err&&<div style={{fontSize:12,color:"#ef4444",marginBottom:10}}>Incorrect password.</div>}
        <div style={{display:"flex",gap:10,marginTop:12}}>
          <button onClick={onClose} style={{flex:1,padding:"10px 0",border:"1.5px solid #e2e8f0",borderRadius:9,background:"#fff",cursor:"pointer",fontSize:14,fontWeight:600,color:"#64748b"}}>Cancel</button>
          <button onClick={attempt} style={{flex:2,padding:"10px 0",border:"none",borderRadius:9,fontSize:14,fontWeight:700,color:"#fff",background:CUE_NAVY,cursor:"pointer"}}>Enter</button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin panel ──────────────────────────────────────────────────────────────
function AdminPanel({ reservations, onDelete, onDeleteAll, onClose }) {
  const [filter, setFilter] = useState("");
  const [clearStep, setClearStep] = useState(false);
  const entries = Object.entries(reservations).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
  const filtered = entries.filter(([id,r]) =>
    [id,r.name,r.cueId||"",r.email||"",r.dept||""].some(v=>v.toLowerCase().includes(filter.toLowerCase()))
  );
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.8)",backdropFilter:"blur(8px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:720,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 90px rgba(0,0,0,.4)"}}>
        <div style={{padding:"18px 22px",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:900,color:"#0f172a"}}>Admin Panel</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{entries.length} total reservations across all fields</div>
          </div>
          <button onClick={()=>exportCSV(reservations)} style={{padding:"7px 14px",border:"1px solid #e2e8f0",borderRadius:8,background:"#f8fafc",cursor:"pointer",fontSize:12,fontWeight:600,color:"#475569"}}>⬇ Export CSV</button>
          {clearStep ? (
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,color:"#ef4444",fontWeight:600}}>Are you sure?</span>
              <button onClick={()=>{onDeleteAll();setClearStep(false);}} style={{padding:"6px 12px",border:"none",borderRadius:7,background:"#ef4444",cursor:"pointer",fontSize:12,fontWeight:700,color:"#fff"}}>Yes, clear all</button>
              <button onClick={()=>setClearStep(false)} style={{padding:"6px 12px",border:"1px solid #e2e8f0",borderRadius:7,background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:"#64748b"}}>No</button>
            </div>
          ) : (
            <button onClick={()=>setClearStep(true)} style={{padding:"7px 14px",border:"1px solid #fca5a5",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:"#ef4444"}}>Clear All</button>
          )}
          <button onClick={onClose} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#f1f5f9",cursor:"pointer",fontSize:20,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"12px 22px",borderBottom:"1px solid #f1f5f9"}}>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search by booth, name, CUE ID, email, or department…"
            style={{width:"100%",padding:"9px 13px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#f8fafc"}}/>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {filtered.length===0
            ? <div style={{padding:32,textAlign:"center",color:"#94a3b8",fontSize:14}}>No results</div>
            : filtered.map(([id,res])=>{
              const cfg=DEPT[res.dept||getDept(id)];
              const fieldLabel=id[0]==="A"?"Field 1":id[0]==="B"?"Field 2":"Field 3";
              return (
                <div key={id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 22px",borderBottom:"1px solid #f8fafc"}}>
                  <div style={{width:42,height:42,borderRadius:7,flexShrink:0,background:cfg.bg,border:`2px solid ${cfg.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
                    <span style={{fontSize:9,fontWeight:800,color:cfg.text}}>{id}</span>
                    <span style={{fontSize:7,color:cfg.text,opacity:.7}}>{fieldLabel}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#1e293b"}}>{res.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>{res.cueId} · {res.email}</div>
                    {res.ts&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{new Date(res.ts).toLocaleString()}</div>}
                  </div>
                  <div style={{fontSize:10,fontWeight:700,color:cfg.text,background:cfg.bg,borderRadius:5,padding:"3px 8px",flexShrink:0}}>{res.dept}</div>
                  <button onClick={()=>onDelete(id)} style={{padding:"6px 12px",border:"1px solid #fca5a5",borderRadius:7,background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:"#ef4444",flexShrink:0}}>Cancel</button>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:type==="error"?"#ef4444":"#0f172a",color:"#fff",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:600,zIndex:3000,boxShadow:"0 8px 30px rgba(0,0,0,.3)",display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap"}}>
      <span style={{color:type==="error"?"#fecaca":"#4ade80"}}>{type==="error"?"✕":"✓"}</span>{msg}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [reservations, setReservations] = useState({});
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeField, setActiveField] = useState("A");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({msg:"",type:"ok"});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [titleClicks, setTitleClicks] = useState(0);

  const showToast = (msg,type="ok") => { setToast({msg,type}); setTimeout(()=>setToast({msg:"",type:"ok"}),3500); };

  useEffect(()=>{
    const unsub = onSnapshot(collection(db,"reservations"),(snap)=>{
      const data={};
      snap.forEach(d=>{data[d.id]=d.data();});
      setReservations(data);
      setLoading(false);
    },(err)=>{
      console.error(err);
      showToast("Connection error — check Firebase rules.","error");
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const handleDeptSelect = (dept) => {
    setSelectedDept(dept);
    setActiveField(DEPT_FIELD[dept]);
  };

  const handleTitleClick = () => {
    const next=titleClicks+1;
    setTitleClicks(next);
    if(next>=5){setShowAdminLogin(true);setTitleClicks(0);}
  };

  const handleConfirmReserve = async (boothId, data) => {
    setSaving(true);
    try {
      await setDoc(doc(db,"reservations",boothId),{...data,dept:getDept(boothId),ts:Date.now()});
      setSelectedBooth(null);
      showToast(`Booth ${boothId} reserved for ${data.name}!`);
    } catch(e) {
      console.error(e);
      showToast("Failed to save. Please try again.","error");
    }
    setSaving(false);
  };

  // Admin cancel: open confirm modal
  const handleAdminCancel = (boothId) => setConfirmDeleteId(boothId);

  // Admin confirm delete
  const handleConfirmDelete = async (boothId) => {
    setConfirmDeleteId(null);
    try {
      const ref = doc(db, "reservations", boothId);
      await deleteDoc(ref);
      showToast(`Booth ${boothId} reservation cancelled.`);
    } catch(e) {
      const code = e?.code || e?.message || "unknown";
      console.error("Delete failed:", code, e);
      showToast(`Delete failed (${code}) — check Firebase rules.`, "error");
    }
  };

  // Admin delete all
  const handleDeleteAll = async () => {
    const ids = Object.keys(reservations);
    let failed = 0;
    await Promise.all(ids.map(id =>
      deleteDoc(doc(db, "reservations", id)).catch(() => { failed++; })
    ));
    setShowAdminPanel(false);
    if (failed > 0) showToast(`${failed} deletion(s) failed — check Firebase rules.`, "error");
    else showToast("All reservations cleared.");
  };

  const stats = (field) => {
    const ids=allBoothIds(field);
    const res=ids.filter(id=>reservations[id]).length;
    return {total:ids.length,res,free:ids.length-res};
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"system-ui",background:"#f1f5f9"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:12}}>🎓</div>
        <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>Loading floor plan…</div>
        <div style={{fontSize:13,color:"#94a3b8",marginTop:6}}>Connecting to database</div>
      </div>
    </div>
  );

  if (!selectedDept && !isAdmin) return (
    <>
      <DeptSelector onSelect={handleDeptSelect}/>
      {showAdminLogin&&<AdminLogin onClose={()=>setShowAdminLogin(false)} onSuccess={()=>{setIsAdmin(true);setShowAdminLogin(false);setSelectedDept("ACC");setActiveField("A");showToast("Admin mode enabled.");}}/>}
    </>
  );

  const deptCfg = selectedDept ? DEPT[selectedDept] : null;
  const sA=stats("A"), sB=stats("B"), sC=stats("C");
  const total={free:sA.free+sB.free+sC.free,total:sA.total+sB.total+sC.total,res:sA.res+sB.res+sC.res};

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f1f5f9"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${CUE_NAVY},#1a3a8f)`,color:"#fff",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          
          <div onClick={handleTitleClick} style={{cursor:"default",userSelect:"none"}}>
            <div style={{fontSize:9,fontWeight:700,color:CUE_CYAN,letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>Catholic University in Erbil · Class of 2026</div>
            <h1 style={{margin:0,fontSize:18,fontWeight:900,letterSpacing:"-.02em"}}>Pre-Graduation Booth Reservation</h1>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {isAdmin&&<button onClick={()=>setShowAdminPanel(true)} style={{padding:"8px 16px",border:`1px solid ${CUE_CYAN}`,borderRadius:8,background:"rgba(41,182,212,.15)",cursor:"pointer",fontSize:12,fontWeight:700,color:CUE_CYAN}}>⚙ Admin Panel</button>}
          {[{label:"Total",s:total},{label:"Field 1",s:sA},{label:"Field 2",s:sB},{label:"Field 3",s:sC}].map(({label,s})=>(
            <div key={label} style={{background:"rgba(255,255,255,.1)",borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:76}}>
              <div style={{fontSize:20,fontWeight:900,lineHeight:1}}>{s.free}</div>
              <div style={{fontSize:8,color:CUE_CYAN,marginTop:3,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{label} Free</div>
              <div style={{fontSize:8,color:"rgba(255,255,255,.5)",marginTop:1}}>{s.res}/{s.total}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Dept bar */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"10px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        {deptCfg&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{background:deptCfg.bg,border:`1.5px solid ${deptCfg.border}`,borderRadius:7,padding:"5px 12px",display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:9,height:9,borderRadius:2,background:deptCfg.color}}/>
              <span style={{fontSize:13,fontWeight:700,color:deptCfg.text}}>{selectedDept} — {deptCfg.label}</span>
            </div>
            {!isAdmin&&<button onClick={()=>setSelectedDept(null)} style={{fontSize:12,color:"#64748b",background:"none",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>← Change</button>}
          </div>
        )}
        <div style={{marginLeft:"auto",fontSize:12,color:"#94a3b8"}}>
          {isAdmin?"⚠ Admin mode — click any reserved booth to cancel it":`Only ${deptCfg?.label} booths (${FIELD_NAMES[DEPT_FIELD[selectedDept]]}) are available`}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 20px",display:"flex"}}>
        {["A","B","C"].map(f=>{
          const active=activeField===f;
          const s=stats(f);
          return (
            <button key={f} onClick={()=>setActiveField(f)} style={{padding:"14px 18px",border:"none",borderBottom:active?`3px solid ${CUE_CYAN}`:"3px solid transparent",background:"none",cursor:"pointer",fontSize:13,fontWeight:active?700:500,color:active?CUE_NAVY:"#64748b",display:"flex",alignItems:"center",gap:8,transition:"all .15s"}}>
              {FIELDS[f].name} · {FIELDS[f].subtitle}
              <span style={{background:active?CUE_CYAN:"#e2e8f0",color:active?"#fff":"#64748b",borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{s.free} free</span>
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div style={{padding:"16px 20px",overflowX:"auto"}}>
        {/* Legend */}
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
          {Object.entries(DEPT).filter(([k])=>k!=="NONE"&&k!=="PLAIN").map(([key,cfg])=>(
            <div key={key} style={{display:"flex",alignItems:"center",gap:5,background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:6,padding:"4px 9px",opacity:!isAdmin&&selectedDept&&selectedDept!==key?0.3:1}}>
              <div style={{width:9,height:9,borderRadius:2,background:cfg.color}}/>
              <span style={{fontSize:11,fontWeight:700,color:cfg.text}}>{cfg.label}</span>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:5,background:"#f3f4f6",border:"1px solid #d1d5db",borderRadius:6,padding:"4px 9px"}}>
            <span style={{fontSize:12,color:"#9ca3af"}}>✓</span>
            <span style={{fontSize:11,fontWeight:700,color:"#6b7280"}}>Reserved</span>
          </div>
        </div>

        <FieldMap
          field={activeField}
          reservations={reservations}
          onSelect={setSelectedBooth}
          isAdmin={isAdmin}
          onAdminCancel={handleAdminCancel}
          selectedDept={isAdmin?null:selectedDept}
        />
      </div>

      {/* Modals */}
      {selectedBooth&&<Modal boothId={selectedBooth} onClose={()=>setSelectedBooth(null)} onConfirm={handleConfirmReserve} loading={saving}/>}
      {confirmDeleteId&&<ConfirmCancelModal boothId={confirmDeleteId} reservation={reservations[confirmDeleteId]} onConfirm={handleConfirmDelete} onCancel={()=>setConfirmDeleteId(null)}/>}
      {showAdminLogin&&<AdminLogin onClose={()=>setShowAdminLogin(false)} onSuccess={()=>{setIsAdmin(true);setShowAdminLogin(false);setSelectedDept("ACC");setActiveField("A");showToast("Admin mode enabled.");}}/>}
      {showAdminPanel&&<AdminPanel reservations={reservations} onDelete={handleAdminCancel} onDeleteAll={handleDeleteAll} onClose={()=>setShowAdminPanel(false)}/>}
      <Toast msg={toast.msg} type={toast.type}/>
    </div>
  );
}
