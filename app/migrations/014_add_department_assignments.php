<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_department_assignments
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

        if (!$dbforge->column_exists('users', 'dept_id')) {
            $dbforge->add_column('users', [
                'dept_id' => [
                    'type' => 'INT',
                    'constraint' => 11,
                    'unsigned' => TRUE,
                    'null' => TRUE
                ]
            ]);

            $db->raw("
                UPDATE users u
                INNER JOIN sections s ON s.section_id = u.section_id
                SET u.dept_id = s.dept_id
                WHERE u.dept_id IS NULL
            ");
            $db->raw(
                'ALTER TABLE `users`
                 ADD KEY `idx_users_dept_id` (`dept_id`)'
            );
            $db->raw("
                ALTER TABLE `users`
                ADD CONSTRAINT `fk_users_department`
                FOREIGN KEY (`dept_id`)
                REFERENCES `departments` (`dept_id`)
                ON UPDATE CASCADE
                ON DELETE SET NULL
            ");
        }

        if (!$dbforge->column_exists('events', 'dept_id')) {
            $dbforge->add_column('events', [
                'dept_id' => [
                    'type' => 'INT',
                    'constraint' => 11,
                    'unsigned' => TRUE,
                    'null' => TRUE
                ]
            ]);

            $db->raw("
                UPDATE events e
                INNER JOIN users u ON u.user_id = e.created_by
                SET e.dept_id = u.dept_id
                WHERE e.dept_id IS NULL
            ");
            $db->raw(
                'ALTER TABLE `events`
                 ADD KEY `idx_events_dept_id` (`dept_id`)'
            );
            $db->raw("
                ALTER TABLE `events`
                ADD CONSTRAINT `fk_events_department`
                FOREIGN KEY (`dept_id`)
                REFERENCES `departments` (`dept_id`)
                ON UPDATE CASCADE
                ON DELETE SET NULL
            ");
        }
    }

    public function down()
    {
        $dbforge = $this->_lava->dbforge;
        $db = $this->_lava->db;

        if ($dbforge->column_exists('events', 'dept_id')) {
            $db->raw(
                'ALTER TABLE `events`
                 DROP FOREIGN KEY `fk_events_department`'
            );
            $db->raw(
                'ALTER TABLE `events`
                 DROP INDEX `idx_events_dept_id`'
            );
            $dbforge->drop_column('events', 'dept_id');
        }

        if ($dbforge->column_exists('users', 'dept_id')) {
            $db->raw(
                'ALTER TABLE `users`
                 DROP FOREIGN KEY `fk_users_department`'
            );
            $db->raw(
                'ALTER TABLE `users`
                 DROP INDEX `idx_users_dept_id`'
            );
            $dbforge->drop_column('users', 'dept_id');
        }
    }
}
