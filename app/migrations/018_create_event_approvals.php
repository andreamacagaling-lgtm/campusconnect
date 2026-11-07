<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Create_event_approvals
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        $dbforge = $this->_lava->dbforge;
        $db = $this->_lava->db;

        if (!$dbforge->column_exists('users', 'admin_type')) {
            $db->raw("
                ALTER TABLE `users`
                ADD COLUMN `admin_type`
                    ENUM('department','usg','osse')
                    NOT NULL DEFAULT 'department'
            ");
        }

        $db->raw("
            UPDATE `users`
            SET `admin_type` = CASE
                WHEN `dept_id` IS NULL THEN 'usg'
                ELSE 'department'
            END
            WHERE `role` = 'admin'
        ");

        $db->raw("
            UPDATE `users`
            SET `admin_type` = 'osse'
            WHERE `role` = 'admin'
              AND LOWER(`email`) = LOWER('campus.osse@gmail.com')
        ");

        if (!$dbforge->column_exists('events', 'org_id')) {
            $db->raw("
                ALTER TABLE `events`
                ADD COLUMN `org_id` INT(11) UNSIGNED NULL,
                ADD KEY `idx_events_org_id` (`org_id`),
                ADD CONSTRAINT `fk_events_organization`
                    FOREIGN KEY (`org_id`)
                    REFERENCES `organizations` (`org_id`)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            ");
        }

        if (!$dbforge->column_exists('events', 'approval_status')) {
            $db->raw("
                ALTER TABLE `events`
                ADD COLUMN `approval_status`
                    ENUM('pending','approved','rejected')
                    NOT NULL DEFAULT 'pending'
            ");
            $db->raw("
                UPDATE `events`
                SET `approval_status` = 'approved'
            ");
        }

        if (!$dbforge->column_exists('events', 'approval_note')) {
            $db->raw("
                ALTER TABLE `events`
                ADD COLUMN `approval_note` TEXT NULL
            ");
        }

        if (!$dbforge->column_exists('events', 'reviewed_by')) {
            $db->raw("
                ALTER TABLE `events`
                ADD COLUMN `reviewed_by` INT(11) UNSIGNED NULL,
                ADD KEY `idx_events_reviewed_by` (`reviewed_by`),
                ADD CONSTRAINT `fk_events_reviewed_by`
                    FOREIGN KEY (`reviewed_by`)
                    REFERENCES `users` (`user_id`)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            ");
        }

        if (!$dbforge->column_exists('events', 'reviewed_at')) {
            $db->raw("
                ALTER TABLE `events`
                ADD COLUMN `reviewed_at` DATETIME NULL
            ");
        }
    }

    public function down()
    {
        $dbforge = $this->_lava->dbforge;
        $db = $this->_lava->db;

        if ($dbforge->column_exists('events', 'reviewed_by')) {
            $db->raw(
                'ALTER TABLE `events` DROP FOREIGN KEY `fk_events_reviewed_by`'
            );
            $db->raw(
                'ALTER TABLE `events` DROP INDEX `idx_events_reviewed_by`'
            );
            $dbforge->drop_column('events', 'reviewed_by');
        }

        foreach ([
            'reviewed_at',
            'approval_note',
            'approval_status'
        ] as $column) {
            if ($dbforge->column_exists('events', $column)) {
                $dbforge->drop_column('events', $column);
            }
        }

        if ($dbforge->column_exists('events', 'org_id')) {
            $db->raw(
                'ALTER TABLE `events` DROP FOREIGN KEY `fk_events_organization`'
            );
            $db->raw(
                'ALTER TABLE `events` DROP INDEX `idx_events_org_id`'
            );
            $dbforge->drop_column('events', 'org_id');
        }

        if ($dbforge->column_exists('users', 'admin_type')) {
            $dbforge->drop_column('users', 'admin_type');
        }
    }
}
