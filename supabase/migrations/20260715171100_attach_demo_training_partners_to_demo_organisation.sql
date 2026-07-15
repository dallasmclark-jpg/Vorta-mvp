update public.training_partners partner
set organisation_id = organisation.id,
    updated_at = now()
from lateral (
  select org.id
  from public.organisations org
  where org.status = 'demo'
  order by org.created_at
  limit 1
) organisation
where partner.organisation_id is null;
