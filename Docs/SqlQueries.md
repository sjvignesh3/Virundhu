# Business KPI SQL Queries

_Stage 6 §6.1 · Observability deliverable._

Copy-paste-ready queries the ops team runs from Supabase Studio →
SQL Editor. All queries respect RLS when run as a project owner; run as
`postgres` role for global views.

---

## DAU (distinct active owners)

```sql
select
  date_trunc('day', o.placed_at)::date as day,
  count(distinct sm.user_id)           as active_owners
from public.orders o
join public.store_members sm on sm.store_id = o.store_id
where o.placed_at >= now() - interval '30 days'
group by 1
order by 1 desc;
```

Interpretation: an "active owner" here is anyone whose store received an
order that day. Signups without orders don't count.

## Orders per day (last 30d, all tenants)

```sql
select
  date_trunc('day', placed_at)::date as day,
  count(*)                            as order_count,
  count(*) filter (where status = 'COMPLETED') as completed,
  count(*) filter (where status = 'CANCELLED') as cancelled
from public.orders
where placed_at >= now() - interval '30 days'
group by 1
order by 1 desc;
```

## Revenue per day (only COMPLETED)

```sql
select
  date_trunc('day', placed_at)::date as day,
  sum(total_amount)::numeric(14,2)   as revenue,
  avg(total_amount)::numeric(14,2)   as avg_order_value
from public.orders
where status = 'COMPLETED'
  and placed_at >= now() - interval '30 days'
group by 1
order by 1 desc;
```

## Top-10 stores by revenue (last 7d)

```sql
select s.slug, s.name,
       sum(o.total_amount)::numeric(14,2) as revenue,
       count(*)                             as orders
from public.orders o
join public.stores s on s.id = o.store_id
where o.status = 'COMPLETED'
  and o.placed_at >= now() - interval '7 days'
group by s.slug, s.name
order by revenue desc
limit 10;
```

## Payment capture success rate (last 24h)

```sql
select
  count(*) filter (where payment_status = 'PAID')::float
    / nullif(count(*), 0) * 100 as pct_paid,
  count(*) filter (where payment_status = 'PAID') as paid,
  count(*) filter (where payment_status = 'FAILED') as failed,
  count(*) filter (where payment_status = 'PENDING') as pending
from public.orders
where placed_at >= now() - interval '24 hours'
  and payment_method = 'ONLINE';
```

## Cutover progress (during T-0 to T+24h)

```sql
-- users imported from legacy vs. new signups
select
  count(*) filter (where raw_app_meta_data ? 'legacy_user_id') as imported,
  count(*) filter (where not (raw_app_meta_data ? 'legacy_user_id')) as native
from auth.users;
```

## Query performance snapshot

```sql
-- top 10 slowest queries in the last hour
select round(mean_exec_time::numeric, 1) as mean_ms,
       calls,
       round(total_exec_time::numeric, 1) as total_ms,
       substring(query for 120) as q
from extensions.pg_stat_statements
where last_call > now() - interval '1 hour'
order by total_exec_time desc
limit 10;
```

If `pg_stat_statements` is empty, the Stage 6 perf-hardening migration
did not apply — see Runbook §8.5.
