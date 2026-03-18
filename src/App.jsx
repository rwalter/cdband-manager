import { useState, useMemo } from "react";
import AvailabilityView from "./AvailabilityView";

const BAND_MEMBERS = [
  { id: 1, name: "Alex", initials: "AL", color: "#5DCAA5", role: "Guitar / Vocals" },
  { id: 2, name: "Sam", initials: "SA", color: "#7F77DD", role: "Bass" },
  { id: 3, name: "Jordan", initials: "JO", color: "#D4537E", role: "Keys" },
  { id: 4, name: "Morgan", initials: "MO", color: "#378ADD", role: "Drums" },
  { id: 5, name: "Riley", initials: "RI", color: "#EF9F27", role: "Lead Guitar" },
];
const INITIAL_SONGS = [
  { id: 1, title: "Mortgage Blues", status: "ready", bpm: 94, key: "Am", notes: "Tight on bridge, nail the stop-start" },
  { id: 2, title: "Dad at the Disco", status: "learning", bpm: 128, key: "F", notes: "Morgan still wobbly on fills in verse 2" },
  { id: 3, title: "Semi-Detached", status: "ready", bpm: 112, key: "G", notes: "" },
  { id: 4, title: "Moderate Feelings", status: "polishing", bpm: 76, key: "D", notes: "Solo needs work — practise separately" },
  { id: 5, title: "Radio 4", status: "ready", bpm: 88, key: "Em", notes: "" },
  { id: 6, title: "The Sensible Option", status: "idea", bpm: null, key: null, notes: "New riff — demo it next session" },
  { id: 7, title: "Pension Age Lament", status: "learning", bpm: 102, key: "C", notes: "" },
  { id: 8, title: "Bi-Annual Review", status: "polishing", bpm: 86, key: "Bm", notes: "Intro timing still drifting" },
];
const INITIAL_REHEARSALS = [
  {
    id: 1, date: "2026-04-05", time: "14:00", venue: "Sam's Garage",
    confirmed: true,
    attendees: [1, 2, 3, 4, 5],
    setlist: [1, 3, 5, 2, 8],
    notes: "Full run-through + work on Disco bridge",
  },
  {
    id: 2, date: "2026-04-19", time: "14:00", venue: "Sam's Garage",
    confirmed: true,
    attendees: [1, 2, 4, 5],
    setlist: [1, 5, 4, 7],
    notes: "Jordan away — work on rhythm section tightness",
  },
  {
    id: 3, date: "2026-05-03", time: "15:00", venue: "Morgan's Loft",
    confirmed: false,
    attendees: [],
    setlist: [],
    notes: "",
  },
];
const STATUS_META = {
  ready:     { label: "Ready",     bg: "#EAF3DE", text: "#3B6D11", dot: "#639922" },
  polishing: { label: "Polishing", bg: "#FAEEDA", text: "#854F0B", dot: "#EF9F27" },
  learning:  { label: "Learning",  bg: "#E6F1FB", text: "#185FA5", dot: "#378ADD" },
  idea:      { label: "Idea",      bg: "#EEEDFE", text: "#534AB7", dot: "#7F77DD" },
};
const Avatar = ({ member, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: member.color + "22", border: `1.5px solid ${member.color}55`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.34, fontWeight: 500, color: member.color, letterSpacing: "0.02em",
  }}>{member.initials}</div>
);
const StatusBadge = ({ status }) => {
  const m = STATUS_META[status];
  return (
    <span style={{
      background: m.bg, color: m.text, fontSize: 11, fontWeight: 500,
      padding: "2px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, display: "inline-block" }} />
      {m.label}
    </span>
  );
};
const formatDate = (str) => {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const formatShortDate = (str) => {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: "1rem 1.25rem", ...style,
  }}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>{children}</h2>
);
// ─── VIEWS ──────────────────────────────────────────────────────────────────
function Dashboard({ rehearsals, songs, members, onNav }) {
  const next = rehearsals.filter(r => r.confirmed && new Date(r.date) >= new Date()).sort((a,b) => a.date.localeCompare(b.date))[0];
  const readyCount = songs.filter(s => s.status === "ready").length;
  const needsWorkCount = songs.filter(s => ["learning","polishing"].includes(s.status)).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Next rehearsal", value: next ? formatShortDate(next.date) : "TBC", sub: next?.venue },
          { label: "Songs ready", value: readyCount, sub: `of ${songs.length} total` },
          { label: "Needs work", value: needsWorkCount, sub: "learning or polishing" },
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>{next.venue}</div>
                {next.notes && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{next.notes}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {next.attendees.map(id => <Avatar key={id} member={members.find(m => m.id === id)} size={28} />)}
              </div>
            </div>
            {next.setlist.length > 0 && (
              <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>Setlist</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {next.setlist.map((sid, i) => {
                    const song = songs.find(s => s.id === sid);
                    return song ? (
                      <div key={sid} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                        <span style={{ color: "var(--color-text-secondary)", fontSize: 12, minWidth: 16 }}>{i + 1}</span>
                        <span style={{ flex: 1, color: "var(--color-text-primary)" }}>{song.title}</span>
                        <StatusBadge status={song.status} />
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
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
function SetlistView({ songs, onUpdateSong }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [whatsappMsg, setWhatsappMsg] = useState(null);
  const filtered = filter === "all" ? songs : songs.filter(s => s.status === filter);
  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const buildSetlistMessage = () => {
    const list = selected.length > 0
      ? songs.filter(s => selected.includes(s.id))
      : songs.filter(s => s.status === "ready");
    const lines = list.map((s, i) => `${i + 1}. ${s.title}${s.key ? ` (${s.key}, ${s.bpm} bpm)` : ""}`).join("\n");
    const msg = `Rehearsal setlist 🎸\n\n${lines}\n\nSee you there!`;
    const encoded = encodeURIComponent(msg);
    setWhatsappMsg({ text: msg, url: `https://wa.me/?text=${encoded}` });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "ready", "polishing", "learning", "idea"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 12, padding: "4px 12px", borderRadius: 20, cursor: "pointer",
              background: filter === f ? "var(--color-text-primary)" : "var(--color-background-secondary)",
              color: filter === f ? "var(--color-background-primary)" : "var(--color-text-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
            }}
          >{f === "all" ? "All songs" : STATUS_META[f]?.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
        {selected.length > 0 ? `${selected.length} selected for setlist share` : "Tap songs to build a shareable setlist"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(song => {
          const isSel = selected.includes(song.id);
          return (
            <Card
              key={song.id}
              style={{
                cursor: "pointer",
                borderColor: isSel ? "#1D9E75" : undefined,
                borderWidth: isSel ? 1.5 : undefined,
              }}
              onClick={() => toggleSelect(song.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {isSel && <span style={{ fontSize: 14, color: "#1D9E75" }}>✓</span>}
                    <span style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>{song.title}</span>
                  </div>
                  {(song.key || song.bpm) && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: song.notes ? 4 : 0 }}>
                      {[song.key && `Key: ${song.key}`, song.bpm && `${song.bpm} bpm`].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {song.notes && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                      {song.notes}
                    </div>
                  )}
                </div>
                <StatusBadge status={song.status} />
              </div>
            </Card>
          );
        })}
      </div>
      <button
        onClick={buildSetlistMessage}
        style={{
          fontSize: 13, padding: "10px", borderRadius: 8, cursor: "pointer",
          background: "var(--color-background-secondary)",
          border: "0.5px solid var(--color-border-tertiary)",
          color: "var(--color-text-primary)",
        }}
      >
        {selected.length > 0 ? `Share ${selected.length}-song setlist ↗` : "Share all ready songs ↗"}
      </button>
      {whatsappMsg && (
        <Card style={{ background: "#E1F5EE", borderColor: "#5DCAA5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56" }}>Setlist message ready</span>
            <button onClick={() => setWhatsappMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#0F6E56", fontSize: 16 }}>×</button>
          </div>
          <pre style={{
            fontSize: 12, color: "#0F6E56", whiteSpace: "pre-wrap", lineHeight: 1.6,
            fontFamily: "var(--font-sans)", margin: "0 0 10px",
            background: "#fff8", borderRadius: 6, padding: "8px 10px",
          }}>{whatsappMsg.text}</pre>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigator.clipboard.writeText(whatsappMsg.text)}
              style={{ flex: 1, fontSize: 13, padding: "6px 0", borderRadius: 8, background: "none", border: "1px solid #3B6D11", color: "#3B6D11", cursor: "pointer" }}
            >Copy</button>
            <a
              href={whatsappMsg.url} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, fontSize: 13, padding: "6px 0", borderRadius: 8, background: "#1D9E75", color: "#fff", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
            >Open in WhatsApp ↗</a>
          </div>
        </Card>
      )}
    </div>
  );
}
function RehearsalsView({ rehearsals, songs, members }) {
  const upcoming = rehearsals.filter(r => new Date(r.date) >= new Date()).sort((a,b) => a.date.localeCompare(b.date));
  const past = rehearsals.filter(r => new Date(r.date) < new Date()).sort((a,b) => b.date.localeCompare(a.date));
  const RehearsalCard = ({ r }) => (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>{formatDate(r.date)}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{r.time} · {r.venue}</div>
        </div>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500,
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
      {r.setlist.length > 0 && (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Setlist ({r.setlist.length} songs)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {r.setlist.map(sid => {
              const song = songs.find(s => s.id === sid);
              return song ? (
                <span key={sid} style={{
                  fontSize: 12, padding: "2px 8px", borderRadius: 20,
                  background: "var(--color-background-secondary)",
                  color: "var(--color-text-primary)",
                  border: "0.5px solid var(--color-border-tertiary)",
                }}>{song.title}</span>
              ) : null;
            })}
          </div>
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
function SetupView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>Connect Google Calendar</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.6 }}>
          Each band member connects their Google Calendar once. The app reads your free/busy slots to suggest rehearsal times — it never reads event details.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {BAND_MEMBERS.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <Avatar member={m} size={28} />
              <span style={{ flex: 1, color: "var(--color-text-primary)" }}>{m.name}</span>
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 20,
                background: m.id === 1 ? "#E1F5EE" : "var(--color-background-secondary)",
                color: m.id === 1 ? "#0F6E56" : "var(--color-text-secondary)",
              }}>{m.id === 1 ? "Connected" : "Not connected"}</span>
            </div>
          ))}
        </div>
        <button style={{ width: "100%", fontSize: 13, padding: "8px", borderRadius: 8, cursor: "pointer", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)" }}>
          Connect my Google Calendar ↗
        </button>
      </Card>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>Backend setup</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          This app requires a Supabase project + Node.js backend for Google OAuth and data persistence. See the architecture guide for full setup instructions.
        </div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { step: "1", label: "Create a Supabase project", done: false },
            { step: "2", label: "Run the schema migration", done: false },
            { step: "3", label: "Set up Google OAuth credentials", done: false },
            { step: "4", label: "Deploy the Node.js API", done: false },
            { step: "5", label: "Update .env with keys", done: false },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: s.done ? "#E1F5EE" : "var(--color-background-secondary)",
                border: `1px solid ${s.done ? "#3B6D11" : "var(--color-border-tertiary)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: s.done ? "#3B6D11" : "var(--color-text-secondary)",
              }}>{s.done ? "✓" : s.step}</div>
              <span style={{ color: "var(--color-text-primary)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
// ─── ROOT APP ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "home",        label: "Home",        icon: "⌂" },
  { id: "availability",label: "Availability", icon: "◷" },
  { id: "rehearsals",  label: "Rehearsals",   icon: "♪" },
  { id: "setlist",     label: "Songs",        icon: "≡" },
  { id: "setup",       label: "Setup",        icon: "⚙" },
];
export default function App() {
  const [view, setView] = useState("home");
  const [songs] = useState(INITIAL_SONGS);
  const [rehearsals] = useState(INITIAL_REHEARSALS);
  const renderView = () => {
    switch (view) {
      case "home":         return <Dashboard rehearsals={rehearsals} songs={songs} members={BAND_MEMBERS} onNav={setView} />;
      case "availability": return <AvailabilityView />;
      case "rehearsals":   return <RehearsalsView rehearsals={rehearsals} songs={songs} members={BAND_MEMBERS} />;
      case "setlist":      return <SetlistView songs={songs} />;
      case "setup":        return <SetupView />;
      default:             return null;
    }
  };
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "var(--font-sans)", paddingBottom: 80 }}>
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
        <div style={{ display: "flex", gap: -6 }}>
          {BAND_MEMBERS.map((m, i) => (
            <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <Avatar member={m} size={26} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        {renderView()}
      </div>
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        background: "var(--color-background-primary)",
        borderTop: "0.5px solid var(--color-border-tertiary)",
        display: "flex",
      }}>
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            style={{
              flex: 1, padding: "10px 4px 12px", background: "none", border: "none",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              borderTop: view === n.id ? "2px solid var(--color-text-primary)" : "2px solid transparent",
            }}
          >
            <span style={{ fontSize: 16, color: view === n.id ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{n.icon}</span>
            <span style={{ fontSize: 10, color: view === n.id ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: view === n.id ? 500 : 400 }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
