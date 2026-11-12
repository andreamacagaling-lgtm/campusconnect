<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Create_event_fines
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

        if (!$dbforge->table_exists('event_fine_settings')) {
            $dbforge
                ->add_field([
                    'settings_id' => [
                        'type'       => 'TINYINT',
                        'constraint' => 3,
                        'unsigned'   => TRUE,
                        'null'       => FALSE
                    ],
                    'enabled_from' => [
                        'type' => 'DATETIME',
                        'null' => FALSE
                    ]
                ])
                ->add_key('settings_id', TRUE)
                ->create_table('event_fine_settings');

        }

        $db->raw(
            'INSERT IGNORE INTO `event_fine_settings` (`settings_id`, `enabled_from`)
             VALUES (1, NOW())'
        );

        if ($dbforge->table_exists('event_fines')) {
            return;
        }

        $this->_lava->dbforge
            ->add_field([
                'fine_id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => TRUE,
                    'auto_increment' => TRUE,
                    'null'           => FALSE
                ],
                'event_reg_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => TRUE,
                    'null'       => FALSE
                ],
                'fine_amount' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '8,2',
                    'default'    => '25.00',
                    'null'       => FALSE
                ],
                'fined_at' => [
                    'type' => 'DATETIME',
                    'null' => FALSE
                ]
            ])
            ->add_key('fine_id', TRUE)
            ->add_key('event_reg_id', FALSE, TRUE)
            ->create_table('event_fines');

        $db->raw("
            ALTER TABLE `event_fines`
            ADD CONSTRAINT `fk_event_fines_registration`
            FOREIGN KEY (`event_reg_id`)
            REFERENCES `event_registrations` (`event_reg_id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
        ");
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('event_fines', TRUE);
        $this->_lava->dbforge->drop_table('event_fine_settings', TRUE);
    }
}
