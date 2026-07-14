with equipment_templates as (
  select
    equipment.id as equipment_id,
    case
      when equipment.equipment_type ilike '%vial%'
        or equipment.name ilike '%vial filler%'
        or equipment.name ilike '%vial capper%'
        then array[
          'Vial Filling Lines',
          'Servo Systems',
          'Pneumatic Systems',
          'Machine Safety',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%HVAC%'
        or equipment.name ilike '%HVAC%'
        then array[
          'HVAC',
          'Building Management Systems',
          'HVAC Validation',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%vision%'
        or equipment.equipment_type ilike '%inspection%'
        or equipment.equipment_type ilike '%CCIT%'
        or equipment.name ilike '%inspection%'
        then array[
          'Vision Inspection Systems',
          'Machine Vision',
          'Pharmaceutical Calibration',
          'Electrical Fault Finding',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%freeze dryer%'
        or equipment.name ilike '%freeze dryer%'
        then array[
          'Freeze Dryers',
          'GEA Freeze Dryers',
          'Vacuum Systems',
          'Refrigeration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%labeller%'
        then array[
          'Labelling Systems',
          'Servo Systems',
          'Pneumatic Systems',
          'Machine Safety',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%case packer%'
        then array[
          'Case Packers',
          'Servo Systems',
          'Pneumatic Systems',
          'Machine Safety',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%cartoner%'
        then array[
          'Cartoners',
          'Servo Systems',
          'Pneumatic Systems',
          'Machine Safety',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%palletiser%'
        then array[
          'Palletisers',
          'Robotics',
          'Servo Systems',
          'Machine Safety',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%blister%'
        then array[
          'Blister Packing',
          'Uhlmann Blister Lines',
          'Servo Systems',
          'Machine Safety',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%serialisation%'
        or equipment.equipment_type ilike '%serialization%'
        then array[
          'Serialization Systems',
          'Industrial Networking',
          'Machine Vision',
          'Data Integrity',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%autoclave%'
        then array[
          'Autoclaves',
          'Steris Autoclaves',
          'Steam Systems',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%depyrogenation%'
        then array[
          'Depyrogenation Tunnels',
          'Temperature Mapping',
          'Electrical Fault Finding',
          'Machine Safety',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%washer%'
        then array[
          'Washer Disinfectors',
          'Steam Systems',
          'Pumps',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%compressor%'
        then array[
          'Compressed Air Systems',
          'Compressors',
          'Electrical Fault Finding',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%chiller%'
        then array[
          'Chillers',
          'Refrigeration',
          'Pumps',
          'Electrical Fault Finding',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%pure steam%'
        then array[
          'Pure Steam Generators',
          'Steam Systems',
          'Water Treatment',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%clean utility%'
        or equipment.name ilike '%WFI%'
        then array[
          'WFI Generation',
          'WFI Distribution',
          'Water Treatment',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%environmental monitoring%'
        or equipment.name ilike '%cold store%'
        then array[
          'Environmental Monitoring Systems',
          'Refrigeration',
          'Pharmaceutical Calibration',
          'Industrial Networking',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%dock leveller%'
        then array[
          'Hydraulic Systems',
          'Electrical Fault Finding',
          'Machine Safety',
          'Lock Out Tag Out',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%warehouse management%'
        or equipment.equipment_type ilike '%barcode%'
        then array[
          'Warehouse Automation',
          'Industrial Networking',
          'SAP PM',
          'Electrical Fault Finding',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%bioreactor%'
        then array[
          'Bioreactors',
          'Emerson DeltaV',
          'CIP Systems',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%CIP%'
        then array[
          'CIP Skids',
          'Pumps',
          'Valves',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%DCS%'
        or equipment.name ilike '%DeltaV%'
        then array[
          'Emerson DeltaV',
          'SCADA Systems',
          'Industrial Networking',
          'Functional Safety Systems',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%process skid%'
        then array[
          'Dosing Systems',
          'Pumps',
          'Valves',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      when equipment.equipment_type ilike '%chromatography%'
        then array[
          'Chromatography Systems',
          'Pumps',
          'Industrial Networking',
          'Pharmaceutical Calibration',
          'GMP'
        ]::text[]
      else array[
        'Electrical Fault Finding',
        'Mechanical Fault Finding',
        'Machine Safety',
        'SAP PM',
        'GMP'
      ]::text[]
    end as skill_names
  from public.equipment_assets equipment
),
expanded as (
  select
    template.equipment_id,
    skill_name,
    ordinal_position
  from equipment_templates template
  cross join lateral unnest(template.skill_names)
    with ordinality as skills(skill_name, ordinal_position)
),
resolved as (
  select
    expanded.equipment_id,
    skill.id as skill_id,
    expanded.skill_name,
    expanded.ordinal_position
  from expanded
  join public.skills skill on skill.name = expanded.skill_name
)
insert into public.equipment_required_skills (
  equipment_id,
  skill_id,
  required_level,
  criticality,
  notes,
  minimum_qualified_engineers,
  execution_authority,
  validation_required,
  evidence_reference
)
select
  resolved.equipment_id,
  resolved.skill_id,
  case when resolved.ordinal_position = 1 then 4 else 3 end,
  case
    when resolved.ordinal_position <= 2 then 'critical'
    when resolved.ordinal_position <= 4 then 'high'
    else 'medium'
  end,
  'Equipment capability requirement generated from the professional demo skill template.',
  2,
  case when resolved.ordinal_position = 1 then 'authoriser' else 'independent' end,
  true,
  'Manager validation and equipment-specific evidence required.'
from resolved
on conflict (equipment_id, skill_id)
do update set
  required_level = greatest(
    public.equipment_required_skills.required_level,
    excluded.required_level
  ),
  criticality = case
    when public.equipment_required_skills.criticality = 'critical' then 'critical'
    when excluded.criticality = 'critical' then 'critical'
    when public.equipment_required_skills.criticality = 'high' then 'high'
    else excluded.criticality
  end,
  minimum_qualified_engineers = greatest(
    public.equipment_required_skills.minimum_qualified_engineers,
    excluded.minimum_qualified_engineers
  ),
  execution_authority = case
    when public.equipment_required_skills.execution_authority = 'authoriser'
      or excluded.execution_authority = 'authoriser'
      then 'authoriser'
    else 'independent'
  end,
  validation_required = true,
  evidence_reference = coalesce(
    public.equipment_required_skills.evidence_reference,
    excluded.evidence_reference
  ),
  updated_at = now();
