import { useState } from "react";
import AvailabilityView from "./AvailabilityView";

const BAND_MEMBERS = [
  { id: 1, name: "Alex", initials: "AL", color: "#5DCAA5", role: "Guitar / Vocals" },
  { id: 2, name: "Sam", initials: "SA", color: "#7F77DD", role: "Bass" },
  { id: 3, name: "Jordan", initials: "JO", color: "#D4537E", role: "Keys" },
  { id: 4, name: "Morgan", initials: "MO", color: "#378ADD", role: "Drums" },
  { id: 5, name: "Riley", initials: "RI", color: "#EF9F27", role: "Lead Guitar" },
];
const INITIAL_REHEARSALS = [
  {
    id: 1, date: "2026-04-05", time: "14:00", venue: "Sam's Garage",
    confirmed: true,
    attendees: [1, 2, 3, 4, 5],
    notes: "Full run-through",
  },
  {
    id: 2, date: "2026-04-19", time: "14:00", venue: "Sam's Garage",
    confirmed: true,
    attendees: [1, 2, 4, 5],
    notes: "Jordan away — work on rhythm section tightness",
  },
  {
    id: 3, date: "2026-05-03", time: "15:00", venue: "Morgan's Loft",
    confirmed: false,
    attendees: [],
    notes: "",
  },
];
const Avatar = ({ member, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: member.color + "22", border: `1.5px solid ${member.color}55`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.34, fontWeight: 500, color: member.color, letterSpacing: "0.02em",
  }}>{member.initials}</div>
);
const formatDate = (str) => {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const formatShortDate = (str) => {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const Card = ({ children, style = {} }) => (
  <div style={{
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: "1rem 1.25rem", ...style,
  }}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>{children}</h2>
);
// ─── VIEWS ──────────────────────────────────────────────────────────────────
function Dashboard({ rehearsals, members }) {
  const next = rehearsals.filter(r => r.confirmed && new Date(r.date) >= new Date()).sort((a,b) => a.date.localeCompare(b.date))[0];
  const confirmedCount = rehearsals.filter(r => r.confirmed).length;
  const pendingCount = rehearsals.filter(r => !r.confirmed).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10 }}>
        {[
          { label: "Next rehearsal", value: next ? formatShortDate(next.date) : "TBC", sub: next?.venue },
          { label: "Confirmed", value: confirmedCount, sub: `of ${rehearsals.length} total` },
          { label: "Pending", value: pendingCount, sub: "awaiting confirmation" },
        ].map(m => (
          <div key={m.label} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.1 }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{m.sub}</div>}
          </div>
        ))}
      </div>
      {next && (
        <>
          <SectionTitle>Next up — {formatDate(next.date)} at {next.time}</SectionTitle>
          <Card>
            <div style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>{next.venue}</div>
                {next.notes && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{next.notes}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {next.attendees.map(id => <Avatar key={id} member={members.find(m => m.id === id)} size={28} />)}
              </div>
            </div>
          </Card>
        </>
      )}
      <SectionTitle>The band</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map(m => (
          <Card key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
            <Avatar member={m} size={36} />
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{m.role}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
function RehearsalsView({ rehearsals, members }) {
  const upcoming = rehearsals.filter(r => new Date(r.date) >= new Date()).sort((a,b) => a.date.localeCompare(b.date));
  const past = rehearsals.filter(r => new Date(r.date) < new Date()).sort((a,b) => b.date.localeCompare(a.date));
  const RehearsalCard = ({ r }) => (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>{formatDate(r.date)}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{r.time} · {r.venue}</div>
        </div>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500, flexShrink: 0,
          background: r.confirmed ? "#E1F5EE" : "#FAEEDA",
          color: r.confirmed ? "#0F6E56" : "#854F0B",
        }}>{r.confirmed ? "Confirmed" : "Pending"}</span>
      </div>
      {r.attendees.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {r.attendees.map(id => <Avatar key={id} member={members.find(m => m.id === id)} size={26} />)}
          {r.attendees.length < members.length && (
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center" }}>
              {members.length - r.attendees.length} missing
            </span>
          )}
        </div>
      )}
      {r.notes && (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8, fontStyle: "italic" }}>{r.notes}</div>
      )}
    </Card>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {upcoming.length > 0 && (
        <div>
          <SectionTitle>Upcoming</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcoming.map(r => <RehearsalCard key={r.id} r={r} />)}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <SectionTitle>Past rehearsals</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {past.map(r => <RehearsalCard key={r.id} r={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
// ─── ROOT APP ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "home",        label: "Home",        icon: "⌂" },
  { id: "availability",label: "Availability", icon: "◷" },
  { id: "rehearsals",  label: "Rehearsals",   icon: "♪" },
];
function UserSelect({ onSelect }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 24, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
          Band Manager
        </div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Who are you?</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 340 }}>
        {BAND_MEMBERS.map(m => (
          <div
            key={m.id}
            onClick={() => onSelect(m)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(m); }}
            style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 12, padding: "14px 18px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 14,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Avatar member={m} size={40} />
            <div>
              <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{m.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("availability");
  const [rehearsals] = useState(INITIAL_REHEARSALS);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("cdband-currentUser");
      const id = saved ? JSON.parse(saved) : null;
      return BAND_MEMBERS.find(m => m.id === id) || null;
    } catch { return null; }
  });

  const handleLogin = (member) => {
    setCurrentUser(member);
    localStorage.setItem("cdband-currentUser", JSON.stringify(member.id));
  };
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("cdband-currentUser");
  };

  if (!currentUser) {
    return <UserSelect onSelect={handleLogin} />;
  }

  const renderView = () => {
    switch (view) {
      case "home":         return <Dashboard rehearsals={rehearsals} members={BAND_MEMBERS} />;
      case "availability": return <AvailabilityView currentUser={currentUser} />;
      case "rehearsals":   return <RehearsalsView rehearsals={rehearsals} members={BAND_MEMBERS} />;
      default:             return null;
    }
  };
  return (
    <div style={{ margin: "0 auto", fontFamily: "var(--font-sans)", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{
        padding: "18px 20px 14px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 17, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
            Band Manager
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Band HQ</div>
        </div>
        <div
          onClick={handleLogout}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleLogout(); }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer", padding: "6px 10px", borderRadius: 8,
            WebkitTapHighlightColor: "transparent",
            minHeight: 44,
          }}
        >
          <Avatar member={currentUser} size={28} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{currentUser.name}</div>
            <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>Switch user</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        {renderView()}
      </div>
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--color-background-primary)",
        borderTop: "0.5px solid var(--color-border-tertiary)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            style={{
              flex: 1, padding: "10px 4px 12px", background: "none", border: "none",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              borderTop: view === n.id ? "2px solid var(--color-text-primary)" : "2px solid transparent",
              minHeight: 48,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 18, color: view === n.id ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{n.icon}</span>
            <span style={{ fontSize: 10, color: view === n.id ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: view === n.id ? 500 : 400 }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
