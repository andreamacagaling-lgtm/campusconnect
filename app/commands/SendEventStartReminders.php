<?php

class SendEventStartReminders
{
    public static $command = 'events:send-start-reminders';
    public static $description = 'Email registered students when events start';

    public function handle($argument = null, array $flags = [])
    {
        $index = PUBLIC_DIR . 'index.php';
        if (!is_file($index)) {
            fwrite(STDERR, "Application entry point not found: {$index}\n");
            exit(1);
        }

        $command = escapeshellarg(PHP_BINARY) . ' ' .
            escapeshellarg($index) . ' ' .
            escapeshellarg('internal/send-event-start-reminders');

        passthru($command, $status);
        if ($status !== 0) {
            exit($status);
        }
    }
}
