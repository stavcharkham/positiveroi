-- 0010: first-run experience fields + optional hourly rate (Track G)
--
-- The hourly rate becomes optional: null = unset, dashboards lead with
-- hours and show money only when a rate exists. Existing rows keep their
-- value; only the default for new workspaces goes away.
--
-- Workspace profile (asked once, in onboarding): website (logo pulled from
-- the site), company size. Member profile: builder type — a signal, both
-- kinds see the same UI.

alter table workspaces
  alter column hourly_rate_cents drop not null,
  alter column hourly_rate_cents drop default,
  add column website text
    check (website is null or website ~* '^https?://\S{1,200}$'),
  add column company_size text
    check (company_size is null
           or company_size in ('just_me', '2_10', '11_50', '51_plus')),
  add column logo_url text
    check (logo_url is null or char_length(logo_url) <= 600);

alter table members
  add column builder_type text
    check (builder_type is null
           or builder_type in ('non_technical', 'technical'));
