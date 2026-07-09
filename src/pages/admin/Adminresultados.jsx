import { useState, useEffect } from "react";
import API from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";

// Parsea valor_referencia (string JSON guardado por la pantalla de configuración
// de parámetros) a { tipo, opciones }. Si no es JSON válido o viene vacío, se
// asume NUMÉRICO (compatibilidad con parámetros creados antes de este cambio).
function parseTipoDato(valor_referencia) {
  if (!valor_referencia) return { tipo: "NUMERICO", opciones: [] };
  try {
    const parsed = JSON.parse(valor_referencia);
    return { tipo: parsed.tipo || "NUMERICO", opciones: parsed.opciones || [] };
  } catch {
    return { tipo: "NUMERICO", opciones: [] };
  }
}

// Texto legible del rango/referencia de un parámetro según su tipo.
function descripcionReferencia(p) {
  const { tipo } = parseTipoDato(p.valor_referencia);
  if (tipo === "OPCIONES") return "";
  if (tipo === "TEXTO")    return "";
  return p.rango_min != null ? `${p.rango_min} - ${p.rango_max}` : "—";
}

// Determina si un parámetro está fuera de rango. Solo aplica a parámetros
// NUMÉRICOS — los de tipo TEXTO/OPCIONES nunca se marcan fuera de rango.
function estaFueraDeRango(p) {
  const { tipo } = parseTipoDato(p.valor_referencia);
  if (tipo !== "NUMERICO") return false;
  const num = parseFloat(p.valor_obtenido);
  return !isNaN(num) && p.rango_min != null && p.rango_max != null
         && (num < p.rango_min || num > p.rango_max);
}

/* ══════════════════════════════════════════════════════════
   FUSIONAR PDF GENERADO + PDFs ADJUNTOS DE EXÁMENES PDF
══════════════════════════════════════════════════════════ */
async function fusionarPDFs(docJsPdf, pdfUrls) {
  // Si no hay PDFs adjuntos, devolver el doc tal cual
  if (!pdfUrls || pdfUrls.length === 0) return docJsPdf;

  try {
    // Convertir el jsPDF generado a ArrayBuffer
    const basePdfBytes = docJsPdf.output("arraybuffer");
    const mergedPdf    = await PDFDocument.load(basePdfBytes);

    for (const url of pdfUrls) {
      try {
        const resp    = await fetch(url);
        const bytes   = await resp.arrayBuffer();
        const extDoc  = await PDFDocument.load(bytes);
        const indices = extDoc.getPageIndices();
        const pages   = await mergedPdf.copyPages(extDoc, indices);
        pages.forEach(p => mergedPdf.addPage(p));
      } catch (err) {
        console.warn("No se pudo adjuntar PDF:", url, err);
      }
    }

    const mergedBytes = await mergedPdf.save();
    return mergedBytes; // Uint8Array — usar con new Blob([bytes], {type:"application/pdf"})
  } catch (err) {
    console.error("Error fusionando PDFs:", err);
    return docJsPdf; // fallback: devolver doc original
  }
}
// Interpola color RGB entre "stops" (paradas de color) según una fracción t (0-1).
// Se usa para dibujar la barra de "Posición" con zonas rojo→ámbar→verde→ámbar→rojo
// simulando un degradado continuo (jsPDF no soporta gradientes nativos en rects).
const ZONA_STOPS = [
  { t: 0,    c: [240, 149, 149] }, // rojo   (bajo)
  { t: 0.15, c: [250, 199, 117] }, // ámbar  (límite bajo)
  { t: 0.5,  c: [151, 196, 89]  }, // verde  (normal)
  { t: 0.85, c: [250, 199, 117] }, // ámbar  (límite alto)
  { t: 1,    c: [240, 149, 149] }, // rojo   (alto)
];
function colorZona(t) {
  for (let i = 0; i < ZONA_STOPS.length - 1; i++) {
    const a = ZONA_STOPS[i], b = ZONA_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const local = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * local),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * local),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * local),
      ];
    }
  }
  return ZONA_STOPS[ZONA_STOPS.length - 1].c;
}

/* ══════════════════════════════════════════════════════════
   HELPER: Limpieza EXTREMA de texto para jsPDF
══════════════════════════════════════════════════════════ */
function st(txt) {
  if (txt == null || txt === "") return "";
  let str = String(txt);

  // 1. Extraer texto puro ignorando cualquier código HTML oculto
  try {
    const doc = new DOMParser().parseFromString(str, 'text/html');
    str = doc.body.textContent || "";
  } catch (e) {}

  // 2. Eliminar saltos de línea y tabulaciones (esto evita que el texto se amontone)
  str = str.replace(/[\r\n\t]+/g, " ");

  // 3. Traducir símbolos médicos comunes a texto normal
  str = str.replace(/µ|μ/g, "u")
           .replace(/≤/g, "<=")
           .replace(/≥/g, ">=")
           .replace(/±/g, "+/-")
           .replace(/°/g, " grados");

  // 4. Aplanar acentos: Convierte letras con tilde (á) en letras normales (a)
  // Es la forma más segura para evitar cajas ilegibles en jsPDF.
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 5. REGLA DE ORO: Eliminar absolutamente cualquier símbolo raro que sobreviva.
  // Solo permite letras, números, espacios y signos de puntuación básicos.
  str = str.replace(/[^a-zA-Z0-9\s.,;:'"()\-+<>=/]/g, "");

  return str.trim();
}
/* ══════════════════════════════════════════════════════════
   GENERADOR DE PDF EN FRONTEND
══════════════════════════════════════════════════════════ */
async function generarPDFResultado(orden, resultados, admin) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, PH = 297;
  const ML = 15, MR = 15;

  // ── COLORES MARCA ──
  const C_NARANJA  = [232, 139, 58];   // #E88B3A
  const C_OSCURO   = [31,  41,  55];   // #1F2937
  const C_GRIS     = [107, 114, 128];  // #6B7280
  const C_GRIS_CLR = [156, 163, 175];  // #9CA3AF
  const C_BORDE    = [226, 232, 240];  // #E2E8F0
  const C_FONDO    = [248, 250, 252];  // #F8FAFC
  const C_BLANCO   = [255, 255, 255];

  // ── LOGO BASE64 ──
  const LOGO_B64 = "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";

  // ── ENCABEZADO ──
  // Fondo oscuro completo
  doc.setFillColor(...C_OSCURO);
  doc.rect(0, 0, PW, 32, "F");
  // Franja naranja izquierda (acento de marca)
  doc.setFillColor(...C_NARANJA);
  doc.rect(0, 0, 3, 32, "F");

  // Logo circular
  try {
    doc.addImage("data:image/jpeg;base64," + LOGO_B64, "JPEG", ML, 3, 26, 26);
  } catch(_) {}

  // Nombre laboratorio
  doc.setTextColor(...C_BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("LABORATORIO CLÍNICO", ML + 30, 11);
  doc.setFontSize(15);
  doc.setTextColor(...C_NARANJA);
  doc.text("CÁRDENAS GARÓFALO", ML + 30, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C_GRIS_CLR);
  doc.text("Maracaibo 1430 y García Moreno · Guayaquil, Ecuador", ML + 30, 23);
  doc.text("labclinicoardenasgarofalo@hotmail.com", ML + 30, 27.5);

  // Ticket (derecha)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C_BLANCO);
  doc.text(st(`N° ${orden.numero_ticket || orden.id_orden}`), PW - MR, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C_GRIS_CLR);
  doc.text(st(`Fecha orden: ${new Date(orden.fecha_orden).toLocaleDateString("es-EC")}`), PW - MR, 16, { align: "right" });
  doc.text(st(`Validado: ${new Date().toLocaleDateString("es-EC")}`), PW - MR, 21, { align: "right" });
  // Etiqueta RESULTADO OFICIAL
  doc.setFillColor(...C_NARANJA);
  doc.roundedRect(PW - MR - 36, 24, 36, 6, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C_BLANCO);
  doc.text("RESULTADO OFICIAL", PW - MR - 18, 28, { align: "center" });

  // ── DATOS DEL PACIENTE ──
  doc.setTextColor(0, 0, 0);
  let y = 37;

  // Encabezado de sección — mismo estilo que las categorías (oscuro + acento naranja)
  doc.setFillColor(...C_OSCURO);
  doc.roundedRect(ML, y, PW - ML - MR, 6, 1, 1, "F");
  doc.setFillColor(...C_NARANJA);
  doc.rect(ML, y, 3, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_BLANCO);
  doc.text("DATOS DEL PACIENTE", ML + 7, y + 4.2);
  y += 7;

  // Cuerpo del bloque
  doc.setFillColor(...C_FONDO);
  doc.roundedRect(ML, y, PW - ML - MR, 20, 1, 1, "F");
  doc.setDrawColor(...C_BORDE);
  doc.roundedRect(ML, y, PW - ML - MR, 20, 1, 1, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_OSCURO);
  doc.text(st(orden.paciente_nombre || "—"), ML + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C_GRIS);
  doc.text(st(`Cedula: ${orden.paciente_cedula || "—"}`), ML + 4, y + 13);
  doc.text(st(`Correo: ${orden.paciente_correo || "—"}`), ML + 4, y + 18);

  const colD = PW / 2 + 5;
  if (orden.edad_paciente != null) {
    doc.setTextColor(...C_GRIS);
    doc.text(st(`Edad: ${orden.edad_paciente} anos`), colD, y + 7);
  }
  doc.text(st(`Genero: ${orden.genero || "—"}`), colD, y + 13);
  // Badge Validado
  doc.setFillColor(209, 250, 229);
  doc.roundedRect(colD, y + 15, 22, 4, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(6, 95, 70);
 doc.text("VALIDADO", colD + 11, y + 18, { align: "center" });

  y += 25;

  // ── RESULTADOS AGRUPADOS POR CATEGORÍA ──
  const todosLosExamenes = resultados.flatMap(r => r.examenes || []);
  const porCategoria = {};
  for (const examen of todosLosExamenes) {
    const cat = examen.categoria || "Otros";
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(examen);
  }

  for (const [categoria, examenesCategoria] of Object.entries(porCategoria)) {
    if (y > PH - 65) { doc.addPage(); y = 20; }

    // Encabezado de categoría — barra oscura con acento naranja
    doc.setFillColor(...C_OSCURO);
    doc.roundedRect(ML, y, PW - ML - MR, 8, 1, 1, "F");
    doc.setFillColor(...C_NARANJA);
    doc.rect(ML, y, 3, 8, "F");
    doc.setTextColor(...C_BLANCO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(st(`  ${categoria.toUpperCase()}`), ML + 6, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    for (const examen of examenesCategoria) {
      if (y > PH - 60) { doc.addPage(); y = 20; }

      // Encabezado examen
      doc.setFillColor(...C_FONDO);
      doc.roundedRect(ML, y, PW - ML - MR, 7, 1, 1, "F");
      doc.setDrawColor(...C_BORDE);
      doc.roundedRect(ML, y, PW - ML - MR, 7, 1, 1, "S");
      doc.setFillColor(...C_NARANJA);
      doc.rect(ML, y, 2.5, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...C_OSCURO);
      doc.text(st(examen.nombre_examen?.toUpperCase() || "EXAMEN"), ML + 6, y + 5);
      y += 9;

      const params = examen.parametros || [];
      if (params.length === 0) {
        // Examen tipo PDF — el archivo se adjunta al final; mostrar nota informativa
        doc.setFillColor(...C_FONDO);
        doc.roundedRect(ML, y, PW - ML - MR, 10, 2, 2, "F");
        doc.setDrawColor(...C_BORDE);
        doc.roundedRect(ML, y, PW - ML - MR, 10, 2, 2, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C_GRIS);
       doc.text(st("El resultado de este examen se adjunta en las páginas siguientes del documento."), ML + 5, y + 9);
        doc.setTextColor(0, 0, 0);
        y += 14;
        continue;
      }

     // Tabla de parámetros
      const tableData = params.map(p => {
        const fuera = estaFueraDeRango(p);
        const { tipo } = parseTipoDato(p.valor_referencia);
        const valorNum = parseFloat(p.valor_obtenido);
        // Datos numéricos crudos preservados (no el string ya formateado) para
        // poder dibujar la barra de posición sin tener que re-parsear texto.
        const tieneRangoNumerico =
          tipo === "NUMERICO" &&
          p.rango_min != null && p.rango_max != null &&
          !isNaN(valorNum);
        return {
          // Aplicamos st() a todas las cadenas de texto
          parametro: st(p.nombre_parametro || "—"),
          valor:     st(p.valor_obtenido  || "—"),
          unidad:    st(p.unidad          || "—"),
          rango:     st(descripcionReferencia(p)),
          fuera,
          obs:       st(p.observacion || ""),
          tieneRangoNumerico,
          valorNum,
          rangoMin: p.rango_min != null ? parseFloat(p.rango_min) : null,
          rangoMax: p.rango_max != null ? parseFloat(p.rango_max) : null,
        };
      });

      const tableResult = autoTable(doc, {
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Parámetro", "Resultado", "Unidad", "Rango Ref.", "Posición"]],
        body: tableData.map(r => [r.parametro, r.valor, r.unidad, r.rango, ""]),
        styles: { fontSize: 7.5, cellPadding: 2.5, font: "helvetica", textColor: [31, 41, 55] },
        headStyles: { fillColor: [100, 105, 115], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [253, 253, 253] },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 25, fontStyle: "bold" },
          2: { cellWidth: 20 },
          3: { cellWidth: 45 },
          4: { cellWidth: 35 },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const row = tableData[data.row.index];
            if (row?.fuera) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const row = tableData[data.row.index];
            if (row?.fuera) {
              const flecha = row.tieneRangoNumerico
                ? (row.valorNum > row.rangoMax ? "↑" : "↓")
                : "↑";
              doc.setFontSize(8);
              doc.setTextColor(220, 38, 38);
              doc.text(flecha, data.cell.x + data.cell.width - 4, data.cell.y + data.cell.height - 1.5);
              doc.setTextColor(0, 0, 0);
            }
          }

          // Columna "Posición": barra de zonas (rojo→ámbar→verde→ámbar→rojo)
          // simulando un degradado continuo, con marcador del valor real.
          // Solo se dibuja para parámetros numéricos con rango definido; el
          // resto queda vacío (texto/opciones/sin rango).
          if (data.section === "body" && data.column.index === 4) {
            const row = tableData[data.row.index];
            if (!row?.tieneRangoNumerico) return;

            const { x, y: cy, width, height } = data.cell;
            const barX = x + 3;
            const barW = width - 6;
            const barY = cy + height / 2;
            const barH = 1.8;

            // Barra de zonas: se dibuja en segmentos finos interpolando color
            // para simular el degradado (jsPDF no soporta gradientes en rects).
            const SEGMENTOS = 24;
            const segW = barW / SEGMENTOS;
            for (let i = 0; i < SEGMENTOS; i++) {
              const t = (i + 0.5) / SEGMENTOS;
              doc.setFillColor(...colorZona(t));
              doc.rect(barX + i * segW, barY - barH / 2, segW + 0.3, barH, "F");
            }

            // Posición del marcador, acotada visualmente a los bordes de la
            // barra aunque el valor real se salga del rango (clamp 0-1).
            const { rangoMin, rangoMax, valorNum, fuera } = row;
            const span = rangoMax - rangoMin;
            let frac = span > 0 ? (valorNum - rangoMin) / span : 0.5;
            frac = Math.max(0, Math.min(1, frac));
            const markerX = barX + frac * barW;

            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.5);
            if (fuera) {
              doc.setFillColor(220, 38, 38);       // rojo: fuera de rango
            } else {
              doc.setFillColor(30, 58, 95);         // navy: dentro de rango
            }
            doc.circle(markerX, barY, 1.5, "FD");   // "FD" = relleno + borde blanco (resalta sobre el fondo de color)
          }
        },
      });

      y = (tableResult?.finalY ?? doc.lastAutoTable?.finalY ?? y + 20) + 4;

      // Observaciones si hay
      /*
      const conObs = tableData.filter(r => r.obs);
      if (conObs.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        conObs.forEach(r => {
          const textLine = `Obs. ${r.parametro}: ${r.obs}`;
          // TRUCO: Dividir el texto largo en varias líneas respetando los márgenes
          const splitText = doc.splitTextToSize(textLine, PW - ML - MR - 6);
          
          doc.text(splitText, ML + 3, y);
          
          // Ajustar la posición Y dinámicamente según la cantidad de líneas generadas
          y += (splitText.length * 3.5); 
        });
        doc.setTextColor(0, 0, 0);
      }
      y += 3;
      */
    }
    y += 5;
  }

  // ── FIRMA DEL ADMINISTRADOR ──
  // Espacio real que ocupa el bloque de firma, calculado según el contenido
  // que realmente se va a dibujar (no un valor fijo "por las dudas"):
  //   6mm  → línea separadora + respiro antes del bloque
  //   19mm → imagen de firma digital (solo si admin.firma existe)
  //   4mm  → línea de firma + respiro antes del nombre
  //   4mm  → nombre del administrador
  //   5mm  → línea extra si se muestra el cargo (mismo criterio que más abajo, línea 477)
  //   10mm → "FIRMADO DIGITALMENTE" + fecha de validación
  //   6mm  → margen de seguridad (descenders de fuente / respiro final)
  const tieneCargoVisible = !!(admin.cargo && admin.cargo !== "Responsable Técnico");
  const ESPACIO_FIRMA =
    6 +
    (admin.firma ? 19 : 0) +
    4 +
    4 +
    (tieneCargoVisible ? 5 : 0) +
    10 +
    6;

  if (y > PH - ESPACIO_FIRMA) {
    // No cabe en lo que queda de esta página: pasar a una nueva y arrancar
    // arriba (no forzar al fondo, para no dejar una hoja casi vacía).
    doc.addPage();
    y = 25;
  } else {
    // Sí cabe: dejar un respiro natural después del último bloque, sin
    // empujarla artificialmente hasta el fondo de la página.
    y += 12;
  }

  // Línea separadora
  doc.setDrawColor(226, 232, 240);
  doc.line(ML, y, PW - MR, y);
  y += 6;

  // Bloque firma
  const firmaX = PW / 2 - 35;

  // Imagen de firma digital si existe
  if (admin.firma) {
    try {
      const _apiBase = (import.meta.env?.VITE_API_URL || "").replace(/\/api\/?$/, "")
                    || window.location.origin.replace(/:\d+$/, ":4000");

      // Normalizar URL: puede llegar como URL completa, ruta relativa con / o solo nombre de archivo
      let firmaUrl;
      if (admin.firma.startsWith("http")) {
        firmaUrl = admin.firma;                                    // https://supabase.co/storage/...
      } else if (admin.firma.startsWith("/storage/")) {
        firmaUrl = `${_apiBase}${admin.firma}`;                   // /storage/firmas/archivo.png
      } else {
        firmaUrl = `${_apiBase}/storage/firmas/${admin.firma}`;   // solo "archivo.png"
      }

      console.log("🖊️ Cargando firma desde:", firmaUrl);

      const firmaResp = await fetch(firmaUrl);
      if (!firmaResp.ok) throw new Error(`HTTP ${firmaResp.status} al cargar firma: ${firmaUrl}`);

      const firmaBlob = await firmaResp.blob();
      const firmaDataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error("FileReader falló al leer la firma"));
        r.readAsDataURL(firmaBlob);
      });

      // Detectar formato real por el data URL
      const fmt = firmaDataUrl.includes("image/jpeg") || firmaDataUrl.includes("image/jpg")
        ? "JPEG" : "PNG";

      doc.addImage(firmaDataUrl, fmt, firmaX, y, 70, 18, undefined, "FAST");
      y += 19;
      console.log("✅ Firma añadida al PDF correctamente");
    } catch (err) {
      console.error("❌ No se pudo cargar la firma:", err.message);
      // Continúa sin imagen — igual dibuja la línea y el nombre
    }
  } else {
    console.warn("⚠️ admin.firma está vacío o null. Valor recibido:", admin);
  }

  doc.setDrawColor(31, 41, 55);
  doc.line(firmaX, y, firmaX + 70, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text(admin.nombre || "Administrador", firmaX + 35, y + 4, { align: "center" });

  // Solo mostrar cargo si existe y no es genérico
  let firmaLineY = y + 4;
  if (tieneCargoVisible) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(admin.cargo, firmaX + 35, y + 9, { align: "center" });
    firmaLineY = y + 9;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_NARANJA);
  doc.text(st("FIRMADO DIGITALMENTE"), firmaX + 35, firmaLineY + 5, { align: "center" });

  doc.setTextColor(156, 163, 175);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`Fecha de validación: ${new Date().toLocaleDateString("es-EC")}`, firmaX + 35, firmaLineY + 10, { align: "center" });

  // ── PIE DE PÁGINA ──
  const totalPags = doc.getNumberOfPages();
  for (let i = 1; i <= totalPags; i++) {
    doc.setPage(i);
    // Franja naranja pie
    doc.setFillColor(...C_OSCURO);
    doc.rect(0, PH - 10, PW, 10, "F");
    doc.setFillColor(...C_NARANJA);
    doc.rect(0, PH - 10, 3, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...C_GRIS_CLR);
    doc.text("Laboratorio Clínico Cárdenas Garófalo — Documento validado electrónicamente.", ML + 4, PH - 4);
    doc.text(`Pág. ${i} / ${totalPags}`, PW - MR, PH - 4, { align: "right" });
  }

  return doc;
}

/* ══════════════════════════════════════════════════════════
   HELPER: convierte rutas relativas del backend a URL completa
   Evita que el navegador interprete /storage/pdf/... como ruta
   del frontend y redirija al login.
══════════════════════════════════════════════════════════ */
const toBackendUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = (import.meta.env?.VITE_API_URL || "").replace(/\/api\/?$/, "")
               || window.location.origin.replace(/:\d+$/, ":4000");
  return `${base}${path}`;
};

/* ══════════════════════════════════════════════════════════
   API CALLS
══════════════════════════════════════════════════════════ */
const api = {
  getOrdenes: (estado) => {
    const q = estado && estado !== "todos" ? `?estado=${estado}` : "";
    return API.get(`/resultados/admin/ordenes${q}`).then(r => r.data);
  },
  getDetalleOrden: (id_orden) =>
    API.get(`/resultados/admin/orden/${id_orden}`).then(r => r.data),
  devolver: (id_resultado, motivo) =>
    API.put(`/resultados/devolver/${id_resultado}`, { motivo }).then(r => r.data),
  publicar: (id_resultado, pdf_url, firma) =>
    API.put(`/resultados/publicar/${id_resultado}`, { pdf_url, firma }).then(r => r.data),
};

/* ══════════════════════════════════════════════════════════
   BADGE ESTADO
══════════════════════════════════════════════════════════ */
function Badge({ estado }) {
  const map = {
    "Validado":    { bg: "#D1FAE5", color: "#065F46" },
    "Por Validar": { bg: "#FEF3C7", color: "#92400E" },
    "En Proceso":  { bg: "#DBEAFE", color: "#1E40AF" },
    "Devuelto":    { bg: "#FEE2E2", color: "#991B1B" },
    "Generada":    { bg: "#F3F4F6", color: "#6B7280" },
  };
  const s = map[estado] || { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span style={{ ...badgeSt, background: s.bg, color: s.color }}>
      {estado}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   INDICADOR VALOR FUERA/DENTRO DE RANGO
══════════════════════════════════════════════════════════ */
function ValorCell({ parametro }) {
  const valor = parametro.valor_obtenido;
  if (valor == null || valor === "") return <span style={{ color: "#9CA3AF" }}>—</span>;
  const outRange = estaFueraDeRango(parametro);
  const num = parseFloat(valor);
  const flecha = outRange ? (num > parametro.rango_max ? " ↑" : " ↓") : "";
  return (
    <span style={{ fontWeight: outRange ? 700 : 400, color: outRange ? "#EF4444" : "#374151" }}>
      {valor}<span style={{ fontSize: "0.85em" }}>{flecha}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL DEVOLUCIÓN
══════════════════════════════════════════════════════════ */
function ModalDevolver({ resultado, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Overlay onClose={onClose}>
      <div style={modalInner}>
        <ModalHead title="⚠️ Devolver al Especialista" onClose={onClose} />
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <p style={infoTxt}>
            Resultado ID: <strong>{resultado.id_resultado}</strong> — Orden: <strong>{resultado.numero_ticket || resultado.id_orden}</strong>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label style={flabel}>Motivo de devolución *</label>
            <textarea rows={4} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Describe el problema o corrección necesaria…"
              style={{ ...finput, resize: "vertical" }} />
          </div>
          <div style={footerRow}>
            <button onClick={onClose} style={btnSec}>Cancelar</button>
            <button onClick={() => { if (!motivo.trim()) return alert("Ingresa un motivo"); onConfirm(motivo); }}
              style={{ ...btnBase, background: "#EF4444", color: "#FFF" }}>
              Devolver
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL DEVOLUCIÓN POR EXAMEN (individual)
══════════════════════════════════════════════════════════ */
function ModalDevolverExamen({ examen, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Overlay onClose={onClose}>
      <div style={{ ...modalInner, zIndex: 400 }}>
        <ModalHead title={`↩ Devolver examen: ${examen.nombre_examen}`} onClose={onClose} />
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <p style={infoTxt}>
            Indica el motivo de corrección para este examen. El especialista deberá corregirlo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label style={flabel}>Motivo de devolución *</label>
            <textarea rows={4} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Describe el error o corrección necesaria para este examen…"
              style={{ ...finput, resize: "vertical" }} />
          </div>
          <div style={footerRow}>
            <button onClick={onClose} style={btnSec}>Cancelar</button>
            <button
              onClick={() => { if (!motivo.trim()) return alert("Ingresa un motivo"); onConfirm(motivo); }}
              style={{ ...btnBase, background: "#EF4444", color: "#FFF" }}>
              ↩ Devolver este examen
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL VALIDAR / PUBLICAR — revisión examen por examen
══════════════════════════════════════════════════════════ */
function ModalPublicar({ orden, onConfirm, onClose }) {
  const user  = JSON.parse(localStorage.getItem("user") || "{}");
  const rolActivo = user.rol || (Array.isArray(user.roles) ? user.roles[0] : null) || "Responsable Técnico";
  // Preferir datos del backend (orden.admin_*) sobre localStorage
  const admin = {
  nombre: orden?.admin_nombre || `${user.nombres || ""} ${user.apellidos || ""}`.trim() || "Administrador",
  cargo:  orden?.admin_cargo  || user.cargo || rolActivo,
  // Prioridad: URL firmada del backend → fallback a nada (nunca el path raw)
firma:  orden?.admin_firma_url || orden?.admin_firma || user.firma_digital || null,
};

  const resultados = orden?.resultados || [];

  // Construir lista plana de exámenes con su contexto
  const todosExamenes = resultados.flatMap((r, ri) =>
    (r.examenes || []).map((ex, ei) => ({
      key:               `${ri}-${ei}`,
      id_resultado:      r.id_resultado,
      especialista:      r.especialista_nombre || "Sin especialista",
      especialidad:      r.especialidad || "",
      estado_resultado:  r.estado_resultado,
      ...ex,
    }))
  );

  // Estado de decisión por examen: null | "validado" | "devuelto"
  const [decisiones,      setDecisiones]      = useState({});
  const [motivosDevuelto, setMotivosDevuelto] = useState({});
  const [examenDevolver,  setExamenDevolver]  = useState(null); // examen al que se abre modal motivo
  const [saving,          setSaving]          = useState(false);
  const [pdfGenerado,     setPdfGenerado]     = useState(false);
  const [pdfDoc,          setPdfDoc]          = useState(null);
  const [expandidos,      setExpandidos]      = useState({});   // colapsar/expandir parámetros
  const [pdfPreview,      setPdfPreview]      = useState(null); // { url, nombre } para visor lateral

  const marcarValidado = (key) =>
    setDecisiones(prev => ({ ...prev, [key]: "validado" }));

  const iniciarDevolver = (ex) =>
    setExamenDevolver(ex);

  const confirmarDevolver = (motivo) => {
    setDecisiones(prev => ({ ...prev, [examenDevolver.key]: "devuelto" }));
    setMotivosDevuelto(prev => ({ ...prev, [examenDevolver.key]: motivo }));
    setExamenDevolver(null);
  };

  const toggleExpandir = (key) =>
    setExpandidos(prev => ({ ...prev, [key]: !prev[key] }));

  // Resumen
  const totalExamenes   = todosExamenes.length;
  const totalValidados  = Object.values(decisiones).filter(d => d === "validado").length;
  const totalDevueltos  = Object.values(decisiones).filter(d => d === "devuelto").length;
  const totalRevisados  = totalValidados + totalDevueltos;
  const todoRevisado    = totalRevisados === totalExamenes && totalExamenes > 0;
  const algunoDevuelto  = totalDevueltos > 0;
  const todosValidados  = totalValidados === totalExamenes && totalExamenes > 0;

  const hayFueraRango = todosExamenes.some(ex =>
    (ex.parametros || []).some(estaFueraDeRango)
  );

  const handlePreviewPDF = async () => {
    const doc = await generarPDFResultado(orden, resultados, admin);
    setPdfDoc(doc);
    setPdfGenerado(true);
    // Mostrar inline en visor, sin forzar descarga
    const blob    = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    setPdfPreview({ url: blobUrl, nombre: `Resultado_${orden.numero_ticket || orden.id_orden}` });
  };

  const handleConfirmar = async () => {
    if (!todoRevisado) return;
    setSaving(true);
    try {
      let docFinal = pdfDoc;

      // Solo generar PDF si hay exámenes validados
      if (todosValidados || (!algunoDevuelto && totalValidados > 0)) {
        if (!docFinal) {
          docFinal = await generarPDFResultado(orden, resultados, admin);
        }

        // Recolectar URLs de PDFs adjuntos de exámenes validados tipo PDF
        const examenesValidados = todosExamenes.filter(ex => decisiones[ex.key] === "validado");
        const pdfUrlsAdjuntos   = examenesValidados
          .filter(ex => !!ex.archivo_pdf && (ex.parametros || []).length === 0)
          .map(ex => toBackendUrl(ex.archivo_pdf));

        let pdfBlob;
        const fileName = `resultado_${orden.id_orden}_${Date.now()}.pdf`;

        if (pdfUrlsAdjuntos.length > 0) {
          // Fusionar el PDF generado con los PDFs adjuntos
          const mergedBytes = await fusionarPDFs(docFinal, pdfUrlsAdjuntos);
          if (mergedBytes instanceof Uint8Array) {
            pdfBlob = new Blob([mergedBytes], { type: "application/pdf" });
            // Solo subir al backend, sin forzar descarga local
          } else {
            // fallback: el merge falló, usar doc original
            pdfBlob = docFinal.output("blob");
          }
        } else {
          pdfBlob = docFinal.output("blob");
          // Solo subir al backend, sin forzar descarga local
        }

        const formData = new FormData();
        formData.append("pdf_orden", pdfBlob, fileName);
        formData.append("id_orden",  orden.id_orden);

        let pdfUrl = null;
        try {
          const { data } = await API.post("/resultados/subir-pdf-orden", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          pdfUrl = data.pdf_url;
        } catch {
          console.warn("No se pudo subir el PDF al servidor, pero se descargó localmente.");
        }

        // Validar resultados aprobados
        const idsResultadosValidar = [...new Set(examenesValidados.map(ex => ex.id_resultado))];
        for (const id of idsResultadosValidar) {
          await api.publicar(id, pdfUrl, admin.nombre);
        }
      }

      // Devolver resultados marcados como devueltos
      const examenesDevueltos = todosExamenes.filter(ex => decisiones[ex.key] === "devuelto");
      const idsDevolver = [...new Set(examenesDevueltos.map(ex => ex.id_resultado))];
      for (const id of idsDevolver) {
        const motivoEx = examenesDevueltos.find(ex => ex.id_resultado === id);
        const motivo = motivosDevuelto[motivoEx?.key] || "Corrección requerida";
        await api.devolver(id, motivo);
      }

      const soloDevueltos = totalValidados === 0 && idsDevolver.length > 0;
      const mixto = totalValidados > 0 && idsDevolver.length > 0;
      onConfirm({ soloDevueltos, mixto });
    } catch (e) {
      alert("Error al procesar: " + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  // Agrupar exámenes por especialista para mostrar
  const porEspecialista = resultados.map((r, ri) => ({
    ri,
    especialista: r.especialista_nombre || "Sin especialista",
    especialidad: r.especialidad || "",
    estado_resultado: r.estado_resultado,
    examenes: (r.examenes || []).map((ex, ei) => ({
      ...ex,
      key: `${ri}-${ei}`,
      id_resultado: r.id_resultado,
    })),
  }));

  return (
    <Overlay onClose={!saving ? onClose : undefined}>
      {/* Modal de motivo devolución (sub-modal) */}
      {examenDevolver && (
        <ModalDevolverExamen
          examen={examenDevolver}
          onConfirm={confirmarDevolver}
          onClose={() => setExamenDevolver(null)}
        />
      )}

      <div style={{ ...modalInner, width: pdfPreview ? "min(1100px, 96vw)" : "760px", maxHeight: "none", height: "auto", display: "flex", flexDirection: "column", transition: "width 0.3s ease", overflow: "visible", margin: "auto" }}>
        <ModalHead title="📋 Revisión de Resultados — Examen por Examen" onClose={!saving ? onClose : undefined} />

        {/* Barra de progreso sticky */}
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #F1F5F9", background: "#FAFBFC", display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>
                PROGRESO DE REVISIÓN
              </span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: todoRevisado ? "#10B981" : "#8B5CF6" }}>
                {totalRevisados} / {totalExamenes} revisados
              </span>
            </div>
            <div style={{ height: "6px", background: "#E5E7EB", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                borderRadius: "99px",
                width: `${totalExamenes > 0 ? (totalRevisados / totalExamenes) * 100 : 0}%`,
                background: algunoDevuelto ? "linear-gradient(90deg, #10B981, #EF4444)" : "#10B981",
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
          {/* Contadores */}
          <div style={{ display: "flex", gap: "0.6rem", flexShrink: 0 }}>
            {totalValidados > 0 && (
              <span style={{ background: "#D1FAE5", color: "#065F46", padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 700 }}>
                ✅ {totalValidados} validado{totalValidados !== 1 ? "s" : ""}
              </span>
            )}
            {totalDevueltos > 0 && (
              <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 700 }}>
                ↩ {totalDevueltos} devuelto{totalDevueltos !== 1 ? "s" : ""}
              </span>
            )}
            {totalRevisados === 0 && (
              <span style={{ background: "#F3F4F6", color: "#9CA3AF", padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
                Sin revisar aún
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: "1.1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>

          {/* Info orden */}
          <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem 1rem", border: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#1F2937", fontSize: "1rem" }}>
                #{orden?.numero_ticket || orden?.id_orden} — {orden?.paciente_nombre}
              </p>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#9CA3AF" }}>
                Cédula: {orden?.paciente_cedula || "—"} · Fecha: {orden?.fecha_orden ? new Date(orden.fecha_orden).toLocaleDateString("es-EC") : "—"}
              </p>
            </div>
            <Badge estado={todosValidados ? "Validado" : (orden?.estado || "Por Validar")} />
          </div>

          {/* Alerta fuera de rango */}
          {hayFueraRango && (
            <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "8px", padding: "0.65rem 1rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span>⚠️</span>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#92400E", fontFamily: "'Barlow', sans-serif" }}>
                Hay valores <strong>fuera del rango de referencia</strong>. Revisa cada examen con cuidado antes de validar.
              </p>
            </div>
          )}

          {/* ── ESPECIALISTAS Y EXÁMENES ── */}
          {porEspecialista.map(({ ri, especialista, especialidad, examenes }) => (
            <div key={ri} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
              {/* Header especialista */}
              <div style={{ background: "rgba(139,92,246,0.06)", padding: "0.6rem 1rem", borderBottom: "1px solid #EDE9FE", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1rem" }}>🔬</span>
                <div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#1F2937", textTransform: "uppercase" }}>
                    {especialista}
                  </span>
                  {especialidad && (
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#8B5CF6", marginLeft: "0.5rem" }}>
                      {especialidad}
                    </span>
                  )}
                </div>
              </div>

              {/* Exámenes */}
              {examenes.map((ex) => {
                const decision    = decisiones[ex.key];
                const esTipoPDF   = ex.tipo_resultado === 'PDF';
                const tieneParams = (ex.parametros || []).length > 0;
                const tienePDF    = !!ex.archivo_pdf;
                const expandido   = expandidos[ex.key] !== false; // por defecto expandido

                const fueraRango  = (ex.parametros || []).some(estaFueraDeRango);

                // Color de borde según decisión
                const borderColor = decision === "validado" ? "#10B981"
                                  : decision === "devuelto" ? "#EF4444"
                                  : "#F1F5F9";
                const bgColor     = decision === "validado" ? "#F0FDF4"
                                  : decision === "devuelto" ? "#FEF2F2"
                                  : "#FFFFFF";

                return (
                  <div key={ex.key} style={{ borderBottom: "1px solid #F1F5F9", background: bgColor, transition: "background 0.3s", borderLeft: `3px solid ${borderColor}` }}>
                    {/* Cabecera del examen */}
                    <div style={{ padding: "0.65rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
                        {/* Toggle expandir */}
                        {(tieneParams || tienePDF || esTipoPDF) && (
                          <button
                            onClick={() => toggleExpandir(ex.key)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "0.75rem", padding: "0.1rem 0.3rem", flexShrink: 0 }}>
                            {expandido ? "▼" : "▶"}
                          </button>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#1F2937", margin: 0, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ex.nombre_examen || "Examen"}
                          </p>
                          <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: 0 }}>
                            {esTipoPDF
                              ? (tienePDF ? "📄 PDF adjunto" : "⏳ Esperando PDF del especialista")
                              : `${(ex.parametros || []).length} parámetro(s)`}
                            {fueraRango && <span style={{ color: "#EF4444", marginLeft: "0.35rem" }}>⚠ valores fuera de rango</span>}
                          </p>
                        </div>
                      </div>

                      {/* Acciones por examen */}
                      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, alignItems: "center" }}>
                        {decision === "validado" && (
                          <span style={{ background: "#D1FAE5", color: "#065F46", padding: "0.25rem 0.7rem", borderRadius: "99px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            ✅ Validado
                          </span>
                        )}
                        {decision === "devuelto" && (
                          <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.25rem 0.7rem", borderRadius: "99px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            ↩ Devuelto
                          </span>
                        )}
                        {/* Siempre mostrar botones para poder cambiar decisión */}
                        {decision !== "validado" && (
                          <button
                            onClick={() => marcarValidado(ex.key)}
                            style={{ ...btnSmall, background: "#10B981", color: "#FFF", border: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            ✅ Validar
                          </button>
                        )}
                        {decision !== "devuelto" && (
                          <button
                            onClick={() => iniciarDevolver(ex)}
                            style={{ ...btnSmall, background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            ↩ Devolver
                          </button>
                        )}
                        {/* Botón deshacer */}
                        {decision && (
                          <button
                            onClick={() => setDecisiones(prev => { const n = {...prev}; delete n[ex.key]; return n; })}
                            title="Deshacer decisión"
                            style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: "6px", cursor: "pointer", color: "#9CA3AF", fontSize: "0.72rem", padding: "0.25rem 0.45rem" }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Motivo devolución visible */}
                    {decision === "devuelto" && motivosDevuelto[ex.key] && (
                      <div style={{ margin: "0 1rem 0.5rem 2.5rem", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: "6px", padding: "0.4rem 0.65rem" }}>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "#BE123C", fontFamily: "'Barlow', sans-serif" }}>
                          <strong>Motivo:</strong> {motivosDevuelto[ex.key]}
                        </p>
                      </div>
                    )}

                    {/* Contenido del examen (colapsable) */}
                    {expandido && (
                      <div style={{ padding: "0 1rem 0.75rem 2.5rem" }}>

                        {/* ── EXAMEN TIPO PDF ── */}
                        {esTipoPDF ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {tienePDF ? (
                              /* PDF ya subido por el especialista */
                              <>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "#EFF6FF", borderRadius: "6px", border: "1px solid #BFDBFE" }}>
                                  <span>📄</span>
                                  <span style={{ fontSize: "0.78rem", color: "#1E40AF", fontFamily: "'Barlow', sans-serif", fontWeight: 600, flex: 1 }}>
                                    PDF adjunto por el especialista
                                  </span>
                                  <button
                                    onClick={() => setPdfPreview(prev =>
                                      prev?.url === toBackendUrl(ex.archivo_pdf) ? null : { url: toBackendUrl(ex.archivo_pdf), nombre: ex.nombre_examen }
                                    )}
                                    style={{ ...btnSmall, background: pdfPreview?.url === toBackendUrl(ex.archivo_pdf) ? "#DBEAFE" : "#2563EB", color: pdfPreview?.url === toBackendUrl(ex.archivo_pdf) ? "#1E40AF" : "#FFF", border: "none", fontSize: "0.72rem" }}>
                                    {pdfPreview?.url === toBackendUrl(ex.archivo_pdf) ? "▼ Cerrar vista previa" : "👁 Ver PDF"}
                                  </button>
                                  <a href={toBackendUrl(ex.archivo_pdf)} target="_blank" rel="noreferrer"
                                    style={{ ...btnSmall, background: "none", color: "#2563EB", border: "1px solid #BFDBFE", textDecoration: "none", fontSize: "0.72rem" }}>
                                    ↗ Abrir
                                  </a>
                                </div>
                                {/* Visor inline del PDF */}
                                {pdfPreview?.url === toBackendUrl(ex.archivo_pdf) && (
                                  <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #BFDBFE", background: "#F0F9FF" }}>
                                    <div style={{ padding: "0.4rem 0.75rem", background: "#DBEAFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 600, color: "#1E40AF" }}>
                                        📄 {pdfPreview.nombre}
                                      </span>
                                      <button onClick={() => setPdfPreview(null)}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#3B82F6", fontSize: "0.8rem" }}>✕</button>
                                    </div>
                                    <iframe
                                      src={toBackendUrl(ex.archivo_pdf)}
                                      title={ex.nombre_examen}
                                      style={{ width: "100%", height: "420px", border: "none", display: "block" }}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              /* PDF aún no subido */
                              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.85rem", background: "#FFFBEB", borderRadius: "6px", border: "1px solid #FDE68A" }}>
                                <span>⏳</span>
                                <p style={{ margin: 0, fontSize: "0.78rem", color: "#92400E", fontFamily: "'Barlow', sans-serif" }}>
                                  El especialista aún no ha subido el PDF de este examen.
                                </p>
                              </div>
                            )}
                          </div>

                        ) : (
                          /* ── EXAMEN TIPO PARÁMETROS ── */
                          tieneParams ? (
                            <div style={{ overflowX: "auto", borderRadius: "6px", border: "1px solid #F1F5F9" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.77rem" }}>
                                <thead>
                                  <tr style={{ background: "#F8FAFC" }}>
                                    {["Parámetro", "Resultado", "Rango Ref.", "Unidad"].map(c => (
                                      <th key={c} style={{ ...th, padding: "0.5rem 0.75rem" }}>{c}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(ex.parametros || []).map((p, pi) => {
                                    const fuera = estaFueraDeRango(p);
                                    return (
                                      <tr key={pi} style={{ borderBottom: "1px solid #F8FAFC", background: fuera ? "#FFF8F8" : "transparent" }}>
                                        <td style={{ ...td, padding: "0.45rem 0.75rem", fontWeight: fuera ? 600 : 400 }}>{p.nombre_parametro}</td>
                                        <td style={{ ...td, padding: "0.45rem 0.75rem" }}>
                                          <ValorCell parametro={p} />
                                        </td>
                                        <td style={{ ...td, padding: "0.45rem 0.75rem", color: "#9CA3AF", fontSize: "0.73rem" }}>
                                          {descripcionReferencia(p)}
                                        </td>
                                        <td style={{ ...td, padding: "0.45rem 0.75rem", color: "#9CA3AF" }}>{p.unidad || "—"}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            /* Parámetros aún no ingresados */
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.85rem", background: "#FFFBEB", borderRadius: "6px", border: "1px solid #FDE68A" }}>
                              <span>⏳</span>
                              <p style={{ margin: 0, fontSize: "0.78rem", color: "#92400E", fontFamily: "'Barlow', sans-serif" }}>
                                El especialista aún no ha ingresado los valores de los parámetros.
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* ── RESUMEN FINAL ── */}
          {todoRevisado && (
            <div style={{
              borderRadius: "10px",
              padding: "0.9rem 1rem",
              border: algunoDevuelto && !todosValidados
                ? "1px solid #FBBF24"
                : "1px solid #86EFAC",
              background: algunoDevuelto && !todosValidados
                ? "#FFFBEB"
                : "#F0FDF4",
              display: "flex", flexDirection: "column", gap: "0.4rem"
            }}>
              <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: algunoDevuelto && !todosValidados ? "#92400E" : "#166534" }}>
                {todosValidados
                  ? "✅ Todos los exámenes validados — listo para publicar"
                  : algunoDevuelto && totalValidados === 0
                  ? "↩ Todos los exámenes serán devueltos al especialista"
                  : `⚠️ ${totalValidados} validado(s) · ${totalDevueltos} devuelto(s)`}
              </p>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#6B7280", fontFamily: "'Barlow', sans-serif" }}>
                {todosValidados
                  ? "Se generará el PDF con firma electrónica y se notificará al paciente."
                  : totalValidados > 0
                  ? "Los exámenes validados se publicarán. Los devueltos volverán al especialista para corrección."
                  : "No se generará PDF. Los exámenes volverán al especialista para corrección."}
              </p>
            </div>
          )}

        </div>{/* fin área scrolleable */}

        {/* ── FOOTER FIJO ── fuera del scroll para que siempre sea visible */}
        <div style={{ borderTop: "1px solid #F1F5F9", background: "#FFF", flexShrink: 0, padding: "0.85rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>

          {/* Firma del admin */}
          <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "8px", padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.1rem" }}>✍️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#166534", fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>{admin.nombre}</p>
              <p style={{ margin: 0, fontSize: "0.71rem", color: "#4ADE80" }}>{admin.cargo} · Firmado electrónicamente</p>
            </div>
            {/* Botón preview PDF integrado en la fila de firma */}
            {totalValidados > 0 && (
              <button onClick={handlePreviewPDF}
                style={{ ...btnSmall, background: "rgba(139,92,246,0.08)", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                📄 Visualizar PDF
              </button>
            )}
          </div>

          {/* Botones de acción */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button onClick={onClose} disabled={saving} style={btnSec}>Cancelar</button>
            <button
              onClick={handleConfirmar}
              disabled={!todoRevisado || saving}
              title={!todoRevisado ? `Faltan ${totalExamenes - totalRevisados} examen(es) por revisar` : ""}
              style={{
                ...btnBase,
                background: !todoRevisado ? "#E5E7EB"
                            : saving ? "#E5E7EB"
                            : algunoDevuelto && !todosValidados ? "#F59E0B"
                            : "#10B981",
                color: !todoRevisado || saving ? "#9CA3AF" : "#FFF",
                cursor: !todoRevisado || saving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "0.4rem",
              }}>
              {saving ? "⏳ Procesando…"
               : !todoRevisado ? `⏳ Revisar ${totalExamenes - totalRevisados} examen(es) más`
               : todosValidados ? "✅ Confirmar Validación y Generar PDF"
               : totalValidados === 0 ? "↩ Confirmar Devolución"
               : "⚠️ Confirmar (validar + devolver)"}
            </button>
          </div>
        </div>

      </div>

      {/* ── VISOR PDF GENERADO (blob) — se abre sobre el modal, misma pantalla ── */}
      {pdfPreview && pdfPreview.url?.startsWith("blob:") && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 500,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "1.5rem",
        }}>
          <div style={{
            background: "#1F2937", borderRadius: "12px",
            width: "100%", maxWidth: "820px",
            height: "88vh",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
          }}>
            {/* Barra superior del visor */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "0.65rem 1rem", background: "#374151", gap: "0.75rem",
            }}>
              <span style={{
                color: "#F9FAFB", fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.04em",
              }}>
                📄 {pdfPreview.nombre}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => setPdfPreview(null)}
                  style={{
                    padding: "0.3rem 0.85rem", background: "#EF4444", color: "#FFF",
                    border: "none", borderRadius: "6px", fontSize: "0.75rem",
                    fontFamily: "'Barlow', sans-serif", fontWeight: 600, cursor: "pointer",
                  }}>
                  ✕ Cerrar
                </button>
              </div>
            </div>
            {/* iframe del PDF */}
            <iframe
              src={pdfPreview.url}
              title="Vista previa del resultado"
              style={{ flex: 1, border: "none", width: "100%", display: "block" }}
            />
          </div>
        </div>
      )}

    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function AdminResultados() {
  const [todasOrdenes, setTodasOrdenes] = useState([]);   // siempre el universo completo
  const [loading,      setLoading]      = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [buscar,       setBuscar]       = useState("");
  const [desde,        setDesde]        = useState("");   // filtro de fecha — vacío = sin límite inferior
  const [hasta,        setHasta]        = useState("");   // filtro de fecha — vacío = sin límite superior
  const [pagina,        setPagina]      = useState(1);
  const PAGE_SIZE = 10;
  const [modal,        setModal]        = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [ordenDetalle, setOrdenDetalle] = useState(null);
  const [msg,          setMsg]          = useState(null);

  // Cargamos SIEMPRE todas las órdenes (sin filtro de estado en el backend)
  // y filtramos en frontend para que los contadores de los pills sean siempre correctos.
  const cargar = async () => {
    setLoading(true);
    try {
      const data = await api.getOrdenes("todos");   // ← siempre "todos"
      setTodasOrdenes(Array.isArray(data) ? data : []);
    } catch { setTodasOrdenes([]); }
    finally { setLoading(false); }
  };

  // Las órdenes que se muestran en la tabla = filtro de estado + búsqueda
  const ordenes = filtroEstado === "todos"
    ? todasOrdenes
    : todasOrdenes.filter(o => o.estado_orden === filtroEstado);

  useEffect(() => { cargar(); }, []);

  const mostrarMsg = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  const abrirDevolver = (r) => { setSeleccionado(r); setModal("devolver"); };

  const abrirPublicar = async (orden) => {
    try {
      const detalle = await api.getDetalleOrden(orden.id_orden);
      setOrdenDetalle(detalle);
      setModal("publicar");
    } catch {
      mostrarMsg("err", "Error al cargar el detalle de la orden.");
    }
  };

  const [pdfVisor, setPdfVisor] = useState(null); // { url, nombre } para visor standalone

  const abrirSoloPDF = async (orden) => {
  try {
    const detalle = await api.getDetalleOrden(orden.id_orden);
    
    // Si ya existe un PDF guardado en el servidor, abrirlo directamente
    if (detalle?.pdf_url) {
      const url = toBackendUrl(detalle.pdf_url);
      setPdfVisor({ url, nombre: `Resultado_${orden.numero_ticket || orden.id_orden}` });
      return;
    }

    // Solo regenerar si no hay PDF guardado
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const rolActivo = user.rol || (Array.isArray(user.roles) ? user.roles[0] : null) || "Responsable Técnico";
    const admin = {
      nombre: detalle?.admin_nombre || `${user.nombres || ""} ${user.apellidos || ""}`.trim() || "Administrador",
      cargo:  detalle?.admin_cargo  || user.cargo || rolActivo,
      firma:  detalle?.admin_firma_url || detalle?.admin_firma || user.firma_digital || null,
    };
    const resultados = detalle?.resultados || [];
    const doc = await generarPDFResultado(detalle, resultados, admin);
    const todosExamenes = resultados.flatMap(r => (r.examenes || []).map(ex => ({ ...ex })));
    const pdfUrlsAdjuntos = todosExamenes
      .filter(ex => !!ex.archivo_pdf && (ex.parametros || []).length === 0)
      .map(ex => toBackendUrl(ex.archivo_pdf));

    let blobUrl;
    if (pdfUrlsAdjuntos.length > 0) {
      const mergedBytes = await fusionarPDFs(doc, pdfUrlsAdjuntos);
      if (mergedBytes instanceof Uint8Array) {
        blobUrl = URL.createObjectURL(new Blob([mergedBytes], { type: "application/pdf" }));
      } else {
        blobUrl = URL.createObjectURL(doc.output("blob"));
      }
    } else {
      blobUrl = URL.createObjectURL(doc.output("blob"));
    }

    setPdfVisor({ url: blobUrl, nombre: `Resultado_${orden.numero_ticket || orden.id_orden}` });
  } catch {
    mostrarMsg("err", "Error al generar el PDF.");
  }
};

  const handleDevolver = async (motivo) => {
    try {
      await api.devolver(seleccionado.id_resultado, motivo);
      const especialista = seleccionado?.tecnico_nombre || seleccionado?.especialista_nombre || "el Especialista responsable";
      mostrarMsg("ok", `Examen devuelto correctamente. Se ha notificado a ${especialista} para que realice las correcciones correspondientes.`);
      setModal(null);
      await cargar();
    } catch { mostrarMsg("err", "Error al devolver el resultado."); }
  };

  const handlePublicar = async ({ soloDevueltos, mixto } = {}) => {
    if (soloDevueltos) {
      mostrarMsg("ok", "Examen devuelto correctamente. Se notificará al Especialista para que realice las correcciones.");
    } else if (mixto) {
      mostrarMsg("ok", "Orden procesada: exámenes validados publicados y devueltos al Especialista para corrección.");
    } else {
      mostrarMsg("ok", "Orden validada correctamente. El paciente será notificado con sus resultados.");
    }
    setModal(null);
    await cargar();
  };

  const filtrados = ordenes.filter(o => {
    const coincideTexto =
      (o.numero_ticket || "").toLowerCase().includes(buscar.toLowerCase()) ||
      (o.paciente_nombre || "").toLowerCase().includes(buscar.toLowerCase()) ||
      (o.paciente_cedula || "").toLowerCase().includes(buscar.toLowerCase());

    if (!coincideTexto) return false;

    // Filtro por rango de fecha (sobre fecha_orden, en formato YYYY-MM-DD)
    if (desde || hasta) {
      const fechaOrden = o.fecha_orden ? String(o.fecha_orden).slice(0, 10) : null;
      if (!fechaOrden) return false;
      if (desde && fechaOrden < desde) return false;
      if (hasta && fechaOrden > hasta) return false;
    }

    return true;
  });

  // Resetear a la página 1 cada vez que cambian los filtros (texto, estado o fecha)
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado, desde, hasta]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const filtradosPagina = filtrados.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE);

  const estados = ["Por Validar", "En Proceso", "Validado", "Devuelto", "todos"];
  // Contadores globales calculados de TODAS las órdenes (independiente del filtro activo)
  const counts  = todasOrdenes.reduce((acc, o) => { acc[o.estado_orden] = (acc[o.estado_orden] || 0) + 1; return acc; }, {});

  return (
    <div style={page}>
      {/* TOAST */}
      {msg && (
        <div style={{ position: "fixed", top: "80px", right: "1.5rem", zIndex: 400, background: msg.tipo === "ok" ? "#D1FAE5" : "#FEE2E2", color: msg.tipo === "ok" ? "#065F46" : "#991B1B", border: `1px solid ${msg.tipo === "ok" ? "#86EFAC" : "#FCA5A5"}`, padding: "0.75rem 1.25rem", borderRadius: "10px", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", fontWeight: 600, boxShadow: "0 4px 15px rgba(0,0,0,0.1)", animation: "fadeIn 0.2s ease" }}>
          {msg.tipo === "ok" ? "✅" : "❌"} {msg.texto}
        </div>
      )}

      {/* HEADER */}
      <div style={header}>
        <div>
          <h2 style={pageH2}>Resultados <span style={{ color: "#8B5CF6" }}>Clínicos</span></h2>
          <p style={pageSub}>Validación y publicación de resultados de laboratorio</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input placeholder="🔍 Ticket, paciente o cédula…" value={buscar}
            onChange={e => setBuscar(e.target.value)} style={searchInput} />
          <input type="date" value={desde} max={hasta || undefined}
            onChange={e => setDesde(e.target.value)} style={dateInput} title="Desde" />
          <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>—</span>
          <input type="date" value={hasta} min={desde || undefined}
            onChange={e => setHasta(e.target.value)} style={dateInput} title="Hasta" />
          {(desde || hasta) && (
            <button onClick={() => { setDesde(""); setHasta(""); }}
              style={{ ...btnBase, background: "#F1F5F9", color: "#374151", border: "1px solid #E2E8F0", fontSize: "0.78rem", padding: "0.45rem 0.85rem" }}>
              ✕ Limpiar fechas
            </button>
          )}
          <button onClick={cargar} style={{ ...btnBase, background: "rgba(139,92,246,0.1)", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.2)", fontSize: "0.82rem" }}>
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {estados.map(e => {
          const count  = e === "todos" ? todasOrdenes.length : (counts[e] || 0);
          const active = filtroEstado === e;
          const colorMap = { "Por Validar": "#8B5CF6", "En Proceso": "#3B82F6", "Validado": "#10B981", "Devuelto": "#EF4444", "todos": "#6B7280" };
          const c = colorMap[e] || "#6B7280";
          return (
            <button key={e} onClick={() => setFiltroEstado(e)} style={{ padding: "0.45rem 0.9rem", borderRadius: "20px", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.78rem", border: active ? `2px solid ${c}` : "1px solid #E2E8F0", background: active ? `${c}18` : "#F8FAFC", color: active ? c : "#6B7280", letterSpacing: "0.03em", textTransform: "uppercase" }}>
              {e === "todos" ? "TODOS" : e.toUpperCase()} ({count})
            </button>
          );
        })}
      </div>

      {/* TABLA */}
      {loading ? <Loader /> : (
        <div style={tableWrap}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Ticket", "Paciente", "Fecha", "Estado Orden", "Resultados", "Acciones"].map(c => (
                  <th key={c} style={th}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>
                    Sin órdenes para este filtro
                  </td>
                </tr>
              ) : filtradosPagina.map(o => {
                const porValidar = parseInt(o.por_validar || 0);
                const validados  = parseInt(o.validados   || 0);
                const devueltos  = parseInt(o.devueltos   || 0);
                const enProceso  = parseInt(o.en_proceso  || 0);
                const total      = parseInt(o.total_resultados || 0);
                return (
                  <tr key={o.id_orden} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={td}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#1F2937" }}>
                        #{o.numero_ticket || o.id_orden}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{o.paciente_nombre || "—"}</div>
                      <div style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>{o.paciente_cedula || ""}</div>
                    </td>
                    <td style={{ ...td, color: "#9CA3AF", fontSize: "0.78rem" }}>
                      {new Date(o.fecha_orden).toLocaleDateString("es-EC")}
                    </td>
                    <td style={td}><Badge estado={o.estado_orden} /></td>
                    <td style={td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {porValidar > 0 && <span style={{ fontSize: "0.72rem", color: "#8B5CF6" }}>⏳ {porValidar} por validar</span>}
                        {validados  > 0 && <span style={{ fontSize: "0.72rem", color: "#059669" }}>✅ {validados} validados</span>}
                        {devueltos  > 0 && <span style={{ fontSize: "0.72rem", color: "#DC2626" }}>↩️ {devueltos} devueltos</span>}
                        {enProceso  > 0 && <span style={{ fontSize: "0.72rem", color: "#3B82F6" }}>🔬 {enProceso} en proceso</span>}
                        {total === 0    && <span style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>Sin resultados aún</span>}
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {/* Orden lista (estado correcto 'Por Validar') */}
                        {o.estado_orden === "Por Validar" && (
                          <button onClick={() => abrirPublicar(o)}
                            style={{ ...btnSmall, background: "#10B981", color: "#FFF", border: "none" }}>
                            ✅ Validar
                          </button>
                        )}
                        
                        {/* En Proceso pero ya hay resultados listos (la orden no cambió de estado por el bug del backend) */}
                        {o.estado_orden === "En Proceso" && porValidar > 0 && (
                          <button onClick={() => abrirPublicar(o)}
                            style={{ ...btnSmall, background: "#10B981", color: "#FFF", border: "none" }}>
                            ✅ Validar
                          </button>
                        )}
                        {o.estado_orden === "En Proceso" && porValidar > 0 && (
                          <button onClick={() => { setSeleccionado({ id_resultado: null, id_orden: o.id_orden, numero_ticket: o.numero_ticket }); setModal("devolver"); }}
                            style={{ ...btnSmall, background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}>
                            ↩ Devolver
                          </button>
                        )}
                        {/* En elaboración real: ningún especialista ha enviado todavía */}
                        {o.estado_orden === "En Proceso" && porValidar === 0 && (
                          <span style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>En elaboración</span>
                        )}
                        {o.estado_orden === "Validado" && (
                          <button onClick={() => abrirSoloPDF(o)}
                            style={{ ...btnSmall, background: "#DBEAFE", color: "#1E40AF", border: "1px solid #BFDBFE" }}>
                            📄 Abrir PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* PAGINADO */}
          {filtrados.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderTop: "1px solid #F1F5F9", background: "#F8FAFC" }}>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF" }}>
                {filtrados.length} orden{filtrados.length !== 1 ? "es" : ""} — página {paginaSegura} de {totalPaginas}
              </span>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaSegura <= 1}
                  style={{ ...pgBtn, opacity: paginaSegura <= 1 ? 0.5 : 1, cursor: paginaSegura <= 1 ? "default" : "pointer" }}>
                  ← Anterior
                </button>
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura >= totalPaginas}
                  style={{ ...pgBtn, opacity: paginaSegura >= totalPaginas ? 0.5 : 1, cursor: paginaSegura >= totalPaginas ? "default" : "pointer" }}>
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALES */}
      {modal === "devolver" && seleccionado && (
        <ModalDevolver resultado={seleccionado} onConfirm={handleDevolver} onClose={() => setModal(null)} />
      )}
      {modal === "publicar" && ordenDetalle && (
        <ModalPublicar orden={ordenDetalle} onConfirm={handlePublicar} onClose={() => setModal(null)} />
      )}

      {/* VISOR PDF STANDALONE (órdenes validadas) */}
      {pdfVisor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ background: "#1F2937", borderRadius: "12px", width: "100%", maxWidth: "820px", height: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", background: "#374151", gap: "0.75rem" }}>
              <span style={{ color: "#F9FAFB", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.04em" }}>
                📄 {pdfVisor.nombre}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => { URL.revokeObjectURL(pdfVisor.url); setPdfVisor(null); }}
                  style={{ padding: "0.3rem 0.85rem", background: "#EF4444", color: "#FFF", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "'Barlow', sans-serif", fontWeight: 600, cursor: "pointer" }}>
                  ✕ Cerrar
                </button>
              </div>
            </div>
            <iframe src={pdfVisor.url} title="Vista previa del resultado"
              style={{ flex: 1, border: "none", width: "100%", display: "block" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HELPERS UI
══════════════════════════════════════════════════════════ */
function Overlay({ onClose, children }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "2rem 1rem" }}>
      {children}
    </div>
  );
}
function ModalHead({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.06em", color: "#1F2937", textTransform: "uppercase" }}>{title}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1rem", cursor: "pointer", color: "#9CA3AF" }}>✕</button>
    </div>
  );
}
function Loader() {
  return <div style={{ padding: "3rem", textAlign: "center", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>Cargando órdenes…</div>;
}

/* ══════════════════════════════════════════════════════════
   ESTILOS
══════════════════════════════════════════════════════════ */
const page        = { padding: "1.5rem", fontFamily: "'Barlow', sans-serif" };
const header      = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" };
const pageH2      = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "0.04em", color: "#1F2937", margin: 0, textTransform: "uppercase" };
const pageSub     = { fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const tableWrap   = { background: "#FFF", borderRadius: "12px", border: "1px solid #F1F5F9", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const th          = { fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0.75rem 1rem", textAlign: "left" };
const td          = { padding: "0.7rem 1rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151" };
const badgeSt     = { padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 600 };
const btnSmall    = { padding: "0.3rem 0.7rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "'Barlow', sans-serif", fontWeight: 600, cursor: "pointer" };
const searchInput = { padding: "0.55rem 1rem", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", width: "260px", outline: "none" };
const dateInput   = { padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", outline: "none", background: "#FFF" };
const pgBtn       = { padding: "0.4rem 0.9rem", border: "1px solid #E2E8F0", borderRadius: "6px", background: "#FFF", fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: "0.78rem", color: "#374151" };
const modalInner  = { background: "#FFF", borderRadius: "14px", width: "520px", maxWidth: "95vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const flabel      = { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" };
const finput      = { padding: "0.55rem 0.75rem", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none", width: "100%", boxSizing: "border-box" };
const footerRow   = { display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" };
const btnBase     = { padding: "0.55rem 1.25rem", border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.85rem" };
const btnSec      = { ...btnBase, background: "#F8FAFC", color: "#374151", border: "1px solid #E2E8F0" };
const infoTxt     = { fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", margin: 0, background: "#F8FAFC", padding: "0.6rem 0.85rem", borderRadius: "8px" };