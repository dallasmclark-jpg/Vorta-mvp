-- VOR-033: cover the demo-storyline site reference used by the private health gate.
create index if not exists vorta_demo_storylines_site_active_idx
  on private.vorta_demo_storylines (site_id, active, story_key);
