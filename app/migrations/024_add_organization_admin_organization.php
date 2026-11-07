<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_organization_admin_department
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

        if (!$dbforge->column_exists('users', 'organization_dept_id')) {
            $dbforge->add_column('users', [
                'organization_dept_id' => [
                    'type' => 'INT',
                    'constraint' => 11,
                    'unsigned' => TRUE,
                    'null' => TRUE
                ]
            ]);
        }

        $db->raw("
            UPDATE users
            SET organization_dept_id = dept_id
            WHERE role = 'admin'
              AND admin_type = 'organization'
              AND organization_dept_id IS NULL
              AND dept_id IS NOT NULL
        ");
        $db->raw("
            UPDATE users
            SET status = 'active'
            WHERE role = 'admin'
              AND admin_type = 'organization'
        ");

        $duplicates = $db->raw("
            SELECT organization_dept_id, COUNT(*) AS account_count
            FROM users
            WHERE role = 'admin'
              AND admin_type = 'organization'
              AND organization_dept_id IS NOT NULL
            GROUP BY organization_dept_id
            HAVING COUNT(*) > 1
            LIMIT 1
        ")->fetch(PDO::FETCH_ASSOC);

        if ($duplicates) {
            throw new RuntimeException(
                'Multiple organization administrator accounts exist for department ' .
                $duplicates['organization_dept_id'] .
                '; resolve the duplicate before applying this migration.'
            );
        }

        $db->raw("
            UPDATE users
            SET dept_id = NULL,
                student_no = NULL
            WHERE role = 'admin'
              AND admin_type = 'organization'
        ");

        $db->raw("
            ALTER TABLE users
            ADD UNIQUE KEY `uq_users_organization_department`
                (`organization_dept_id`),
            ADD CONSTRAINT `fk_users_organization_department`
                FOREIGN KEY (`organization_dept_id`)
                REFERENCES departments (`dept_id`)
                ON UPDATE CASCADE
                ON DELETE SET NULL
        ");
    }

    public function down()
    {
        $db = $this->_lava->db;
        $dbforge = $this->_lava->dbforge;

        if ($dbforge->column_exists('users', 'organization_dept_id')) {
            $db->raw("
                UPDATE users
                SET dept_id = organization_dept_id
                WHERE role = 'admin'
                  AND admin_type = 'organization'
                  AND organization_dept_id IS NOT NULL
            ");
            $db->raw("
                ALTER TABLE users
                DROP FOREIGN KEY `fk_users_organization_department`,
                DROP INDEX `uq_users_organization_department`
            ");
            $dbforge->drop_column('users', 'organization_dept_id');
        }
    }
}
