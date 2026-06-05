import marcaAgua from '../../assets/marcaAgua.png'; // ← importa tu imagen

function MicroscopeIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="28" fill="#F5F5F0" />
      <rect x="24" y="8" width="8" height="18" rx="4" fill="#9CA3AF" />
      <rect x="22" y="22" width="12" height="4" rx="2" fill="#6B7280" />
      <ellipse cx="28" cy="34" rx="10" ry="10" fill="none" stroke="#9CA3AF" strokeWidth="3" />
      <line x1="16" y1="46" x2="40" y2="46" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" />
      <line x1="28" y1="36" x2="28" y2="46" stroke="#6B7280" strokeWidth="2.5" />
      <circle cx="34" cy="28" r="3" fill="#E88B3A" />
    </svg>
  );
}



export default function LogoHeader({ subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "2rem" }}>

      {/* ── LOGO ── */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
        <img
          src={marcaAgua}
          alt="Logo Laboratorio"
          style={{
            width: "80px",
            height: "80px",
            objectFit: "contain",
          }}
        />
      </div>

      {/* ── TEXTOS ── */}
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: "0.75rem",
        letterSpacing: "0.25em",
        color: "#6B7280",
        marginBottom: "0.25rem",
        textTransform: "uppercase",
        margin: 0,
      }}>
        Laboratorio Clínico
      </p>
      <h1 style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        fontSize: "2rem",
        color: "#E88B3A",
        letterSpacing: "0.05em",
        margin: "0.25rem 0",
        lineHeight: 1,
      }}>
        CÁRDENAS–GAROFALO
      </h1>
      <p style={{
        fontFamily: "'Barlow', sans-serif",
        fontSize: "0.7rem",
        letterSpacing: "0.2em",
        color: "#9CA3AF",
        marginTop: "0.4rem",
        textTransform: "uppercase",
      }}>
        {subtitle}
      </p>
    </div>
  );
}