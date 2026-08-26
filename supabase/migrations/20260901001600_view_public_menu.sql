-- =============================================================================
-- 20260901001600_view_public_menu.sql
-- Purpose : anonymous (public) menu access. This view is the ONLY route by
--           which unauthenticated visitors read tenant data.
-- Safety  : declared with security_barrier so the planner cannot push user
--           predicates below the view's filter clauses.
-- =============================================================================

create or replace view public.public_store_menu
  with (security_barrier = true, security_invoker = false) as
select
  s.id                 as store_id,
  s.slug               as slug,
  s.name               as store_name,
  s.currency           as currency,
  s.tax_rate           as tax_rate,
  s.logo_url           as logo_url,
  s.address            as address,
  s.phone              as phone,
  s.settings           as settings,
  coalesce(
    (
      select jsonb_agg(cat order by cat->>'sort_order', cat->>'name')
      from (
        select jsonb_build_object(
          'id',         c.id,
          'name',       c.name,
          'sort_order', c.sort_order,
          'products',   coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id',          p.id,
                  'name',        p.name,
                  'description', p.description,
                  'price',       p.price,
                  'image_url',   p.image_url,
                  'sort_order',  p.sort_order
                )
                order by p.sort_order, p.name
              )
              from public.products p
              where p.category_id = c.id
                and p.is_active   = true
            ),
            '[]'::jsonb
          )
        ) as cat
        from public.categories c
        where c.store_id  = s.id
          and c.is_active = true
      ) x
    ),
    '[]'::jsonb
  ) as categories
from public.stores s
where s.status = 'OPEN';

comment on view public.public_store_menu is
  'Public read-only menu, keyed by slug. security_barrier + owner-run SELECTs replace RLS.';

-- Grant read to anon and authenticated. The view intentionally does not
-- appear in the RLS matrix — it is our sole controlled public window.
grant select on public.public_store_menu to anon, authenticated;
