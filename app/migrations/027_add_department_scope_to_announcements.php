<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_department_scope_to_announcements
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

        if (!$dbforge->column_exists('announcements', 'dept_id')) {
            $db->raw("
                ALTER TABLE `announcements`
                ADD COLUMN `dept_id` INT(11) UNSIGNED NULL,
                ADD KEY `idx_announcements_dept_id` (`dept_id`),
                ADD CONSTRAINT `fk_announcements_department`
                    FOREIGN KEY (`dept_id`)
                    REFERENCES `departments` (`dept_id`)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            ");
        }
    }

    public function down()
    {
        $db = $this->_lava->db;
        $dbforge = $this->_lava->dbforge;

        if ($dbforge->column_exists('announcements', 'dept_id')) {
            $db->raw("
                ALTER TABLE `announcements`
                DROP FOREIGN KEY `fk_announcements_department`,
                DROP INDEX `idx_announcements_dept_id`
            ");
            $dbforge->drop_column('announcements', 'dept_id');
        }
    }
}
