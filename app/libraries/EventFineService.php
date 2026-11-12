<?php

class EventFineService
{
    private const ABSENCE_FINE_AMOUNT = 25.00;

    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function generate_due_fines()
    {
        return $this->db->raw(
            "INSERT INTO event_fines (event_reg_id, fine_amount, fined_at)
             SELECT er.event_reg_id, ?, e.end_datetime
             FROM event_registrations er
             INNER JOIN events e ON e.event_id = er.event_id
             INNER JOIN event_fine_settings settings
                ON settings.settings_id = 1
             LEFT JOIN attendance a ON a.event_reg_id = er.event_reg_id
             WHERE e.approval_status = 'approved'
               AND e.status <> 'cancelled'
               AND e.start_datetime >= settings.enabled_from
               AND e.end_datetime <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
               AND er.registered_at < e.start_datetime
               AND a.attendance_id IS NULL
             ON DUPLICATE KEY UPDATE
                event_reg_id = VALUES(event_reg_id)",
            [self::ABSENCE_FINE_AMOUNT]
        );
    }
}
