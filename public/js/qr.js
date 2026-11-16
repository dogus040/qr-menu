// QR-printpagina: tekent 4 kaartjes (A6) in het thema van de menukaart.
// Naam en slogan komen van de server (data-attributen op #sheet).
(function () {
  "use strict";
  var urlInput = document.getElementById("url");
  var ctaInput = document.getElementById("cta");
  var tableInput = document.getElementById("table");
  var sheet = document.getElementById("sheet");
  var name = sheet.dataset.name || "Menü";
  var subtitle = sheet.dataset.subtitle || "";

  function cssVar(n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  }

  function luminance(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return 1;
    return (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255;
  }

  // Altijd donker op licht: scanners lezen omgekeerde codes slecht.
  function qrColors() {
    var card = cssVar("--card") || "#fbf7ef";
    var ink = cssVar("--ink") || "#2b2118";
    return luminance(card) >= luminance(ink) ? { light: card, dark: ink } : { light: ink, dark: card };
  }

  function drawQr(canvas, text, scale, colors) {
    var qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var margin = 2;
    var size = (count + margin * 2) * scale;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = colors.light;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = colors.dark;
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
      }
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function render() {
    sheet.textContent = "";
    var url = urlInput.value.trim();
    if (!url) return;
    var colors = qrColors();
    for (var i = 0; i < 4; i++) {
      var card = el("div", "card");
      card.appendChild(el("div", "orn", "❦"));
      card.appendChild(el("div", "name", name));
      if (subtitle) card.appendChild(el("p", "sub", subtitle));
      var canvas = document.createElement("canvas");
      drawQr(canvas, url, 12, colors);
      card.appendChild(canvas);
      card.appendChild(el("p", "cta", ctaInput.value));
      card.appendChild(el("div", "table", tableInput.value));
      sheet.appendChild(card);
    }
  }

  [urlInput, ctaInput, tableInput].forEach(function (inp) { inp.addEventListener("input", render); });
  document.getElementById("printbg").addEventListener("change", function (ev) {
    document.body.classList.toggle("no-print-bg", !ev.target.checked);
  });
  document.getElementById("print").addEventListener("click", function () { window.print(); });
  document.getElementById("download").addEventListener("click", function () {
    var canvas = document.createElement("canvas");
    drawQr(canvas, urlInput.value.trim(), 24, { light: "#ffffff", dark: "#000000" });
    var a = document.createElement("a");
    a.download = "menu-qr.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  render();
})();
