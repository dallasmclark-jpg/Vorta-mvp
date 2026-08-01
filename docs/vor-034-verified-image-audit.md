# VOR-034 Verified Equipment and Spare-Part Image Audit

Last production audit: 2026-08-01

Site: Wrexham (`11000000-0000-0000-0000-000000000001`)

## Rules

An image is operational evidence only when its identity and provenance are recorded.

### Equipment

A verified equipment image requires:

- a source image URL
- an authoritative source page URL
- source type: approved site photograph, manufacturer, or authorised supplier
- match basis: exact installed asset, exact model, product family, or software product
- alt text
- verification timestamp
- an explicit note when product media is not the installed serial asset

### Spare parts

A verified spare-part image additionally requires:

- the exact OEM manufacturer catalogue/service part number
- match basis `exact_part`

Internal SAP/Vorta material references and generated component codes are not accepted as OEM identity.

## Current production result

| State | Equipment | Spare parts |
|---|---:|---:|
| Verified | 11 | 0 |
| Blocked by identity | 16 | 177 |
| Authoritative source review pending | 8 | 0 |

All 11 verified equipment rows satisfy the database provenance constraint. No spare part is marked verified without an exact OEM part number.

## Verified equipment

- AGV-01 — MiR MiR600 — exact model — authorised supplier media
- ALUS-01 — GEA ALUS — product-family media
- BMS-01 — Siemens Desigo CC — software-product media
- DH-01 — Fedegari FOD — exact model
- DOCK-01 — Stertil S-Series — exact model
- FD-03 — GEA LYOVAC FCM — product-family media
- GEN-01 — Caterpillar C18 600 kVA — product-family media
- LEAK-01 — Bonfiglioli Engineering PK-V — exact model
- PAL-02 — KUKA KR QUANTEC — product-family media
- PW-01 — Getinge GEW 888 — exact model
- VI-03 — Seidenader VI-S — exact model

## Equipment blocked by insufficient or contradictory identity

The following records need an approved site photograph or corrected exact manufacturer/model evidence before an image can be verified:

- AHU-01
- AUT-01
- AUT-02
- CIP-01
- COLD-01
- FD-01
- FD-02
- LB-01
- PSG-01
- RABS-01
- SC-01
- VF-01
- VF-02
- VI-01
- WFI-01
- WMS-02

FD-01 and FD-02 currently combine GEA as OEM with LYOSTAR model names. That contradiction must be resolved rather than hidden beneath a plausible freeze-dryer photograph.

## Equipment still under authoritative source review

- CART-02 — Marchesini MA 155
- CC-01 — Brevetti CEA KBA
- CDA-01 — Atlas Copco ZT 55 VSD
- CHW-01 — Trane Sintesis RTAF
- CP-01 — Marchesini MC 820
- RI-01 — Antares Vision MIB-4
- VF-03 — Syntegon VRK 4010
- WMS-01 — SAP EWM

A family or adjacent-model image is not accepted as an exact match. For example, Marchesini's current MA-series page features MA255 media, not an MA155 image.

## Spare-part blocker

All 177 Wrexham component records currently lack a separate exact OEM catalogue number:

- 119 use generated asset-prefixed internal codes
- 117 use generic component descriptions
- examples such as `HVAC-DP-001`, `VF02-SENS-014` and `WFI1-COND-001` are useful Vorta references but do not prove a manufacturer part identity

Required source data for completion:

1. SAP material number
2. manufacturer
3. exact OEM catalogue/service part number
4. manufacturer description
5. optional approved site photograph
6. preferred manufacturer or authorised-supplier product-page URL

Until that data exists, Vorta deliberately shows the verified-image-unavailable state instead of a generic sensor, actuator, bearing or seal-kit photograph.

## Database controls

Migrations add provenance fields and fail-closed constraints to `equipment_assets` and `equipment_components`. A spare cannot be marked `verified` unless an exact OEM part number and full image provenance exist.

## Remaining implementation work

- complete the eight sourceable equipment reviews
- obtain site photographs or corrected identities for the sixteen blocked equipment records
- import exact OEM identities for the 177 spare records
- copy approved images into stable Vorta-controlled storage rather than relying permanently on remote hotlinks
- expose verified spare images and provenance in Equipment Spares and Stores Inventory
- verify broken-image, loading, missing-image and recovery states on phone, tablet and desktop
- complete CI, merge, deploy and production verification
