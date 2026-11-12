<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class EventStartNotificationService
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function send_due_notifications()
    {
        $this->db->raw(
            "INSERT IGNORE INTO event_start_email_deliveries
                (event_id, user_id)
             SELECT DISTINCT e.event_id, er.user_id
             FROM events e
             INNER JOIN event_registrations er
                ON er.event_id = e.event_id
             INNER JOIN users u
                ON u.user_id = er.user_id
                AND u.role = ?
                AND u.status = ?
                AND u.email IS NOT NULL
                AND TRIM(u.email) <> ?
             WHERE e.approval_status = ?
               AND e.status IN (?, ?)
               AND e.start_datetime <= NOW()
               AND e.end_datetime > NOW()
               AND EXISTS (
                    SELECT 1
                    FROM announcements a
                    WHERE a.event_id = e.event_id
               )",
            ['student', 'active', '', 'approved', 'upcoming', 'ongoing']
        );

        $this->db->raw(
            "UPDATE event_start_email_deliveries d
             INNER JOIN events e ON e.event_id = d.event_id
             SET d.status = ?, d.last_error = ?
             WHERE d.status = ?
               AND (
                    e.end_datetime <= NOW()
                    OR e.status IN (?, ?)
                    OR e.approval_status <> ?
                    OR NOT EXISTS (
                        SELECT 1
                        FROM announcements a
                        WHERE a.event_id = e.event_id
                    )
               )",
            [
                'failed',
                'Event ended or became unavailable before the reminder was sent.',
                'pending',
                'cancelled',
                'completed',
                'approved'
            ]
        );

        $rows = $this->db->raw(
            "SELECT d.event_id, d.user_id, u.email,
                    e.title AS event_title, e.description AS event_description,
                    e.venue, e.start_datetime, e.end_datetime, e.image,
                    a.title AS announcement_title,
                    a.body AS announcement_body
             FROM event_start_email_deliveries d
             INNER JOIN users u ON u.user_id = d.user_id
             INNER JOIN events e ON e.event_id = d.event_id
             INNER JOIN announcements a
                ON a.announcement_id = (
                    SELECT MAX(a2.announcement_id)
                    FROM announcements a2
                    WHERE a2.event_id = e.event_id
                )
             WHERE d.status = ?
               AND d.attempts < ?
               AND u.role = ?
               AND u.status = ?
               AND u.email IS NOT NULL
               AND TRIM(u.email) <> ?
             ORDER BY d.event_id ASC, d.user_id ASC
             LIMIT 500",
            ['pending', 5, 'student', 'active', '']
        )->fetchAll(PDO::FETCH_ASSOC);

        if (!$rows) {
            return ['sent' => 0, 'failed' => 0, 'queued' => 0];
        }

        $events = [];
        foreach ($rows as $row) {
            $eventId = (int) $row['event_id'];
            if (!isset($events[$eventId])) {
                $events[$eventId] = [
                    'event' => [
                        'event_id' => $eventId,
                        'title' => $row['event_title'],
                        'description' => $row['event_description'],
                        'venue' => $row['venue'],
                        'start_datetime' => $row['start_datetime'],
                        'end_datetime' => $row['end_datetime'],
                        'image' => $row['image']
                    ],
                    'announcement_title' => $row['announcement_title'],
                    'announcement_body' => $row['announcement_body'],
                    'recipients' => []
                ];
            }

            $email = strtolower(trim((string) $row['email']));
            $events[$eventId]['recipients'][$email][] = (int) $row['user_id'];
        }

        require_once APP_DIR . 'libraries/EventAnnouncementMailer.php';
        $mailer = new EventAnnouncementMailer();
        $sent = 0;
        $failed = 0;
        $queued = count($rows);

        foreach ($events as $eventId => $group) {
            $emails = array_keys($group['recipients']);
            $delivery = $mailer->send(
                $group['announcement_title'],
                $group['announcement_body'],
                $group['event'],
                $emails,
                'event_start'
            );

            $sentEmails = array_fill_keys($delivery['sent_emails'], true);
            $failedEmails = array_fill_keys($delivery['failed_emails'], true);
            $invalidEmails = array_fill_keys($delivery['invalid_emails'], true);

            foreach ($group['recipients'] as $email => $userIds) {
                if (isset($sentEmails[$email])) {
                    $this->update_deliveries(
                        $eventId,
                        $userIds,
                        'sent',
                        null
                    );
                    $sent += count($userIds);
                } elseif (isset($invalidEmails[$email])) {
                    $this->update_deliveries(
                        $eventId,
                        $userIds,
                        'failed',
                        'Student account has an invalid email address.'
                    );
                    $failed += count($userIds);
                } elseif (isset($failedEmails[$email])) {
                    $this->update_deliveries(
                        $eventId,
                        $userIds,
                        'pending',
                        'Email delivery failed; will retry up to five times.'
                    );
                    $failed += count($userIds);
                }
            }
        }

        return [
            'sent' => $sent,
            'failed' => $failed,
            'queued' => $queued
        ];
    }

    private function update_deliveries(
        $eventId,
        array $userIds,
        $status,
        $error
    ) {
        foreach (array_chunk($userIds, 200) as $userIdBatch) {
            $placeholders = implode(
                ', ',
                array_fill(0, count($userIdBatch), '?')
            );

            if ($status === 'sent') {
                $sql = "UPDATE event_start_email_deliveries
                        SET status = ?, sent_at = NOW(), attempts = attempts + 1,
                            last_error = NULL
                        WHERE event_id = ? AND user_id IN ({$placeholders})";
                $params = array_merge(
                    ['sent', (int) $eventId],
                    $userIdBatch
                );
            } elseif ($status === 'failed') {
                $sql = "UPDATE event_start_email_deliveries
                        SET status = ?, attempts = attempts + 1, last_error = ?
                        WHERE event_id = ? AND user_id IN ({$placeholders})";
                $params = array_merge(
                    ['failed', $error, (int) $eventId],
                    $userIdBatch
                );
            } else {
                $sql = "UPDATE event_start_email_deliveries
                        SET status = IF(attempts >= 4, ?, ?),
                            attempts = attempts + 1,
                            last_error = ?
                        WHERE event_id = ? AND user_id IN ({$placeholders})";
                $params = array_merge(
                    ['failed', 'pending', $error, (int) $eventId],
                    $userIdBatch
                );
            }

            $this->db->raw($sql, $params);
        }
    }
}
