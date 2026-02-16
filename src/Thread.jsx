import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════
// MATH: Projective Plane (p=5 → 31 cards, 6 symbols each)
// ═══════════════════════════════════════════
function generateCards(p) {
  const cards = [];
  const pt = (x, y) => x * p + y;
  const slope = (a) => p * p + a;
  const inf = p * p + p;
  for (let a = 0; a < p; a++)
    for (let b = 0; b < p; b++) {
      const card = [];
      for (let x = 0; x < p; x++) card.push(pt(x, (a * x + b) % p));
      card.push(slope(a));
      cards.push(card);
    }
  for (let b = 0; b < p; b++) {
    const card = [];
    for (let y = 0; y < p; y++) card.push(pt(b, y));
    card.push(inf);
    cards.push(card);
  }
  const infCard = [];
  for (let a = 0; a < p; a++) infCard.push(slope(a));
  infCard.push(inf);
  cards.push(infCard);
  return cards;
}

const ALL_CARDS = generateCards(5);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════
// TIME — puzzle resets at 9am EST daily
// ═══════════════════════════════════════════
function getNext9amEST() {
  const now = new Date();
  const todayRelease = new Date(now);
  todayRelease.setUTCHours(14, 0, 0, 0); // 9am EST = 14:00 UTC
  if (now >= todayRelease) {
    const tomorrow = new Date(todayRelease);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
  }
  return todayRelease;
}

function getThreadDayNumber() {
  const now = new Date();
  const epoch = new Date(Date.UTC(2025, 0, 1, 14, 0, 0));
  return Math.floor((now - epoch) / 86400000);
}

function getDailyPuzzle() {
  const dayNum = getThreadDayNumber();
  const rng = mulberry32(dayNum * 7919 + 1337);
  const indices = shuffle(Array.from({ length: ALL_CARDS.length }, (_, i) => i), rng);
  const rounds = [];
  for (let r = 0; r < 5; r++) {
    const cardA = ALL_CARDS[indices[r * 2]];
    const cardB = ALL_CARDS[indices[r * 2 + 1]];
    const match = cardA.find((s) => cardB.includes(s));
    rounds.push({
      top: shuffle([...cardA], rng),
      bottom: shuffle([...cardB], rng),
      answer: match,
    });
  }
  return { rounds, puzzleNum: dayNum + 1 };
}

// ═══════════════════════════════════════════
// STORAGE (localStorage wrapper)
// ═══════════════════════════════════════════
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function load(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

// ═══════════════════════════════════════════
// GOOGLE FORM SUBMISSION
// ═══════════════════════════════════════════
// ⚠️ REPLACE THESE WITH YOUR ACTUAL VALUES FROM THE PRE-FILLED LINK
const GOOGLE_FORM_ID = "1FAIpQLSd_EVLBlzkjyoyZSr4NUlxyVJqAiZldd58tVRhi4TrBKRweQg";
const GOOGLE_FORM_ENTRY = "entry.1811460026";

function submitPhoneToGoogleForm(phone) {
  const url = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`;
  const body = new URLSearchParams();
  body.append(GOOGLE_FORM_ENTRY, phone);

  // Fire-and-forget via fetch (no-cors so we don't get CORS errors)
  fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch(() => {});
}

// ═══════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════
const COLORS = {
  green: "#2d8a4e",
  yellow: "#b59f3b",
  red: "#c23b22",
  dim: "rgba(255,255,255,0.06)",
};

function getColor(t) {
  if (t < 1.5) return "green";
  if (t <= 3) return "yellow";
  return "red";
}

function getEmoji(t) {
  if (t < 1.5) return "\ud83d\udfe9";
  if (t <= 3) return "\ud83d\udfe8";
  return "\ud83d\udfe5";
}

// ═══════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════
function computeStats(history) {
  const todayDay = getThreadDayNumber();
  const sortedDays = history.map(h => h.day).sort((a, b) => b - a);
  let currentStreak = 0;
  if (sortedDays.length > 0 && sortedDays[0] === todayDay) {
    currentStreak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] === sortedDays[i - 1] - 1) currentStreak++;
      else break;
    }
  }
  const totalSolved = history.length;
  const allTotals = history.map(h => h.total);
  const avgAllTime = allTotals.length > 0 ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;
  const weekEntries = history.filter(h => todayDay - h.day < 7);
  const weekTotals = weekEntries.map(h => h.total);
  const avgWeek = weekTotals.length > 0 ? weekTotals.reduce((a, b) => a + b, 0) / weekTotals.length : 0;
  const monthEntries = history.filter(h => todayDay - h.day < 30);
  const monthTotals = monthEntries.map(h => h.total);
  const avgMonth = monthTotals.length > 0 ? monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length : 0;
  return {
    currentStreak, totalSolved,
    avgWeek: weekTotals.length > 0 ? avgWeek : null,
    avgMonth: monthTotals.length > 0 ? avgMonth : null,
    avgAllTime: allTotals.length > 0 ? avgAllTime : null,
    weekCount: weekTotals.length, monthCount: monthTotals.length,
  };
}

// ═══════════════════════════════════════════
// 31 GEOMETRIC SHAPES
// ═══════════════════════════════════════════
function Shape({ index, size = 36, color = "currentColor" }) {
  const s = (d) => ({ stroke: color, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", fill: "none", ...d });
  const f = (d) => ({ fill: color, ...d });
  const shapes = [
    <circle cx="12" cy="12" r="8" {...f()} />,
    <circle cx="12" cy="12" r="8" {...s()} />,
    <rect x="4" y="4" width="16" height="16" {...f()} />,
    <rect x="4" y="4" width="16" height="16" {...s()} />,
    <polygon points="12,3 22,21 2,21" {...f()} />,
    <polygon points="12,21 2,3 22,3" {...f()} />,
    <polygon points="12,2 22,12 12,22 2,12" {...f()} />,
    <polygon points="12,2 22,12 12,22 2,12" {...s()} />,
    <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" {...f()} />,
    <polygon points="12,2 22,9.5 19,21 5,21 2,9.5" {...f()} />,
    <path d="M12 3v18M3 12h18" {...s({ strokeWidth: 3 })} />,
    <path d="M4 4l16 16M20 4L4 20" {...s({ strokeWidth: 3 })} />,
    <polygon points="12,2 14.5,8.5 21.5,9 16.2,13.8 17.8,21 12,17.2 6.2,21 7.8,13.8 2.5,9 9.5,8.5" {...f()} />,
    <polygon points="12,1 14,9 22,12 14,15 12,23 10,15 2,12 10,9" {...f()} />,
    <path d="M12 2v20M4.4 4.4l15.2 15.2M19.6 4.4L4.4 19.6" {...s({ strokeWidth: 2.5 })} />,
    <path d="M12 3L19 12H15V21H9V12H5Z" {...f()} />,
    <path d="M21 12L12 5V9H3V15H12V19Z" {...f()} />,
    <path d="M4 6h16M4 12h16M4 18h16" {...s({ strokeWidth: 2.5 })} />,
    <path d="M6 4v16M12 4v16M18 4v16" {...s({ strokeWidth: 2.5 })} />,
    <path d="M8 3v18M16 3v18M3 8h18M3 16h18" {...s({ strokeWidth: 2 })} />,
    <path d="M4 16L12 7L20 16" {...s({ strokeWidth: 3 })} />,
    <path d="M4 19L12 12L20 19M4 12L12 5L20 12" {...s({ strokeWidth: 2.5 })} />,
    <path d="M3 14A9 9 0 0 1 21 14Z" {...f()} />,
    <path d="M14 3A9 9 0 0 0 14 21Z" {...f()} />,
    <path d="M17 12A7 7 0 1 1 12 5A5 5 0 1 0 17 12Z" {...f()} />,
    <path d="M3 6L8 18L13 6L18 18L23 6" {...s({ strokeWidth: 2.8 })} />,
    <path d="M12 20C12 20 3 14 3 8.5A4.5 4.5 0 0 1 12 7A4.5 4.5 0 0 1 21 8.5C21 14 12 20 12 20Z" {...f()} />,
    <path d="M12 3C12 3 5 10 5 15A7 7 0 0 0 19 15C19 10 12 3 12 3Z" {...f()} />,
    <polygon points="13,2 7,13 11,13 9,22 17,10 13,10 15,2" {...f()} />,
    <><circle cx="12" cy="12" r="9" {...s()} /><circle cx="12" cy="12" r="5" {...s()} /><circle cx="12" cy="12" r="1.5" {...f()} /></>,
    <path d="M5 4H11V10H17V16H23" {...s({ strokeWidth: 3 })} />,
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      {shapes[index] || <circle cx="12" cy="12" r="8" fill={color} />}
    </svg>
  );
}

// ═══════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════
function Cell({ sym, state, onTap, isLocked }) {
  const ok = state === "correct";
  const bad = state === "wrong";
  return (
    <div
      role="button" tabIndex={0}
      onPointerDown={(e) => { e.preventDefault(); if (!isLocked) onTap(sym); }}
      style={{
        width: 72, height: 72,
        background: ok ? "#fff" : "transparent",
        border: ok ? "2px solid #fff" : bad ? "2px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 3,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: isLocked ? "default" : "pointer",
        transition: "all 0.12s ease",
        color: ok ? "#060606" : bad ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
        transform: ok ? "scale(1.06)" : bad ? "scale(0.93)" : "scale(1)",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation", userSelect: "none",
      }}
    >
      <Shape index={sym} size={32} color="currentColor" />
    </div>
  );
}

function ColorBlock({ time, size = 28, active = false }) {
  const c = time != null ? getColor(time) : null;
  const bg = c ? COLORS[c] : active ? "rgba(255,255,255,0.12)" : COLORS.dim;
  return (
    <div style={{
      width: size, height: size, background: bg, borderRadius: 3,
      transition: "all 0.3s ease",
      border: active && !c ? "1px solid rgba(255,255,255,0.15)" : "none",
    }} />
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = getNext9amEST() - new Date();
      if (diff <= 0) { setTimeLeft("Available now!"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return timeLeft;
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export default function Thread() {
  const puzzle = useRef(getDailyPuzzle());
  const { rounds, puzzleNum } = puzzle.current;

  const [phase, setPhase] = useState("splash");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState([]);
  const [roundStart, setRoundStart] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [cellStates, setCellStates] = useState({});
  const [penalties, setPenalties] = useState(0);
  const [locked, setLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(null);
  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);

  const countdown = useCountdown();

  const timerRef = useRef(null);
  const roundRef = useRef(round);
  const timesRef = useRef(times);
  const penaltiesRef = useRef(penalties);
  const lockedRef = useRef(locked);
  const roundStartRef = useRef(roundStart);

  roundRef.current = round;
  timesRef.current = times;
  penaltiesRef.current = penalties;
  lockedRef.current = locked;
  roundStartRef.current = roundStart;

  useEffect(() => {
    const history = load("thread-history") || [];
    const todayEntry = history.find(h => h.day === getThreadDayNumber());
    if (todayEntry) {
      setTimes(todayEntry.times);
      setStats(computeStats(history));
      setPhase("result");
      return;
    }
    setStats(computeStats(history));
    if (load("thread-phone-saved")) setPhoneSaved(true);
  }, []);

  useEffect(() => {
    if (phase === "playing" && roundStart) {
      timerRef.current = setInterval(() => setElapsed(Date.now() - roundStart), 47);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, roundStart]);

  const startGame = () => {
    setPhase("playing");
    setRound(0);
    setTimes([]);
    setPenalties(0);
    setCellStates({});
    setRoundStart(Date.now());
    setElapsed(0);
    setLocked(false);
  };

  const handleTap = useCallback((sym) => {
    if (lockedRef.current) return;
    const r = roundRef.current;
    const cur = rounds[r];
    if (!cur) return;

    if (sym === cur.answer) {
      clearInterval(timerRef.current);
      const t = (Date.now() - roundStartRef.current + penaltiesRef.current * 2000) / 1000;
      const newTimes = [...timesRef.current, t];
      setTimes(newTimes);
      setCellStates({ [sym]: "correct" });
      setLocked(true);

      setTimeout(() => {
        if (r < 4) {
          setRound(r + 1);
          setCellStates({});
          setRoundStart(Date.now());
          setElapsed(0);
          setPenalties(0);
          setLocked(false);
        } else {
          const total = newTimes.reduce((a, b) => a + b, 0);
          const history = load("thread-history") || [];
          const existing = history.findIndex(h => h.day === getThreadDayNumber());
          const entry = { day: getThreadDayNumber(), times: newTimes, total, puzzleNum };
          if (existing >= 0) history[existing] = entry;
          else history.push(entry);
          store("thread-history", history);
          setStats(computeStats(history));
          setPhase("result");
        }
      }, 450);
    } else {
      setCellStates((prev) => ({ ...prev, [sym]: "wrong" }));
      setPenalties((p) => p + 1);
      setLocked(true);
      setTimeout(() => {
        setCellStates((prev) => { const n = { ...prev }; delete n[sym]; return n; });
        setLocked(false);
      }, 250);
    }
  }, [rounds, puzzleNum]);

  const fmtT = (s) => s.toFixed(1);
  const totalTime = times.reduce((a, b) => a + b, 0);

  const copyResults = () => {
    const blocks = times.map(t => getEmoji(t)).join("");
    const text = `\ud83e\uddf5${blocks} ${fmtT(totalTime)}s`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: prompt user
      window.prompt("Copy your result:", text);
    });
  };

  const handlePhoneSubmit = () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return;
    submitPhoneToGoogleForm(cleaned);
    store("thread-phone-saved", true);
    setPhoneSaved(true);
  };

  const FONT = "'Space Mono', 'SF Mono', 'Consolas', monospace";
  const curRound = rounds[round];

  return (
    <div style={{
      minHeight: "100vh", background: "#060606", color: "#d4d4d4",
      fontFamily: FONT,
      display: "flex", flexDirection: "column", alignItems: "center",
      userSelect: "none",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <header style={{ padding: "20px 20px 0", textAlign: "center", width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.3em", color: "#e0e0e0" }}>THREAD</div>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(255,255,255,0.12)", marginTop: 2 }}>#{puzzleNum}</div>
      </header>

      {/* SPLASH */}
      {phase === "splash" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 48, padding: "0 40px", textAlign: "center", maxWidth: 320,
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[COLORS.green, COLORS.green, COLORS.yellow, COLORS.red, COLORS.green].map((c, i) => (
              <div key={i} style={{ width: 24, height: 24, background: c, borderRadius: 3, opacity: 0.4 }} />
            ))}
          </div>
          <div style={{ fontSize: 12, lineHeight: 2.2, color: "rgba(255,255,255,0.25)" }}>
            Two grids. One shared shape.<br />Five rounds. Be fast.
          </div>
          <div
            role="button" tabIndex={0} onPointerDown={startGame}
            style={{
              fontSize: 12, fontWeight: 700, fontFamily: FONT,
              letterSpacing: "0.25em", textTransform: "uppercase",
              padding: "14px 48px", background: "transparent",
              color: "#e0e0e0", border: "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer", touchAction: "manipulation",
            }}
          >Start</div>
        </div>
      )}

      {/* PLAYING */}
      {phase === "playing" && curRound && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", maxWidth: 360, padding: "0 16px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "16px 0 8px" }}>
            {[0,1,2,3,4].map(i => <ColorBlock key={i} time={times[i]} size={28} active={i === round} />)}
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 4 }}>
              {curRound.top.map(sym => <Cell key={`t${sym}r${round}`} sym={sym} state={cellStates[sym]} onTap={handleTap} isLocked={locked} />)}
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: "#e0e0e0", fontVariantNumeric: "tabular-nums" }}>{(elapsed / 1000).toFixed(1)}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", marginLeft: 2 }}>s</span>
            {penalties > 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginTop: 3, letterSpacing: "0.1em" }}>+{penalties * 2}s penalty</div>}
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 4 }}>
              {curRound.bottom.map(sym => <Cell key={`b${sym}r${round}`} sym={sym} state={cellStates[sym]} onTap={handleTap} isLocked={locked} />)}
            </div>
          </div>
          <div style={{ height: 16 }} />
        </div>
      )}

      {/* RESULTS */}
      {phase === "result" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 24, padding: "24px 28px",
          maxWidth: 340, width: "100%", overflowY: "auto",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
              {times.map((t, i) => (
                <div key={i} style={{
                  width: 44, height: 44, background: COLORS[getColor(t)], borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.5)", fontVariantNumeric: "tabular-nums" }}>{fmtT(t)}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#e0e0e0", fontVariantNumeric: "tabular-nums" }}>{fmtT(totalTime)}s</div>
          </div>

          <div style={{ display: "flex", gap: 16, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
            <span><span style={{ color: COLORS.green }}>■</span> &lt;1.5s</span>
            <span><span style={{ color: COLORS.yellow }}>■</span> 1.5–3s</span>
            <span><span style={{ color: COLORS.red }}>■</span> &gt;3s</span>
          </div>

          <div
            role="button" tabIndex={0} onPointerDown={copyResults}
            style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.25em", textTransform: "uppercase",
              padding: "12px 36px", background: "transparent",
              color: "#e0e0e0", border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer", touchAction: "manipulation",
            }}
          >{copied ? "Copied!" : "Share"}</div>

          {/* Countdown */}
          <div style={{ textAlign: "center", marginTop: 4 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", marginBottom: 6 }}>Next thread</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.08em" }}>{countdown}</div>
          </div>

          {/* Reminder signup */}
          {!phoneSaved ? (
            <div style={{
              width: "100%", padding: "16px", borderRadius: 4,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10, textAlign: "center" }}>
                Get a daily reminder when the new puzzle drops
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="tel" placeholder="Phone number" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handlePhoneSubmit(); }}
                  style={{
                    flex: 1, padding: "10px 12px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 3, color: "#e0e0e0", fontSize: 13, fontFamily: FONT, outline: "none",
                  }}
                />
                <div
                  role="button" tabIndex={0} onPointerDown={handlePhoneSubmit}
                  style={{
                    padding: "10px 16px", background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3,
                    color: "#e0e0e0", fontSize: 11, fontWeight: 700, fontFamily: FONT,
                    letterSpacing: "0.1em", cursor: "pointer", touchAction: "manipulation",
                    display: "flex", alignItems: "center",
                  }}
                >GO</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              You're signed up for reminders
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div style={{ width: "100%", marginTop: 4 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.12)", marginBottom: 8 }}>Stats</div>
              <StatRow label="Current streak" value={`${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}`} />
              <StatRow label="Total solved" value={stats.totalSolved} />
              <StatRow label={`Avg this week (${stats.weekCount})`} value={stats.avgWeek != null ? `${fmtT(stats.avgWeek)}s` : "\u2014"} />
              <StatRow label={`Avg this month (${stats.monthCount})`} value={stats.avgMonth != null ? `${fmtT(stats.avgMonth)}s` : "\u2014"} />
              <StatRow label="Avg all time" value={stats.avgAllTime != null ? `${fmtT(stats.avgAllTime)}s` : "\u2014"} />
            </div>
          )}

          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.06)", textAlign: "center", lineHeight: 1.8, maxWidth: 240, marginTop: 4 }}>
            Every pair shares exactly one shape. Guaranteed by a projective plane.
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        input::placeholder { color: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
}
