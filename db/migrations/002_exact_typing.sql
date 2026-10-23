alter table study_items drop constraint study_items_type_check;
alter table study_items add constraint study_items_type_check check (type in ('flashcard', 'multiple-choice', 'write', 'debug-code', 'verbatim'));
alter table study_items add column memory_hook text;
alter table study_items add column sentences jsonb not null default '[]'::jsonb;
alter table study_attempts add column sentence_id text;
alter table study_attempts add column stage text;
alter table study_attempts add column rating text check (rating in ('again', 'hard', 'good', 'easy'));
create table exact_typing_progress (
  id text primary key,
  owner_id text,
  study_item_id text not null references study_items(id) on delete cascade,
  sentence_id text not null,
  stage text not null check (stage in ('copy', 'fill-gaps', 'first-letters', 'exact', 'cumulative')),
  target text not null,
  completed boolean not null default false,
  stats jsonb not null,
  updated_at timestamptz not null default now()
);
create index exact_typing_progress_item_idx on exact_typing_progress(study_item_id, owner_id);
