-- Vrije allergeentekst per product (bijv. "Alerjen: Süt"); leeg = niets op de menukaart.
-- Vervangt de allergenenlijst op de kaart. De oude kolom allergens blijft staan (niet meer gebruikt),
-- zodat de eerdere gegevens bewaard blijven.
ALTER TABLE items ADD COLUMN allergen_text TEXT NOT NULL DEFAULT '' CHECK (length(allergen_text) <= 200);
