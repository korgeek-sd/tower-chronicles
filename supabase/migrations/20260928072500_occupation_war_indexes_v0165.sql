-- v0.1.65: cover occupation user foreign keys used by matchmaking and cleanup.
create index if not exists occupation_participants_user_idx
on private.occupation_participants(user_id);

create index if not exists occupation_duels_attacker_idx
on private.occupation_duels(attacker_user_id);

create index if not exists occupation_duels_defender_idx
on private.occupation_duels(defender_user_id);

create index if not exists occupation_duels_current_actor_idx
on private.occupation_duels(current_actor);

create index if not exists occupation_duels_winner_idx
on private.occupation_duels(winner_user_id)
where winner_user_id is not null;
