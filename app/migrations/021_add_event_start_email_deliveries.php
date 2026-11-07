<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_event_start_email_deliveries
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        $this->_lava->db->raw("
            CREATE TABLE IF NOT EXISTS `event_start_email_deliveries` (
                `delivery_id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
                `event_id` INT(11) UNSIGNED NOT NULL,
                `user_id` INT(11) UNSIGNED NOT NULL,
                `status` ENUM('pending', 'sent', 'failed')
                    NOT NULL DEFAULT 'pending',
                `attempts` TINYINT(3) UNSIGNED NOT NULL DEFAULT 0,
                `sent_at` DATETIME NULL,
                `last_error` VARCHAR(500) NULL,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`delivery_id`),
                UNIQUE KEY `uq_event_start_email` (`event_id`, `user_id`),
                KEY `idx_event_start_email_pending` (`status`, `event_id`),
                CONSTRAINT `fk_event_start_email_event`
                    FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT `fk_event_start_email_user`
                    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
                    ON UPDATE CASCADE ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('event_start_email_deliveries', TRUE);
    }
}
