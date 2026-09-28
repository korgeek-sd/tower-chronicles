-- v0.1.66: cover association user foreign keys used by moderation/activity cleanup.
create index if not exists online_association_applications_reviewed_by_idx
on private.online_association_applications(reviewed_by)
where reviewed_by is not null;

create index if not exists online_association_activity_actor_idx
on private.online_association_activity(actor_user_id)
where actor_user_id is not null;
