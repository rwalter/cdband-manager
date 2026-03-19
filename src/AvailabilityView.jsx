import { useState, useRef, useEffect, useCallback } from "react";
// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DECK_SLUG = "london-camden";
const DEFAULT_DURATION = 3;
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
// All possible hours (8am–7pm); filtered at render time by showExtended toggle
const ALL_HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const DEFAULT_HOURS = ALL_HOURS.filter(h => h >= 9 && h <= 17); // 9am–5pm
const STATUS_CYCLE = ["unavailable", "available", "maybe"]; // cycle order
const MAYBE_COLOR = "#EF9F27"; // amber for maybe state
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

// ─── CACHE HELPERS ──────────────────────────────────────────────────────────
const PIRATE_CACHE_KEY = "cdband-pirateAvailability";

function loadPirateCache() {
  try {
    const raw = localStorage.getItem(PIRATE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePirateCache(data, duration, lastRefreshed) {
  try {
    localStorage.setItem(PIRATE_CACHE_KEY, JSON.stringify({ data, duration, lastRefreshed }));
  } catch { /* quota exceeded — ignore */ }
}

function clearPirateCache() {
  localStorage.removeItem(PIRATE_CACHE_KEY);
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Date.now() - new Date(isoStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── AVAILABILITY HELPERS ────────────────────────────────────────────────────
// memberAvailability shape:
// { "2026-04-05": { 1: { dayStatus: "available"|"maybe"|"unavailable", dayReason: "", slots: { 9: { status, reason } } } } }

function getMemberDayStatus(memberAvailability, date, memberId) {
  return memberAvailability[date]?.[memberId]?.dayStatus || "unavailable";
}

function getMemberSlotStatus(memberAvailability, date, memberId, hour) {
  const entry = memberAvailability[date]?.[memberId];
  if (!entry) return "unavailable";
  // Check slot-level override first (allows per-hour availability even when day is "unavailable")
  const slotEntry = entry.slots?.[hour];
  if (slotEntry) return slotEntry.status;
  // Fall back to day status
  return entry.dayStatus || "unavailable";
}

function getMemberSlotReason(memberAvailability, date, memberId, hour) {
  const entry = memberAvailability[date]?.[memberId];
  if (!entry) return "";
  const slotEntry = entry.slots?.[hour];
  if (slotEntry?.reason) return slotEntry.reason;
  if (entry.dayReason) return entry.dayReason;
  return "";
}

function getAvailabilityLabel(memberAvailability, date, memberId, visibleHours) {
  const entry = memberAvailability[date]?.[memberId];
  if (!entry) return null;
  const dayStatus = entry.dayStatus || "unavailable";
  const slots = entry.slots || {};
  const slotKeys = Object.keys(slots);

  // If dayStatus is "available" or "maybe" with no slot overrides, use simple labels
  if (dayStatus === "available" && slotKeys.length === 0) return { text: "Free today", color: "#1D9E75" };
  if (dayStatus === "maybe" && slotKeys.length === 0) return { text: "Maybe", color: MAYBE_COLOR };

  // Compute which visible hours are available or maybe
  const freeHours = [];
  const maybeHours = [];
  for (const h of visibleHours) {
    const slotEntry = slots[h];
    const status = slotEntry ? slotEntry.status : dayStatus;
    if (status === "available") freeHours.push(h);
    else if (status === "maybe") maybeHours.push(h);
  }

  if (freeHours.length === 0 && maybeHours.length === 0) return null;

  // If dayStatus is "available" and all visible hours are free
  if (dayStatus === "available" && freeHours.length === visibleHours.length) {
    return { text: "Free today", color: "#1D9E75" };
  }

  // Format hours into compact ranges like "14–17"
  const formatRanges = (hours) => {
    const sorted = [...hours].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}–${end + 1}`);
        start = end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}–${end + 1}`);
    return ranges.join(", ");
  };

  if (freeHours.length > 0) return { text: `Free ${formatRanges(freeHours)}`, color: "#1D9E75" };
  if (maybeHours.length > 0) return { text: `Maybe ${formatRanges(maybeHours)}`, color: MAYBE_COLOR };
  return null;
}

function isMemberFree(memberAvailability, date, memberId, hour) {
  const status = getMemberSlotStatus(memberAvailability, date, memberId, hour);
  return status === "available" || status === "maybe";
}

function nextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function fetchPirateAvailability(date, duration) {
  // Don't fetch past dates — return empty
  if (date < todayStr()) {
    const hourMap = {};
    ALL_HOURS.forEach((h) => { hourMap[h] = null; });
    return hourMap;
  }
  const startTime = `${date}T08:00:00.000`;
  const url = `https://api.pirate.com/v1/search?deck_slug=${DECK_SLUG}&duration=${duration}&start_time=${encodeURIComponent(startTime)}`;
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
  ALL_HOURS.forEach((h) => {
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
            studioId: studio.studio?.id,
            rank: pref.rank,
            price: studio.price?.amount,
            capacity: studio.studio?.capacity,
            slotTime: slot.time,
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
const Avatar = ({ member, size = 24, faded = false, status }) => {
  // status can be "available", "maybe", or undefined/null (uses faded prop)
  const isMaybe = status === "maybe";
  const isAvailable = status === "available";
  const effectiveFaded = faded || (status && status === "unavailable");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: effectiveFaded ? "var(--color-background-secondary)"
        : isMaybe ? MAYBE_COLOR + "22"
        : member.color + "22",
      border: isMaybe
        ? `1.5px dashed ${MAYBE_COLOR}88`
        : `1.5px solid ${effectiveFaded ? "var(--color-border-tertiary)" : member.color + "66"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 500,
      color: effectiveFaded ? "var(--color-text-secondary)"
        : isMaybe ? MAYBE_COLOR
        : member.color,
      transition: "all 0.2s",
    }}>{member.initials}</div>
  );
};
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
function DayColumn({ date, availability, loading, memberAvailability, currentUser, onToggleDayStatus, onToggleSlot, onSlotClick, onDayReasonChange, visibleHours, allowStudioSwitch, duration, headerRef }) {
  const [hoveredHour, setHoveredHour] = useState(null);
  const weekend = isWeekend(date);
  const isToday = date === todayStr();
  // Check if duration consecutive hours starting at h all have availability.
  // When allowStudioSwitch is false, require the same studio across all hours.
  const hasConsecutive = (h) => {
    for (let i = 0; i < duration; i++) {
      if (!availability?.[h + i]) return false;
    }
    if (!allowStudioSwitch) {
      // Find a studio that's available in all duration hours
      const firstAll = availability[h]?.all || [];
      return firstAll.some(s =>
        Array.from({ length: duration }, (_, i) => h + i).every(hr =>
          availability[hr]?.all?.some(a => a.studioNum === s.studioNum)
        )
      );
    }
    return true;
  };
  // Find the best studio available across all duration hours from h
  const bestCommonStudio = (h) => {
    const hours = Array.from({ length: duration }, (_, i) => h + i);
    if (hours.some(hr => !availability?.[hr])) return null;
    const firstAll = availability[h]?.all || [];
    const common = firstAll.filter(s =>
      hours.every(hr => availability[hr]?.all?.some(a => a.studioNum === s.studioNum))
    );
    common.sort((a, b) => a.rank - b.rank);
    return common[0] || null;
  };
  // Which hours should be highlighted by the hover
  const hoverSet = new Set();
  const hoverStudio = hoveredHour !== null && hasConsecutive(hoveredHour)
    ? bestCommonStudio(hoveredHour) : null;
  if (hoverStudio) {
    for (let i = 0; i < duration; i++) hoverSet.add(hoveredHour + i);
  }
  const myDayStatus = getMemberDayStatus(memberAvailability, date, currentUser.id);
  return (
    <div style={{
      minWidth: 120, flex: 1, flexShrink: 0,
      borderRight: "0.5px solid var(--color-border-tertiary)",
      opacity: loading ? 0.4 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* Day header */}
      <div ref={headerRef} style={{
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
        {/* Member availability indicators — current user shown separately as tap target */}
        <div style={{ display: "flex", gap: 2, marginTop: 7, flexWrap: "wrap", alignItems: "center" }}>
          {BAND_MEMBERS.filter(m => m.id !== currentUser.id).map(m => {
            const dayStatus = getMemberDayStatus(memberAvailability, date, m.id);
            return (
              <div
                key={m.id}
                title={`${m.name} — ${dayStatus}`}
                style={{ padding: 1, borderRadius: "50%" }}
              >
                <Avatar member={m} size={18} status={dayStatus} />
              </div>
            );
          })}
        </div>
        {/* Current user day toggle — separate, larger tap target */}
        <button
          onClick={() => onToggleDayStatus(date)}
          title={`${currentUser.name} (you) — ${myDayStatus} — tap to change`}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            marginTop: 5, padding: "4px 8px 4px 4px",
            minHeight: 32,
            background: myDayStatus === "available" ? currentUser.color + "14"
              : myDayStatus === "maybe" ? MAYBE_COLOR + "14"
              : "var(--color-background-secondary)",
            border: myDayStatus === "available" ? `1px solid ${currentUser.color}44`
              : myDayStatus === "maybe" ? `1px dashed ${MAYBE_COLOR}44`
              : "1px solid var(--color-border-tertiary)",
            borderRadius: 6, cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <Avatar member={currentUser} size={18} status={myDayStatus} />
          <span style={{
            fontSize: 9, fontWeight: 500,
            color: myDayStatus === "available" ? currentUser.color
              : myDayStatus === "maybe" ? MAYBE_COLOR
              : "var(--color-text-secondary)",
          }}>
            {myDayStatus === "available" ? "Free" : myDayStatus === "maybe" ? "Maybe" : "Off"}
          </span>
        </button>
        {/* Day-level status label for current user — always rendered for alignment */}
        {(() => {
          const label = getAvailabilityLabel(memberAvailability, date, currentUser.id, visibleHours);
          return (
            <div style={{
              fontSize: 9, marginTop: 4,
              color: label ? label.color : "var(--color-text-secondary)",
              fontWeight: 500,
              minHeight: 14,
            }}>
              {label ? label.text : "Not set"}
            </div>
          );
        })()}
        {/* Inline note for day-level maybe */}
        {myDayStatus === "maybe" && (
          <input
            type="text"
            value={memberAvailability[date]?.[currentUser.id]?.dayReason || ""}
            onChange={e => onDayReasonChange(date, e.target.value)}
            placeholder="Note (optional)"
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", marginTop: 4, padding: "3px 5px",
              fontSize: 9, borderRadius: 4, boxSizing: "border-box",
              border: `1px solid ${MAYBE_COLOR}44`,
              background: MAYBE_COLOR + "0A",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        )}
      </div>
      {/* Hour slots */}
      <div>
        {visibleHours.map(hour => {
          const slot = availability?.[hour];
          const membersFree = BAND_MEMBERS.filter(m => isMemberFree(memberAvailability, date, m.id, hour));
          const highlight = slot && membersFree.length >= 4;
          // When hovered, show the common studio instead of the per-hour best
          const isHovered = hoverSet.has(hour);
          const displayStudio = isHovered && hoverStudio ? hoverStudio : slot?.best;
          const displayColor = STUDIO_COLORS[displayStudio?.studioNum] || "#888";
          const mySlotStatus = getMemberSlotStatus(memberAvailability, date, currentUser.id, hour);
          return (
            <div
              key={hour}
              onPointerEnter={(e) => { if (e.pointerType === "mouse" && slot) setHoveredHour(hour); }}
              onPointerLeave={() => setHoveredHour(null)}
              style={{
                height: 44,
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                padding: "4px 6px",
                boxSizing: "border-box",
                display: "flex", alignItems: "center",
                cursor: "default",
                background: isHovered
                  ? displayColor + "22"
                  : highlight
                  ? STUDIO_COLORS[slot.best.studioNum] + "12"
                  : "transparent",
                transition: "background 0.15s",
                position: "relative",
              }}
            >
              {/* My availability toggle — proper button, no nesting issues */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSlot(date, hour);
                }}
                title={`Your status: ${mySlotStatus} — tap to change`}
                style={{
                  width: 36, height: 36, flexShrink: 0,
                  marginRight: 2, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  background: "none", border: "none", padding: 0,
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: mySlotStatus === "available" ? currentUser.color + "22"
                    : mySlotStatus === "maybe" ? MAYBE_COLOR + "22"
                    : "transparent",
                  border: mySlotStatus === "available" ? `1.5px solid ${currentUser.color}`
                    : mySlotStatus === "maybe" ? `1.5px dashed ${MAYBE_COLOR}`
                    : "1.5px solid var(--color-border-tertiary)",
                  transition: "all 0.15s",
                  pointerEvents: "none",
                }}>
                  {mySlotStatus === "available" && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: currentUser.color }} />
                  )}
                  {mySlotStatus === "maybe" && (
                    <span style={{ fontSize: 9, color: MAYBE_COLOR, fontWeight: 700 }}>?</span>
                  )}
                </div>
              </button>
              {loading ? (
                <div style={{
                  height: 8, borderRadius: 4, width: "60%",
                  background: "var(--color-background-secondary)",
                }} />
              ) : slot ? (
                <button
                  disabled={!hasConsecutive(hour)}
                  style={{
                    flex: 1, cursor: hasConsecutive(hour) ? "pointer" : "default",
                    background: "none", border: "none", padding: "4px 0",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                    textAlign: "left", minHeight: 36,
                    display: "flex", alignItems: "center",
                  }}
                  onClick={() => {
                    if (!slot || !hasConsecutive(hour)) return;
                    const common = bestCommonStudio(hour);
                    const overriddenSlot = common ? { ...slot, best: common } : slot;
                    onSlotClick({ date, hour, slot: overriddenSlot, membersFree });
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4, pointerEvents: "none" }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: displayColor,
                    }} />
                    <span style={{
                      fontSize: 10, fontWeight: 500,
                      color: displayColor,
                    }}>
                      {displayStudio.studioNum} – £{displayStudio.price}
                    </span>
                  </div>
                </button>
              ) : (
                <div style={{
                  height: 4, borderRadius: 2, width: "30%",
                  background: "var(--color-border-tertiary)",
                  opacity: 0.4,
                }} />
              )}
              {/* Member count indicator */}
              {!loading && slot && membersFree.length > 0 && (
                <div style={{
                  position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                  fontSize: 9,
                  color: membersFree.length >= 4
                    ? STUDIO_COLORS[slot.best.studioNum]
                    : "var(--color-text-secondary)",
                }}>
                  {membersFree.length === 5 ? "★" : `${membersFree.length}/5`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── SLOT DETAIL MODAL ───────────────────────────────────────────────────────
function SlotDetail({ detail, memberAvailability, onClose, onWhatsApp, duration }) {
  if (!detail) return null;
  const { date, hour, slot, membersFree } = detail;
  const timeStr = `${String(hour).padStart(2, "0")}:00–${String(hour + duration).padStart(2, "0")}:00`;
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
          padding: "20px 20px calc(32px + env(safe-area-inset-bottom, 0px))",
          width: "100%", maxWidth: 480,
          borderTop: "0.5px solid var(--color-border-tertiary)",
          maxHeight: "80vh", overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--color-border-secondary)", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>
          {formatDate(date)} · {timeStr} · {duration}hrs
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
        {/* Who's free — per-slot status */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Attendance
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flexDirection: "column" }}>
            {BAND_MEMBERS.map(m => {
              const status = getMemberSlotStatus(memberAvailability, date, m.id, hour);
              const reason = getMemberSlotReason(memberAvailability, date, m.id, hour);
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <Avatar member={m} size={24} status={status} />
                  <div>
                    <span style={{
                      color: status === "unavailable" ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                      textDecoration: status === "unavailable" ? "line-through" : "none",
                    }}>{m.name}</span>
                    {status === "maybe" && (
                      <span style={{ fontSize: 11, color: MAYBE_COLOR, marginLeft: 6 }}>
                        maybe{reason ? ` — ${reason}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
            href={`https://book.pirate.com/booking/${DECK_SLUG}/${slot.best.studioId}/${slot.best.slotTime}?duration=${duration}&studio_super_type=1&total_guests=0`}
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
            Book Studio {slot.best.studioNum} ↗
          </a>
        </div>
      </div>
    </div>
  );
}
// ─── MAIN VIEW ───────────────────────────────────────────────────────────────
export default function AvailabilityView({ currentUser }) {
  // Seed availability from localStorage cache
  const cachedPirate = loadPirateCache();
  const cachedData = (cachedPirate && cachedPirate.duration === DEFAULT_DURATION)
    ? (() => {
        const today = todayStr();
        const filtered = {};
        for (const [d, v] of Object.entries(cachedPirate.data)) {
          if (d >= today) filtered[d] = v;
        }
        return filtered;
      })()
    : {};
  const cachedDates = Object.keys(cachedData).sort();

  const [dates, setDates] = useState(cachedDates);
  const [availability, setAvailability] = useState(cachedData);   // { dateStr: { hour: slotOrNull } }
  const [loading, setLoading] = useState({});              // { dateStr: bool }
  const [memberAvailability, setMemberAvailability] = useState(() => {
    try {
      const saved = localStorage.getItem("cdband-memberAvailability");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [whatsappMsg, setWhatsappMsg] = useState(null);
  const [error, setError] = useState(null);
  const [showExtended, setShowExtended] = useState(false);
  const [allowStudioSwitch, setAllowStudioSwitch] = useState(false);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [lastRefreshed, setLastRefreshed] = useState(
    cachedPirate?.duration === DEFAULT_DURATION ? cachedPirate.lastRefreshed : null
  );
  const [, setTick] = useState(0); // force re-render to update timeAgo display
  const visibleHours = showExtended ? ALL_HOURS : DEFAULT_HOURS;
  const scrollRef = useRef(null);
  const dayHeaderRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Measure day header height dynamically so hour axis stays aligned
  useEffect(() => {
    const el = dayHeaderRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeaderHeight(el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [dates.length > 0]); // re-attach when columns first appear

  // Persist memberAvailability to localStorage
  useEffect(() => {
    localStorage.setItem("cdband-memberAvailability", JSON.stringify(memberAvailability));
  }, [memberAvailability]);

  // Tick every 30s to keep "Updated X ago" label fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const loadDates = useCallback(async (newDates, { force = false } = {}) => {
    // Add only dates not already loaded (unless force-refreshing)
    const toLoad = force ? newDates : newDates.filter(d => !(d in availability));
    if (toLoad.length === 0) {
      // Still add the dates to the visible list even if already cached
      setDates(prev => {
        const all = [...new Set([...prev, ...newDates])].sort();
        return all;
      });
      return;
    }
    setDates(prev => {
      const all = [...new Set([...prev, ...newDates])].sort();
      return all;
    });
    // Mark as loading
    const loadingPatch = {};
    toLoad.forEach(d => { loadingPatch[d] = true; });
    setLoading(prev => ({ ...prev, ...loadingPatch }));
    // Fetch in parallel (with small stagger to be polite)
    let anySuccess = false;
    await Promise.all(toLoad.map(async (date, i) => {
      await new Promise(r => setTimeout(r, i * 120));
      try {
        const result = await fetchPirateAvailability(date, duration);
        setAvailability(prev => {
          const updated = { ...prev, [date]: result };
          // Persist to localStorage cache
          const now = new Date().toISOString();
          savePirateCache(updated, duration, now);
          setLastRefreshed(now);
          return updated;
        });
        anySuccess = true;
        setError(null);
      } catch (e) {
        setError("Couldn't reach Pirate API — try again in a moment.");
      } finally {
        setLoading(prev => ({ ...prev, [date]: false }));
      }
    }));
  }, [availability, duration]);
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

  // Day-level toggle: cycle unavailable → available → maybe
  const handleToggleDayStatus = (date) => {
    const myId = currentUser.id;
    const current = getMemberDayStatus(memberAvailability, date, myId);
    const next = nextStatus(current);
    setMemberAvailability(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [myId]: {
          ...(prev[date]?.[myId] || {}),
          dayStatus: next,
          dayReason: next === "maybe" ? (prev[date]?.[myId]?.dayReason || "") : "",
          slots: next === "unavailable" ? {} : (prev[date]?.[myId]?.slots || {}),
        },
      },
    }));
  };

  // Update day-level note for maybe status
  const handleDayReasonChange = (date, reason) => {
    const myId = currentUser.id;
    setMemberAvailability(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [myId]: {
          ...(prev[date]?.[myId] || {}),
          dayReason: reason,
        },
      },
    }));
  };

  // Slot-level toggle: cycle unavailable → available → maybe
  const handleToggleSlot = (date, hour) => {
    const myId = currentUser.id;
    const dayStatus = getMemberDayStatus(memberAvailability, date, myId);

    // If day is "unavailable", keep it that way but add a slot-level override
    if (dayStatus === "unavailable") {
      setMemberAvailability(prev => ({
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [myId]: {
            ...(prev[date]?.[myId] || {}),
            dayStatus: "unavailable",
            slots: {
              ...(prev[date]?.[myId]?.slots || {}),
              [hour]: { status: "available" },
            },
          },
        },
      }));
      return;
    }

    const currentSlotStatus = getMemberSlotStatus(memberAvailability, date, myId, hour);
    const next = nextStatus(currentSlotStatus);

    if (next === "unavailable") {
      // Remove the slot entry (revert to day-level default)
      setMemberAvailability(prev => {
        const slots = { ...(prev[date]?.[myId]?.slots || {}) };
        delete slots[hour];
        return {
          ...prev,
          [date]: {
            ...(prev[date] || {}),
            [myId]: {
              ...(prev[date]?.[myId] || {}),
              slots,
            },
          },
        };
      });
    } else {
      // "available" or "maybe"
      setMemberAvailability(prev => ({
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [myId]: {
            ...(prev[date]?.[myId] || {}),
            slots: {
              ...(prev[date]?.[myId]?.slots || {}),
              [hour]: { status: next },
            },
          },
        },
      }));
    }
  };

  const handleWhatsApp = ({ date, hour, slot, membersFree }) => {
    const timeStr = `${String(hour).padStart(2, "0")}:00–${String(hour + duration).padStart(2, "0")}:00`;
    const attending = membersFree.map(m => m.name).join(", ");
    const bookUrl = `https://book.pirate.com/booking/${DECK_SLUG}/${slot.best.studioId}/${slot.best.slotTime}?duration=${duration}&studio_super_type=1&total_guests=0`;
    const msg = `Hey band 🎸\n\nRehearsal slot at Pirate Studios Camden:\n📅 ${formatDate(date)}\n⏰ ${timeStr}\n🎛 Studio ${slot.best.studioNum} (£${slot.best.price})\n👥 ${attending}\n\nBook at: ${bookUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    setWhatsappMsg({ text: msg, url });
    setSelectedSlot(null);
  };
  // Refresh: clear cache and re-fetch all loaded dates
  const handleRefresh = () => {
    if (dates.length === 0) return;
    clearPirateCache();
    setAvailability({});
    setLastRefreshed(null);
    setSelectedSlot(null);
    const toRefetch = [...dates];
    loadDates(toRefetch, { force: true });
  };

  // Re-fetch all loaded dates when duration changes
  const prevDurationRef = useRef(duration);
  useEffect(() => {
    if (prevDurationRef.current !== duration) {
      prevDurationRef.current = duration;
      if (dates.length > 0) {
        clearPirateCache();
        setAvailability({});
        setLastRefreshed(null);
        setSelectedSlot(null);
        const toRefetch = [...dates];
        loadDates(toRefetch, { force: true });
      }
    }
  }, [duration]);
  // Initial load — start from most recent Monday (or today if Monday)
  useEffect(() => {
    if (dates.length === 0) {
      const today = todayStr();
      const dayOfWeek = new Date(today + "T12:00:00").getDay(); // 0=Sun, 1=Mon...
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = addDays(today, -daysSinceMonday);
      const next7 = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      loadDates(next7);
    }
  }, []);
  const anyLoading = Object.values(loading).some(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Header bar */}
      <div style={{
        padding: "12px 12px 10px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexShrink: 0, gap: 8, flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
            Pirate Studios Camden
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>
            Rehearsal Pro · {duration}hrs
          </div>
          {lastRefreshed && !anyLoading && (
            <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2, opacity: 0.7 }}>
              Updated {timeAgo(lastRefreshed)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {anyLoading && (
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>loading…</div>
          )}
          <button
            onClick={handleRefresh}
            disabled={anyLoading || dates.length === 0}
            title="Refresh availability from Pirate Studios"
            style={{
              fontSize: 12, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              color: "var(--color-text-primary)",
              opacity: (anyLoading || dates.length === 0) ? 0.5 : 1,
              minHeight: 36, WebkitTapHighlightColor: "transparent",
            }}
          >↻</button>
          <button
            onClick={handleLoad1Day}
            disabled={anyLoading}
            style={{
              fontSize: 12, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              color: "var(--color-text-primary)", opacity: anyLoading ? 0.5 : 1,
              minHeight: 36, WebkitTapHighlightColor: "transparent",
            }}
          >+1 day</button>
          <button
            onClick={handleLoad7Days}
            disabled={anyLoading}
            style={{
              fontSize: 12, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              color: "var(--color-text-primary)", opacity: anyLoading ? 0.5 : 1,
              minHeight: 36, WebkitTapHighlightColor: "transparent",
            }}
          >+7 days</button>
        </div>
      </div>
      {/* Time axis label + scrollable calendar */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Fixed hour axis */}
        <div style={{
          width: 38, flexShrink: 0,
          borderRight: "0.5px solid var(--color-border-tertiary)",
          paddingTop: headerHeight || 0,
        }}>
          {visibleHours.map(h => (
            <div key={h} style={{
              height: 44,
              borderBottom: "0.5px solid var(--color-border-tertiary)",
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              paddingRight: 8,
              fontSize: 10,
              color: "var(--color-text-secondary)",
              boxSizing: "border-box",
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
            touchAction: "pan-x pan-y",
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
            dates.map((date, i) => (
              <DayColumn
                key={date}
                date={date}
                availability={availability[date]}
                loading={!!loading[date]}
                memberAvailability={memberAvailability}
                currentUser={currentUser}
                onToggleDayStatus={handleToggleDayStatus}
                onToggleSlot={handleToggleSlot}
                onSlotClick={setSelectedSlot}
                onDayReasonChange={handleDayReasonChange}
                visibleHours={visibleHours}
                allowStudioSwitch={allowStudioSwitch}
                duration={duration}
                headerRef={i === 0 ? dayHeaderRef : undefined}
              />
            ))
          )}
        </div>
      </div>
      {/* Controls */}
      <div style={{
        padding: "8px 12px",
        borderTop: "0.5px solid var(--color-border-tertiary)",
        flexShrink: 0,
        display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center",
      }}>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer",
          minHeight: 32, WebkitTapHighlightColor: "transparent",
        }}>
          <input
            type="checkbox"
            checked={showExtended}
            onChange={e => setShowExtended(e.target.checked)}
            style={{ margin: 0, width: 18, height: 18 }}
          />
          8am–8pm
        </label>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer",
          minHeight: 32, WebkitTapHighlightColor: "transparent",
        }}>
          <input
            type="checkbox"
            checked={allowStudioSwitch}
            onChange={e => setAllowStudioSwitch(e.target.checked)}
            style={{ margin: 0, width: 18, height: 18 }}
          />
          Switch studios
        </label>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--color-text-secondary)",
          minHeight: 32,
        }}>
          Duration
          <select
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            style={{
              fontSize: 12, padding: "4px 6px", borderRadius: 4,
              border: "0.5px solid var(--color-border-tertiary)",
              background: "var(--color-background-secondary)",
              color: "var(--color-text-primary)",
              cursor: "pointer", minHeight: 28,
            }}
          >
            <option value={3}>3 hrs</option>
            <option value={4}>4 hrs</option>
          </select>
        </label>
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
          memberAvailability={memberAvailability}
          onClose={() => setSelectedSlot(null)}
          onWhatsApp={handleWhatsApp}
          duration={duration}
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
              padding: "20px 20px calc(32px + env(safe-area-inset-bottom, 0px))",
              width: "100%", maxWidth: 480,
              maxHeight: "80vh", overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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
