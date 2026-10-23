-- =====================================================================
-- FINTIX v1 database
--
-- Profiles, the trading simulator's account (cash, holdings, trades), the
-- simulator's tutorial progress and Learning Hub progress, for every
-- signed-in player (email, Google, or anonymous "test account" sign-ins).
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste this
-- whole file -> Run. It is safe to run again (it creates what is missing
-- and replaces functions and policies).
--
-- Money is in whole paise (1 rupee = 100 paise), as in the app.
-- Every player starts with 1,00,000 virtual rupees = 10,000,000 paise.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. The market's eight fictional assets
--    base_price (paise) is the asset's typical price, used to reject
--    prices that could not have come from the simulated market.
-- ---------------------------------------------------------------------

create table if not exists public.sim_assets (
  ticker     text primary key,
  name       text   not null,
  sector     text   not null,
  base_price bigint not null check (base_price > 0)
);

insert into public.sim_assets (ticker, name, sector, base_price) values
  ('NOVA', 'Nova',  'Technology',        24860),
  ('AERO', 'Aero',  'Aviation',          16420),
  ('VNTA', 'Vanta', 'Consumer',           9280),
  ('KRON', 'Kron',  'Energy',            31010),
  ('MEDX', 'Medix', 'Healthcare',        51240),
  ('TERA', 'Terra', 'Food',               6840),
  ('BOLT', 'Bolt',  'Electric vehicles', 73500),
  ('LUMA', 'Luma',  'Banking',           18530)
on conflict (ticker) do update
  set name = excluded.name, sector = excluded.sector, base_price = excluded.base_price;


-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------

-- One row per player: the name shown in the app ("Medansh's city").
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The simulator account: cash and total realised profit or loss, in paise.
create table if not exists public.sim_accounts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  cash       bigint not null default 10000000 check (cash >= 0),
  realised   bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shares held, and what the shares still held cost (average-cost basis).
create table if not exists public.sim_holdings (
  user_id uuid    not null references auth.users (id) on delete cascade,
  ticker  text    not null references public.sim_assets (ticker),
  qty     integer not null check (qty > 0),
  cost    bigint  not null check (cost >= 0),
  primary key (user_id, ticker)
);

-- Every filled order. order_id is the app's own id for the order, so the
-- same order can never be filled twice.
create table if not exists public.sim_trades (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid    not null references auth.users (id) on delete cascade,
  order_id      text    not null check (char_length(order_id) between 1 and 64),
  side          text    not null check (side in ('buy', 'sell')),
  ticker        text    not null references public.sim_assets (ticker),
  qty           integer not null check (qty > 0),
  price         bigint  not null check (price > 0),
  total         bigint  not null,
  realised      bigint,
  market_minute bigint  not null,
  executed_at   timestamptz not null default now(),
  constraint sim_trades_total_matches check (total = qty::bigint * price),
  constraint sim_trades_realised_on_sales check ((side = 'sell') = (realised is not null)),
  constraint sim_trades_order_once unique (user_id, order_id)
);

create index if not exists sim_trades_user_newest on public.sim_trades (user_id, executed_at desc);

-- The simulator tutorial: where the player is in it and what they finished.
create table if not exists public.sim_progress (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  tutorial_done     boolean not null default false,
  tutorial_skipped  boolean not null default false,
  beginner_done     boolean not null default false,
  intermediate_done boolean not null default false,
  tutorial_run      jsonb   not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);

-- Learning Hub: lessons finished ("module-slug/lesson-slug") and challenges passed.
create table if not exists public.learn_lessons (
  user_id      uuid not null references auth.users (id) on delete cascade,
  lesson       text not null check (lesson ~ '^[a-z0-9-]+/[a-z0-9-]+$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson)
);

create table if not exists public.learn_challenges (
  user_id   uuid not null references auth.users (id) on delete cascade,
  module    text not null check (module ~ '^[a-z0-9-]+$'),
  passed_at timestamptz not null default now(),
  primary key (user_id, module)
);


-- ---------------------------------------------------------------------
-- 3. Keep updated_at current
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists sim_accounts_touch on public.sim_accounts;
create trigger sim_accounts_touch before update on public.sim_accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists sim_progress_touch on public.sim_progress;
create trigger sim_progress_touch before update on public.sim_progress
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- 4. A new player gets a profile, a fresh account and tutorial progress
--    The name comes from Google (full_name / name), else the part of the
--    email before the @, else "Player" (anonymous test accounts).
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Player'
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.sim_accounts (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.sim_progress (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Players who signed up before this script ran get their rows too.
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                     nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
                     nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                     'Player'), 40),
       u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

insert into public.sim_accounts (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.sim_progress (user_id) select id from auth.users on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------
-- 5. Placing a trade
--    The only way cash, holdings and trades change. It runs as one
--    transaction with the player's account locked, so a refused order
--    changes nothing and two orders can't race each other.
--
--    The app sends the price it quoted and the market minute it was quoted
--    at. The function accepts the minute only if it is within 2 minutes of
--    the server's market clock (one market minute = 3 seconds, counted from
--    2026-01-01 00:00 UTC, as in the app), and the price only if it is on
--    the 5-paise tick and within half to double the asset's typical price.
--    It then applies exactly the app's rules: a buy needs the cash; a sell
--    needs the shares, and takes its share of the cost at the average price
--    (rounded to the nearest paisa), the rest being realised profit or loss.
--
--    Calling it again with the same order_id returns the first fill.
-- ---------------------------------------------------------------------

create or replace function public.place_trade(
  p_order_id text,
  p_side     text,
  p_ticker   text,
  p_qty      integer,
  p_price    bigint,
  p_minute   bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user          uuid   := auth.uid();
  v_server_minute bigint := floor((extract(epoch from clock_timestamp()) * 1000 - 1767225600000) / 3000);
  v_base          bigint;
  v_cash          bigint;
  v_held          integer;
  v_cost          bigint;
  v_total         bigint;
  v_cost_out      bigint;
  v_realised      bigint;
  v_trade         public.sim_trades;
begin
  if v_user is null then
    raise exception 'Sign in to place trades.' using errcode = '28000';
  end if;

  -- The same order twice: return the first fill instead of filling it again.
  select * into v_trade from public.sim_trades where user_id = v_user and order_id = p_order_id;
  if found then
    return jsonb_build_object(
      'trade', to_jsonb(v_trade),
      'cash', (select cash from public.sim_accounts where user_id = v_user),
      'repeated', true
    );
  end if;

  if p_side is null or p_side not in ('buy', 'sell') then
    raise exception 'Choose buy or sell.' using errcode = '22023';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantity must be at least 1 share.' using errcode = '22023';
  end if;

  select base_price into v_base from public.sim_assets where ticker = p_ticker;
  if not found then
    raise exception 'That asset isn''t in this market.' using errcode = '22023';
  end if;

  if p_minute is null or abs(p_minute - v_server_minute) > 2 then
    raise exception 'The price has moved on since this order was prepared. Check the price and try again.' using errcode = '22023';
  end if;
  if p_price is null or p_price % 5 <> 0 or p_price * 2 < v_base or p_price > v_base * 2 then
    raise exception 'That isn''t a price from this market.' using errcode = '22023';
  end if;

  v_total := p_qty::bigint * p_price;

  insert into public.sim_accounts (user_id) values (v_user) on conflict (user_id) do nothing;
  select cash into v_cash from public.sim_accounts where user_id = v_user for update;
  select qty, cost into v_held, v_cost from public.sim_holdings where user_id = v_user and ticker = p_ticker for update;
  v_held := coalesce(v_held, 0);
  v_cost := coalesce(v_cost, 0);

  if p_side = 'buy' then
    if v_total > v_cash then
      raise exception 'Not enough virtual cash for this order.' using errcode = '22023';
    end if;
    update public.sim_accounts set cash = cash - v_total where user_id = v_user;
    insert into public.sim_holdings (user_id, ticker, qty, cost)
    values (v_user, p_ticker, p_qty, v_total)
    on conflict (user_id, ticker) do update
      set qty = public.sim_holdings.qty + excluded.qty,
          cost = public.sim_holdings.cost + excluded.cost;
  else
    if p_qty > v_held then
      raise exception 'You don''t hold that many shares.' using errcode = '22023';
    end if;
    v_cost_out := round(v_cost::numeric * p_qty / v_held)::bigint;
    v_realised := v_total - v_cost_out;
    update public.sim_accounts
      set cash = cash + v_total, realised = realised + v_realised
      where user_id = v_user;
    if p_qty = v_held then
      delete from public.sim_holdings where user_id = v_user and ticker = p_ticker;
    else
      update public.sim_holdings
        set qty = qty - p_qty, cost = cost - v_cost_out
        where user_id = v_user and ticker = p_ticker;
    end if;
  end if;

  insert into public.sim_trades (user_id, order_id, side, ticker, qty, price, total, realised, market_minute)
  values (v_user, p_order_id, p_side, p_ticker, p_qty, p_price, v_total, v_realised, p_minute)
  returning * into v_trade;

  return jsonb_build_object(
    'trade', to_jsonb(v_trade),
    'cash', (select cash from public.sim_accounts where user_id = v_user),
    'repeated', false
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 6. The whole account in one call, shaped like the app's own Account:
--    { version, cash, realised, holdings: { TICKER: { qty, cost } },
--      trades: [ newest first ] }
-- ---------------------------------------------------------------------

create or replace function public.get_my_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 1,
    'cash', a.cash,
    'realised', a.realised,
    'holdings', coalesce((
      select jsonb_object_agg(h.ticker, jsonb_build_object('qty', h.qty, 'cost', h.cost))
      from public.sim_holdings h where h.user_id = a.user_id
    ), '{}'::jsonb),
    'trades', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', t.order_id,
               'side', t.side,
               'ticker', t.ticker,
               'qty', t.qty,
               'price', t.price,
               'total', t.total,
               'realised', t.realised,
               'minute', t.market_minute,
               'at', (extract(epoch from t.executed_at) * 1000)::bigint
             )) order by t.executed_at desc)
      from public.sim_trades t where t.user_id = a.user_id
    ), '[]'::jsonb)
  )
  from public.sim_accounts a
  where a.user_id = auth.uid();
$$;


-- ---------------------------------------------------------------------
-- 7. Row-level security: every player sees and changes only their own rows
-- ---------------------------------------------------------------------

alter table public.sim_assets       enable row level security;
alter table public.profiles         enable row level security;
alter table public.sim_accounts     enable row level security;
alter table public.sim_holdings     enable row level security;
alter table public.sim_trades       enable row level security;
alter table public.sim_progress     enable row level security;
alter table public.learn_lessons    enable row level security;
alter table public.learn_challenges enable row level security;

-- The market's assets are public reference data.
drop policy if exists "Anyone can read the assets" on public.sim_assets;
create policy "Anyone can read the assets" on public.sim_assets
  for select to anon, authenticated using (true);

-- Profiles: read and rename your own.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Account, holdings and trades: read your own. They change only through place_trade.
drop policy if exists "Read own account" on public.sim_accounts;
create policy "Read own account" on public.sim_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read own holdings" on public.sim_holdings;
create policy "Read own holdings" on public.sim_holdings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read own trades" on public.sim_trades;
create policy "Read own trades" on public.sim_trades
  for select to authenticated using ((select auth.uid()) = user_id);

-- Tutorial progress: read and update your own.
drop policy if exists "Read own simulator progress" on public.sim_progress;
create policy "Read own simulator progress" on public.sim_progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Update own simulator progress" on public.sim_progress;
create policy "Update own simulator progress" on public.sim_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Learning progress: read, add and remove your own (the Hub can reset a module).
drop policy if exists "Read own lessons" on public.learn_lessons;
create policy "Read own lessons" on public.learn_lessons
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own lessons" on public.learn_lessons;
create policy "Add own lessons" on public.learn_lessons
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Remove own lessons" on public.learn_lessons;
create policy "Remove own lessons" on public.learn_lessons
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read own challenges" on public.learn_challenges;
create policy "Read own challenges" on public.learn_challenges
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own challenges" on public.learn_challenges;
create policy "Add own challenges" on public.learn_challenges
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Remove own challenges" on public.learn_challenges;
create policy "Remove own challenges" on public.learn_challenges
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------
-- 8. Permissions: belt and braces on top of the policies
--    Players can't write cash, holdings or trades directly at all, and
--    only signed-in players can call the functions.
-- ---------------------------------------------------------------------

revoke insert, update, delete on public.sim_assets   from anon, authenticated;
revoke insert, update, delete on public.sim_accounts from anon, authenticated;
revoke insert, update, delete on public.sim_holdings from anon, authenticated;
revoke insert, update, delete on public.sim_trades   from anon, authenticated;
revoke insert, delete         on public.profiles     from anon, authenticated;
revoke insert, delete         on public.sim_progress from anon, authenticated;

revoke all on function public.place_trade(text, text, text, integer, bigint, bigint) from public, anon;
grant execute on function public.place_trade(text, text, text, integer, bigint, bigint) to authenticated;

revoke all on function public.get_my_account() from public, anon;
grant execute on function public.get_my_account() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
