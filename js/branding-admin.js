
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
});
    

