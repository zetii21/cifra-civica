# Official-source adapters

The source registry covers AEAT tax aggregates and Renta Web Open, INE ECV,
EPF, ADRH and geography, Seguridad Social, Hacienda, EUROMOD and future foral/
Canary extensions. Permissions are enforceable:

- Renta Web Open and legal-rule references are manual-only and cannot be
  scraped through the adapter.
- Restricted or unapproved snapshots fail before parsing.
- Survey or administrative microdata is never written to public outputs.
- Publisher suppression tokens remain null/suppressed.
- Geography joins use official codes, never names.
- `ingestOfficialSnapshot` always creates a checksum provenance manifest.

Source-specific column mappings belong in reviewed pipeline configuration;
the generic adapter does not guess changing publisher schemas.
