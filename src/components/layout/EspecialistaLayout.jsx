import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar"; 
import Navbar from "./Navbar";   

export default function EspecialistaLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2" }}>
      
      {/* Sidebar compartido que leerá el rol "Especialista" del LocalStorage */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      {/* Navbar compartido */}
      <Navbar collapsed={collapsed} />

      {/* Área de contenido con el mismo espaciado dinámico */}
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