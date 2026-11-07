<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_event_link_to_announcements
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

        if (!$dbforge->column_exists('announcements', 'event_id')) {
            $db->raw("
                ALTER TABLE `announcements`
                ADD COLUMN `event_id` INT(11) UNSIGNED NULL,
                ADD KEY `idx_announcements_event_id` (`event_id`),
                ADD CONSTRAINT `fk_announcements_event`
                    FOREIGN KEY (`event_id`)
                    REFERENCES `events` (`event_id`)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            ");
        }
    }

    public function down()
    {
        $dbforge = $this->_lava->dbforge;
        $db = $this->_lava->db;

        if ($dbforge->column_exists('announcements', 'event_id')) {
            $db->raw(
                'ALTER TABLE `announcements`
                 DROP FOREIGN KEY `fk_announcements_event`'
            );
            $db->raw(
                'ALTER TABLE `announcements`
                 DROP INDEX `idx_announcements_event_id`'
            );
            $dbforge->drop_column('announcements', 'event_id');
        }
    }
}
