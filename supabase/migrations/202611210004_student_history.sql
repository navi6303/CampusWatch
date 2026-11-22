begin;
-- No caller-selected identity. Closed complaints remain accessible to their author.
create function public.campus_my_reports()
returns table (id uuid, category public.campus_category, occurred_at timestamptz,
  created_at timestamptz, description text, status public.campus_status,
  verification public.campus_verification, department text)
language sql stable security definer set search_path='' as $$
  select i.id,i.category,i.occurred_at,i.created_at,i.description,i.status,i.verification,i.department
  from public.incidents i where i.reporter_id=(select auth.uid())
$$;
revoke all on function public.campus_my_reports() from public, anon;
grant execute on function public.campus_my_reports() to authenticated;
create index if not exists incidents_reporter_created_idx on public.incidents(reporter_id,created_at desc);
commit;
