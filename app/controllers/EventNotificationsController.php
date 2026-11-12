<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class EventNotificationsController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
    }

    public function send_event_start_reminders()
    {
        if (PHP_SAPI !== 'cli') {
            http_response_code(404);
            return;
        }

        $lockName = 'campusconnect_event_start_reminders';
        $lock = $this->db->raw(
            'SELECT GET_LOCK(?, 0)',
            [$lockName]
        )->fetchColumn();

        if ((int) $lock !== 1) {
            fwrite(STDOUT, "Event reminder job is already running.\n");
            return;
        }

        $failed = false;
        try {
            require_once APP_DIR . 'libraries/EventFineService.php';
            (new EventFineService($this->db))->generate_due_fines();
            fwrite(STDOUT, "Absence fines synchronized.\n");
        } catch (Throwable $e) {
            $failed = true;
            error_log(
                'EventNotificationsController process_event_fines: ' .
                $e->getMessage()
            );
            fwrite(STDERR, "Unable to synchronize absence fines.\n");
        }

        try {
            require_once APP_DIR . 'libraries/EventStartNotificationService.php';
            $service = new EventStartNotificationService($this->db);
            $result = $service->send_due_notifications();

            fwrite(
                STDOUT,
                sprintf(
                    "Event-start reminders: %d sent, %d failed, %d queued.\n",
                    $result['sent'],
                    $result['failed'],
                    $result['queued']
                )
            );
        } catch (Throwable $e) {
            $failed = true;
            error_log(
                'EventNotificationsController send_event_start_reminders: ' .
                $e->getMessage()
            );
            fwrite(STDERR, "Unable to process event-start reminders.\n");
        } finally {
            $this->db->raw(
                'SELECT RELEASE_LOCK(?)',
                [$lockName]
            );
        }

        if ($failed) {
            exit(1);
        }
    }
}
