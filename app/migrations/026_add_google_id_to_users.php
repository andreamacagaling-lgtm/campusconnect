<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_google_id_to_users
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

        if (!$dbforge->column_exists('users', 'google_id')) {
            $dbforge->add_column('users', [
                'google_id' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => TRUE
                ]
            ]);
        }

        $db->raw("
            ALTER TABLE users
            ADD UNIQUE KEY `uq_users_google_id` (`google_id`)
        ");
    }

    public function down()
    {
        $dbforge = $this->_lava->dbforge;
        $db = $this->_lava->db;

        if ($dbforge->column_exists('users', 'google_id')) {
            $db->raw("
                ALTER TABLE users
                DROP INDEX `uq_users_google_id`
            ");
            $dbforge->drop_column('users', 'google_id');
        }
    }
}
