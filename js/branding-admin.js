if (!authGuard()) {
  document.body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Akses ditolak. <a href="login.html">Login</a></div>';
} else {

function apiReq(method, path, body) {
  const token = localStorage.getItem("rv_auth_token");
  const xhr = new XMLHttpRequest();
  xhr.open(method, path, false);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
  xhr.send(body !== undefined ? JSON.stringify(body) : null);
  if (xhr.status < 200 || xhr.status >= 300) return null;
  return xhr.responseText ? JSON.parse(xhr.responseText) : null;
}

function setupUpload(inputId, boxId, previewId, logoKey, maxBytes) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  const preview = document.getElementById(previewId);
  if (!input || !box) return;
  box.addEventListener("click", () => input.click());
  box.addEventListener("dragover", e => { e.preventDefault(); box.style.borderColor = "var(--accent, #4f8cff)"; });
  box.addEventListener("dragleave", () => { box.style.borderColor = ""; });
  box.addEventListener("drop", e => {
    e.preventDefault();
    box.style.borderColor = "";
    const file = (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) || null;
    if (file) processFile(file);
  });
  input.addEventListener("change", () => {
    const file = (input.files && input.files[0]) || null;
    if (file) processFile(file);
  });
  function processFile(file) {
    if (!file.type.match(/^image\/(png|svg\+xml|jpeg|jpg)$/)) { alert("Format harus PNG/SVG/JPG."); return; }
    if (maxBytes && file.size > maxBytes) { alert("Ukuran file melebihi " + (maxBytes / 1024) + "KB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      const res = apiReq("POST", "/api/brand/logo?key=" + logoKey, { data: base64 });
      if (res && res.ok) {
        if (preview) preview.innerHTML = '<img src="' + res.url + '" style="max-width:100%;max-height:60px;object-fit:contain;">';
      } else {
        alert("Gagal upload logo: " + (res && res.error ? res.error : "unknown"));
      }
    };
    reader.readAsDataURL(file);
  }
  const brand = apiReq("GET", "/api/brand") || {};
  const url = brand[logoKey] || "";
  if (url && preview) preview.innerHTML = '<img src="' + url + '" style="max-width:100%;max-height:60px;object-fit:contain;">';
}

setupUpload("in-logo", "upload-logo-box", "logo-preview", "logo", 500 * 1024);
setupUpload("in-logo-small", "upload-logo-small-box", "logo-small-preview", "logo-small", 200 * 1024);

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add("active");
  });
});
document.querySelectorAll(".radio-group").forEach(group => {
  group.addEventListener("click", e => {
    const pill = e.target.closest(".radio-pill");
    if (!pill) return;
    group.querySelectorAll(".radio-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
  });
});
document.querySelectorAll(".toggle-switch").forEach(sw => {
  sw.addEventListener("click", () => sw.classList.toggle("on"));
});

const root = document.documentElement;
const pvLogin = document.getElementById("pv-login");
function setVar(name, value) { root.style.setProperty(name, value); }
function luminanceOf(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0,2),16)/255, g = parseInt(c.substr(2,2),16)/255, b = parseInt(c.substr(4,2),16)/255;
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
const primaryColor = document.getElementById("in-primary");
const primaryHex = document.getElementById("in-primary-hex");
const secondaryColor = document.getElementById("in-secondary");
const secondaryHex = document.getElementById("in-secondary-hex");
const contrastWarning = document.getElementById("contrast-warning");
function applyPrimary(hex) {
  setVar("--pv-primary", hex);
  pvLogin.querySelectorAll(".preview-cname").forEach(el => el.style.color = hex);
  contrastWarning.classList.toggle("show", luminanceOf(hex) < 0.35);
}
function applySecondary(hex) { setVar("--pv-secondary", hex); }
primaryColor.addEventListener("input", () => { primaryHex.value = primaryColor.value; applyPrimary(primaryColor.value); });
primaryHex.addEventListener("change", () => { primaryColor.value = primaryHex.value; applyPrimary(primaryHex.value); });
secondaryColor.addEventListener("input", () => { secondaryHex.value = secondaryColor.value; applySecondary(secondaryColor.value); });
secondaryHex.addEventListener("change", () => { secondaryColor.value = secondaryHex.value; applySecondary(secondaryHex.value); });
document.querySelectorAll("#primary-presets .swatch").forEach(sw => {
  sw.addEventListener("click", () => {
    const hex = sw.dataset.hex;
    primaryColor.value = hex; primaryHex.value = hex;
    applyPrimary(hex);
    document.querySelectorAll("#primary-presets .swatch").forEach(s => s.classList.remove("active-preset"));
    sw.classList.add("active-preset");
  });
});
document.getElementById("in-company-name").addEventListener("input", e => {
  document.getElementById("pv-cname").textContent = e.target.value || "Company Name";
  document.getElementById("pv-sb-name").textContent = e.target.value || "Company Name";
});
document.getElementById("in-tagline").addEventListener("input", e => {
  document.getElementById("pv-tag").textContent = e.target.value;
});

function loadBrand() {
  const brand = apiReq("GET", "/api/brand") || {};
  if (brand.companyName) {
    document.getElementById("in-company-name").value = brand.companyName;
    document.getElementById("pv-cname").textContent = brand.companyName;
    document.getElementById("pv-sb-name").textContent = brand.companyName;
  }
  if (brand.tagline) {
    document.getElementById("in-tagline").value = brand.tagline;
    document.getElementById("pv-tag").textContent = brand.tagline;
  }
}

function saveBrand() {
  const body = {
    companyName: document.getElementById("in-company-name").value,
    tagline: document.getElementById("in-tagline").value,
    footerText: document.getElementById("in-footer") ? document.getElementById("in-footer").value : "",
    supportUrl: document.getElementById("in-support") ? document.getElementById("in-support").value : "",
    privacyUrl: document.getElementById("in-privacy") ? document.getElementById("in-privacy").value : "",
    termsUrl: document.getElementById("in-terms") ? document.getElementById("in-terms").value : "",
  };
  const res = apiReq("POST", "/api/brand", body);
  if (res && res.ok) {
    alert("Branding berhasil disimpan.");
    location.reload();
  } else {
    alert("Gagal menyimpan branding.");
  }
}

loadBrand();
applyPrimary(primaryColor.value);
applySecondary(secondaryColor.value);
document.getElementById("reset-btn").addEventListener("click", () => {
  primaryColor.value = "#31D8A4"; primaryHex.value = "#31D8A4"; applyPrimary("#31D8A4");
  secondaryColor.value = "#4C8DFF"; secondaryHex.value = "#4C8DFF"; applySecondary("#4C8DFF");
  document.getElementById("in-company-name").value = "RackView";
  document.getElementById("in-tagline").value = "Datacenter Asset Management";
  document.getElementById("pv-cname").textContent = "RackView";
  document.getElementById("pv-sb-name").textContent = "RackView";
  document.getElementById("pv-tag").textContent = "Datacenter Asset Management";
  saveBrand();
});
const applyBtn = document.getElementById("apply-btn");
if (applyBtn) applyBtn.addEventListener("click", saveBrand);
}
