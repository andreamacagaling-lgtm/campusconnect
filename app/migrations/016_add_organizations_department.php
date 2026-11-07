<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_organization_department
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

        if (!$dbforge->column_exists('organizations', 'dept_id')) {
            $dbforge->add_column('organizations', [
                'dept_id' => [
                    'type' => 'INT',
                    'constraint' => 11,
                    'unsigned' => TRUE,
                    'null' => TRUE
                ]
            ]);

            $db->raw(
                'ALTER TABLE `organizations`
                 ADD KEY `idx_organizations_dept_id` (`dept_id`)'
            );
            $db->raw("
                ALTER TABLE `organizations`
                ADD CONSTRAINT `fk_organizations_department`
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

        if ($dbforge->column_exists('organizations', 'dept_id')) {
            $db->raw(
                'ALTER TABLE `organizations`
                 DROP FOREIGN KEY `fk_organizations_department`'
            );
            $db->raw(
                'ALTER TABLE `organizations`
                 DROP INDEX `idx_organizations_dept_id`'
            );
            $dbforge->drop_column('organizations', 'dept_id');
        }
    }
}
