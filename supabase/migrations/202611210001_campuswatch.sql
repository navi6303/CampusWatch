begin;

create schema if not exists private;
revoke all on schema private from public;

create table private.campus_bounds (shape polygon not null);
insert into private.campus_bounds (shape) values ('((72.9084321,19.1245674),(72.9083322,19.1251384),(72.9084402,19.1255521),(72.9084169,19.1259301),(72.9082043,19.1259898),(72.9081731,19.1261479),(72.9084281,19.1264716),(72.9088118,19.1266654),(72.9090476,19.1266714),(72.9092505,19.126533),(72.909341,19.1262015),(72.9093343,19.1254109),(72.9096727,19.1251467),(72.9098263,19.1251655),(72.9098391,19.1249508),(72.9100586,19.1247369),(72.9104768,19.1247732),(72.9106713,19.1249163),(72.9112643,19.125046),(72.9115106,19.1249756),(72.9117197,19.1252355),(72.9125255,19.1252592),(72.9128425,19.125387),(72.9129222,19.1257922),(72.9130472,19.1258403),(72.9132356,19.1257169),(72.9135921,19.1258454),(72.9137433,19.126008),(72.9137917,19.1269424),(72.9138187,19.1270641),(72.9138455,19.1273271),(72.9138793,19.1275404),(72.9137941,19.1276323),(72.9137066,19.1276989),(72.913619,19.1276924),(72.9135614,19.1277417),(72.9135794,19.1281103),(72.913661,19.1285774),(72.9136647,19.1286948),(72.9135185,19.1287138),(72.9135253,19.1287607),(72.9136645,19.1287426),(72.9136138,19.1292003),(72.9135404,19.1292448),(72.9137149,19.1296735),(72.9135739,19.1298502),(72.9134395,19.1302456),(72.9134373,19.1303417),(72.9134776,19.1306737),(72.9134834,19.1307627),(72.9134725,19.1308162),(72.9134211,19.1308298),(72.9133656,19.1308079),(72.9132425,19.1307666),(72.9130613,19.1307502),(72.9129412,19.1307555),(72.9126647,19.1307931),(72.9124389,19.1307558),(72.9123771,19.1307326),(72.9123563,19.1307032),(72.9123478,19.1306765),(72.9123525,19.1306237),(72.9123327,19.130562),(72.9122967,19.1305178),(72.9122303,19.1305301),(72.9121532,19.1305729),(72.9120531,19.1306264),(72.9119727,19.1306302),(72.9117546,19.1305934),(72.9117204,19.1305679),(72.9116388,19.1304804),(72.9116262,19.1304298),(72.9116411,19.130374),(72.9116615,19.1303183),(72.9116646,19.1302508),(72.9116518,19.1302114),(72.9116409,19.1301668),(72.911601,19.1301182),(72.9115649,19.1300831),(72.9115276,19.1300755),(72.9114932,19.1301108),(72.9114791,19.1301451),(72.9114545,19.1301766),(72.911437,19.1302155),(72.9114008,19.1302555),(72.9113487,19.1302667),(72.9113057,19.1302238),(72.9112132,19.1302065),(72.9111241,19.130221),(72.9110353,19.1302586),(72.9109596,19.1302557),(72.9108731,19.1301927),(72.9104008,19.1298811),(72.9103105,19.1298537),(72.9102868,19.1299247),(72.9102773,19.1301616),(72.9103775,19.1303661),(72.910614,19.1305465),(72.9106081,19.1307136),(72.9108908,19.1309175),(72.9112268,19.1310166),(72.911336,19.1312547),(72.9114187,19.1312677),(72.9115532,19.1311609),(72.911916,19.1314279),(72.9119082,19.1314951),(72.9110287,19.1315706),(72.9109093,19.1319903),(72.910578,19.1325786),(72.9104707,19.1326585),(72.9101842,19.1323332),(72.9101065,19.1323276),(72.9097831,19.1324983),(72.909462,19.1321599),(72.9091581,19.1322208),(72.9088925,19.1323149),(72.9087346,19.1327097),(72.9087952,19.1331248),(72.909051,19.1334791),(72.9085781,19.1336201),(72.9084992,19.1334552),(72.907718,19.1336045),(72.9075682,19.1337993),(72.9074516,19.1340983),(72.9074316,19.1344423),(72.9071513,19.1344684),(72.9069888,19.1339762),(72.9070113,19.133599),(72.9066574,19.1335838),(72.9062931,19.1336907),(72.9062074,19.1334464),(72.9067667,19.1331606),(72.9064406,19.1320804),(72.9065555,19.1318365),(72.9067742,19.1317823),(72.906911,19.1314405),(72.9068841,19.1310415),(72.9070316,19.1305943),(72.9069406,19.1302596),(72.9069926,19.1299468),(72.9067509,19.1295127),(72.9066465,19.1295207),(72.9064315,19.1297214),(72.9062112,19.1298159),(72.906045,19.1297767),(72.9059413,19.1296064),(72.9057643,19.1296631),(72.9057313,19.1302123),(72.9055377,19.1303707),(72.9055356,19.1305949),(72.9057194,19.1307649),(72.905641,19.1310561),(72.9056833,19.1313355),(72.9054518,19.1313549),(72.9052815,19.1318221),(72.9057051,19.131763),(72.9056558,19.132024),(72.9055416,19.1321691),(72.9052808,19.1321089),(72.9051199,19.1319368),(72.9047374,19.1318983),(72.9046988,19.1317625),(72.9045509,19.1317501),(72.9045994,19.1315702),(72.904589,19.1312698),(72.9047249,19.1311952),(72.9046487,19.1310715),(72.9044697,19.1310727),(72.9043747,19.1312594),(72.9041362,19.1311925),(72.9041231,19.1310572),(72.9039696,19.130986),(72.9037919,19.1310199),(72.9037358,19.1312308),(72.903817,19.1314619),(72.9037407,19.1318052),(72.9040788,19.1319315),(72.904109,19.1322987),(72.9043169,19.1324607),(72.904753,19.1324464),(72.9048389,19.1329501),(72.9046329,19.1328646),(72.9045467,19.1327064),(72.9043591,19.1328651),(72.9042409,19.1330601),(72.9042407,19.133229),(72.9044043,19.1333823),(72.9045195,19.1336157),(72.9043218,19.1337214),(72.9042101,19.1342454),(72.9043855,19.1347158),(72.9043619,19.1348024),(72.9043056,19.1348363),(72.9041866,19.1347408),(72.9038942,19.1341719),(72.9037955,19.1341329),(72.9036546,19.1341584),(72.9035876,19.1342529),(72.9036454,19.1345582),(72.9037297,19.1349124),(72.9036494,19.1352773),(72.9037501,19.1354563),(72.904045,19.1358307),(72.906011,19.1363679),(72.9089802,19.1371889),(72.9114157,19.1378274),(72.9123223,19.1381062),(72.9131779,19.1385344),(72.9141086,19.1391679),(72.9145056,19.1395734),(72.9151734,19.1404982),(72.915659,19.1413927),(72.9161632,19.1412204),(72.9176813,19.1412305),(72.9182714,19.1411241),(72.9184323,19.141043),(72.9183116,19.1407972),(72.9183385,19.140521),(72.9184645,19.1403943),(72.9185825,19.1400548),(72.919127,19.1391628),(72.9191498,19.138874),(72.9192156,19.1386409),(72.9191887,19.1382456),(72.9188883,19.1383216),(72.9188347,19.1373637),(72.9191512,19.1357521),(72.9193238,19.1334255),(72.9194999,19.1318852),(72.9196447,19.1309425),(72.9197655,19.1289837),(72.9196233,19.1288924),(72.9190749,19.128128),(72.9188669,19.1278382),(72.9188515,19.1278212),(72.9165831,19.1253176),(72.9164566,19.1252159),(72.9163617,19.1251229),(72.913658,19.1243893),(72.9118797,19.1239103),(72.9116088,19.1238824),(72.9095542,19.1241384),(72.9093075,19.1241434),(72.9090151,19.1240623),(72.9086449,19.1238481))'::polygon);
insert into private.campus_bounds (shape) values ('((72.9025912,19.136563),(72.902838,19.1366897),(72.9029292,19.1371002),(72.9028326,19.1371458),(72.9029453,19.1373941),(72.9030874,19.1377996),(72.903412,19.1380859),(72.9038975,19.1385243),(72.9043293,19.1388841),(72.9045278,19.1388233),(72.9049355,19.1386915),(72.9049247,19.1385496),(72.9050803,19.1384381),(72.9050428,19.138205),(72.9055202,19.138053),(72.9057562,19.1383418),(72.905944,19.1388436),(72.9071027,19.1377236),(72.9073199,19.137455),(72.907446,19.137085),(72.904568,19.1363223),(72.9036024,19.1360486),(72.9021996,19.1356812))'::polygon);

create table private.campus_admins (user_id uuid primary key references auth.users(id) on delete cascade);

create function public.is_campus_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.campus_admins where user_id = (select auth.uid())) $$;
revoke all on function public.is_campus_admin() from public;
grant execute on function public.is_campus_admin() to authenticated;

create function private.within_campus(lng double precision, lat double precision)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.campus_bounds where pg_catalog.point(lng,lat) <@ shape) $$;
revoke all on function private.within_campus(double precision,double precision) from public;
grant usage on schema private to authenticated;
grant execute on function private.within_campus(double precision,double precision) to authenticated;

create type public.campus_category as enum (
  'Leopard sighting','Snake or other wildlife','Road accident','Broken streetlight',
  'Damaged pedestrian pathway','Waterlogging','Fallen tree','General safety issue','Other'
);
create type public.campus_severity as enum ('Low','Moderate','High','Critical');
create type public.campus_verification as enum ('Reported','Verified','Rejected');
create type public.campus_status as enum ('Submitted','Pending','Under review','Forwarded','Resolved','Rejected');

create table public.departments (
  name text primary key,
  provisional boolean not null default true
);
insert into public.departments(name) values
  ('Security / Wildlife'),('Security / Medical Centre'),('Electrical / Maintenance'),
  ('Estate / Maintenance'),('Civil / Estate'),('Campus Security');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references auth.users(id) on delete set null,
  category public.campus_category not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  priority_review boolean generated always as (severity = 'Critical' or (category in ('Leopard sighting','Snake or other wildlife') and extract(epoch from (created_at - occurred_at)) between 0 and 3600)) stored,
  description text not null check (length(btrim(description)) between 1 and 1500),
  severity public.campus_severity not null,
  verification public.campus_verification not null default 'Reported',
  status public.campus_status not null default 'Submitted',
  department text not null references public.departments(name),
  photo_path text,
  source_url text,
  data_source text not null default 'Student_Report' check (data_source = 'Student_Report'),
  check (occurred_at <= created_at),
  check (private.within_campus(lng, lat)),
  check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$')
);
create index incidents_occurred_idx on public.incidents(occurred_at desc);

create table public.complaint_history (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  changed_at timestamptz not null default now(),
  status public.campus_status not null,
  verification public.campus_verification not null,
  department text not null references public.departments(name)
);
create index complaint_history_incident_idx on public.complaint_history(incident_id,changed_at desc);

create table public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  data_source text not null default 'CampusWatch_Admin' check (data_source = 'CampusWatch_Admin'),
  check (expires_at is null or expires_at > created_at)
);

create function private.route_incident() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.department := case new.category
    when 'Leopard sighting' then 'Security / Wildlife'
    when 'Snake or other wildlife' then 'Security / Wildlife'
    when 'Road accident' then 'Security / Medical Centre'
    when 'Broken streetlight' then 'Electrical / Maintenance'
    when 'Damaged pedestrian pathway' then 'Estate / Maintenance'
    when 'Fallen tree' then 'Estate / Maintenance'
    when 'Waterlogging' then 'Civil / Estate'
    else 'Campus Security'
  end;
  return new;
end;
$$;
create trigger route_incident before insert on public.incidents
for each row execute function private.route_incident();

create function private.log_complaint_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or (old.status,old.verification,old.department) is distinct from (new.status,new.verification,new.department) then
    insert into public.complaint_history(incident_id,status,verification,department)
    values (new.id,new.status,new.verification,new.department);
  end if;
  return new;
end;
$$;
create trigger log_complaint_change after insert or update on public.incidents
for each row execute function private.log_complaint_change();

alter table public.incidents enable row level security;
alter table public.departments enable row level security;
alter table public.complaint_history enable row level security;
alter table public.safety_alerts enable row level security;

revoke all on public.incidents, public.departments, public.complaint_history, public.safety_alerts from public, anon, authenticated;
grant select on public.departments, public.safety_alerts to anon, authenticated;
grant select on public.incidents,public.complaint_history to authenticated;
grant insert (id,category,lat,lng,occurred_at,description,severity,photo_path) on public.incidents to authenticated;
grant update (verification,status,department) on public.incidents to authenticated;
grant insert (title,body,expires_at) on public.safety_alerts to authenticated;

create policy read_departments on public.departments for select to anon, authenticated using (true);
create policy read_alerts on public.safety_alerts for select to anon, authenticated using (true);
create policy admin_publish on public.safety_alerts for insert to authenticated with check ((select public.is_campus_admin()));
create policy read_history on public.complaint_history for select to authenticated using ((select public.is_campus_admin()));
create policy read_private_incidents on public.incidents for select to authenticated using ((select public.is_campus_admin()));
create policy insert_own_incidents on public.incidents for insert to authenticated with check (
  reporter_id = (select auth.uid()) and (photo_path is null or photo_path = reporter_id::text||'/'||id::text)
);
create policy admin_update_incidents on public.incidents for update to authenticated using ((select public.is_campus_admin())) with check ((select public.is_campus_admin()));

create function public.campus_public_incidents()
returns table (
  id uuid, category public.campus_category, lat double precision, lng double precision,
  occurred_at timestamptz, severity public.campus_severity, verification public.campus_verification,
  status public.campus_status, department text, data_source text, approximate boolean
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.category,
    case when i.category in ('Leopard sighting','Snake or other wildlife') then null else i.lat end,
    case when i.category in ('Leopard sighting','Snake or other wildlife') then null else i.lng end,
    case when i.category in ('Leopard sighting','Snake or other wildlife') then pg_catalog.date_trunc('day', i.occurred_at, 'Asia/Kolkata') else i.occurred_at end,
    i.severity,i.verification,i.status,i.department,i.data_source,
    i.category in ('Leopard sighting','Snake or other wildlife')
  from public.incidents i
  where i.verification = 'Verified' or i.reporter_id = (select auth.uid())
$$;
revoke all on function public.campus_public_incidents() from public;
grant execute on function public.campus_public_incidents() to anon, authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('incident-photos','incident-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy campus_photo_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'incident-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy campus_photo_read on storage.objects for select to authenticated using (
  bucket_id = 'incident-photos' and (
    (select public.is_campus_admin()) or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and (storage.allow_only_operation('storage.object.delete') or storage.allow_only_operation('storage.object.delete_many'))
    )
  )
);
create policy campus_photo_cleanup on storage.objects for delete to authenticated using (
  bucket_id = 'incident-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.campus_public_incidents() p where p.id::text = split_part(name,'/',2))
);

commit;
