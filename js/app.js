/* ============================================
   RackView — shared app chrome
   Sidebar collapse, submenu toggle, theme toggle wiring.
   (Theme toggle via brand.js binds all .theme-toggle;
   this file only wires the sidebar collapse + nav submenu.)
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("collapse-btn");
  if (sidebar && collapseBtn) {
    collapseBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));
  }

  document.addEventListener("click", (e) => {
    const caret = e.target.closest(".nav-caret");
    if (!caret) return;
    e.preventDefault();
    const parent2 = caret.closest("[data-submenu2]");
    if (parent2) {
      const sub2 = document.getElementById(parent2.dataset.submenu2);
      if (sub2) {
        parent2.classList.toggle("open");
        sub2.classList.toggle("open");
      }
      return;
    }
    const item = caret.closest(".nav-item");
    const sub = item && document.getElementById(item.dataset.submenu);
    if (sub) {
      item.classList.toggle("open");
      sub.classList.toggle("open");
    }
  });
});
