<?php

class Create_announcements_table {

    private $_lava;
    protected $dbforge;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        $this->_lava->dbforge->add_field([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => TRUE,
                'auto_increment' => TRUE
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 255
            ],
            'message' => [
                'type' => 'TEXT'
            ],
            'type' => [
                'type'       => 'VARCHAR',
                'constraint' => 50
            ],
            'event_date' => [
                'type' => 'DATE',
                'null' => TRUE
            ],
            'event_time' => [
                'type' => 'TIME',
                'null' => TRUE
            ],
            'venue' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => TRUE
            ],
            'created_by' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => TRUE,
                'null'       => TRUE
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => TRUE
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => TRUE
            ]
        ]);

        $this->_lava->dbforge->add_key('id', TRUE);
        $this->_lava->dbforge->create_table('announcements');
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('announcements');
    }
}