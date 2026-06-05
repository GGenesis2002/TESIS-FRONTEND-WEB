import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar"; // Componente hermano en la misma carpeta
import Navbar from "./Navbar";   // Componente hermano en la misma carpeta

export default function TecnicoLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2" }}>
      
      {/* Sidebar Oficial */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      {/* Navbar Oficial */}
      <Navbar collapsed={collapsed} />

      {/* Área de contenidos acoplada milimétricamente al diseño flotante */}
      <div style={{
        paddingTop: "84px", 
        paddingLeft: collapsed ? "94px" : "264px", 
        paddingRight: "24px",
        paddingBottom: "24px",
        transition: "padding-left 0.3s ease",
      }}>
        {/* Aquí se inyectan dinámicamente las páginas del técnico */}
        <Outlet />
      </div>
    </div>
  );
}