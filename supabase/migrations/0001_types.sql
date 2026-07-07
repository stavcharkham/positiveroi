create extension if not exists pgcrypto;
create schema if not exists app;

create type member_role   as enum ('admin','lead','builder');
create type tool_type     as enum ('automation','skill','agent','app');
create type tool_status   as enum ('active','archived');
create type event_source  as enum ('rest','mcp','hook','sdk','manual');
create type metric_unit   as enum ('currency','count','duration');
create type api_key_scope as enum ('ingest','read');
create type badge_type    as enum ('multiplier');
