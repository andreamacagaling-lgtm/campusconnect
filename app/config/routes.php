<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

$router->get('/', 'Welcome::index');

// Migration Routes
$router->get('create-migration/{migration_class}', 'MigrationController::create_migration');
$router->get('migrate', 'MigrationController::migrate');
$router->get('rollback', 'MigrationController::rollback');
$router->get('rollback-all', 'MigrationController::rollback_all');
$router->get('refresh', 'MigrationController::refresh');
$router->get('status', 'MigrationController::status');

// Authentication Routes
$router->post('api/auth/register', 'AuthController::register');
$router->post('api/auth/login', 'AuthController::login');
$router->post('api/auth/google', 'AuthController::google_login');
$router->get('api/auth/departments', 'AuthController::departments');
$router->get('api/auth/me', 'AuthController::me');

// Organization administrator accounts (USG only)
$router->get(
    'api/admin/organization-accounts',
    'OrganizationAdminController::index'
);
$router->post(
    'api/admin/organization-accounts',
    'OrganizationAdminController::create'
);
$router->put(
    'api/admin/organization-accounts/{id}/department',
    'OrganizationAdminController::assign_department'
);
// Administrator profile
$router->get('api/admin/profile', 'AdminProfileController::index');
$router->put('api/admin/profile', 'AdminProfileController::update');
$router->post('api/admin/profile/avatar', 'AdminProfileController::upload_avatar');

// Student portal
$router->get('api/student/portal', 'StudentPortalController::index');
$router->post(
    'api/student/events/{id}/register',
    'StudentPortalController::register_event'
);
$router->post(
    'api/student/organizations/{id}/join',
    'StudentPortalController::join_organization'
);
$router->put(
    'api/student/profile',
    'StudentPortalController::update_profile'
);
$router->post(
    'api/student/profile/avatar',
    'StudentPortalController::upload_avatar'
);

// Events Routes
$router->get(
    'api/events/pending-approvals',
    'EventsController::pending_approvals'
);
$router->post(
    'api/events/{id}/approve',
    'EventsController::approve'
);
$router->post(
    'api/events/{id}/reject',
    'EventsController::reject'
);
$router->get('api/events', 'EventsController::index');
$router->get('api/events/{id}', 'EventsController::index');
$router->post('api/events', 'EventsController::create');
$router->put('api/events/{id}', 'EventsController::update');
$router->delete('api/events/{id}', 'EventsController::delete');

// Organizations Routes
$router->get(
    'api/organizations/membership-requests',
    'OrganizationsController::membership_requests'
);
$router->put(
    'api/organizations/membership-requests/{id}',
    'OrganizationsController::update_membership_status'
);
$router->get('api/organizations', 'OrganizationsController::index');
$router->get('api/organizations/{id}', 'OrganizationsController::index');
$router->post('api/organizations', 'OrganizationsController::create');
$router->put('api/organizations/{id}', 'OrganizationsController::update');
$router->delete('api/organizations/{id}', 'OrganizationsController::delete');

// Announcements Routes
$router->get('api/announcements', 'AnnouncementsController::index');
$router->get('api/announcements/{id}', 'AnnouncementsController::index');
$router->post('api/announcements', 'AnnouncementsController::create');
$router->put('api/announcements/{id}', 'AnnouncementsController::update');
$router->delete('api/announcements/{id}', 'AnnouncementsController::delete');

$router->get(
    'internal/send-event-start-reminders',
    'EventNotificationsController::send_event_start_reminders'
);



$router->get('api/attendance/summary', 'AttendanceController::summary');
$router->get('api/attendance', 'AttendanceController::index');
$router->post('api/attendance', 'AttendanceController::scan');
$router->put('api/attendance/{id}', 'AttendanceController::update');
$router->delete('api/attendance/{id}', 'AttendanceController::delete');


$router->get(
    'api/google-calendar/test',
    'GoogleCalendarController::test'
);
$router->post(
    'api/google-calendar/sync-events',
    'GoogleCalendarController::sync_events'
);
// CCS Directory Routes
$router->get(
    'api/ccs-directory',
    'CCSDirectoryController::index'
);

// Para sa pag-register ng estudyante (POST request)
$router->post('/api/events/register', 'EventsController@register');

// Para sa pag-verify ng QR ticket ng Admin (POST request)
$router->post('/api/events/verify-ticket', 'EventsController@verify_ticket');

// Para sa pag-confirm ng attendance ng Admin (POST request)
$router->post('/api/events/confirm-attendance', 'EventsController@confirm_attendance');
