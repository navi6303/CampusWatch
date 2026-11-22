-- Additive upgrade. Existing category values and report history remain readable.
alter type public.campus_category add value if not exists 'Pedestrian crossing hazard';
begin;
alter table public.campus_route_settings add column report_age_days smallint not null default 30 check (report_age_days between 1 and 365);
grant update(report_age_days) on public.campus_route_settings to authenticated;

create function private.check_new_category() returns trigger language plpgsql set search_path='' as $$
begin
  if new.category::text in ('Other','General safety issue') then
    raise exception 'Select a specific campus incident category.';
  end if;
  return new;
end; $$;
create trigger require_specific_category before insert on public.incidents for each row execute function private.check_new_category();

create function public.campus_public_incidents_v2()
returns table (
  id uuid, category public.campus_category, lat double precision, lng double precision,
  occurred_at timestamptz, severity public.campus_severity, verification public.campus_verification,
  status public.campus_status, department text, data_source text, approximate boolean, created_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select p.*, i.created_at from public.campus_public_incidents() p join public.incidents i on i.id=p.id
$$;
revoke all on function public.campus_public_incidents_v2() from public;
grant execute on function public.campus_public_incidents_v2() to anon,authenticated;
commit;
