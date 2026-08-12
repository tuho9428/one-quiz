create table if not exists study_sets (
  id text primary key,
  owner_id text,
  title text not null,
  description text not null default '',
  source_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists study_items (
  id text primary key,
  study_set_id text not null references study_sets(id) on delete cascade,
  type text not null check (type in ('flashcard', 'multiple-choice', 'write', 'debug-code')),
  task text not null default 'explain-behavior',
  question text not null,
  answer text not null,
  explanation text,
  code_snippet text,
  language text,
  position integer not null default 0,
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_set_id, source_key)
);

create table if not exists study_item_options (
  id text primary key,
  study_item_id text not null references study_items(id) on delete cascade,
  option_text text not null,
  position integer not null default 0,
  is_correct boolean not null default false,
  unique (study_item_id, position)
);

create table if not exists tags (
  id text primary key,
  name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists study_item_tags (
  study_item_id text not null references study_items(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  primary key (study_item_id, tag_id)
);

create table if not exists study_sessions (
  id text primary key,
  owner_id text,
  study_set_id text not null references study_sets(id) on delete cascade,
  mode text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  score integer check (score is null or score between 0 and 100)
);

create table if not exists study_attempts (
  id text primary key,
  session_id text not null references study_sessions(id) on delete cascade,
  study_item_id text not null references study_items(id) on delete cascade,
  mode text not null,
  user_answer text not null default '',
  score integer check (score is null or score between 0 and 100),
  result text not null check (result in ('correct', 'partial', 'incorrect', 'skipped')),
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists study_progress (
  id text primary key,
  owner_id text,
  study_item_id text not null references study_items(id) on delete cascade,
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  times_seen integer not null default 0 check (times_seen >= 0),
  times_correct integer not null default 0 check (times_correct >= 0),
  times_incorrect integer not null default 0 check (times_incorrect >= 0),
  consecutive_successes integer not null default 0 check (consecutive_successes >= 0),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  review_interval integer not null default 0 check (review_interval >= 0),
  last_result text check (last_result is null or last_result in ('correct', 'partial', 'incorrect', 'skipped'))
);

create unique index if not exists study_progress_owner_item_uidx
  on study_progress (coalesce(owner_id, ''), study_item_id);

create index if not exists study_sets_owner_idx on study_sets(owner_id, updated_at desc);
create index if not exists study_items_set_position_idx on study_items(study_set_id, position);
create index if not exists study_items_type_idx on study_items(type);
create index if not exists study_item_options_item_idx on study_item_options(study_item_id, position);
create index if not exists study_item_tags_tag_idx on study_item_tags(tag_id);
create index if not exists study_sessions_set_idx on study_sessions(study_set_id, started_at desc);
create index if not exists study_attempts_item_idx on study_attempts(study_item_id, created_at desc);
create index if not exists study_attempts_session_idx on study_attempts(session_id, created_at);
create index if not exists study_progress_due_idx on study_progress(owner_id, next_review_at);
create index if not exists study_progress_weak_idx on study_progress(owner_id, mastery_score);
