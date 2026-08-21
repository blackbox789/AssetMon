
// ---- Lapisan API ke backend Express + SQLite (server.js) ----
// Dipakai oleh rack-data.js dan server-data.js.
// Jika backend tidak tersedia (mis. dibuka langsung via file://),
// otomatis fallback ke localStorage sehingga demo tetap berjalan.

const API_BASE = (function () {
  try {
    if (location.protocol === "file:") return "http://localhost:3000/api";
  } catch (e) {}
  return "/api";
})();

function apiRequest(method, path, body) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open(method, API_BASE + path, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(body !== undefined ? JSON.stringify(body) : null);
    if (xhr.status < 200 || xhr.status >= 300) return null;
    return xhr.responseText ? JSON.parse(xhr.responseText) : null;
  } catch (e) {
    return null;
  }
}

function apiGetRacks() {
  const r = apiRequest("GET", "/racks");
  return Array.isArray(r) ? r : null;
}

function apiSaveRack(rack) {
  return apiRequest("POST", "/racks", rack);
}

function apiDeleteRack(rackId) {
  return apiRequest("DELETE", "/racks/" + encodeURIComponent(rackId));
}

function apiGetServers() {
  const r = apiRequest("GET", "/servers");
  return Array.isArray(r) ? r : null;
}

function apiSaveServer(server) {
  return apiRequest("POST", "/servers", server);
}

// ---- Master sites (site.id = masterKey; picklist OPS & referensi racks) ----
function apiGetSites() {
  const r = apiRequest("GET", "/sites");
  return Array.isArray(r) ? r : null;
}

function apiSaveSite(site) {
  return apiRequest("POST", "/sites", site);
}

// ---- Referensi data (lookups) ----
function apiGetRefs() {
  return apiRequest("GET", "/refs");
}

function apiSaveRefs(kind, items) {
  return apiRequest("POST", "/refs/" + encodeURIComponent(kind), items);
}

function apiGetMaps(kind) {
  const r = apiRequest("GET", "/maps/" + encodeURIComponent(kind));
  return Array.isArray(r) ? r : null;
}

function apiSaveMap(kind, deviceKey, data) {
  return apiRequest("POST", "/maps/" + encodeURIComponent(kind) + "/" + encodeURIComponent(deviceKey), { data });
}

function apiDeleteMap(kind, deviceKey) {
  return apiRequest("DELETE", "/maps/" + encodeURIComponent(kind) + "/" + encodeURIComponent(deviceKey));
}

// ---- Registri master perangkat (devices) ----
function apiGetDevices() {
  const r = apiRequest("GET", "/devices");
  return Array.isArray(r) ? r : null;
}

function apiSaveDevice(device) {
  return apiRequest("POST", "/devices", device);
}

function apiDeleteDevice(deviceKey) {
  return apiRequest("DELETE", "/devices/" + encodeURIComponent(deviceKey));
}

function apiRenameDevice(oldKey, newKey) {
  return apiRequest("PUT", "/devices/" + encodeURIComponent(oldKey) + "/rename", { to: newKey });
}

// ---- Bulk update lokasi device (site + rackId dari penempatan rack) ----
function apiSaveDeviceLocations(list) {
  return apiRequest("POST", "/devices/locations", list);
}
