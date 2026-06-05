import { useState } from "react";

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function InputField({ label, type = "text", value, onChange, placeholder, isPassword }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const actualType = isPassword ? (show ? "text" : "password") : type;

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {label && (
        <label style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#6B7280",
          textTransform: "uppercase",
          marginBottom: "0.4rem",
          display: "block",
        }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          type={actualType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            paddingRight: isPassword ? "2.5rem" : "1rem",
            border: `1.5px solid ${focused ? "#E88B3A" : "#E5E7EB"}`,
            borderRadius: "8px",
            fontFamily: "'Barlow', sans-serif",
            fontSize: "0.95rem",
            color: "#1F2937",
            background: focused ? "#FFFBF7" : "#FAFAFA",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s, background 0.2s",
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9CA3AF",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
            }}
          >
            <EyeIcon open={show} />
          </button>
        )}
      </div>
    </div>
  );
}