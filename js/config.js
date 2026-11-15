// Google Sheets koppeling
// ----------------------------------------------------------------------------
// De menukaart leest het menu uit deze Google Sheet ("Iedereen met de link mag
// bekijken"). Laat een link leeg ("") om het bestand in de map data/ te gebruiken.
//
// Sheet: https://docs.google.com/spreadsheets/d/1UEMbSL-tcQcfzTUzC9VMaLQAlipFxiKWa44cfthKvdg/edit
// gid = het nummer achter "#gid=" in de adresbalk wanneer het tabblad open staat.
window.MENU_CONFIG = {
  // Achtergrond: kagit, kahve, cini, kraft of espresso.
  // Een regel "Arka Plan" in het tabblad ayarlar van de sheet gaat hiervoor.
  arkaPlan: "kagit",
  menuCsvUrl: "https://docs.google.com/spreadsheets/d/1UEMbSL-tcQcfzTUzC9VMaLQAlipFxiKWa44cfthKvdg/export?format=csv&gid=907230277",
  ayarlarCsvUrl: "https://docs.google.com/spreadsheets/d/1UEMbSL-tcQcfzTUzC9VMaLQAlipFxiKWa44cfthKvdg/export?format=csv&gid=1680754422"
};
