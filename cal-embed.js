(function (C, A, L) {
  let p = function (a, ar) { a.q.push(ar); };
  let d = C.document;
  C.Cal = C.Cal || function () {
    let cal = C.Cal; let ar = arguments;
    if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
    if (ar[0] === L) {
      const api = function () { p(api, arguments); };
      const namespace = ar[1]; api.q = api.q || [];
      if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, [L, namespace, api]); } else p(cal, ar);
      return;
    }
    p(cal, ar);
  };
})(window, "https://app.cal.com/embed/embed.js", "init");

Cal("init", "karia", { origin: "https://cal.com" });
Cal.ns.karia("ui", {
  theme: "light",
  hideEventTypeDetails: false,
  layout: "month_view",
  cssVarsPerTheme: {
    light: {
      "cal-brand": "#0D1F2D",
      "cal-brand-emphasis": "#B87333",
      "cal-brand-text": "#F8F6F3"
    }
  }
});

// Limitar largura do modal ao abrir
document.addEventListener("click", function(e) {
  var el = e.target.closest("[data-cal-link]");
  if (!el) return;
  setTimeout(function() {
    var modal = document.querySelector("cal-modal-box");
    if (modal) {
      modal.style.maxWidth = "900px";
      modal.style.margin = "0 auto";
    }
  }, 300);
});
