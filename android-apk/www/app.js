const calculationVersion = "Agres Plantio | Ajuste Entre-Passadas v49";

const defaults = {
  spacing: 0,
  rows: 0,
  implementWidthOverride: null,
  firstPassRows: null,
  firstPassSpacing: null,
  firstPassWidth: null,
  initialOffset: 0,
  turn: "left",
  measured12: 0,
  measured23: 0
};

const storageKeys = {
  state: "agres-configurar-espacamento-state",
  history: "agres-configurar-espacamento-history"
};

const fields = {
  spacing: document.querySelector("#inputSpacing"),
  rows: document.querySelector("#inputRows"),
  initialOffset: document.querySelector("#inputInitialOffset"),
  measured12: document.querySelector("#inputMeasured12"),
  measured23: document.querySelector("#inputMeasured23")
};

const outputs = {
  implementWidth: document.querySelector("#resultImplementWidth"),
  correctedWidth: document.querySelector("#resultCorrectedWidth"),
  correctedOffset: document.querySelector("#resultCorrectedOffset"),
  error: document.querySelector("#formError"),
  fieldGuide: document.querySelector("#fieldGuide"),
  fieldGapLeft: document.querySelector("#fieldGapLeft"),
  fieldGapRight: document.querySelector("#fieldGapRight"),
  turnCurve: document.querySelector("#turnCurve"),
  machineImage: document.querySelector("#machineImage"),
  laneA: document.querySelector("#laneA"),
  laneB: document.querySelector("#laneB"),
  laneC: document.querySelector("#laneC"),
  laneALabel: document.querySelector("#laneALabel"),
  laneBLabel: document.querySelector("#laneBLabel"),
  laneCLabel: document.querySelector("#laneCLabel"),
  history: document.querySelector("#historyList"),
  exportWord: document.querySelector("#exportWordButton"),
  toast: document.querySelector("#toastMessage"),
  status: document.querySelector("#connectionStatus")
};

let state = loadState();
let latest = calculate(state);
let selectedHistoryIds = new Set();
let toastTimer = 0;
const textEncoder = new TextEncoder();

function parseDecimal(value) {
  if (typeof value !== "string") return Number(value);
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  return Number(normalized);
}

function formatInput(value, digits = 2) {
  return Number(value).toFixed(digits).replace(".", ",");
}

function formatMeters(value, digits = 3) {
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })} m`;
}

function formatSignedMeters(value, digits = 3) {
  if (Object.is(value, -0)) return formatMeters(0, digits);
  return formatMeters(value, digits);
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function roundLikeExcel(value, digits) {
  const factor = 10 ** digits;
  const number = Number(value);
  const sign = Math.sign(number) || 1;
  return sign * (Math.round((Math.abs(number) + Number.EPSILON) * factor) / factor);
}

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;"
  }[char]));
}

function safeFileName(value) {
  return String(value || "historico")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "historico";
}

function hasNumber(value) {
  return value !== null && value !== "" && Number.isFinite(Number(value));
}

function firstPassInfo(values, calculated = null) {
  const rows = hasNumber(values.firstPassRows) ? Number(values.firstPassRows) : Number(values.rows || 0);
  const spacing = hasNumber(values.firstPassSpacing) ? Number(values.firstPassSpacing) : Number(values.spacing || 0);
  const width = hasNumber(values.firstPassWidth)
    ? Number(values.firstPassWidth)
    : rows * spacing;

  return {
    rows,
    spacing,
    width: hasNumber(width) ? width : Number(calculated?.implementWidth || 0)
  };
}

function showToast(message) {
  if (!outputs.toast) return;
  outputs.toast.textContent = message;
  outputs.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    outputs.toast.classList.remove("show");
  }, 2200);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.state));
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

function persistState() {
  localStorage.setItem(storageKeys.state, JSON.stringify(state));
}

function syncInputs() {
  fields.spacing.value = formatInput(state.spacing);
  fields.rows.value = String(Math.round(state.rows || 0));
  fields.initialOffset.value = formatInput(state.initialOffset, 3);
  fields.measured12.value = formatInput(state.measured12);
  fields.measured23.value = formatInput(state.measured23);

  document.querySelectorAll("[data-turn]").forEach((button) => {
    const active = button.dataset.turn === state.turn;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
}

function readInputs() {
  state = {
    spacing: parseDecimal(fields.spacing.value),
    rows: Math.round(parseDecimal(fields.rows.value)),
    implementWidthOverride: null,
    firstPassRows: null,
    firstPassSpacing: null,
    firstPassWidth: null,
    initialOffset: parseDecimal(fields.initialOffset.value),
    turn: state.turn === "right" ? "right" : "left",
    measured12: parseDecimal(fields.measured12.value),
    measured23: parseDecimal(fields.measured23.value)
  };
}

function readInput(key) {
  if (key === "spacing") {
    state.spacing = parseDecimal(fields.spacing.value);
    state.implementWidthOverride = null;
    state.firstPassRows = null;
    state.firstPassSpacing = null;
    state.firstPassWidth = null;
  }

  if (key === "rows") {
    state.rows = Math.round(parseDecimal(fields.rows.value));
    state.implementWidthOverride = null;
    state.firstPassRows = null;
    state.firstPassSpacing = null;
    state.firstPassWidth = null;
  }

  if (key === "initialOffset") {
    state.initialOffset = parseDecimal(fields.initialOffset.value);
  }

  if (key === "measured12") {
    state.measured12 = parseDecimal(fields.measured12.value);
  }

  if (key === "measured23") {
    state.measured23 = parseDecimal(fields.measured23.value);
  }
}

function normalizeField(key) {
  if (key === "spacing") state.spacing = Math.max(0, state.spacing || 0);
  if (key === "rows") state.rows = Math.max(0, Math.round(state.rows || 0));
  if (key === "initialOffset") state.initialOffset = state.initialOffset || 0;
  if (key === "measured12") state.measured12 = Math.max(0, state.measured12 || 0);
  if (key === "measured23") state.measured23 = Math.max(0, state.measured23 || 0);
}

function validate(values) {
  const allFinite = [
    values.spacing,
    values.rows,
    values.initialOffset,
    values.measured12,
    values.measured23
  ].every(Number.isFinite);

  if (!allFinite) return "Preencha todos os campos com números válidos.";
  if (values.spacing < 0) return "O espaçamento entre linhas não pode ser negativo.";
  if (values.rows < 0) return "A quantidade de linhas não pode ser negativa.";
  if (values.measured12 < 0 || values.measured23 < 0) return "Os espaçamentos medidos não podem ser negativos.";
  return "";
}

function calculate(values) {
  const turnFactor = values.turn === "right" ? 1 : -1;
  const hasWidthOverride = Number.isFinite(values.implementWidthOverride);
  const implementWidth = hasWidthOverride ? values.implementWidthOverride : values.rows * values.spacing;
  const referenceSpacing = hasWidthOverride && hasNumber(values.firstPassSpacing)
    ? Number(values.firstPassSpacing)
    : values.spacing;

  const measured12Delta = values.measured12 > 0 ? (values.measured12 - referenceSpacing) / 2 : 0;
  const measured23Delta = values.measured23 > 0 ? (values.measured23 - referenceSpacing) / 2 : 0;
  const leftCorrection = (implementWidth / 2) - measured12Delta;
  const rightCorrection = (implementWidth / 2) - measured23Delta;
  const correctedWidth = roundTo(leftCorrection + rightCorrection, 3);
  const correctedOffset = roundLikeExcel((((leftCorrection - rightCorrection) / 2) * turnFactor) + values.initialOffset, 3);

  return {
    implementWidth,
    correctedWidth,
    correctedOffset,
    widthDelta: correctedWidth - implementWidth,
    offsetDelta: correctedOffset - values.initialOffset,
    turnFactor
  };
}

function setLanePass(lane, passClass) {
  lane.classList.remove("pass-one", "pass-two", "pass-three");
  lane.classList.add(passClass);
}

function render() {
  const error = validate(state);
  const saveButton = document.querySelector("#saveButton");
  const copyButton = document.querySelector("#copyButton");
  const secondStageButton = document.querySelector("#secondStageButton");
  outputs.error.textContent = error;

  if (error) {
    saveButton.disabled = true;
    copyButton.disabled = true;
    secondStageButton.disabled = true;
    return;
  }

  saveButton.disabled = false;
  copyButton.disabled = false;
  latest = calculate(state);
  secondStageButton.disabled = state.rows <= 0
    || !Number.isFinite(latest.correctedWidth)
    || !Number.isFinite(latest.correctedOffset);

  outputs.implementWidth.textContent = formatMeters(latest.implementWidth, 2);
  outputs.correctedWidth.textContent = formatMeters(latest.correctedWidth, 3);
  outputs.correctedOffset.textContent = formatSignedMeters(latest.correctedOffset);
  const turnRight = state.turn === "right";
  const measured12Text = `1ª-2ª: ${formatMeters(state.measured12, 2)}`;
  const measured23Text = `2ª-3ª: ${formatMeters(state.measured23, 2)}`;

  outputs.fieldGuide.classList.toggle("turn-right", turnRight);
  outputs.fieldGuide.classList.toggle("turn-left", !turnRight);
  outputs.laneALabel.textContent = turnRight ? "1ª" : "3ª";
  outputs.laneBLabel.textContent = "2ª";
  outputs.laneCLabel.textContent = turnRight ? "3ª" : "1ª";
  setLanePass(outputs.laneA, turnRight ? "pass-one" : "pass-three");
  setLanePass(outputs.laneB, "pass-two");
  setLanePass(outputs.laneC, turnRight ? "pass-three" : "pass-one");
  outputs.fieldGapLeft.textContent = turnRight ? measured12Text : measured23Text;
  outputs.fieldGapRight.textContent = turnRight ? measured23Text : measured12Text;
  outputs.turnCurve.setAttribute("d", turnRight
    ? "M 160 102 C 210 72 300 72 342 102"
    : "M 560 102 C 510 72 420 72 378 102");
  outputs.machineImage.setAttribute("x", turnRight ? "78" : "526");

  persistState();
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.history)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  const now = new Date();
  const date = now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const suggestedName = `Ajuste ${date.replace(",", "")}`;
  const typedName = window.prompt("Nome do Registro", suggestedName);

  if (typedName === null) return;

  const item = {
    id: Date.now(),
    name: typedName.trim() || suggestedName,
    date,
    values: { ...state },
    result: { ...latest }
  };
  const next = [item, ...loadHistory()].slice(0, 12);
  localStorage.setItem(storageKeys.history, JSON.stringify(next));
  renderHistory();
}

function renderHistory() {
  const history = loadHistory();
  const validIds = new Set(history.map((item) => String(item.id)));
  selectedHistoryIds = new Set([...selectedHistoryIds].filter((id) => validIds.has(id)));
  outputs.exportWord.disabled = !history.length;

  if (!history.length) {
    outputs.history.innerHTML = '<div class="history-empty">Nenhum Cálculo Salvo</div>';
    return;
  }

  outputs.history.innerHTML = history.map((item) => {
    const itemId = String(item.id);
    const selected = selectedHistoryIds.has(itemId);

    return `
    <div class="history-item ${selected ? "selected" : ""}" data-history-id="${itemId}">
      <label class="history-select">
        <input type="checkbox" data-export-id="${itemId}" ${selected ? "checked" : ""}>
        <span>Selecionar</span>
      </label>
      <button class="history-open" type="button" data-restore-id="${itemId}">
        <span>
        <strong>${item.name || item.date}</strong>
        <span>${item.date} | ${item.values.rows || 0} Linhas | Virada ${item.values.turn === "right" ? "Direita" : "Esquerda"} | 1ª-2ª ${formatMeters(item.values.measured12, 2)}</span>
      </span>
      <span>
        <strong>${formatMeters(item.result.correctedWidth, 3)}</strong>
        <span>${formatSignedMeters(item.result.correctedOffset)}</span>
      </span>
      </button>
    </div>`;
  }).join("");
}

function restoreHistory(id) {
  const item = loadHistory().find((entry) => String(entry.id) === String(id));
  if (!item) return;
  state = { ...defaults, ...item.values };
  syncInputs();
  render();
  showView("calculator");
}

function startNewCalculation() {
  const confirmed = window.confirm("Iniciar a Primeira Passada? Todos os dados preenchidos serão perdidos.");
  if (!confirmed) return;

  state = { ...defaults };
  syncInputs();
  render();
  showView("calculator");
}

function startSecondStage() {
  const error = validate(state);
  if (error) {
    render();
    return;
  }

  const confirmed = window.confirm("Os valores corrigidos da 1ª passada serão aplicados como valores iniciais da 2ª passada.");
  if (!confirmed) return;

  latest = calculate(state);
  const rows = Math.max(0, Math.round(state.rows || 0));
  const correctedWidth = roundTo(latest.correctedWidth, 3);
  const firstPass = firstPassInfo(state, latest);
  const referenceSpacing = Math.max(0, firstPass.spacing || state.spacing || 0);

  state = {
    ...state,
    spacing: referenceSpacing,
    rows,
    implementWidthOverride: Math.max(0, correctedWidth || 0),
    firstPassRows: firstPass.rows,
    firstPassSpacing: firstPass.spacing,
    firstPassWidth: roundTo(firstPass.width, 2),
    initialOffset: latest.correctedOffset || 0,
    measured12: 0,
    measured23: 0
  };

  syncInputs();
  render();
  showView("calculator");
}

function resultText() {
  return [
    "Ajuste de Espaçamento Entre-Passadas",
    `Espaçamento Entre Linhas da Plantadeira: ${formatMeters(state.spacing, 2)}`,
    `Quantidade de Linhas: ${state.rows}`,
    `Largura do Implemento Calculada: ${formatMeters(latest.implementWidth, 2)}`,
    `Deslocamento Lateral do Implemento: ${formatSignedMeters(state.initialOffset)}`,
    `Virada Entre a 1ª e a 2ª Passada: ${state.turn === "right" ? "Direita" : "Esquerda"}`,
    `Espaçamento Medido Entre a 1ª e a 2ª Passada: ${formatMeters(state.measured12, 2)}`,
    `Espaçamento Medido Entre a 2ª e a 3ª Passada: ${formatMeters(state.measured23, 2)}`,
    `2Âª Passada - Largura Final Corrigida: ${formatMeters(latest.correctedWidth, 3)}`,
    `Deslocamento Lateral Corrigido: ${formatSignedMeters(latest.correctedOffset)}`
  ].join("\n");
}

function wordParagraph(text, options = {}) {
  const size = options.size || 22;
  const bold = options.bold ? "<w:b/>" : "";
  const spacing = options.after ? `<w:spacing w:after="${options.after}"/>` : "";
  return `<w:p><w:pPr>${spacing}</w:pPr><w:r><w:rPr>${bold}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wordTableRow(label, value) {
  return `
    <w:tr>
      <w:tc><w:tcPr><w:tcW w:w="4300" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(label)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="4300" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p></w:tc>
    </w:tr>`;
}

function wordTable(rows) {
  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="8600" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="BEBEBE"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="BEBEBE"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="BEBEBE"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="BEBEBE"/>
          <w:insideH w:val="single" w:sz="6" w:space="0" w:color="D9D9D9"/>
          <w:insideV w:val="single" w:sz="6" w:space="0" w:color="D9D9D9"/>
        </w:tblBorders>
      </w:tblPr>
      ${rows.map(([label, value]) => wordTableRow(label, value)).join("")}
    </w:tbl>`;
}

function historyRows(item) {
  const values = { ...defaults, ...(item.values || {}) };
  const calculated = calculate(values);
  const result = { ...calculated, ...(item.result || {}) };

  return [
    ["Nome do Registro", item.name || item.date || "Registro"],
    ["Data", item.date || ""],
    ["Espaçamento Entre Linhas da Plantadeira", formatMeters(values.spacing, 2)],
    ["Quantidade de Linhas", String(values.rows || 0)],
    ["Largura do Implemento Calculada", formatMeters(result.implementWidth, 2)],
    ["Deslocamento Lateral do Implemento", formatSignedMeters(values.initialOffset)],
    ["Virada Entre a 1ª e a 2ª Passada", values.turn === "right" ? "Direita" : "Esquerda"],
    ["Espaçamento Medido Entre a 1ª e a 2ª Passada", formatMeters(values.measured12, 2)],
    ["Espaçamento Medido Entre a 2ª e a 3ª Passada", formatMeters(values.measured23, 2)],
    ["Largura do Implemento Corrigido", formatMeters(result.correctedWidth, 3)],
    ["Deslocamento Lateral Corrigido", formatSignedMeters(result.correctedOffset)]
  ];
}

function buildWordDocumentXml(history) {
  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const records = history.map((item, index) => (
    wordParagraph(`${index + 1}. ${item.name || item.date || "Registro"}`, { bold: true, size: 26, after: 120 })
    + wordTable(historyRows(item))
    + wordParagraph("", { after: 220 })
  )).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${wordParagraph("Histórico de Ajuste Entre Passadas", { bold: true, size: 34, after: 180 })}
    ${wordParagraph(`Gerado em ${generatedAt}`, { size: 20, after: 260 })}
    ${records}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function reportRecordTitle(item, index) {
  if (index === 0) return "1ª Passada - Valores Originais";
  if (index === 1) return "2ª Passada - Ajuste Final";
  return `${index + 1}ª Passada - ${item.name || "Registro"}`;
}

function historySnapshot(item) {
  const values = { ...defaults, ...(item.values || {}) };
  const calculated = calculate(values);
  const result = { ...calculated, ...(item.result || {}) };
  return { values, result };
}

function wordRun(text, options = {}) {
  const bold = options.bold ? "<w:b/>" : "";
  const color = options.color ? `<w:color w:val="${options.color}"/>` : "";
  const size = options.size || 22;
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bold}${color}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function wordParagraph(text, options = {}) {
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : "";
  const before = options.before ? ` w:before="${options.before}"` : "";
  const after = options.after !== undefined ? ` w:after="${options.after}"` : ' w:after="80"';
  const spacing = `<w:spacing${before}${after}/>`;
  return `<w:p><w:pPr>${spacing}${align}</w:pPr>${wordRun(text, options)}</w:p>`;
}

function wordLogoDrawing(hasLogo) {
  if (!hasLogo) {
    return wordParagraph("AGRES", { bold: true, size: 36, color: "6B6B6B", after: 0, align: "center" });
  }

  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="1480000" cy="420000"/>
      <wp:docPr id="1" name="Logo Agres"/>
      <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic>
            <pic:nvPicPr><pic:cNvPr id="0" name="agres-report-logo.jpg"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
            <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1480000" cy="420000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing></w:r></w:p>`;
}

function wordBorders(color = "B7B7B7", size = 6) {
  return `<w:tcBorders><w:top w:val="single" w:sz="${size}" w:space="0" w:color="${color}"/><w:left w:val="single" w:sz="${size}" w:space="0" w:color="${color}"/><w:bottom w:val="single" w:sz="${size}" w:space="0" w:color="${color}"/><w:right w:val="single" w:sz="${size}" w:space="0" w:color="${color}"/></w:tcBorders>`;
}

function wordCell(content, options = {}) {
  const width = options.width ? `<w:tcW w:w="${options.width}" w:type="dxa"/>` : "";
  const shading = options.shading ? `<w:shd w:fill="${options.shading}"/>` : "";
  const gridSpan = options.gridSpan ? `<w:gridSpan w:val="${options.gridSpan}"/>` : "";
  const vertical = options.vertical ? `<w:vAlign w:val="${options.vertical}"/>` : "";
  const borders = options.noBorders ? "" : wordBorders(options.borderColor || "B7B7B7", options.borderSize || 6);
  return `<w:tc><w:tcPr>${width}${gridSpan}${shading}${vertical}${borders}</w:tcPr>${content}</w:tc>`;
}

function wordHeaderTable(generatedAt, recordCount, hasLogo) {
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="777777"/><w:left w:val="single" w:sz="8" w:space="0" w:color="777777"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="777777"/><w:right w:val="single" w:sz="8" w:space="0" w:color="777777"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="B7B7B7"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="B7B7B7"/></w:tblBorders></w:tblPr>
    <w:tr>
      ${wordCell(wordLogoDrawing(hasLogo), { width: 2600, vertical: "center", shading: "F2F2F2" })}
      ${wordCell(
        wordParagraph("RELATÓRIO TÉCNICO", { bold: true, size: 24, color: "5F6368", after: 80, align: "center" })
        + wordParagraph("Configuração de Espaçamento Entre-Passadas da Plantadeira", { bold: true, size: 28, color: "2F3033", after: 60, align: "center" })
        + wordParagraph("Comparativo da 1ª Passada e do Ajuste Final", { size: 20, color: "5F6368", after: 0, align: "center" }),
        { width: 6760, vertical: "center" }
      )}
    </w:tr>
    <w:tr>
      ${wordCell(wordParagraph("Data de Exportação", { bold: true, size: 18, color: "5F6368", after: 0 }), { width: 2600, shading: "EDEDED" })}
      ${wordCell(wordParagraph(generatedAt, { size: 18, after: 0 }), { width: 6760 })}
    </w:tr>
    <w:tr>
      ${wordCell(wordParagraph("Registros Selecionados", { bold: true, size: 18, color: "5F6368", after: 0 }), { width: 2600, shading: "EDEDED" })}
      ${wordCell(wordParagraph(String(recordCount), { size: 18, after: 0 }), { width: 6760 })}
    </w:tr>
  </w:tbl>`;
}

function wordTableRow(label, value) {
  return `<w:tr>
    ${wordCell(wordParagraph(label, { bold: true, size: 20, color: "666666", after: 0 }), { width: 4300, shading: "F0F0F0" })}
    ${wordCell(wordParagraph(value, { size: 20, color: "2F3033", after: 0 }), { width: 5060 })}
  </w:tr>`;
}

function wordTable(rows) {
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="B7B7B7"/><w:left w:val="single" w:sz="6" w:space="0" w:color="B7B7B7"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="B7B7B7"/><w:right w:val="single" w:sz="6" w:space="0" w:color="B7B7B7"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="D7D7D7"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="D7D7D7"/></w:tblBorders></w:tblPr>
    ${rows.map(([label, value]) => wordTableRow(label, value)).join("")}
  </w:tbl>`;
}

function comparisonRows(history) {
  if (history.length < 2) return [];

  const first = historySnapshot(history[0]);
  const second = historySnapshot(history[1]);

  return [
    ["1ª Passada - Largura Original", formatMeters(first.result.implementWidth, 2)],
    ["1ª Passada - Deslocamento Original", formatSignedMeters(first.values.initialOffset)],
    ["Ajuste Encontrado na 1ª Passada", `${formatMeters(first.result.correctedWidth, 3)} / ${formatSignedMeters(first.result.correctedOffset)}`],
    ["2ª Passada - Largura Aplicada", formatMeters(second.result.implementWidth, 2)],
    ["2ª Passada - Deslocamento Aplicado", formatSignedMeters(second.values.initialOffset)],
    ["Resultado Final da 2ª Passada", `${formatMeters(second.result.correctedWidth, 3)} / ${formatSignedMeters(second.result.correctedOffset)}`]
  ];
}

function buildWordDocumentXml(history, hasLogo = false) {
  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const summaryRows = comparisonRows(history);
  const summary = summaryRows.length
    ? wordParagraph("Resumo Comparativo", { bold: true, size: 26, color: "2F3033", before: 260, after: 100 })
      + wordTable(summaryRows)
    : "";
  const records = history.map((item, index) => (
    wordParagraph(reportRecordTitle(item, index), { bold: true, size: 26, color: "2F3033", before: 260, after: 100 })
    + wordTable(historyRows(item))
  )).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${wordHeaderTable(generatedAt, history.length, hasLogo)}
    ${summary}
    ${records}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function reportCellText(text, options = {}) {
  return wordCell(
    wordParagraph(text, {
      bold: options.bold,
      size: options.size || 20,
      color: options.color || "595959",
      align: options.align,
      after: 0
    }),
    {
      width: options.width,
      shading: options.shading,
      gridSpan: options.gridSpan,
      vertical: "center",
      borderColor: options.borderColor || "BFBFBF"
    }
  );
}

function reportCompanyHeader(hasLogo) {
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="9360" w:type="dxa"/></w:tblPr>
    <w:tr>
      ${wordCell(wordLogoDrawing(hasLogo), { width: 3600, noBorders: true, vertical: "center" })}
      ${wordCell(
        wordParagraph("Agres Sistemas Eletrônicos S.A", { bold: true, size: 20, color: "595959", align: "right", after: 0 })
        + wordParagraph("Av. Com. Franco, 6720", { size: 18, color: "595959", align: "right", after: 0 })
        + wordParagraph("Uberaba, Curitiba - PR", { size: 18, color: "595959", align: "right", after: 0 }),
        { width: 5760, noBorders: true, vertical: "center" }
      )}
    </w:tr>
  </w:tbl>`;
}

function reportTitleBlock(generatedAt) {
  return [
    wordParagraph("Configuração de Espaçamento Entre-Passadas da Plantadeira", {
      bold: true,
      size: 26,
      color: "595959",
      align: "center",
      before: 220,
      after: 0
    }),
    wordParagraph("Relatório Técnico de Ajuste", {
      bold: true,
      size: 22,
      color: "595959",
      align: "center",
      after: 180
    }),
    reportPairTable("IDENTIFICAÇÃO DO RELATÓRIO", [
      ["Documento", "Ajuste de Espaçamento Entre-Passadas"],
      ["Data de Exportação", generatedAt],
      ["Versão do Cálculo", calculationVersion],
      ["Padrão", "Agres Sistemas Eletrônicos S.A"]
    ])
  ].join("");
}

function reportPairTable(title, rows) {
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:left w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:right w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="D9D9D9"/></w:tblBorders></w:tblPr>
    <w:tr>${reportCellText(title, { bold: true, size: 20, align: "center", shading: "D9D9D9", gridSpan: 2, width: 9360 })}</w:tr>
    ${rows.map(([label, value]) => `<w:tr>
      ${reportCellText(label, { bold: true, width: 3600, shading: "F2F2F2" })}
      ${reportCellText(value, { width: 5760 })}
    </w:tr>`).join("")}
  </w:tbl>`;
}

function reportSummaryTable(rows) {
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:left w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:right w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="D9D9D9"/></w:tblBorders></w:tblPr>
    <w:tr>${reportCellText("RESUMO DO AJUSTE", { bold: true, size: 20, align: "center", shading: "D9D9D9", gridSpan: 4, width: 9360 })}</w:tr>
    <w:tr>
      ${reportCellText("ETAPA", { bold: true, align: "center", shading: "D9D9D9", width: 2340 })}
      ${reportCellText("LARGURA", { bold: true, align: "center", shading: "D9D9D9", width: 2340 })}
      ${reportCellText("DESLOCAMENTO", { bold: true, align: "center", shading: "D9D9D9", width: 2340 })}
      ${reportCellText("OBSERVAÇÃO", { bold: true, align: "center", shading: "D9D9D9", width: 2340 })}
    </w:tr>
    ${rows.map((row) => `<w:tr>${row.map((cell) => reportCellText(cell, { align: "center", width: 2340 })).join("")}</w:tr>`).join("")}
  </w:tbl>`;
}

function reportTerminalHighlight(item) {
  const { result } = historySnapshot(item);

  return `<w:tbl>
    <w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="10" w:space="0" w:color="595959"/><w:left w:val="single" w:sz="10" w:space="0" w:color="595959"/><w:bottom w:val="single" w:sz="10" w:space="0" w:color="595959"/><w:right w:val="single" w:sz="10" w:space="0" w:color="595959"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="BFBFBF"/></w:tblBorders></w:tblPr>
    <w:tr>${reportCellText("PREENCHER NO TERMINAL", { bold: true, size: 22, align: "center", color: "FFFFFF", shading: "595959", gridSpan: 2, width: 9360 })}</w:tr>
    <w:tr>
      ${reportCellText("Largura do Implemento Corrigida", { bold: true, size: 22, width: 4680, shading: "F2F2F2" })}
      ${reportCellText(formatMeters(result.correctedWidth, 3), { bold: true, size: 28, align: "center", width: 4680 })}
    </w:tr>
    <w:tr>
      ${reportCellText("Deslocamento Lateral Corrigido", { bold: true, size: 22, width: 4680, shading: "F2F2F2" })}
      ${reportCellText(formatSignedMeters(result.correctedOffset), { bold: true, size: 28, align: "center", width: 4680 })}
    </w:tr>
  </w:tbl>`;
}

function firstPassFormulaText(info) {
  return `${Math.round(info.rows || 0)} linhas x ${formatMeters(info.spacing, 2)} = ${formatMeters(info.width, 2)}`;
}

function historyRows(item) {
  const values = { ...defaults, ...(item.values || {}) };
  const calculated = calculate(values);
  const result = { ...calculated, ...(item.result || {}) };
  const firstPass = firstPassInfo(values, calculated);

  return [
    ["Nome do Registro", item.name || item.date || "Registro"],
    ["Data", item.date || ""],
    ["1ª Passada - Largura Original", firstPassFormulaText(firstPass)],
    ["Espaçamento Entre Linhas da Plantadeira", formatMeters(values.spacing, 2)],
    ["Quantidade de Linhas", String(values.rows || 0)],
    ["Largura Aplicada Nesta Passada", formatMeters(result.implementWidth, 2)],
    ["Deslocamento Lateral do Implemento", formatSignedMeters(values.initialOffset)],
    ["Virada Entre a 1ª e a 2ª Passada", values.turn === "right" ? "Direita" : "Esquerda"],
    ["Espaçamento Medido Entre a 1ª e a 2ª Passada", formatMeters(values.measured12, 2)],
    ["Espaçamento Medido Entre a 2ª e a 3ª Passada", formatMeters(values.measured23, 2)],
    ["2ª Passada - Largura Final Corrigida", formatMeters(result.correctedWidth, 3)],
    ["Deslocamento Lateral Corrigido", formatSignedMeters(result.correctedOffset)]
  ];
}

function comparisonRows(history) {
  if (history.length < 2) return [];

  const first = historySnapshot(history[0]);
  const second = historySnapshot(history[1]);
  const firstPass = firstPassInfo(first.values, first.result);

  return [
    ["1ª Passada", formatMeters(firstPass.width, 2), formatSignedMeters(first.values.initialOffset), firstPassFormulaText(firstPass)],
    ["Correção Calculada", formatMeters(first.result.correctedWidth, 3), formatSignedMeters(first.result.correctedOffset), "Valores transferidos para a 2ª passada"],
    ["2ª Passada", formatMeters(second.result.implementWidth, 3), formatSignedMeters(second.values.initialOffset), "Valores aplicados no terminal"],
    ["Resultado Final", formatMeters(second.result.correctedWidth, 3), formatSignedMeters(second.result.correctedOffset), "Ajuste final corrigido"]
  ];
}

function reportSpacer(size = 320) {
  return wordParagraph("", { after: size });
}

function reportSectionHeading(text) {
  return wordParagraph(text, {
    bold: true,
    size: 24,
    color: "595959",
    align: "center",
    before: 160,
    after: 120
  });
}

function firstPassOriginalRows(item) {
  const { values, result } = historySnapshot(item);
  const original = firstPassInfo(values, result);

  return [
    ["Registro", item.name || item.date || "1ª Passada"],
    ["Data", item.date || ""],
    ["Espaçamento Entre Linhas", formatMeters(original.spacing, 2)],
    ["Quantidade de Linhas", String(Math.round(original.rows || 0))],
    ["Largura Original da Plantadeira", firstPassFormulaText(original)],
    ["Deslocamento Lateral Original", formatSignedMeters(values.initialOffset)]
  ];
}

function firstPassMeasurementRows(item) {
  const { values, result } = historySnapshot(item);

  return [
    ["Virada Entre a 1ª e a 2ª Passada", values.turn === "right" ? "Direita" : "Esquerda"],
    ["Medição Entre 1ª e 2ª Passada", formatMeters(values.measured12, 2)],
    ["Medição Entre 2ª e 3ª Passada", formatMeters(values.measured23, 2)],
    ["Largura Calculada Para Aplicar na 2ª Passada", formatMeters(result.correctedWidth, 3)],
    ["Deslocamento Calculado Para Aplicar na 2ª Passada", formatSignedMeters(result.correctedOffset)]
  ];
}

function secondPassAppliedRows(item) {
  const { values, result } = historySnapshot(item);

  return [
    ["Registro", item.name || item.date || "2ª Passada"],
    ["Data", item.date || ""],
    ["Largura Final Aplicada no Terminal", formatMeters(result.implementWidth, 3)],
    ["Deslocamento Final Aplicado no Terminal", formatSignedMeters(values.initialOffset)],
    ["Espaçamento Entre Linhas Resultante", formatMeters(values.spacing, 2)],
    ["Quantidade de Linhas", String(values.rows || 0)]
  ];
}

function secondPassCheckRows(item) {
  const { values, result } = historySnapshot(item);

  return [
    ["Virada Entre a 1ª e a 2ª Passada", values.turn === "right" ? "Direita" : "Esquerda"],
    ["Medição Entre 1ª e 2ª Passada", formatMeters(values.measured12, 2)],
    ["Medição Entre 2ª e 3ª Passada", formatMeters(values.measured23, 2)],
    ["Largura Conferida Após a 2ª Passada", formatMeters(result.correctedWidth, 3)],
    ["Deslocamento Conferido Após a 2ª Passada", formatSignedMeters(result.correctedOffset)]
  ];
}

function finalResultRows(firstItem, secondItem) {
  const first = historySnapshot(firstItem);
  const second = historySnapshot(secondItem);
  const original = firstPassInfo(first.values, first.result);

  return [
    ["Largura Original da 1ª Passada", firstPassFormulaText(original)],
    ["Correção Calculada Após a 1ª Passada", `${formatMeters(first.result.correctedWidth, 3)} / ${formatSignedMeters(first.result.correctedOffset)}`],
    ["Valores Aplicados na 2ª Passada", `${formatMeters(second.result.implementWidth, 3)} / ${formatSignedMeters(second.values.initialOffset)}`],
    ["Resultado Final Corrigido", `${formatMeters(second.result.correctedWidth, 3)} / ${formatSignedMeters(second.result.correctedOffset)}`]
  ];
}

function buildWordDocumentXml(history, hasLogo = false) {
  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const hasTwoPasses = history.length >= 2;
  const records = hasTwoPasses
    ? [
      reportSectionHeading("1ª PASSADA"),
      reportPairTable("VALORES ORIGINAIS", firstPassOriginalRows(history[0])),
      reportSpacer(180),
      reportPairTable("MEDIÇÕES DA 1ª PASSADA", firstPassMeasurementRows(history[0])),
      reportSpacer(220),
      reportTerminalHighlight(history[0]),
      reportSpacer(520),
      reportSectionHeading("2ª PASSADA"),
      reportPairTable("VALORES FINAIS APLICADOS", secondPassAppliedRows(history[1])),
      reportSpacer(180),
      reportPairTable("CONFERÊNCIA DA 2ª PASSADA", secondPassCheckRows(history[1])),
      reportSpacer(180),
      reportPairTable("RESULTADO FINAL DO AJUSTE", finalResultRows(history[0], history[1])),
      ...history.slice(2).map((item, index) => reportPairTable(`${index + 3}ª PASSADA - REGISTRO COMPLEMENTAR`, historyRows(item)))
    ].join("")
    : history.map((item, index) => (
      wordParagraph("", { after: 180 })
      + reportPairTable(reportRecordTitle(item, index).toUpperCase(), historyRows(item))
      + (index === 0 ? reportSpacer(220) + reportTerminalHighlight(item) : "")
    )).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${reportCompanyHeader(hasLogo)}
    ${reportTitleBlock(generatedAt)}
    ${records}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function zipDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function write32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function createZip(files) {
  const now = zipDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = textEncoder.encode(file.name);
    const data = file.content instanceof Uint8Array
      ? file.content
      : file.content instanceof ArrayBuffer
        ? new Uint8Array(file.content)
        : textEncoder.encode(file.content);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    write32(local, 0, 0x04034b50);
    write16(local, 4, 20);
    write16(local, 6, 0);
    write16(local, 8, 0);
    write16(local, 10, now.time);
    write16(local, 12, now.date);
    write32(local, 14, crc);
    write32(local, 18, data.length);
    write32(local, 22, data.length);
    write16(local, 26, nameBytes.length);
    write16(local, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    write32(central, 0, 0x02014b50);
    write16(central, 4, 20);
    write16(central, 6, 20);
    write16(central, 8, 0);
    write16(central, 10, 0);
    write16(central, 12, now.time);
    write16(central, 14, now.date);
    write32(central, 16, crc);
    write32(central, 20, data.length);
    write32(central, 24, data.length);
    write16(central, 28, nameBytes.length);
    write16(central, 30, 0);
    write16(central, 32, 0);
    write16(central, 34, 0);
    write16(central, 36, 0);
    write32(central, 38, 0);
    write32(central, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  });

  const centralStart = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  write32(end, 0, 0x06054b50);
  write16(end, 4, 0);
  write16(end, 6, 0);
  write16(end, 8, files.length);
  write16(end, 10, files.length);
  write32(end, 12, centralSize);
  write32(end, 16, centralStart);
  write16(end, 20, 0);

  return new Blob([...localParts, ...centralParts, end], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

function createHistoryDocx(history, logoBytes = null) {
  const hasLogo = logoBytes instanceof Uint8Array && logoBytes.length > 0;
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    {
      name: "word/_rels/document.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${hasLogo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/agres-report-logo.jpg"/>' : ""}
</Relationships>`
    },
    {
      name: "word/document.xml",
      content: buildWordDocumentXml(history, hasLogo)
    }
  ];

  if (hasLogo) {
    files.push({
      name: "word/media/agres-report-logo.jpg",
      content: logoBytes
    });
  }

  return createZip(files);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function isCapacitorNative() {
  const capacitor = window.Capacitor;
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function") return capacitor.isNativePlatform();
  if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform() !== "web";
  return false;
}

async function saveBlobWithCapacitor(blob, fileName) {
  const capacitor = window.Capacitor;
  const plugins = capacitor && capacitor.Plugins ? capacitor.Plugins : {};
  const Filesystem = plugins.Filesystem;
  const Share = plugins.Share;

  if (!isCapacitorNative() || !Filesystem || typeof Filesystem.writeFile !== "function") {
    return false;
  }

  try {
    const data = await blobToBase64(blob);
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data,
      directory: "CACHE",
      recursive: true
    });

    if (Share && typeof Share.share === "function") {
      await Share.share({
        title: fileName,
        text: "Relatório de ajuste entre-passadas.",
        url: savedFile.uri,
        dialogTitle: "Exportar relatório"
      });
    }

    showToast("Relatório exportado com sucesso.");
    return true;
  } catch (error) {
    console.warn("Falha ao exportar pelo aplicativo Android.", error);
    return false;
  }
}

async function downloadBlob(blob, fileName) {
  if (await saveBlobWithCapacitor(blob, fileName)) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Relatório exportado com sucesso.");
}

async function loadReportLogo() {
  try {
    const response = await fetch("./assets/agres-report-logo.jpg");
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function exportHistoryWord() {
  const history = loadHistory();
  if (!history.length) return;
  const selectedHistory = history
    .filter((item) => selectedHistoryIds.has(String(item.id)))
    .sort((first, second) => Number(first.id) - Number(second.id));

  if (!selectedHistory.length) {
    window.alert("Selecione pelo menos um registro do histórico para exportar em Word.");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const baseName = selectedHistory.length === 1
    ? selectedHistory[0].name || `historico-ajuste-entre-passadas-${date}`
    : `relatorio-ajuste-entre-passadas-${date}`;
  const logoBytes = await loadReportLogo();
  const blob = createHistoryDocx(selectedHistory, logoBytes);
  await downloadBlob(blob, `${safeFileName(baseName)}.docx`);
}

async function copyResult() {
  const text = resultText();

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  showToast("Arquivo copiado com sucesso.");
}

function showView(name) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  document.querySelector("#calculatorView").classList.toggle("active", name === "calculator");
  document.querySelector("#historyView").classList.toggle("active", name === "history");
}

function updateConnectionStatus() {
  outputs.status.textContent = navigator.onLine ? "Online" : "Offline Pronto";
}

Object.entries(fields).forEach(([key, input]) => {
  input.setAttribute("enterkeyhint", "done");

  input.addEventListener("focus", () => {
    input.dataset.dirty = "false";
    setTimeout(() => input.select(), 0);
  });
  input.addEventListener("click", () => {
    input.select();
  });
  input.addEventListener("input", () => {
    input.dataset.dirty = "true";
    readInput(key);
    render();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "NumpadEnter") {
      event.preventDefault();
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    if (input.dataset.dirty === "true") readInput(key);
    normalizeField(key);
    syncInputs();
    render();
  });
});

document.querySelectorAll("[data-turn]").forEach((button) => {
  button.addEventListener("click", () => {
    state.turn = button.dataset.turn === "right" ? "right" : "left";
    syncInputs();
    render();
  });
});

document.querySelector("#newButton").addEventListener("click", startNewCalculation);
document.querySelector("#secondStageButton").addEventListener("click", startSecondStage);

document.querySelector("#saveButton").addEventListener("click", saveHistory);
document.querySelector("#copyButton").addEventListener("click", copyResult);
document.querySelector("#exportWordButton").addEventListener("click", exportHistoryWord);

document.querySelector("#clearHistoryButton").addEventListener("click", () => {
  localStorage.removeItem(storageKeys.history);
  renderHistory();
});

outputs.history.addEventListener("click", (event) => {
  const item = event.target.closest("[data-restore-id]");
  if (item) restoreHistory(item.dataset.restoreId);
});

outputs.history.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-export-id]");
  if (!checkbox) return;

  if (checkbox.checked) {
    selectedHistoryIds.add(String(checkbox.dataset.exportId));
  } else {
    selectedHistoryIds.delete(String(checkbox.dataset.exportId));
  }

  renderHistory();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

syncInputs();
render();
renderHistory();
updateConnectionStatus();
