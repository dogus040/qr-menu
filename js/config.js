// Google Sheets koppeling
// ----------------------------------------------------------------------------
// De menukaart leest het menu uit deze Google Sheet ("Iedereen met de link mag
// bekijken"). Laat een link leeg ("") om het bestand in de map data/ te gebruiken.
//
// Sheet: https://docs.google.com/spreadsheets/d/1WMBCNGtdqOYoTtWO3RERnBfEVjyKoajX4JKQ2dgdHfU/edit
// gid = het nummer achter "#gid=" in de adresbalk wanneer het tabblad open staat.
window.MENU_CONFIG = {
  // Adres waar de QR-code naartoe wijst.
  menuUrl: "https://bimola.pages.dev/",
  // Web-app-URL van apps-script/Code.gs (beheerpagina /yonetim). Leeg = nog niet ingesteld.
  // OAuth-client-ID voor "Sign in with Google" op de beheerpagina (openbaar, geen geheim).
  googleClientId: "",
  adminApiUrl: "https://script.google.com/macros/s/AKfycbxd0bV0rr_wJBZ8eDrbg4m1cl41wKxoXWwhQEn8zAs4DdPOqf-WTwfZsl7LTYB03-nw/exec",
  // Achtergrond: kagit, kahve, cini, kraft of espresso.
  // Een regel "Arka Plan" in het tabblad ayarlar van de sheet gaat hiervoor.
  arkaPlan: "kraft",
  menuCsvUrl: "https://docs.google.com/spreadsheets/d/1WMBCNGtdqOYoTtWO3RERnBfEVjyKoajX4JKQ2dgdHfU/export?format=csv&gid=1533908302",
  ayarlarCsvUrl: "https://docs.google.com/spreadsheets/d/1WMBCNGtdqOYoTtWO3RERnBfEVjyKoajX4JKQ2dgdHfU/export?format=csv&gid=824941840"
};
