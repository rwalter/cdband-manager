import { useState, useRef, useEffect, useCallback } from "react";
// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DECK_SLUG = "london-camden";
const DURATION = 3;
// Preferred studios in order — Pro only
const STUDIO_PREFERENCE = [
  { number: "16", label: "Studio 16", rank: 1 },
  { number: "13", label: "Studio 13", rank: 2 },
  { number: "22", label: "Studio 22", rank: 3 },
  { number: "32", label: "Studio 32", rank: 4 },
  { number: "21", label: "Studio 21", rank: 5 },
  { number: "17", label: "Studio 17", rank: 6 },
];
const STUDIO_COLORS = {
  "16": "#1D9E75", // teal — top pick
  "13": "#378ADD", // blue
  "22": "#7F77DD", // purple
  "32": "#EF9F27", // amber
  "21": "#D4537E", // pink
  "17": "#888780", // grey
};
const BAND_MEMBERS = [
  { id: 1, name: "Alex",   initials: "AL", color: "#1D9E75" },
  { id: 2, name: "Sam",    initials: "SA", color: "#7F77DD" },
  { id: 3, name: "Jordan", initials: "JO", color: "#D4537E" },
  { id: 4, name: "Morgan", initials: "MO", color: "#378ADD" },
  { id: 5, name: "Riley",  initials: "RI", color: "#EF9F27" },
];
// Hours to display (8am–7pm)
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
// ─── HELPERS ─────────────────────────────────────────────────────────────────
const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const isoDate = (d) => d.toISOString().split("T")[0];
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const todayStr = () => isoDate(new Date());
const isWeekend = (dateStr) => {
  const day = new Date(dateStr + "T12:00:00").getDay();
  return day === 0 || day === 6;
};
// Extract studio number from name like "Studio 16"
const studioNum = (name) => name?.replace("Studio ", "").trim();
const preferenceOf = (name) =>
  STUDIO_PREFERENCE.find((s) => s.number === studioNum(name));
// ─── API ─────────────────────────────────────────────────────────────────────
async function fetchPirateAvailability(date) {
  const startTime = `${date}T08:00:00.000`;
  const url = `https://api.pirate.com/v1/search?deck_slug=${DECK_SLUG}&duration=${DURATION}&start_time=${encodeURIComponent(startTime)}`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Pirate API error ${res.status}`);
  const all = await res.json();
  // Filter: Rehearsal Pro only, studios in our preference list
  const proRehearsal = all.filter((s) => {
    const typeName = s.studio_type?.name || "";
    const num = studioNum(s.studio?.name || "");
    return (
      typeName === "Rehearsal Pro" &&
      STUDIO_PREFERENCE.some((p) => p.number === num)
    );
  });
  // Build a map: hour → best available studio (by preference rank)
  const hourMap = {};
  HOURS.forEach((h) => {
    const hStr = String(h).padStart(2, "0") + ":00";
    const candidates = [];
    proRehearsal.forEach((studio) => {
      const slot = Object.values(studio.slots || {}).find(
        (sl) => sl.time?.substring(11, 16) === hStr
      );
      if (slot?.available) {
        const pref = preferenceOf(studio.studio?.name);
        if (pref) {
          candidates.push({
            studioName: studio.studio.name,
            studioNum: studioNum(studio.studio.name),
            rank: pref.rank,
            price: studio.price?.amount,
            capacity: studio.studio?.capacity,
          });
        }
      }
    });
    if (candidates.length > 0) {
      // Sort by rank (lower = better), pick best
      candidates.sort((a, b) => a.rank - b.rank);
      hourMap[h] = { best: candidates[0], all: candidates };
    } else {
      hourMap[h] = null;
    }
  });
  return hourMap;
}
// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
const Avatar = ({ member, size = 24, faded = false }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: faded ? "var(--color-background-secondary)" : member.color + "22",
    border: `1.5px solid ${faded ? "var(--color-border-tertiary)" : member.color + "66"}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.33, fontWeight: 500,
    color: faded ? "var(--color-text-secondary)" : member.color,
    transition: "all 0.2s",
  }}>{member.initials}</div>
);
const StudioBadge = ({ num, label }) => {
  const color = STUDIO_COLORS[num] || "#888";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 500, padding: "2px 7px",
      borderRadius: 20,
      background: color + "18",
      border: `1px solid ${color}44`,
      color: color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
};
// ─── DAY COLUMN ──────────────────────────────────────────────────────────────
function DayColumn({ date, availability, loading, memberAvailability, myId, onToggleMember, onSlotClick }) {
  const weekend = isWeekend(date);
  const isToday = date === todayStr();
  return (
    <div style={{
      minWidth: 120, flex: 1, flexShrink: 0,
      borderRight: "0.5px solid var(--color-border-tertiary)",
      opacity: loading ? 0.4 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* Day header */}
      <div style={{
        padding: "10px 8px 8px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        background: isToday
          ? "var(--color-background-info)"
          : weekend
          ? "var(--color-background-secondary)"
          : "var(--color-background-primary)",
        position: "sticky", top: 0, zIndex: 2,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 500,
          color: isToday ? "var(--color-text-info)" : "var(--color-text-secondary)",
          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2,
        }}>
          {new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}
        </div>
        <div style={{
          fontSize: 15, fontWeight: 500,
          color: isToday ? "var(--color-text-info)" : "var(--color-text-primary)",
        }}>
          {new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </div>
        {/* Member availability toggles */}
        <div style={{ display: "flex", gap: 3, marginTop: 7, flexWrap: "wrap" }}>
          {BAND_MEMBERS.map(m => {
            const free = memberAvailability[date]?.[m.id] ?? false;
            return (
              <div
                key={m.id}
                title={`${m.name} — click to toggle`}
                onClick={() => onToggleMember(date, m.id)}
                style={{ cursor: "pointer" }}
              >
                <Avatar member={m} size={20} faded={!free} />
              </div>
            );
          })}
        </div>
      </div>
      {/* Hour slots */}
      <div>
        {HOURS.map(hour => {
          const slot = availability?.[hour];
          const membersFree = BAND_MEMBERS.filter(m => memberAvailability[date]?.[m.id]);
          const allFree = membersFree.length === BAND_MEMBERS.length;
          const noneFree = membersFree.length === 0;
          const highlight = slot && membersFree.length >= 4;
          return (
            <div
              key={hour}
              onClick={() => slot && onSlotClick({ date, hour, slot, membersFree })}
              style={{
                height: 44,
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                padding: "4px 6px",
                cursor: slot ? "pointer" : "default",
                background: highlight
                  ? STUDIO_COLORS[slot.best.studioNum] + "12"
                  : "transparent",
                transition: "background 0.15s",
                position: "relative",
              }}
            >
              {loading ? (
                <div style={{
                  height: 8, borderRadius: 4, width: "60%",
                  background: "var(--color-background-secondary)",
                  marginTop: 6,
                }} />
              ) : slot ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: STUDIO_COLORS[slot.best.studioNum],
                    }} />
                    <span style={{
                      fontSize: 10, fontWeight: 500,
                      color: STUDIO_COLORS[slot.best.studioNum],
                    }}>
                      S{slot.best.studioNum}
                    </span>
                    {slot.all.length > 1 && (
                      <span style={{ fontSize: 9, color: "var(--color-text-secondary)" }}>
                        +{slot.all.length - 1}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--color-text-secondary)" }}>
                    £{slot.best.price}
                  </div>
                  {highlight && (
                    <div style={{
                      position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                      fontSize: 9,
                      color: STUDIO_COLORS[slot.best.studioNum],
                    }}>
                      {membersFree.length === 5 ? "★" : `${membersFree.length}/5`}
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  height: 4, borderRadius: 2, width: "30%",
                  background: "var(--color-border-tertiary)",
                  marginTop: 8, opacity: 0.4,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── SLOT DETAIL MODAL ───────────────────────────────────────────────────────
function SlotDetail({ detail, onClose, onWhatsApp }) {
  if (!detail) return null;
  const { date, hour, slot, membersFree } = detail;
  const membersMissing = BAND_MEMBERS.filter(m => !membersFree.find(f => f.id === m.id));
  const timeStr = `${String(hour).padStart(2, "0")}:00–${String(hour + DURATION).padStart(2, "0")}:00`;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--color-background-primary)",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 32px",
          width: "100%", maxWidth: 480,
          borderTop: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--color-border-secondary)", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>
          {formatDate(date)} · {timeStr} · {DURATION}hrs
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>
          Best available: Studio {slot.best.studioNum}
        </div>
        {/* All available studios */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Available studios
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {slot.all.map((s, i) => (
              <StudioBadge key={i} num={s.studioNum} label={`${s.studioName} · £${s.price}`} />
            ))}
          </div>
        </div>
        {/* Who's free */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Attendance
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {membersFree.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Avatar member={m} size={24} />
                <span style={{ color: "var(--color-text-primary)" }}>{m.name}</span>
              </div>
            ))}
            {membersMissing.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Avatar member={m} size={24} faded />
                <span style={{ color: "var(--color-text-secondary)", textDecoration: "line-through" }}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => onWhatsApp(detail)}
            style={{
              flex: 1, padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: "#1D9E75", border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            Share on WhatsApp ↗
          </button>
          <a
            href={`https://book.pirate.com/?site=${DECK_SLUG}&date=${date}&time=${hour}&duration=${DURATION}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              color: "var(--color-text-primary)", cursor: "pointer",
              textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            Book on Pirate ↗
          </a>
        </div>
      </div>
    </div>
  );
}
// ─── MAIN VIEW ───────────────────────────────────────────────────────────────
export default function AvailabilityView() {
  const [dates, setDates] = useState([]);
  const [availability, setAvailability] = useState({});   // { dateStr: { hour: slotOrNull } }
  const [loading, setLoading] = useState({});              // { dateStr: bool }
  const [memberAvailability, setMemberAvailability] = useState({}); // { dateStr: { memberId: bool } }
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [whatsappMsg, setWhatsappMsg] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const loadDates = useCallback(async (newDates) => {
    // Add only dates not already loaded
    const toLoad = newDates.filter(d => !(d in availability));
    if (toLoad.length === 0) return;
    setDates(prev => {
      const all = [...new Set([...prev, ...newDates])].sort();
      return all;
    });
    // Mark as loading
    const loadingPatch = {};
    toLoad.forEach(d => { loadingPatch[d] = true; });
    setLoading(prev => ({ ...prev, ...loadingPatch }));
    // Fetch in parallel (with small stagger to be polite)
    await Promise.all(toLoad.map(async (date, i) => {
      await new Promise(r => setTimeout(r, i * 120));
      try {
        const result = await fetchPirateAvailability(date);
        setAvailability(prev => ({ ...prev, [date]: result }));
        setError(null);
      } catch (e) {
        setError("Couldn't reach Pirate API — try again in a moment.");
      } finally {
        setLoading(prev => ({ ...prev, [date]: false }));
      }
    }));
  }, [availability]);
  const handleLoad1Day = () => {
    const start = dates.length > 0
      ? addDays(dates[dates.length - 1], 1)
      : todayStr();
    loadDates([start]);
  };
  const handleLoad7Days = () => {
    const start = dates.length > 0
      ? addDays(dates[dates.length - 1], 1)
      : todayStr();
    const newDates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    loadDates(newDates);
    // Scroll to end after a tick
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    }, 100);
  };
  const handleToggleMember = (date, memberId) => {
    setMemberAvailability(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [memberId]: !(prev[date]?.[memberId] ?? false),
      },
    }));
  };
  const handleWhatsApp = ({ date, hour, slot, membersFree }) => {
    const timeStr = `${String(hour).padStart(2, "0")}:00–${String(hour + DURATION).padStart(2, "0")}:00`;
    const attending = membersFree.map(m => m.name).join(", ");
    const msg = `Hey band 🎸\n\nRehearsal slot at Pirate Studios Camden:\n📅 ${formatDate(date)}\n⏰ ${timeStr}\n🎛 Studio ${slot.best.studioNum} (£${slot.best.price})\n👥 ${attending}\n\nBook at: https://book.pirate.com/?site=${DECK_SLUG}&date=${date}&time=${hour}&duration=${DURATION}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    setWhatsappMsg({ text: msg, url });
    setSelectedSlot(null);
  };
  // Initial load
  useEffect(() => {
    if (dates.length === 0) {
      const today = todayStr();
      const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i));
      loadDates(next7);
    }
  }, []);
  const anyLoading = Object.values(loading).some(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Header bar */}
      <div style={{
        padding: "12px 16px 10px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
            Pirate Studios Camden
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>
            Rehearsal Pro · {DURATION}hrs · Studios 16, 13, 22, 32, 21, 17
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {anyLoading && (
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>loading…</div>
          )}
          <button
            onClick={handleLoad1Day}
            disabled={anyLoading}
            style={{
              fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              color: "var(--color-text-primary)", opacity: anyLoading ? 0.5 : 1,
            }}
          >+1 day</button>
          <button
            onClick={handleLoad7Days}
            disabled={anyLoading}
            style={{
              fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              color: "var(--color-text-primary)", opacity: anyLoading ? 0.5 : 1,
            }}
          >+7 days</button>
        </div>
      </div>
      {/* Studio legend */}
      <div style={{
        padding: "8px 16px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0,
      }}>
        {STUDIO_PREFERENCE.map((s, i) => (
          <StudioBadge key={s.number} num={s.number} label={`S${s.number}${i === 0 ? " ★" : ""}`} />
        ))}
      </div>
      {/* Time axis label + scrollable calendar */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Fixed hour axis */}
        <div style={{
          width: 38, flexShrink: 0,
          borderRight: "0.5px solid var(--color-border-tertiary)",
          paddingTop: 111, // aligns with day header height
        }}>
          {HOURS.map(h => (
            <div key={h} style={{
              height: 44,
              borderBottom: "0.5px solid var(--color-border-tertiary)",
              display: "flex", alignItems: "center", justifyContent: "flex-end",              
              padding: "4px 6px",
              fontSize: 10,
              color: "var(--color-text-secondary)",
            }}>
              {String(h).padStart(2, "0")}
            </div>
          ))}
        </div>
        {/* Scrollable day columns */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowX: "auto",
            overflowY: "auto",
            display: "flex",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {dates.length === 0 ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              flex: 1, color: "var(--color-text-secondary)", fontSize: 13,
            }}>
              Press +1 day or +7 days to load availability
            </div>
          ) : (
            dates.map(date => (
              <DayColumn
                key={date}
                date={date}
                availability={availability[date]}
                loading={!!loading[date]}
                memberAvailability={memberAvailability}
                myId={1}
                onToggleMember={handleToggleMember}
                onSlotClick={setSelectedSlot}
              />
            ))
          )}
        </div>
      </div>
      {/* Error banner */}
      {error && (
        <div style={{
          position: "absolute", bottom: 80, left: 16, right: 16,
          background: "var(--color-background-danger)",
          border: "0.5px solid var(--color-border-danger)",
          borderRadius: 8, padding: "10px 14px",
          fontSize: 13, color: "var(--color-text-danger)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}>×</button>
        </div>
      )}
      {/* Slot detail sheet */}
      {selectedSlot && (
        <SlotDetail
          detail={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onWhatsApp={handleWhatsApp}
        />
      )}
      {/* WhatsApp message panel */}
      {whatsappMsg && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.35)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={() => setWhatsappMsg(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--color-background-primary)",
              borderRadius: "16px 16px 0 0",
              padding: "20px 20px 32px",
              width: "100%", maxWidth: 480,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--color-border-secondary)", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56", marginBottom: 10 }}>WhatsApp message ready</div>
            <pre style={{
              fontSize: 12, color: "var(--color-text-primary)", whiteSpace: "pre-wrap",
              lineHeight: 1.6, fontFamily: "var(--font-sans)", margin: "0 0 14px",
              background: "var(--color-background-secondary)",
              borderRadius: 8, padding: "10px 12px",
            }}>{whatsappMsg.text}</pre>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { navigator.clipboard.writeText(whatsappMsg.text); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 13,
                  background: "none",
                  border: "0.5px solid var(--color-border-tertiary)",
                  color: "var(--color-text-primary)", cursor: "pointer",
                }}
              >Copy</button>
              <a
                href={whatsappMsg.url} target="_blank" rel="noopener noreferrer"
                style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 13,
                  background: "#1D9E75", color: "#fff", fontWeight: 500,
                  cursor: "pointer", textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >Open WhatsApp ↗</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
