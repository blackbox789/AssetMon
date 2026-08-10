
const nodes = {
  "internet":   { x: 460, y: 30,  type: "router",   name: "Internet", sub: "Upstream" },
  "fw-edge-02": { x: 460, y: 110, type: "firewall", name: "FW-EDGE-02", sub: "FortiGate 200F", ip: "10.10.0.254", model: "Fortinet FortiGate 200F", tags: ["production", "security"] },
  "sw-core-01": { x: 460, y: 190, type: "switch",   name: "SW-CORE-01", sub: "Catalyst 9300", ip: "10.10.0.1", model: "Cisco Catalyst 9300-48P", tags: ["production", "network-core"] },
  "sw-acc-03":  { x: 270, y: 280, type: "switch",   name: "SW-ACC-03", sub: "Catalyst 2960-X", ip: "10.10.0.23", model: "Cisco Catalyst 2960-X", tags: ["production", "network-access"] },
  "sw-acc-04":  { x: 650, y: 280, type: "switch",   name: "SW-ACC-04", sub: "Catalyst 2960-X", ip: "10.10.0.24", model: "Cisco Catalyst 2960-X", tags: ["production", "network-access"] },
  "srv-app-04": { x: 130, y: 390, type: "server",   name: "SRV-APP-04", sub: "R750", ip: "10.10.4.14", model: "Dell PowerEdge R750", tags: ["production", "application"] },
  "srv-db-17":  { x: 270, y: 390, type: "server",   name: "SRV-DB-17", sub: "R750", ip: "10.10.4.17", model: "Dell PowerEdge R750", tags: ["production", "database"] },
  "srv-web-02": { x: 410, y: 390, type: "server",   name: "SRV-WEB-02", sub: "DL380", ip: "10.10.4.22", model: "HPE ProLiant DL380", tags: ["development", "web"] },
  "srv-bkp-01": { x: 560, y: 390, type: "server",   name: "SRV-BKP-01", sub: "R750xd", ip: "10.10.4.31", model: "Dell PowerEdge R750xd", tags: ["production", "backup"] },
  "pdu-a":      { x: 700, y: 390, type: "pdu",      name: "PDU-A", sub: "AP8941", ip: "10.10.9.1", model: "APC AP8941", tags: ["production", "power"] },
  "pdu-b":      { x: 800, y: 390, type: "pdu",      name: "PDU-B", sub: "AP8941", ip: "10.10.9.2", model: "APC AP8941", tags: ["production", "power"] },
};
const edges = [
  ["internet","fw-edge-02"], ["fw-edge-02","sw-core-01"],
  ["sw-core-01","sw-acc-03"], ["sw-core-01","sw-acc-04"],
  ["sw-acc-03","srv-app-04"], ["sw-acc-03","srv-db-17"], ["sw-acc-03","srv-web-02"],
  ["sw-acc-04","srv-bkp-01"], ["sw-acc-04","pdu-a"], ["sw-acc-04","pdu-b"],
];
const typeColor = { server: "var(--accent)", switch: "var(--info)", pdu: "var(--violet)", firewall: "var(--warning)", router: "var(--text-muted)" };
const typeMeta = {
  server:   { label: "Server",   badgeBg: "var(--accent-dim)",   badgeColor: "var(--accent-text)" },
  switch:   { label: "Network Switch",   badgeBg: "var(--info-dim)",     badgeColor: "var(--info)" },
  pdu:      { label: "Rack PDU",      badgeBg: "var(--violet-dim)",   badgeColor: "var(--violet)" },
  firewall: { label: "Firewall", badgeBg: "var(--warning-dim)",  badgeColor: "var(--warning)" },
  router:   { label: "Router / Internet", badgeBg: "var(--bg-surface-3)", badgeColor: "var(--text-secondary)" },
};
const svg = document.getElementById("topo-svg");
const svgNS = "http://www.w3.org/2000/svg";

function draw() {
  svg.innerHTML = "";
  edges.forEach(([a, b]) => {
    const na = nodes[a], nb = nodes[b];
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", na.x); line.setAttribute("y1", na.y + 16);
    line.setAttribute("x2", nb.x); line.setAttribute("y2", nb.y - 16);
    line.setAttribute("class", "edge");
    line.dataset.a = a; line.dataset.b = b;
    svg.appendChild(line);
  });
  Object.entries(nodes).forEach(([id, n]) => {
    const g = document.createElementNS(svgNS, "g");
    g.dataset.id = id;
    g.style.cursor = "pointer";
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", n.x); circle.setAttribute("cy", n.y);
    circle.setAttribute("r", n.type === "router" ? 15 : 16);
    circle.setAttribute("fill", typeColor[n.type]);
    circle.setAttribute("class", "node-circle");
    g.appendChild(circle);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", n.x); label.setAttribute("y", n.y + 30);
    label.setAttribute("class", "node-label"); label.textContent = n.name;
    g.appendChild(label);
    const sub = document.createElementNS(svgNS, "text");
    sub.setAttribute("x", n.x); sub.setAttribute("y", n.y + 42);
    sub.setAttribute("class", "node-sub"); sub.textContent = n.sub;
    g.appendChild(sub);
    g.addEventListener("click", () => selectNode(id));
    svg.appendChild(g);
  });
}

function selectNode(id) {
  document.querySelectorAll(".node-circle").forEach(c => c.classList.remove("selected"));
  svg.querySelector(`g[data-id="${id}"] .node-circle`).classList.add("selected");
  const n = nodes[id];
  const meta = typeMeta[n.type];
  const connections = edges.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));
  const panel = document.getElementById("detail-panel");
  if (n.type === "router") {
    panel.innerHTML = `<span class="detail-type-badge" style="background:${meta.badgeBg};color:${meta.badgeColor}">${meta.label}</span>
      <h2 class="detail-title">${n.name}</h2><p class="detail-sub">Titik masuk trafik eksternal</p>
      <div class="section-label">Terhubung ke</div><div class="conn-list">${connections.map(connRow).join("")}</div>`;
    return;
  }
  const hasPorts = PORT_DATA[n.name];
  const portmapBtn = hasPorts ? `<div class="portmap-btn"><button class="btn primary" onclick="openPortMap('${n.name}')"><i class="fa-solid fa-ethernet"></i>Lihat Port Map</button></div>` : "";
  const hasPower = typeof POWER_DATA !== "undefined" && POWER_DATA[n.name];
  const powermapBtn = hasPower ? `<div class="portmap-btn"><button class="btn primary" onclick="openPowerMap('${n.name}')"><i class="fa-solid fa-plug"></i>Lihat Power Map</button></div>` : "";
  const tagsHtml = (n.tags && n.tags.length) ? `<div class="tag-row">${n.tags.map(t => `<span class="tag-chip" style="background:color-mix(in srgb, ${tagColor(t)} 18%, transparent);color:${tagColor(t)}"><span class="tdot"></span>${t}</span>`).join("")}</div>` : "";
  panel.innerHTML = `<span class="detail-type-badge" style="background:${meta.badgeBg};color:${meta.badgeColor}">${meta.label}</span>
    <h2 class="detail-title">${n.name}</h2><p class="detail-sub">${n.model}</p>
    ${tagsHtml}
    <div class="field-grid"><div class="field-item"><div class="k">IP Address</div><div class="v">${n.ip}</div></div><div class="field-item"><div class="k">Model</div><div class="v" style="font-size:11.5px">${n.model}</div></div></div>
    <div class="section-label">Terhubung ke</div><div class="conn-list">${connections.map(connRow).join("")}</div>${portmapBtn}${powermapBtn}`;
}
function connRow(id) {
  const n = nodes[id];
  return `<div class="conn-item"><span class="dot" style="background:${typeColor[n.type]}"></span>${n.name}</div>`;
}
function findPath(fromId, toId) {
  const adj = {};
  edges.forEach(([a, b]) => { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); });
  const queue = [[fromId]]; const visited = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift(); const last = path[path.length - 1];
    if (last === toId) return path;
    (adj[last] || []).forEach(next => { if (!visited.has(next)) { visited.add(next); queue.push([...path, next]); } });
  }
  return null;
}
document.getElementById("trace-btn").addEventListener("click", () => {
  const from = document.getElementById("trace-from").value;
  const to = document.getElementById("trace-to").value;
  const path = findPath(from, to);
  document.querySelectorAll(".edge").forEach(e => e.classList.remove("traced"));
  if (!path) return;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const edge = svg.querySelector(`.edge[data-a="${a}"][data-b="${b}"], .edge[data-a="${b}"][data-b="${a}"]`);
    if (edge) edge.classList.add("traced");
  }
  document.getElementById("detail-panel").innerHTML = `
    <span class="detail-type-badge" style="background:var(--accent-dim);color:var(--accent-text)">Path Trace</span>
    <h2 class="detail-title" style="font-size:15px">${path.map(p => nodes[p].name).join(" → ")}</h2>
    <p class="detail-sub">${path.length - 1} hop, melewati ${path.filter(p => nodes[p].type === "firewall").length} firewall</p>
    <div class="section-label">Urutan Hop</div><div class="conn-list">${path.map(connRow).join("")}</div>`;
});
document.getElementById("clear-trace-btn").addEventListener("click", () => {
  document.querySelectorAll(".edge").forEach(e => e.classList.remove("traced"));
  document.querySelectorAll(".node-circle").forEach(c => c.classList.remove("selected"));
  document.getElementById("detail-panel").innerHTML = `<div class="detail-empty">Klik salah satu node pada topologi untuk melihat detail koneksi.</div>`;
});
draw();
    

