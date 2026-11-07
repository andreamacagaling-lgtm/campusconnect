<?php

class Create_email_notifications_table {

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
            'announcement_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => TRUE
            ],
            'student_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => TRUE
            ],
            'recipient_email' => [
                'type'       => 'VARCHAR',
                'constraint' => 255
            ],
            'status' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'default'    => 'pending'
            ],
            'error_message' => [
                'type' => 'TEXT',
                'null' => TRUE
            ],
            'sent_at' => [
                'type' => 'DATETIME',
                'null' => TRUE
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => TRUE
            ]
        ]);

        $this->_lava->dbforge->add_key('id', TRUE);
        $this->_lava->dbforge->add_key('announcement_id');
        $this->_lava->dbforge->add_key('student_id');

        $this->_lava->dbforge->create_table('email_notifications');
    }

    public function down()
    {
        $this->_lava->dbforge->drop_table('email_notifications');
    }
}