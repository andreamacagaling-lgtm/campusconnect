<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Assign_departments_to_admin_accounts
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
            UPDATE users u
            INNER JOIN departments d
                ON LOWER(TRIM(u.full_name)) = LOWER(TRIM(d.dept_name))
                OR LOWER(SUBSTRING_INDEX(u.email, '@', 1)) = CONCAT(
                    'admin.',
                    LOWER(TRIM(SUBSTRING_INDEX(d.dept_name, '/', 1)))
                )
            SET u.dept_id = d.dept_id
            WHERE u.role = 'admin'
              AND u.dept_id IS NULL
        ");
    }

    public function down()
    {
        $this->_lava->db->raw("
            UPDATE users u
            INNER JOIN departments d ON d.dept_id = u.dept_id
            SET u.dept_id = NULL
            WHERE u.role = 'admin'
              AND (
                  LOWER(TRIM(u.full_name)) = LOWER(TRIM(d.dept_name))
                  OR LOWER(SUBSTRING_INDEX(u.email, '@', 1)) = CONCAT(
                      'admin.',
                        LOWER(TRIM(SUBSTRING_INDEX(d.dept_name, '/', 1)))
                  )
              )
        ");
    }
}
