/* ============================================
   RackView — Brand configuration
   In production this object is fetched from
   the Branding Admin panel (Settings → Branding)
   and cached client-side. Hardcoded here since
   this is a static prototype.
   ============================================ */

const BRAND = {
  companyName: "RackView",
  tagline: "Datacenter Asset Management",
  logoSmallText: "RV",
  footerText: "© 2026 RackView. All rights reserved.",
  supportUrl: "#",
  privacyUrl: "#",
  termsUrl: "#",
  showPoweredBy: true,
};

function applyBrand() {
  document.querySelectorAll("[data-brand-name]").forEach(el => el.textContent = BRAND.companyName);
  document.querySelectorAll("[data-brand-tagline]").forEach(el => el.textContent = BRAND.tagline);
  document.querySelectorAll("[data-brand-logo-small]").forEach(el => {
    const url = BRAND.logoSmallUrl || "";
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.style.cssText = "width:100%;height:100%;object-fit:contain;";
      el.innerHTML = "";
      el.appendChild(img);
    } else {
      el.textContent = BRAND.logoSmallText;
    }
  });
  document.querySelectorAll("[data-brand-footer]").forEach(el => el.textContent = BRAND.footerText);
  document.querySelectorAll("[data-brand-support]").forEach(el => el.href = BRAND.supportUrl);
  document.querySelectorAll("[data-brand-privacy]").forEach(el => el.href = BRAND.privacyUrl);
  document.querySelectorAll("[data-brand-terms]").forEach(el => el.href = BRAND.termsUrl);
  document.querySelectorAll("[data-powered-by]").forEach(el => el.style.display = BRAND.showPoweredBy ? "" : "none");
  document.title = document.title.includes("|") ? document.title : `${document.title} | ${BRAND.companyName}`;
}

function loadBrand() {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/brand", false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText || "{}");
      Object.assign(BRAND, data);
      BRAND.logoUrl = data.logo || "";
      BRAND.logoSmallUrl = data.logoSmall || "";
    }
  } catch (e) { /* abaikan, pakai default */ }
}

/* ---------- Theme (in-memory only, no persistence in this prototype) ---------- */
let currentTheme = "dark";

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

document.addEventListener("DOMContentLoaded", () => {
  loadBrand();
  applyTheme(currentTheme);
  applyBrand();
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.addEventListener("click", toggleTheme);
  });
});
