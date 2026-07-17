/**
 * ===================================================================
 *  SISTEMA DIGITAL DE LIQUIDACIÓN Y PRESTACIONES LABORALES
 *  Cervecería Hondureña, S.A.
 *  Código de Trabajo de Honduras — Cálculos y lógica
 *  JavaScript vanilla — ES5+
 * ===================================================================
 */

(function () {
  "use strict";

  /* ================================================================
   *  CONSTANTES LABORALES — Código de Trabajo de Honduras
   * ================================================================ */

  var DIAS_ANIO       = 360;   // Año comercial (30 días × 12 meses)
  var DIAS_MES        = 30;
  var MESES_ANIO      = 12;
  var DIAS_SEMANA     = 7;
  var DIAS_QUINCENA   = 15;
  var FACTOR_14_MESES = 14;    // Para salario promedio de 14 meses

  var MAX_ANIOS_CESANTIA = 25; // Tope legal de años computables

  // Días de Auxilio de Cesantía por año trabajado (Art. 119 C.T.)
  var CESANTIA_TABLE = [
    { desde: 1, hasta: 2, dias: 10 },
    { desde: 2, hasta: 3, dias: 15 },
    { desde: 3, hasta: 4, dias: 20 },
    { desde: 4, hasta: 5, dias: 25 },
    { desde: 5, hasta: 6, dias: 30 },
    { desde: 6, hasta: 7, dias: 35 },
    { desde: 7, hasta: 8, dias: 40 },
    { desde: 8, hasta: 9, dias: 45 },
    { desde: 9, hasta: 10,dias: 50 },
    { desde: 10, hasta: Infinity, dias: 55 }
  ];

  // Días de vacaciones por año según antigüedad (Art. 346 C.T.)
  var VACACIONES_TABLE = [
    { hasta: 1, dias: 0  },   // Menos de 1 año: no hay derecho
    { hasta: 2, dias: 10 },
    { hasta: 3, dias: 12 },
    { hasta: 4, dias: 14 },
    { hasta: 5, dias: 16 },
    { hasta: 6, dias: 18 },
    { hasta: Infinity, dias: 20 }
  ];

  // Proporción de Cesantía para Renuncia / Mutuo Acuerdo (50 %)
  var PROPORCION_RENUNCIA = 0.50;

  /* ================================================================
   *  REFERENCIAS AL DOM
   * ================================================================ */

  var $ = function (id) { return document.getElementById(id); };

  var form          = $("liquidacionForm");
  var reporteSection= $("reporteSection");
  var tbodyCalculos = $("tbodyCalculos");
  var totalGeneral  = $("totalGeneral");

  /* ================================================================
   *  FUNCIÓN — DIFERENCIA ENTRE FECHAS (antigüedad exacta)
   * ================================================================ */

  function calcularDiferencia(fechaInicial, fechaFinal) {
    var anios  = 0;
    var meses  = 0;
    var dias   = 0;

    var d1 = new Date(fechaInicial);
    var d2 = new Date(fechaFinal);

    if (d2 <= d1) return { anios: 0, meses: 0, dias: 0 };

    var dia1 = d1.getDate();
    var dia2 = d2.getDate();
    var mes1 = d1.getMonth();
    var mes2 = d2.getMonth();
    var anio1 = d1.getFullYear();
    var anio2 = d2.getFullYear();

    dias = dia2 - dia1;
    if (dias < 0) {
      // Tomar días del mes anterior
      var ultimoMes = new Date(anio2, mes2, 0);
      dias += ultimoMes.getDate();
      mes2--;
    }

    meses = mes2 - mes1;
    if (meses < 0) {
      meses += 12;
      anio2--;
    }

    anios = anio2 - anio1;

    return { anios: anios, meses: meses, dias: dias };
  }

  /* ================================================================
   *  FUNCIÓN — DÍAS TOTALES EN EL PERÍODO (para proporcionales)
   * ================================================================ */

  function diasEntre(fechaInicial, fechaFinal) {
    var d1 = new Date(fechaInicial);
    var d2 = new Date(fechaFinal);
    var diff = d2.getTime() - d1.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }

  /* ================================================================
   *  FUNCIÓN — SALARIO DIARIO ORDINARIO
   *  Fórmula: Salario Mensual / 30
   * ================================================================ */

  function calcularSalarioDiario(salarioMensual) {
    return salarioMensual / DIAS_MES;
  }

  /* ================================================================
   *  FUNCIÓN — SALARIO PROMEDIO BASE (14 meses) Y DIARIO PROMEDIO
   *  Fórmula: (Salario Mensual × 14) / 12  →  Salario Diario Promedio / 30
   * ================================================================ */

  function calcularSalarioPromedio(salarioMensual) {
    return (salarioMensual * FACTOR_14_MESES) / MESES_ANIO;
  }

  function calcularSalarioDiarioPromedio(salarioMensual) {
    return calcularSalarioPromedio(salarioMensual) / DIAS_MES;
  }

  /* ================================================================
   *  FUNCIÓN — PREAVISO (Art. 116 C.T.)
   *  Solo aplica para Despido Injustificado.
   *  Se paga con Salario Diario Ordinario.
   * ================================================================ */

  function calcularPreaviso(salarioMensual, antiguedad) {
    var totalMeses = antiguedad.anios * 12 + antiguedad.meses;
    var sd = calcularSalarioDiario(salarioMensual);
    var diasPreaviso = 0;

    if (totalMeses < 3) {
      diasPreaviso = 1;                // 24 horas = 1 día
    } else if (totalMeses < 6) {
      diasPreaviso = DIAS_SEMANA;      // 1 semana = 7 días
    } else if (totalMeses < 12) {
      diasPreaviso = DIAS_QUINCENA;    // 2 semanas = 15 días
    } else {
      diasPreaviso = DIAS_MES;         // 1 mes = 30 días
    }

    return {
      dias: diasPreaviso,
      formula: "Salario Diario Ordinario (L " + sd.toFixed(2) + ") × " + diasPreaviso + " días",
      monto: sd * diasPreaviso
    };
  }

  /* ================================================================
   *  FUNCIÓN — AUXILIO DE CESANTÍA (Art. 119 C.T.)
   *  Usa Salario Diario Promedio (14 meses).
   *  Aplica para Despido Injustificado.
   *  Tope máximo: 25 años.
   * ================================================================ */

  function calcularCesantia(salarioMensual, antiguedad) {
    var aniosComputables = Math.min(antiguedad.anios, MAX_ANIOS_CESANTIA);
    var sdp = calcularSalarioDiarioPromedio(salarioMensual);
    var totalDias = 0;
    var detalle = [];

    for (var i = 0; i < aniosComputables; i++) {
      var anioNum = i + 1;
      var diasAnio = 0;

      for (var t = 0; t < CESANTIA_TABLE.length; t++) {
        var fila = CESANTIA_TABLE[t];
        if (anioNum >= fila.desde && anioNum < fila.hasta) {
          diasAnio = fila.dias;
          break;
        }
      }

      totalDias += diasAnio;
      detalle.push("Año " + anioNum + ": " + diasAnio + " días");
    }

    // Si hay meses adicionales (fracción del año siguiente)
    if (antiguedad.anios < MAX_ANIOS_CESANTIA && antiguedad.meses > 0) {
      var fraccionAnio = antiguedad.meses / MESES_ANIO;
      var siguienteNivel = aniosComputables + 1;

      var diasFraccion = 0;
      for (var tf = 0; tf < CESANTIA_TABLE.length; tf++) {
        var filaF = CESANTIA_TABLE[tf];
        if (siguienteNivel >= filaF.desde && siguienteNivel < filaF.hasta) {
          diasFraccion = filaF.dias * fraccionAnio;
          break;
        }
      }

      if (diasFraccion > 0) {
        totalDias += diasFraccion;
        detalle.push("Fracción (" + antiguedad.meses + " meses): " + diasFraccion.toFixed(2) + " días");
      }
    }

    var formula = "Salario Diario Promedio (L " + sdp.toFixed(2) + ") × " + totalDias.toFixed(2) + " días";

    return {
      dias: totalDias,
      formula: formula,
      monto: sdp * totalDias,
      detalle: detalle
    };
  }

  /* ================================================================
   *  FUNCIÓN — CESANTÍA PROPORCIONAL
   *  Aplica para Renuncia o Mutuo Acuerdo.
   *  Corresponde al 50 % de la Cesantía completa.
   * ================================================================ */

  function calcularCesantiaProporcional(salarioMensual, antiguedad) {
    var cesantiaCompleta = calcularCesantia(salarioMensual, antiguedad);

    return {
      dias: cesantiaCompleta.dias * PROPORCION_RENUNCIA,
      formula: "Cesantía completa × " + (PROPORCION_RENUNCIA * 100) + " %",
      monto: cesantiaCompleta.monto * PROPORCION_RENUNCIA,
      detalle: cesantiaCompleta.detalle
    };
  }

  /* ================================================================
   *  FUNCIÓN — VACACIONES PROPORCIONALES (Art. 346 C.T.)
   *  Se calculan con Salario Diario Ordinario.
   *  Fórmula: (días de vacaciones del año / 365) × días desde último
   *  aniversario × Salario Diario Ordinario
   * ================================================================ */

  function calcularVacacionesProporcionales(salarioMensual, antiguedad, fechaIngreso, fechaFin) {
    var sd = calcularSalarioDiario(salarioMensual);
    var aniosCompletos = antiguedad.anios;

    // Determinar días de vacaciones que corresponden según antigüedad
    var diasVacAnio = 0;
    for (var v = 0; v < VACACIONES_TABLE.length; v++) {
      var filaV = VACACIONES_TABLE[v];
      if (aniosCompletos < filaV.hasta) {
        diasVacAnio = filaV.dias;
        break;
      }
    }

    // Si no ha cumplido el primer año, no hay vacaciones
    if (aniosCompletos < 1) {
      return { dias: 0, formula: "Menos de 1 año de servicio", monto: 0 };
    }

    // Días desde el último aniversario hasta la fecha de finalización
    var fechaAniversario = new Date(fechaIngreso);
    fechaAniversario.setFullYear(fechaAniversario.getFullYear() + aniosCompletos);

    var diasDesdeAniversario = diasEntre(
      fechaAniversario.toISOString().split("T")[0],
      fechaFin
    );

    if (diasDesdeAniversario < 0) diasDesdeAniversario = 0;

    var fraccion = diasDesdeAniversario / 365;
    var diasVacProporcionales = diasVacAnio * fraccion;

    var formula = "(" + diasVacAnio + " días / 365) × " + diasDesdeAniversario + " días × Salario Diario (L " + sd.toFixed(2) + ")";

    return {
      dias: diasVacProporcionales,
      formula: formula,
      monto: diasVacProporcionales * sd
    };
  }

  /* ================================================================
   *  FUNCIÓN — AGUINALDO PROPORCIONAL (13.er mes)
   *  Fórmula: (Salario Mensual / 360) × días trabajados en el año
   *  calendario (desde el 1 de enero).
   * ================================================================ */

  function calcularAguinaldoProporcional(salarioMensual, fechaFin) {
    var anio = new Date(fechaFin).getFullYear();
    var inicioAnio = anio + "-01-01";
    var diasTrabajadosAnio = diasEntre(inicioAnio, fechaFin);

    if (diasTrabajadosAnio < 0) diasTrabajadosAnio = 0;
    if (diasTrabajadosAnio > 360) diasTrabajadosAnio = 360;

    var monto = (salarioMensual / DIAS_ANIO) * diasTrabajadosAnio;

    var formula = "(L " + salarioMensual.toFixed(2) + " / " + DIAS_ANIO + ") × " + diasTrabajadosAnio + " días trabajados";

    return {
      monto: monto,
      formula: formula,
      dias: diasTrabajadosAnio
    };
  }

  /* ================================================================
   *  FUNCIÓN — CATORCEAVO MES PROPORCIONAL
   *  Fórmula: (Salario Mensual / 360) × días trabajados desde el
   *  1 de julio (o desde el 1 de enero si la fecha de finalización
   *  es antes de julio).
   * ================================================================ */

  function calcularCatorceavoProporcional(salarioMensual, fechaFin) {
    var d = new Date(fechaFin);
    var anio = d.getFullYear();
    var mes   = d.getMonth() + 1; // 1-12

    var inicioPeriodo;
    if (mes < 7) {
      // Primera mitad del año: desde 1 de enero
      inicioPeriodo = anio + "-01-01";
    } else {
      // Segunda mitad: desde 1 de julio
      inicioPeriodo = anio + "-07-01";
    }

    var diasEnPeriodo = diasEntre(inicioPeriodo, fechaFin);
    if (diasEnPeriodo < 0) diasEnPeriodo = 0;
    if (diasEnPeriodo > 180) diasEnPeriodo = 180;

    var monto = (salarioMensual / DIAS_ANIO) * diasEnPeriodo;

    var formula = "(L " + salarioMensual.toFixed(2) + " / " + DIAS_ANIO + ") × " + diasEnPeriodo + " días en el semestre";

    return {
      monto: monto,
      formula: formula,
      dias: diasEnPeriodo
    };
  }

  /* ================================================================
   *  FUNCIÓN — FORMATO DE MONEDA (Lempiras)
   * ================================================================ */

  function formatearL(valor) {
    return "L " + valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* ================================================================
   *  FUNCIÓN — FORMATEAR ANTIGÜEDAD
   * ================================================================ */

  function formatearAntiguedad(ant) {
    return ant.anios + " años, " + ant.meses + " meses, " + ant.dias + " días";
  }

  /* ================================================================
   *  VALIDACIONES DEL FORMULARIO
   * ================================================================ */

  var camposRequeridos = [
    "codigo", "nombre", "identidad", "puesto", "departamento",
    "contrato", "salario", "motivo", "fechaIngreso", "fechaFin"
  ];

  function limpiarErrores() {
    var inputs = document.querySelectorAll(".error");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].classList.remove("error");
    }
  }

  function validarFormulario() {
    limpiarErrores();

    var errores = [];
    var datos   = {};

    for (var i = 0; i < camposRequeridos.length; i++) {
      var id = camposRequeridos[i];
      var el = $(id);
      if (!el) continue;

      if (!el.value || el.value.trim() === "") {
        el.classList.add("error");
        errores.push("El campo \"" + el.previousElementSibling.textContent.replace("*", "").trim() + "\" es obligatorio.");
      } else {
        datos[id] = el.value.trim();
      }
    }

    // Salario debe ser > 0
    var salario = parseFloat($("salario").value);
    if (isNaN(salario) || salario <= 0) {
      $("salario").classList.add("error");
      errores.push("El salario mensual debe ser un número mayor a cero.");
    } else {
      datos.salario = salario;
    }

    // Validar que fecha de finalización sea posterior a fecha de ingreso
    var fi = $("fechaIngreso").value;
    var ff = $("fechaFin").value;

    if (fi && ff) {
      if (new Date(ff) <= new Date(fi)) {
        $("fechaIngreso").classList.add("error");
        $("fechaFin").classList.add("error");
        errores.push("La fecha de finalización debe ser posterior a la fecha de ingreso.");
      }
    }

    // Vacaciones pendientes (opcional, valor por defecto 0)
    var vp = parseInt($("vacPendientes").value, 10) || 0;
    datos.vacPendientes = vp;

    return { valido: errores.length === 0, errores: errores, datos: datos };
  }

  /* ================================================================
   *  FUNCIÓN PRINCIPAL — CALCULAR PRESTACIONES
   * ================================================================ */

  function calcularPrestaciones() {
    var validacion = validarFormulario();

    if (!validacion.valido) {
      var msg = "Por favor corrija los siguientes errores:\n\n";
      for (var e = 0; e < validacion.errores.length; e++) {
        msg += "• " + validacion.errores[e] + "\n";
      }
      alert(msg);
      return;
    }

    var d = validacion.datos;

    // Calcular antigüedad
    var antiguedad = calcularDiferencia(d.fechaIngreso, d.fechaFin);

    // Actualizar display de antigüedad
    $("antiguedadDisplay").innerHTML =
      '<span class="antiguedad-display__value">' + antiguedad.anios + '</span> años &nbsp;·&nbsp; ' +
      '<span class="antiguedad-display__value">' + antiguedad.meses + '</span> meses &nbsp;·&nbsp; ' +
      '<span class="antiguedad-display__value">' + antiguedad.dias + '</span> días';

    // Calcular valores base
    var salarioMensual     = d.salario;
    var salarioDiario      = calcularSalarioDiario(salarioMensual);
    var salarioPromedio    = calcularSalarioPromedio(salarioMensual);
    var salarioDiarioProm  = calcularSalarioDiarioPromedio(salarioMensual);

    var motivo = d.motivo;
    var esDespido = (motivo === "Despido injustificado");

    // ---- PREAVISO (solo Despido Injustificado) ----
    var preaviso = null;
    if (esDespido) {
      preaviso = calcularPreaviso(salarioMensual, antiguedad);
    }

    // ---- AUXILIO DE CESANTÍA ----
    var cesantia = null;
    var cesantiaProp = null;

    if (esDespido) {
      cesantia = calcularCesantia(salarioMensual, antiguedad);
    } else {
      cesantiaProp = calcularCesantiaProporcional(salarioMensual, antiguedad);
    }

    // ---- VACACIONES PROPORCIONALES ----
    var vacProp = calcularVacacionesProporcionales(salarioMensual, antiguedad, d.fechaIngreso, d.fechaFin);

    // ---- VACACIONES PENDIENTES ----
    var vacPendMonto = d.vacPendientes * salarioDiario;
    var vacPendFormula = d.vacPendientes + " días × Salario Diario (L " + salarioDiario.toFixed(2) + ")";

    // ---- AGUINALDO PROPORCIONAL ----
    var aguinaldo = calcularAguinaldoProporcional(salarioMensual, d.fechaFin);

    // ---- CATORCEAVO MES PROPORCIONAL ----
    var catorceavo = calcularCatorceavoProporcional(salarioMensual, d.fechaFin);

    // ---- GENERAR TABLA DE RESULTADOS ----
    var filas = [];

    // Fila 1: Salario Diario Ordinario (informativo)
    filas.push({
      concepto: "Salario Diario Ordinario",
      formula: "L " + salarioMensual.toFixed(2) + " / 30 días",
      monto: salarioDiario,
      esInformativo: true
    });

    // Fila 2: Salario Promedio Base (informativo)
    filas.push({
      concepto: "Salario Promedio Base (14 meses)",
      formula: "(L " + salarioMensual.toFixed(2) + " × 14) / 12",
      monto: salarioPromedio,
      esInformativo: true
    });

    // Fila 3: Salario Diario Promedio (informativo)
    filas.push({
      concepto: "Salario Diario Promedio",
      formula: "Salario Promedio Base / 30",
      monto: salarioDiarioProm,
      esInformativo: true
    });

    // Fila 4: Preaviso
    if (preaviso) {
      filas.push({
        concepto: "Preaviso (Art. 116 C.T.)",
        formula: preaviso.formula,
        monto: preaviso.monto
      });
    }

    // Fila 5: Auxilio de Cesantía
    if (cesantia) {
      filas.push({
        concepto: "Auxilio de Cesantía (Art. 119 C.T.)",
        formula: cesantia.formula,
        monto: cesantia.monto
      });
    }

    // Fila 6: Cesantía Proporcional
    if (cesantiaProp) {
      filas.push({
        concepto: "Cesantía Proporcional (Renuncia / Mutuo Acuerdo)",
        formula: cesantiaProp.formula,
        monto: cesantiaProp.monto
      });
    }

    // Fila 7: Vacaciones Proporcionales
    filas.push({
      concepto: "Vacaciones Proporcionales (Art. 346 C.T.)",
      formula: vacProp.formula,
      monto: vacProp.monto
    });

    // Fila 8: Vacaciones Pendientes
    if (d.vacPendientes > 0) {
      filas.push({
        concepto: "Vacaciones Pendientes",
        formula: vacPendFormula,
        monto: vacPendMonto
      });
    }

    // Fila 9: Aguinaldo Proporcional (13.er mes)
    filas.push({
      concepto: "Aguinaldo Proporcional (13.er mes)",
      formula: aguinaldo.formula,
      monto: aguinaldo.monto
    });

    // Fila 10: Catorceavo Mes Proporcional
    filas.push({
      concepto: "Catorceavo Mes Proporcional",
      formula: catorceavo.formula,
      monto: catorceavo.monto
    });

    // ---- CALCULAR TOTAL GENERAL ----
    var total = 0;
    for (var f = 0; f < filas.length; f++) {
      if (!filas[f].esInformativo) {
        total += filas[f].monto;
      }
    }

    // ---- RENDERIZAR TABLA ----
    var html = "";

    for (var r = 0; r < filas.length; r++) {
      var fila = filas[r];
      var claseInfo = fila.esInformativo ? ' style="color:#8896a8;font-style:italic;"' : "";
      html += "<tr" + claseInfo + ">";
      html += "<td>" + fila.concepto + "</td>";
      html += "<td style='font-size:0.78rem;color:#4a5568;'>" + fila.formula + "</td>";
      html += "<td><strong>" + formatearL(fila.monto) + "</strong></td>";
      html += "</tr>";
    }

    tbodyCalculos.innerHTML = html;
    totalGeneral.innerHTML = "<strong>" + formatearL(total) + "</strong>";

    // ---- LLENAR DATOS DEL REPORTE ----
    $("rCodigo").textContent      = d.codigo;
    $("rNombre").textContent      = d.nombre;
    $("rIdentidad").textContent   = d.identidad;
    $("rPuesto").textContent      = d.puesto;
    $("rDepartamento").textContent= d.departamento;
    $("rContrato").textContent    = d.contrato;
    $("rMotivo").textContent      = d.motivo;
    $("rAntiguedad").textContent  = formatearAntiguedad(antiguedad);
    $("rSalario").textContent     = formatearL(salarioMensual);
    $("rVacPend").textContent     = d.vacPendientes + " día(s)";

    // Folio / fecha del reporte
    var ahora = new Date();
    var folio = "CH-LIQ-" + ahora.getFullYear() + ("0" + (ahora.getMonth() + 1)).slice(-2) + ("0" + ahora.getDate()).slice(-2) + "-" + Math.floor(Math.random() * 900 + 100);
    $("reporteFolio").textContent = "Folio: " + folio + " | Fecha: " + ahora.toLocaleDateString("es-HN");

    // Mostrar reporte
    reporteSection.style.display = "block";
    reporteSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Habilitar botón Exportar
    $("btnExportar").disabled = false;
  }

  /* ================================================================
   *  FUNCIÓN — NUEVO CÁLCULO (limpiar formulario)
   * ================================================================ */

  function nuevoCalculo() {
    mostrarModal(
      "Limpiar formulario",
      "¿Está seguro de que desea limpiar todos los datos del formulario? Los cambios no guardados se perderán.",
      function () {
        form.reset();
        limpiarErrores();
        $("antiguedadDisplay").innerHTML =
          '<span class="antiguedad-display__value">—</span>' +
          '<span class="antiguedad-display__label">años &nbsp;·&nbsp; meses &nbsp;·&nbsp; días</span>';
        reporteSection.style.display = "none";
        $("btnExportar").disabled = true;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    );
  }

  /* ================================================================
   *  FUNCIÓN — EXPORTAR REPORTE (como archivo de texto)
   * ================================================================ */

  function exportarReporte() {
    if (reporteSection.style.display === "none") return;

    var lineas = [];
    lineas.push("========================================");
    lineas.push(" CERVECERÍA HONDUREÑA, S.A.");
    lineas.push(" Liquidación de Prestaciones Laborales");
    lineas.push("========================================");
    lineas.push("");
    lineas.push("Folio: " + $("reporteFolio").textContent);
    lineas.push("");
    lineas.push("--- DATOS DEL TRABAJADOR ---");
    lineas.push("Código:       " + $("rCodigo").textContent);
    lineas.push("Nombre:       " + $("rNombre").textContent);
    lineas.push("Identidad:    " + $("rIdentidad").textContent);
    lineas.push("Puesto:       " + $("rPuesto").textContent);
    lineas.push("Departamento: " + $("rDepartamento").textContent);
    lineas.push("Contrato:     " + $("rContrato").textContent);
    lineas.push("Motivo:       " + $("rMotivo").textContent);
    lineas.push("Antigüedad:   " + $("rAntiguedad").textContent);
    lineas.push("Salario:      " + $("rSalario").textContent);
    lineas.push("");

    lineas.push("--- DETALLE DE PRESTACIONES ---");
    var filas = tbodyCalculos.querySelectorAll("tr");
    for (var i = 0; i < filas.length; i++) {
      var celdas = filas[i].querySelectorAll("td");
      if (celdas.length >= 3) {
        var concepto = celdas[0].textContent.trim();
        var formula  = celdas[1].textContent.trim();
        var monto    = celdas[2].textContent.trim();

        // Saltar filas informativas
        if (concepto.indexOf("Salario Diario Ordinario") !== -1 ||
            concepto.indexOf("Salario Promedio Base") !== -1 ||
            concepto.indexOf("Salario Diario Promedio") !== -1) {
          continue;
        }

        lineas.push(concepto);
        lineas.push("  Fórmula: " + formula);
        lineas.push("  Monto:   " + monto);
        lineas.push("");
      }
    }

    lineas.push("----------------------------------------");
    lineas.push("TOTAL GENERAL: " + totalGeneral.textContent);
    lineas.push("----------------------------------------");
    lineas.push("");
    lineas.push("Firmas:");
    lineas.push("  _________________    _________________");
    lineas.push("  Empleado              Representante Legal");
    lineas.push("");
    lineas.push("  _________________ ");
    lineas.push("  Sello de la Empresa");
    lineas.push("");
    lineas.push("Documento generado el " + new Date().toLocaleString("es-HN"));

    var contenido = lineas.join("\n");

    // Crear y descargar archivo .txt
    var blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement("a");
    a.href   = url;
    a.download = "Liquidacion_" + $("rCodigo").textContent + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ================================================================
   *  FUNCIÓN — SALIR
   * ================================================================ */

  function salir() {
    mostrarModal(
      "Salir del sistema",
      "¿Está seguro de que desea cerrar la sesión?",
      function () {
        localStorage.removeItem("ch-logged");
        window.location.replace("login.html");
      }
    );
  }

  /* ================================================================
   *  FUNCIÓN — MODAL DE CONFIRMACIÓN
   * ================================================================ */

  var modalCallback = null;

  function mostrarModal(titulo, mensaje, callback) {
    $("modalTitle").textContent    = titulo;
    $("modalMessage").textContent  = mensaje;
    $("modalOverlay").style.display = "flex";
    modalCallback = callback;
  }

  function ocultarModal() {
    $("modalOverlay").style.display = "none";
    modalCallback = null;
  }

  /* ================================================================
   *  FUNCIÓN — ACTUALIZAR ANTIGÜEDAD EN TIEMPO REAL
   * ================================================================ */

  function actualizarAntiguedad() {
    var fi = $("fechaIngreso").value;
    var ff = $("fechaFin").value;

    if (fi && ff) {
      var ant = calcularDiferencia(fi, ff);
      $("antiguedadDisplay").innerHTML =
        '<span class="antiguedad-display__value">' + ant.anios + '</span> años &nbsp;·&nbsp; ' +
        '<span class="antiguedad-display__value">' + ant.meses + '</span> meses &nbsp;·&nbsp; ' +
        '<span class="antiguedad-display__value">' + ant.dias + '</span> días';
    }
  }

  /* ================================================================
   *  FUNCIÓN — CALCULAR VACACIONES PENDIENTES AUTO
   * ================================================================ */

  function actualizarVacPendientes() {
    var fi = $("fechaIngreso").value;
    var ff = $("fechaFin").value;

    if (fi && ff) {
      var ant = calcularDiferencia(fi, ff);
      var aniosCompletos = ant.anios;

      if (aniosCompletos < 1) {
        $("vacPendientes").value = 0;
        return;
      }

      // Determinar días de vacaciones según antigüedad
      var diasVacAnio = 0;
      for (var v = 0; v < VACACIONES_TABLE.length; v++) {
        if (aniosCompletos < VACACIONES_TABLE[v].hasta) {
          diasVacAnio = VACACIONES_TABLE[v].dias;
          break;
        }
      }

      // Calcular proporcional desde el último aniversario
      var fechaAniv = new Date(fi);
      fechaAniv.setFullYear(fechaAniv.getFullYear() + aniosCompletos);

      var dDesdeAniv = diasEntre(
        fechaAniv.toISOString().split("T")[0],
        ff
      );
      if (dDesdeAniv < 0) dDesdeAniv = 0;

      var vacPendCalculadas = Math.round((diasVacAnio / 365) * dDesdeAniv);
      $("vacPendientes").value = vacPendCalculadas;
    }
  }

  /* ================================================================
   *  THEME TOGGLE — DARK / LIGHT
   * ================================================================ */

  function initTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  /* ================================================================
   *  INICIALIZAR AL CARGAR EL DOM
   * ================================================================ */

  function init() {
    initTheme();

    // Logout
    $("btnLogout").addEventListener("click", salir);

    // Botones principales
    $("btnCalcular").addEventListener("click", calcularPrestaciones);
    $("btnNuevo").addEventListener("click", nuevoCalculo);
    $("btnExportar").addEventListener("click", exportarReporte);
    $("btnSalir").addEventListener("click", salir);
    $("btnExportar2").addEventListener("click", exportarReporte);

    // Modal
    $("modalConfirm").addEventListener("click", function () {
      if (typeof modalCallback === "function") {
        modalCallback();
      }
      ocultarModal();
    });

    $("modalCancel").addEventListener("click", ocultarModal);
    $("modalOverlay").addEventListener("click", function (e) {
      if (e.target === this) ocultarModal();
    });

    // Cálculo automático de antigüedad al cambiar fechas
    $("fechaIngreso").addEventListener("change", actualizarAntiguedad);
    $("fechaFin").addEventListener("change", actualizarAntiguedad);

    // Cálculo automático de vacaciones pendientes
    $("fechaIngreso").addEventListener("change", actualizarVacPendientes);
    $("fechaFin").addEventListener("change", actualizarVacPendientes);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
