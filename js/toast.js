/* ============================================
   RackView — Toast notification global
   showToast(message, type) → sukses/error/info/warn
   confirmDoubleDelete(name) → konfirmasi 2 langkah
   Container dibuat otomatis pada pemakaian pertama.
   ============================================ */
(function () {
  let container = null;

  function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement("div");
    container.id = "app-toast-container";
    container.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:340px;";
    document.body.appendChild(container);
    return container;
  }

  function showToast(message, type) {
    type = type || "success";
    const c = ensureContainer();
    const t = document.createElement("div");
    t.style.cssText = "padding:11px 16px;border-radius:8px;font-size:13px;font-weight:500;color:#fff;min-width:220px;box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:0;transform:translateY(6px);transition:opacity .2s ease,transform .2s ease;";
    if (type === "success") t.style.background = "#2f9e6f";
    else if (type === "error") t.style.background = "#e05244";
    else if (type === "warn") t.style.background = "#d99136";
    else t.style.background = "#4f8cff";
    t.textContent = message;
    c.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(6px)";
      setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }, 3200);
  }

  // Konfirmasi hapus 2 langkah (pola sama seperti modul OPS)
  function confirmDoubleDelete(name) {
    if (!confirm("Hapus " + name + "?")) return false;
    if (!confirm("Yakin ingin menghapus permanen? Data yang dihapus tidak dapat dikembalikan.")) return false;
    return true;
  }

  window.showToast = showToast;
  window.confirmDoubleDelete = confirmDoubleDelete;
})();