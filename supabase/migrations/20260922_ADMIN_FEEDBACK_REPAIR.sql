-- Commissioner: repair Admin Feedback Inbox RPCs
-- Run this once in Supabase SQL Editor if the Admin Feedback tab says
-- "Could not find the function public.admin_list_feedback without parameters in the schema cache".

alter table public.commissioner_feedback
  add column if not exists page text,
  add column if not exists page_url text,
  add column if not exists status text not null default 'new',
  add column if not exists admin_note text,
  add column if not exists reviewed_at timestamptz;

update public.commissioner_feedback
set status = 'new'
where status is null or status not in ('new','reviewed','archived');

drop function if exists public.admin_list_feedback();
create or replace function public.admin_list_feedback()
returns table (
  id uuid, user_id uuid, user_email text, feedback_type text, message text,
  page text, page_url text, status text, admin_note text,
  created_at timestamptz, reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select f.id, f.user_id, u.email::text, f.feedback_type, f.message,
         coalesce(f.page, '')::text, coalesce(f.page_url, '')::text,
         coalesce(f.status, 'new')::text, f.admin_note,
         f.created_at, f.reviewed_at
  from public.commissioner_feedback f
  left join auth.users u on u.id = f.user_id
  where public.is_admin()
  order by f.created_at desc;
$$;

revoke all on function public.admin_list_feedback() from public;
grant execute on function public.admin_list_feedback() to authenticated;

drop function if exists public.admin_update_feedback(uuid,text);
create or replace function public.admin_update_feedback(p_feedback_id uuid, p_status text)
returns public.commissioner_feedback
language plpgsql
security definer
set search_path = public
as $$
declare result public.commissioner_feedback;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('new','reviewed','archived') then raise exception 'Invalid feedback status'; end if;
  update public.commissioner_feedback
  set status = p_status,
      reviewed_at = case
        when p_status = 'reviewed' then now()
        when p_status = 'new' then null
        else reviewed_at
      end
  where id = p_feedback_id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.admin_update_feedback(uuid,text) from public;
grant execute on function public.admin_update_feedback(uuid,text) to authenticated;

notify pgrst, 'reload schema';
