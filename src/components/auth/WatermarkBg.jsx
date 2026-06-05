import marcaAgua from '../../assets/marcaAgua.png';

export default function WatermarkBg() {
  const items = Array(25).fill(null);
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      opacity: 0.05,
      pointerEvents: "none",
      zIndex: 0,
    }}>
      {items.map((_, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}>
          <img src={marcaAgua} alt="" style={{ width: "80px", height: "80px", objectFit: "contain" }} />
        </div>
      ))}
    </div>
  );
}