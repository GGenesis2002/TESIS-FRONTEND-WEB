import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";   // mismo Sidebar compartido
import Navbar from "./Navbar";     // mismo Navbar compartido

export default function AsistenteLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2" }}>

      {/* Sidebar compartido — detecta id_rol:4 y muestra menú Asistente */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {/* Navbar compartido */}
      <Navbar collapsed={collapsed} />

      {/* Área de contenido */}
      <div style={{
        paddingTop: "84px",
        paddingLeft: collapsed ? "94px" : "264px",
        paddingRight: "24px",
        paddingBottom: "24px",
        transition: "padding-left 0.3s ease",
      }}>
        <Outlet />
      </div>
    </div>
  );
}