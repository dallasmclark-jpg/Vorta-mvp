with operator_seed (
  employee_number,
  first_name,
  last_name,
  display_name,
  job_title,
  operator_level,
  area,
  line,
  team_code,
  team_leader_name,
  hire_date,
  skills_score,
  training_compliance_score,
  promotion_readiness_score,
  risk_level
) as (
  values
    ('WREX-SP-001', 'Carys', 'Morgan', 'Carys Morgan', 'Senior Sterile Prep Operator', 4, 'Sterile Prep', 'Sterile Preparation Suite', 'GREEN', 'Bethan Lewis', date '2020-04-13', 89::numeric, 96::numeric, 84::numeric, 'low'),
    ('WREX-SP-002', 'Owen', 'Price', 'Owen Price', 'Sterile Prep Operator', 3, 'Sterile Prep', 'Sterile Preparation Suite', 'GREEN', 'Bethan Lewis', date '2022-09-05', 78::numeric, 90::numeric, 69::numeric, 'medium'),
    ('WREX-SP-003', 'Bethan', 'Hughes', 'Bethan Hughes', 'Senior Sterile Prep Operator', 4, 'Sterile Prep', 'Sterile Preparation Suite', 'RED', 'Gareth Lewis', date '2019-11-18', 87::numeric, 95::numeric, 81::numeric, 'low'),
    ('WREX-SP-004', 'Dylan', 'Jones', 'Dylan Jones', 'Sterile Prep Operator', 3, 'Sterile Prep', 'Sterile Preparation Suite', 'RED', 'Gareth Lewis', date '2022-02-14', 76::numeric, 88::numeric, 66::numeric, 'medium'),
    ('WREX-SP-005', 'Nia', 'Williams', 'Nia Williams', 'Senior Sterile Prep Operator', 4, 'Sterile Prep', 'Sterile Preparation Suite', 'BLUE', 'Emma Davies', date '2020-08-24', 86::numeric, 94::numeric, 79::numeric, 'low'),
    ('WREX-SP-006', 'Rhys', 'Evans', 'Rhys Evans', 'Sterile Prep Operator', 3, 'Sterile Prep', 'Sterile Preparation Suite', 'BLUE', 'Emma Davies', date '2023-01-09', 75::numeric, 87::numeric, 64::numeric, 'medium'),
    ('WREX-SP-007', 'Megan', 'Roberts', 'Megan Roberts', 'Sterile Prep Operator', 2, 'Sterile Prep', 'Sterile Preparation Suite', 'YELLOW', 'Iwan Hughes', date '2023-06-19', 68::numeric, 82::numeric, 56::numeric, 'high'),
    ('WREX-SP-008', 'Callum', 'Davies', 'Callum Davies', 'Trainee Sterile Prep Operator', 1, 'Sterile Prep', 'Sterile Preparation Suite', 'YELLOW', 'Iwan Hughes', date '2025-02-03', 46::numeric, 64::numeric, 33::numeric, 'critical'),
    ('WREX-LYO-001', 'Lily', 'Carter', 'Lily Carter', 'Lyophilisation Operator', 3, 'Lyophilisation', 'Freeze Dryer Suite', 'BLUE', 'Emma Davies', date '2022-11-07', 80::numeric, 89::numeric, 72::numeric, 'medium'),
    ('WREX-PKG-001', 'Mason', 'Clark', 'Mason Clark', 'Packaging Operator', 2, 'Packaging', 'Pack Line 1', 'YELLOW', 'Iwan Hughes', date '2024-03-04', 65::numeric, 79::numeric, 53::numeric, 'high')
)
insert into public.operators (
  site_id,
  employee_number,
  first_name,
  last_name,
  display_name,
  job_title,
  operator_level,
  area,
  line,
  shift,
  shift_team_id,
  team_leader_name,
  hire_date,
  employment_status,
  skills_score,
  training_compliance_score,
  promotion_readiness_score,
  risk_level
)
select
  '11000000-0000-0000-0000-000000000001'::uuid,
  seed.employee_number,
  seed.first_name,
  seed.last_name,
  seed.display_name,
  seed.job_title,
  seed.operator_level,
  seed.area,
  seed.line,
  team.name,
  team.id,
  seed.team_leader_name,
  seed.hire_date,
  'active',
  seed.skills_score,
  seed.training_compliance_score,
  seed.promotion_readiness_score,
  seed.risk_level
from operator_seed seed
join public.maintenance_shift_teams team
  on team.site_id = '11000000-0000-0000-0000-000000000001'::uuid
 and team.code = seed.team_code
 and team.active
on conflict (employee_number)
do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  display_name = excluded.display_name,
  job_title = excluded.job_title,
  operator_level = excluded.operator_level,
  area = excluded.area,
  line = excluded.line,
  shift = excluded.shift,
  shift_team_id = excluded.shift_team_id,
  team_leader_name = excluded.team_leader_name,
  hire_date = excluded.hire_date,
  employment_status = excluded.employment_status,
  skills_score = excluded.skills_score,
  training_compliance_score = excluded.training_compliance_score,
  promotion_readiness_score = excluded.promotion_readiness_score,
  risk_level = excluded.risk_level,
  updated_at = now();
