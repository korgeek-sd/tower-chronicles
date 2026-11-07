-- The status helper runs inside the claim transaction, after the reward receipt insert.
-- A STABLE function cannot observe the current calling command's inserts.
-- VOLATILE allows the returned same-request status to show today's reward as claimed.
alter function private.free_attendance_status_json(uuid) volatile;
