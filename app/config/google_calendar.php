
<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Google Calendar configuration for CampusConnect.
 * Credentials and Calendar IDs are read from environment variables.
 */

return [
    'credentials' => getenv('GOOGLE_CALENDAR_CREDENTIALS') ?: '',
    'ca_bundle' => getenv('GOOGLE_CALENDAR_CA_BUNDLE') ?: '',
    'timezone' => getenv('GOOGLE_CALENDAR_TIMEZONE') ?: 'Asia/Manila',

    'calendars' => [
        1 => getenv('GOOGLE_CALENDAR_CCS_ID') ?: '',
        2 => getenv('GOOGLE_CALENDAR_CCJE_ID') ?: '',
        3 => getenv('GOOGLE_CALENDAR_CBM_ID') ?: '',
        4 => getenv('GOOGLE_CALENDAR_CAS_ID') ?: '',
        5 => getenv('GOOGLE_CALENDAR_BTVTED_ID')
            ?: getenv('GOOGLE_CALENDAR_BTLED_ID')
            ?: '',
        6 => getenv('GOOGLE_CALENDAR_BSED_ID') ?: '',
    ],
];
