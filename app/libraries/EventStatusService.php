<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class EventStatusService
{
    public static function apply($event, $now = null)
    {
        $status = self::get_status($event, $now);

        if (is_array($event)) {
            $event['status'] = $status;
            return $event;
        }

        if (is_object($event)) {
            $event->status = $status;
        }

        return $event;
    }

    private static function get_status($event, $now = null)
    {
        $status = self::get_value($event, 'status');
        if ($status === 'cancelled') {
            return $status;
        }

        $timezone = new DateTimeZone('Asia/Manila');
        $start = self::parse_datetime(
            self::get_value($event, 'start_datetime'),
            $timezone
        );
        $end = self::parse_datetime(
            self::get_value($event, 'end_datetime'),
            $timezone
        );

        if ($start === null || $end === null) {
            return $status;
        }

        $now = $now === null ? time() : (int) $now;
        if ($now < $start) {
            return 'upcoming';
        }

        if ($now < $end) {
            return 'ongoing';
        }

        return 'completed';
    }

    private static function parse_datetime($value, DateTimeZone $timezone)
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($value, $timezone))->getTimestamp();
        } catch (Exception $e) {
            return null;
        }
    }

    private static function get_value($event, $key)
    {
        if (is_array($event)) {
            return $event[$key] ?? null;
        }

        if (is_object($event)) {
            return $event->$key ?? null;
        }

        return null;
    }
}
