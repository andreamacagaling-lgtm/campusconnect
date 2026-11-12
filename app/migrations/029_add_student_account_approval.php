<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_student_account_approval
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
            ALTER TABLE `users`
            MODIFY COLUMN `status`
                ENUM('pending','active','inactive')
                NOT NULL DEFAULT 'active'
        ");
    }

    public function down()
    {
        $this->_lava->db->raw("
            UPDATE `users`
            SET `status` = 'inactive'
            WHERE `status` = 'pending'
        ");
        $this->_lava->db->raw("
            ALTER TABLE `users`
            MODIFY COLUMN `status`
                ENUM('active','inactive')
                NOT NULL DEFAULT 'active'
        ");
    }
}
