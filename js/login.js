
document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  document.getElementById("status-line").textContent = "Signing in…";
  setTimeout(() => { window.location.href = "dashboard.html"; }, 500);
});
  

