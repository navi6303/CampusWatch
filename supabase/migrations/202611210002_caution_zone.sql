begin;
create table public.campus_route_settings (
  id smallint primary key check (id = 1),
  lakeside_width smallint not null check (lakeside_width in (75,150,250))
);
insert into public.campus_route_settings values (1,150);
alter table public.campus_route_settings enable row level security;
revoke all on public.campus_route_settings from public, anon, authenticated;
grant select on public.campus_route_settings to anon, authenticated;
grant update (lakeside_width) on public.campus_route_settings to authenticated;
create policy read_route_settings on public.campus_route_settings for select to anon, authenticated using (true);
create policy manage_route_settings on public.campus_route_settings for update to authenticated
  using ((select public.is_campus_admin())) with check ((select public.is_campus_admin()));
commit;
