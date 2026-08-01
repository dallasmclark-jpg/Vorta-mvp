# VOR-034 Equipment Image Visibility Release

Release date: 2026-08-01

This release corrects the equipment-image visibility defect discovered after the initial VOR-034 provenance implementation.

## Root cause

Verified equipment image URLs were stored in Supabase and returned in `LiveEquipmentRecord.imageUrl`, but the phone, tablet and desktop Equipment list components discarded the live record image field and rendered cards without imagery.

## Released behaviour

- Verified manufacturer or authorised-supplier imagery is rendered on the live Equipment register across phone, tablet and desktop.
- A shared image component provides lazy loading, accessible alternative text and broken-image recovery.
- Equipment without authoritative imagery shows an explicit `Awaiting verified image` state.
- No generic category photograph or generated substitute is represented as verified evidence.

## Current verified coverage

Eleven Wrexham equipment records have verified imagery:

- AGV-01
- ALUS-01
- BMS-01
- DH-01
- DOCK-01
- FD-03
- GEN-01
- LEAK-01
- PAL-02
- PW-01
- VI-03

Spare-part imagery remains blocked until exact OEM catalogue numbers or approved site photographs are supplied.

## References

- Snag: VOR-034
- Pull request: #171
- Feature head: `78db76200d2f44bbcf08524ae279f2adc5adf516`
- Main merge: `3cbd05c2f8c2a7bd43aafbfe50c163451d2a0a49`
