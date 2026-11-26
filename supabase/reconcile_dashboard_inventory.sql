-- Dashboard inventory reconciliation for built-in projects.
-- Safe to run: inserts only missing Meenakshi plot rows and never overwrites
-- existing plot statuses. Does NOT delete Saraswathi records.
--
-- Built-in project IDs:
-- Saraswathi Garden = 3 (layout contains 32 plots)
-- Sri Meenakshi Garden Phase 1 = 4 (layout contains plots 1..42)
-- Sri Meenakshi Garden Phase 2 = 5 (layout contains plots 1..49)

begin;

insert into public.plots (project_id, plot_number, status)
select 4, n::text, 'Available'
from generate_series(1, 42) as n
where not exists (
  select 1 from public.plots p
  where p.project_id = 4
    and trim(p.plot_number::text) = n::text
);

insert into public.plots (project_id, plot_number, status)
select 5, n::text, 'Available'
from generate_series(1, 49) as n
where not exists (
  select 1 from public.plots p
  where p.project_id = 5
    and trim(p.plot_number::text) = n::text
);

commit;

-- 1) Summary for the three affected projects.
select
  project_id,
  count(*) as total_rows,
  count(*) filter (where lower(trim(coalesce(status, ''))) = 'available') as available,
  count(*) filter (where lower(trim(coalesce(status, ''))) = 'reserved') as reserved,
  count(*) filter (where lower(trim(coalesce(status, ''))) = 'booked') as booked,
  count(*) filter (where lower(trim(coalesce(status, ''))) = 'sold') as sold,
  count(*) filter (where lower(trim(coalesce(status, ''))) not in ('available','reserved','booked','sold')) as unknown_status
from public.plots
where project_id in (3, 4, 5)
group by project_id
order by project_id;

-- 2) Saraswathi Garden: list duplicate plot numbers, if any.
select
  trim(plot_number::text) as plot_number,
  count(*) as duplicate_rows,
  array_agg(id order by id) as row_ids
from public.plots
where project_id = 3
group by trim(plot_number::text)
having count(*) > 1
order by trim(plot_number::text);

-- 3) Saraswathi Garden: rows whose plot number is outside the layout range 1..32.
-- Review these rows before deleting or changing anything.
select id, project_id, plot_number, status
from public.plots
where project_id = 3
  and (
    nullif(trim(plot_number::text), '') is null
    or case
      when trim(plot_number::text) ~ '^[0-9]+  )
order by id;

        then trim(plot_number::text)::integer not between 1 and 32
      else true
    end
  )
order by id;
