<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Add_org_membership_application_details
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

        foreach ([
            'applicant_full_name' => [
                'type' => 'VARCHAR',
                'constraint' => 150,
                'null' => TRUE
            ],
            'applicant_department' => [
                'type' => 'VARCHAR',
                'constraint' => 150,
                'null' => TRUE
            ],
            'applicant_section' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
                'null' => TRUE
            ],
            'applicant_year_level' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => TRUE
            ]
        ] as $column => $definition) {
            if (!$dbforge->column_exists('org_registrations', $column)) {
                $dbforge->add_column('org_registrations', [
                    $column => $definition
                ]);
            }
        }
    }

    public function down()
    {
        $dbforge = $this->_lava->dbforge;

        foreach ([
            'applicant_year_level',
            'applicant_section',
            'applicant_department',
            'applicant_full_name'
        ] as $column) {
            if ($dbforge->column_exists('org_registrations', $column)) {
                $dbforge->drop_column('org_registrations', $column);
            }
        }
    }
}
