CREATE UNIQUE INDEX uk_users_active_display_name
    ON users (display_name)
    WHERE account_status = 'ACTIVE';
