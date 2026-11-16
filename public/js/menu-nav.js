// Markeert in de categoriebalk de categorie die op het scherm staat.
// De menukaart werkt ook zonder dit script.
(function () {
  "use strict";
  var nav = document.getElementById("category-nav");
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
  if (!nav || !links.length || !("IntersectionObserver" in window)) return;

  function setActive(id) {
    links.forEach(function (a) {
      var active = a.dataset.target === id;
      a.classList.toggle("active", active);
      if (active) {
        var left = a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2;
        nav.scrollTo({ left: left, behavior: "smooth" });
      }
    });
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
  }, { rootMargin: "-30% 0px -65% 0px" });

  document.querySelectorAll(".category").forEach(function (s) { observer.observe(s); });
  setActive(links[0].dataset.target);
})();
