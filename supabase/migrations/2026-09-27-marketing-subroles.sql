-- ============================================================================
-- Phase F (continued) — now that staff.marketing_role is actually persisted
-- (2026-09-27-marketing-role-fix.sql), replace the blanket "any Marketing
-- staff" policies on the marketing-domain tables (2026-09-27-rls-lockdown.sql
-- §7) with sub-role-scoped ones, matching the docx §4 role descriptions:
--
--   Marketing Manager   — everything in the marketing domain.
--   Leads Specialist    — marketing_leads, marketing_pings only.
--   Content Planner     — content requests/items + cross-branch coordination.
--   Graphics Designer   — design/video production + scheduled posts only.
--
-- Every Marketing sub-role was already excluded from student/HR/finance/
-- application data by the base RLS lockdown — this only narrows access
-- *within* the marketing domain, it does not grant anything new.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.is_marketing_manager() returns boolean
language sql stable as $$
  select public.is_marketing() and (public.current_marketing_role() is null or public.current_marketing_role() = 'Marketing Manager');
$$;
-- NULL sub-role (an account created before this fix, or via direct SQL) is
-- treated as Marketing Manager — the same default Login.tsx already applies
-- client-side (`match.marketingRole ?? 'Marketing Manager'`), so an
-- unmigrated account doesn't suddenly lose access it had yesterday.

create or replace function public.is_leads_specialist() returns boolean
language sql stable as $$ select public.is_marketing() and public.current_marketing_role() = 'Leads Specialist'; $$;

create or replace function public.is_content_planner() returns boolean
language sql stable as $$ select public.is_marketing() and public.current_marketing_role() = 'Content Planner'; $$;

create or replace function public.is_graphics_designer() returns boolean
language sql stable as $$ select public.is_marketing() and public.current_marketing_role() = 'Graphics Designer'; $$;


-- ---- Leads Specialist domain: leads + branch pings -------------------------

drop policy if exists marketing_leads_all on public.marketing_leads;
create policy marketing_leads_all on public.marketing_leads for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());

drop policy if exists marketing_pings_select on public.marketing_pings;
create policy marketing_pings_select on public.marketing_pings for select
using (
  public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist()
  or (public.is_branch_manager() and public.same_branch(branch))
);

drop policy if exists marketing_pings_insert on public.marketing_pings;
create policy marketing_pings_insert on public.marketing_pings for insert
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());

drop policy if exists marketing_pings_update on public.marketing_pings;
create policy marketing_pings_update on public.marketing_pings for update
using (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());

drop policy if exists marketing_pings_delete on public.marketing_pings;
create policy marketing_pings_delete on public.marketing_pings for delete
using (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());


-- ---- Manager-only: campaigns, spend, SEO (budget/strategy tools) ----------

drop policy if exists marketing_campaigns_all on public.marketing_campaigns;
create policy marketing_campaigns_all on public.marketing_campaigns for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());

drop policy if exists marketing_ad_spend_all on public.marketing_ad_spend;
create policy marketing_ad_spend_all on public.marketing_ad_spend for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());

drop policy if exists marketing_seo_tasks_all on public.marketing_seo_tasks;
create policy marketing_seo_tasks_all on public.marketing_seo_tasks for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());

drop policy if exists marketing_seo_keywords_all on public.marketing_seo_keywords;
create policy marketing_seo_keywords_all on public.marketing_seo_keywords for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());


-- ---- Content Planner & Branch Coordinator domain --------------------------

drop policy if exists marketing_content_requests_select on public.marketing_content_requests;
create policy marketing_content_requests_select on public.marketing_content_requests for select
using (
  public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner()
  or public.same_branch(target_branch)
);

drop policy if exists marketing_content_requests_insert on public.marketing_content_requests;
create policy marketing_content_requests_insert on public.marketing_content_requests for insert
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_content_requests_update on public.marketing_content_requests;
create policy marketing_content_requests_update on public.marketing_content_requests for update
using (
  public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner()
  or public.same_branch(target_branch)
)
with check (
  public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner()
  or public.same_branch(target_branch)
);

drop policy if exists marketing_content_requests_delete on public.marketing_content_requests;
create policy marketing_content_requests_delete on public.marketing_content_requests for delete
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

-- Content Planner manages items end-to-end; Graphics Designer needs read
-- access too (they execute the design/video work an item tracks).
drop policy if exists marketing_content_items_all on public.marketing_content_items;
create policy marketing_content_items_select on public.marketing_content_items for select
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner() or public.is_graphics_designer());

drop policy if exists marketing_content_items_insert on public.marketing_content_items;
create policy marketing_content_items_insert on public.marketing_content_items for insert
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_content_items_update on public.marketing_content_items;
create policy marketing_content_items_update on public.marketing_content_items for update
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_content_items_delete on public.marketing_content_items;
create policy marketing_content_items_delete on public.marketing_content_items for delete
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists branch_content_requests_select on public.branch_content_requests;
create policy branch_content_requests_select on public.branch_content_requests for select
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists branch_content_requests_update on public.branch_content_requests;
create policy branch_content_requests_update on public.branch_content_requests for update
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner())
with check (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_support_requests_select on public.marketing_support_requests;
create policy marketing_support_requests_select on public.marketing_support_requests for select
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_support_requests_update on public.marketing_support_requests;
create policy marketing_support_requests_update on public.marketing_support_requests for update
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());


-- ---- Graphics Designer domain: design/video production + scheduled posts --

drop policy if exists marketing_design_tasks_all on public.marketing_design_tasks;
create policy marketing_design_tasks_all on public.marketing_design_tasks for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer());

drop policy if exists marketing_video_tasks_all on public.marketing_video_tasks;
create policy marketing_video_tasks_all on public.marketing_video_tasks for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer());

drop policy if exists marketing_posts_all on public.marketing_posts;
create policy marketing_posts_all on public.marketing_posts for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer());
