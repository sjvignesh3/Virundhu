-- =============================================================================
-- 20260901002100_view_public_menu_realign.sql
-- Purpose : replace public_store_menu with a contract-aligned shape:
--           {
--             store: {...camelCase fields...},
--             categories: [{ id, name, tamilName, displayOrder,
--                            products: [{ id, name, tamilName, price,
--                                         unit, imageUrl, description,
--                                         tamilDescription, displayOrder }] }]
--           }
-- =============================================================================

-- Drop the previous view (columns changed, cannot CREATE OR REPLACE across
-- shape changes).
drop view if exists public.public_store_menu;

create view public.public_store_menu
  with (security_barrier = true, security_invoker = false) as
select
  s.slug,
  jsonb_build_object(
    'id',                            s.id,
    'slug',                          s.slug,
    'name',                          s.name,
    'tamilName',                     s.tamil_name,
    'description',                   s.description,
    'phone',                         s.phone,
    'address',                       s.address,
    'logoUrl',                       s.logo_url,
    'imageUrl',                      s.image_url,
    'status',                        s.status,
    'settings', jsonb_build_object(
      'defaultLanguage',             s.default_language,
      'showTamilNames',              s.show_tamil_names,
      'showUnavailable',             s.show_unavailable,
      'acceptOrders',                s.accept_orders,
      'minimumOrderValue',           s.minimum_order_value,
      'estimatedPreparationMinutes', s.estimated_preparation_minutes
    )
  ) as store,
  coalesce(
    (
      select jsonb_agg(cat order by (cat->>'displayOrder')::int, cat->>'name')
      from (
        select jsonb_build_object(
          'id',           c.id,
          'name',         c.name,
          'tamilName',    c.tamil_name,
          'description',  c.description,
          'displayOrder', c.display_order,
          'products',     coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id',              p.id,
                  'name',            p.name,
                  'tamilName',       p.tamil_name,
                  'description',     p.description,
                  'tamilDescription',p.tamil_description,
                  'price',           p.price,
                  'unit',            p.unit,
                  'imageUrl',        p.image_url,
                  'stockQuantity',   p.stock_quantity,
                  'isAvailable',     p.is_available,
                  'displayOrder',    p.display_order
                )
                order by p.display_order, p.name
              )
              from public.products p
              where p.category_id = c.id
                and (s.show_unavailable or p.is_available)
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
  'Public read-only menu, keyed by slug. Contract-aligned camelCase JSONB payload.';

grant select on public.public_store_menu to anon, authenticated;
