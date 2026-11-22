-- Run with psql against an authorized, migrated test database, using three distinct enrolled accounts.
-- psql "$DATABASE_URL" -v student_id=... -v other_id=... -v admin_id=... -f test/roles.sql
\set ON_ERROR_STOP on
begin;
select set_config('cw.student', :'student_id',true),set_config('cw.other', :'other_id',true),set_config('cw.admin', :'admin_id',true);
select set_config('cw.report',gen_random_uuid()::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('cw.student'),true);
do $$ begin
  if public.is_campus_admin() then raise exception 'Student fixture has the admin role'; end if;
  insert into public.incidents (id,category,lat,lng,occurred_at,description,severity)
    values(current_setting('cw.report')::uuid,'Broken streetlight',19.13078,72.91729,now(),'Isolated role test','Low');
  if not exists(select 1 from public.campus_my_reports() where id=current_setting('cw.report')::uuid) then raise exception 'Missing own report'; end if;
  update public.incidents set status='Resolved' where id=current_setting('cw.report')::uuid;
  if found then raise exception 'Student updated a report'; end if;
  begin
    insert into public.safety_alerts(title,body) values('Role test','This should be denied');
    raise exception 'Student published an alert';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cw.other'),true);
do $$ begin
  if public.is_campus_admin() or exists(select 1 from public.campus_my_reports() where id=current_setting('cw.report')::uuid) then raise exception 'Cross-account history visible'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cw.admin'),true);
do $$ begin
  if not public.is_campus_admin() then raise exception 'Administrator fixture needs a role assignment'; end if;
  update public.incidents set verification='Verified',status='Resolved' where id=current_setting('cw.report')::uuid;
  if not found then raise exception 'Administrator could not update report'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cw.student'),true);
do $$ begin
  if not exists(select 1 from public.campus_my_reports() where id=current_setting('cw.report')::uuid and status='Resolved') then raise exception 'Closed status unavailable to owner'; end if;
end $$;
rollback;
