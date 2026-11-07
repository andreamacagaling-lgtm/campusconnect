
<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Create_organizations_table
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        if ($this->_lava->dbforge->table_exists('organizations')) {
            return;
        }

        $this->_lava->dbforge
            ->add_field([
                'org_id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => TRUE,
                    'auto_increment' => TRUE,
                    'null'           => FALSE
                ],
                'org_name' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 150,
                    'null'       => FALSE
                ],
                'category' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => FALSE
                ],
                'description' => [
                    'type' => 'TEXT',
                    'null' => FALSE
                ],
                'eligibility' => [
                    'type' => 'TEXT',
                    'null' => TRUE
                ],
                'status' => [
                    'type'       => 'ENUM',
                    'constraint' => "'pending','active','inactive'",
                    'null'       => FALSE,
                    'default'    => 'pending'
                ],
                'created_at' => [
                    'type'    => 'TIMESTAMP',
                    'null'    => FALSE,
                    'default' => 'CURRENT_TIMESTAMP'
                ]
            ])
            ->add_key('org_id', TRUE)
            ->add_key('org_name', FALSE, TRUE)
            ->create_table('organizations');
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('organizations', TRUE);
    }
}
