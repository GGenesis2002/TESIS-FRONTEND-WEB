import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar"; 
import Navbar from "./Navbar";   

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2" }}>
      
      {/* Sidebar Oficial — Lee automáticamente la clave 'administrador' del menú */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      {/* Navbar Oficial */}
      <Navbar collapsed={collapsed} />

      {/* Contenedor acoplado dinámicamente según el estado del Sidebar */}
      <div style={{
        paddingTop: "84px", 
        paddingLeft: collapsed ? "94px" : "264px", 
        paddingRight: "24px",
        paddingBottom: "24px",
        transition: "padding-left 0.3s ease",
      }}>
        {/* Aquí se renderizan las páginas hijas del Admin */}
        <Outlet />
      </div>
    </div>
  );
}