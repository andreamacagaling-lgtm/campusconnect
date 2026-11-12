# LavaLust Framework

> A lightweight, fast PHP framework built for developers who want clean MVC architecture without unnecessary complexity or performance overhead.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PHP Version](https://img.shields.io/badge/PHP-%3E%3D7.4-8892BF)](https://www.php.net/)
[![GitHub Stars](https://img.shields.io/github/stars/ronmarasigan/lavalust?style=flat)](https://github.com/ronmarasigan/lavalust/stargazers)

---

## Overview

**LavaLust** is an open-source PHP framework that follows the **MVC (Model–View–Controller)** architectural pattern. It is designed for developers who need a structured, maintainable, and scalable foundation — without the bloat of heavier modern frameworks.

Whether you are building a simple web application, a REST API, or a teaching project, LavaLust provides the right tools with minimal friction.

---

## Features

| Feature | Description |
|---|---|
| **MVC Architecture** | Clean separation of Models, Views, and Controllers for organized, maintainable code |
| **Built-in Routing** | Flexible URL routing that maps requests to controllers with minimal configuration |
| **Libraries & Helpers** | Reusable components for sessions, forms, validation, and database access |
| **Modular Design** | Scalable structure that supports clean organization as your application grows |
| **REST API Support** | First-class support for building RESTful APIs using LavaLust conventions |
| **ORM-like Models** | Simplified, readable database interaction without a heavy abstraction layer |

---

## Requirements

- PHP 7.4 or higher
- A web server with URL rewriting support (Apache `.htaccess` or Nginx config)
- Composer (optional, for dependency management)

---

## Installation

**Clone the repository:**

```bash
git clone https://github.com/ronmarasigan/lavalust.git
cd lavalust
```

**Or download a release directly:**

```bash
wget https://github.com/ronmarasigan/lavalust/archive/refs/heads/main.zip
unzip main.zip
```

Configure your web server to point to the project root and ensure `mod_rewrite` (Apache) or equivalent is enabled.

---

## Quick Start

### 1. Define a Route

**File:** `app/config/routes.php`

```php
$router->get('/', 'Welcome::index');
$router->get('/about', 'Welcome::about');
$router->post('/users/store', 'Users::store');
```

### 2. Create a Controller

**File:** `app/controllers/Welcome.php`

```php
<?php

class Welcome extends Controller
{
    public function index()
    {
        $data['title'] = 'Home';
        $this->call->view('welcome', $data);
    }

    public function about()
    {
        $this->call->view('about');
    }
}
```

### 3. Create a View

**File:** `app/views/welcome.php`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?= $title ?></title>
</head>
<body>
    <h1>Welcome to LavaLust Framework</h1>
    <p>Lightweight. Fast. MVC.</p>
</body>
</html>
```

### 4. Create a Model

**File:** `app/models/User_model.php`

```php
<?php

class User_model extends Model
{
    protected $table = 'users';

    public function getAll()
    {
        return $this->db->table($this->table)->get()->getResult();
    }

    public function findById(int $id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->get()
    }
}
```

---

## Project Structure

```
lavalust/
├── app/
│   ├── config/          # Application configuration (database, routes, etc.)
│   ├── controllers/     # Controller classes
│   ├── models/          # Model classes
│   ├── views/           # View templates
│   └── libraries/       # Custom libraries and helpers
├── scheme/              # Core framework files (do not modify)
├── public/              # Publicly accessible entry point
│   └── index.php
└── runtime/            # Cache, logs, and uploads (must be writable)
```

---

## Configuration

### Database

**File:** `app/config/database.php`

```php
$database['main'] = array(
    'driver'	=> getenv('DB_DRIVER') ?: '',
    'hostname'	=> getenv('DB_HOST') ?: '',
    'port'		=> getenv('DB_PORT') ?: '',
    'username'	=> getenv('DB_USER') ?: '',
    'password'	=> getenv('DB_PASSWORD') ?: '',
    'database'	=> getenv('DB_NAME') ?: '',
    'charset'	=> getenv('DB_CHARSET') ?: '',
    'dbprefix'	=> getenv('DB_PREFIX') ?: '',
    // Optional for SQLite
    'path'      => ''
);
```

### Base URL

**File:** `app/config/config.php`

```php
$config['base_url'] = 'http://localhost:3000/';
```

### Vercel frontend routing

The frontend's `vercel.json` sends `/api/*` requests and `/uploads/*` event
images to the deployed Render backend and rewrites other paths to `index.html`,
so React routes such as `/login` work when opened directly. Update both
rewrites if the backend hostname changes. Deploy the frontend changes for the
updated routing to take effect.

### Google Calendar

CCS event creation, edits, and deletion are synced to the department's
Google Calendar. The CCS Events page also has a **Sync Calendar** action to
push existing department events.

Set `GOOGLE_CALENDAR_CREDENTIALS` in `.env` to the path of a Google service
account JSON key file. Keep that key outside `public/` and out of version
control. Set `GOOGLE_CALENDAR_CCS_ID` to the CCS calendar ID and share that
calendar with the service account's email address with **Make changes to
events** permission. The other department calendar IDs are optional unless
those departments use Calendar sync.

The Calendar API must be enabled in the Google Cloud project. HTTPS
certificate verification uses the system CA store or Composer's CA bundle.
If PHP needs a custom CA file, set `GOOGLE_CALENDAR_CA_BUNDLE` to its PEM path.
Do not disable TLS verification. Event times use `GOOGLE_CALENDAR_TIMEZONE`,
which defaults to `Asia/Manila`.

### Google Sign-In

Google sign-in verifies the Google ID token on the backend and only signs in
an existing active CampusConnect account with the same verified email. New
users should create an account using the registration page first.

### Session persistence

Access tokens are short-lived and refresh automatically while CampusConnect is
open. The **Remember me** option controls whether session tokens remain after
the browser is closed; without it they are kept only for the current browser
tab. Refresh tokens rotate and expire after seven days without use, so a
reopened app may require signing in again after that period. Explicit logout
clears the stored session. Apply the existing
`002_create_refresh_tokens_table` migration before deploying this behavior.

Migration `026_add_google_id_to_users` stores the verified Google account ID
when a user signs in with Google. The verified Google email is saved to the
user's `email` field. Existing users are linked on their next successful
Google sign-in.

Create an OAuth 2.0 **Web application** client ID in Google Cloud Console and
add each frontend origin (for example, `http://localhost:5173`) to its
authorized JavaScript origins. For the deployed frontend, add
`https://campusconnect-v9er.vercel.app` (and any custom domain) as well.

Set the same client ID in both environments:

- Local frontend: `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`.
- Local backend: `GOOGLE_OAUTH_CLIENT_ID` in the backend `.env`.
- Deployed frontend: `VITE_GOOGLE_CLIENT_ID` in the Vercel project's
  Environment Variables, for the environments you deploy (Production and,
  optionally, Preview).
- Deployed backend: `GOOGLE_OAUTH_CLIENT_ID` in the Render service's
  environment variables.

The Vercel variable is embedded when the frontend is built, so redeploy the
frontend after adding or changing it. The frontend and backend client IDs must
match. The client ID is public; do not put the OAuth client secret in the
frontend.

The Render Docker build installs PHP dependencies from `composer.lock`, so keep
that lockfile committed whenever `composer.json` changes.

## Event approval roles

Campus-wide events submitted by USG, department events, and organization
events are saved as pending until an OSSE administrator approves them.
Approved events appear in the student portal's upcoming events and can be
registered for. Editing an approved event sends it through approval again.
OSSE accounts are limited to reviewing submissions; USG keeps the full-control
dashboard and attendance tools.

The event lists provide an **Attendance** action for each event. It opens the
students marked present or late for that event. USG can filter attendees by
student department, year level, and section; department administrators can
filter by year level and section from their attendance page.

After migration `028_create_event_fines`, attendance scans open one hour before
an event and close when it ends. Registered students without a scan by then
incur one ₱25 unpaid fine for the event. Fines appear in the USG and
department **Fines Monitoring** pages and are recorded once per registration;
historical events that started before the migration are not charged. The
existing `events:send-start-reminders` task also synchronizes due fines every
minute. Run that task on the schedule described below.

Students and administrators can upload a JPEG, PNG, or WebP profile photo (up
to 2000 MB) from their profile page. The student photo appears with their event
QR ticket and in the authorized event department's scan result; the QR code
itself contains only the event registration token. Avatar API routes allow a
2010 MB multipart request while other API routes retain the 1 MB request limit.

For the PHP built-in server, restart it with
`php -d upload_max_filesize=2000M -d post_max_size=2010M -d max_input_time=1800 -d max_execution_time=300 -S 127.0.0.1:3000 -t public`.
Apache with mod_php is configured for the same upload limits in
`public/.htaccess`; restart Apache after changing upload limits.

Migration `019_seed_academic_profile_options` adds 1st–4th year levels and
the department-specific sections used in student profiles. Students choose
their year level and section under **My Profile**; both values are saved to
`users.yr_id` and `users.section_id` and appear in attendance records. Run
pending application migrations once to populate the lookup tables.

Run the application migrations to add the `admin_type` and event approval
columns. Existing unassigned administrator accounts are set to `usg`, while
department-assigned administrator accounts are set to `department`. The OSSE
account `campus.osse@gmail.com` is assigned the `osse` administrator type by
the migration. To use a different existing administrator account instead, run
this once with its email:

```sql
UPDATE users
SET admin_type = 'osse'
WHERE role = 'admin' AND email = 'admin@example.edu';
```

The OSSE account signs in through the regular login page and can review event
submissions, approve student registrations, activate/deactivate student
accounts, and view student population totals by department. Apply migration
`029_add_student_account_approval` so student registrations use a pending
status. New student accounts cannot open the Student Portal until OSSE approves
them; inactive accounts are blocked from student access and can be reactivated
by OSSE.

The public registration page is for student accounts; its department and
student ID fields are not used for organization admins. A university admin
registers one active organization admin account per department from
**Organization Admins**. These accounts have `student_no` and `dept_id` set to
`NULL`; `organization_dept_id` controls their department-specific dashboard
and data access. Apply migrations `024_add_organization_admin_type` and
`025_add_organization_admin_department` before using this feature. Department
administrators no longer have organization management in their dashboard;
they can still view their department's organizations when associating events.
Students receive a Toastify notification in the Student Portal when an
organization membership request is approved. The portal checks membership
status while open and remembers already-notified approvals in the browser.

### USG event announcement notifications

Before enabling this feature, apply migrations `020_add_event_link_to_announcements`,
`021_add_event_start_email_deliveries`, `026_add_google_id_to_users`, and
`027_add_department_scope_to_announcements` through the deployment's normal
migration process. If that process applies every pending migration, check the
pending migrations first and run only those intended for the target database.

When creating an event-linked announcement, USG admins can select an approved
upcoming campus-wide event and department admins can select an approved
upcoming event from their department. Eligible active students who have not
registered receive an email when registration opens; the announcement also
appears in the student portal. Registered students receive a reminder when
their event starts. Announcements without an event link do not send event
emails.

USG announcements are visible to all students. Department announcements are
visible only to students in that department. Both use the same email delivery
flow and notify active student accounts with registered email addresses;
department announcements are scoped to students in that department.
Department admins can publish from the Announcements item in their department
dashboard. The phone and desktop announcement forms use the same
server-side email delivery flow. Configure `MAIL_USERNAME` and `MAIL_PASSWORD`
in the deployed backend environment with a Gmail account and its app password.
Alternatively, set `SMTP_USERNAME` and `SMTP_PASSWORD`; optional `SMTP_HOST`,
`SMTP_PORT`, `SMTP_ENCRYPTION` (`tls` for port 587 or `ssl` for port 465),
`SMTP_FROM_EMAIL`, and `SMTP_FROM_NAME` settings customize the mail server and
sender. Keep credentials out of source control. The announcement remains
published if email delivery fails; the API reports the delivery result to the
admin, and server logs contain the SMTP failure details.

Event-specific announcement and event-start emails use the same `MAIL_USERNAME`
and `MAIL_PASSWORD` by default, with Gmail SMTP, port 587, and the sender set
to `MAIL_USERNAME`. Optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
`SMTP_PASSWORD`, `SMTP_ENCRYPTION` (`tls` for port 587 or `ssl` for port 465),
`SMTP_FROM_EMAIL`, and `SMTP_FROM_NAME` settings can override those defaults.
Set `STUDENT_PORTAL_URL` to the frontend's Events page URL to include a direct
event link in those emails. Keep credentials out of source control and ensure
the sender address is authorized by the mail provider.

Schedule `php lava events:send-start-reminders` to run every minute. On
Windows, create a Task Scheduler task that runs `php.exe` with
`C:\path\to\campusconnect\lava events:send-start-reminders` as its arguments,
repeating every minute with the project directory as the working directory.
On Linux, add `* * * * * cd /path/to/campusconnect && php lava events:send-start-reminders`
to the crontab. The job only runs from the CLI, records deliveries to prevent
repeat reminders, synchronizes event absence fines, and retries temporary SMTP
failures up to five times.
Registration-open email is sent when the admin publishes the linked event
announcement; if delivery fails, the announcement remains visible in the
portal and the admin receives a delivery warning.

---

## Building a REST API

LavaLust supports REST API development out of the box. Controllers can return JSON responses for API endpoints.

```php
<?php

class Api extends Controller
{
    $this->call->library('api');

    public function users()
    {
        $this->api->require_method('GET');
        $auth = $this->api->require_jwt(); 

        $this->call->model('User_model');
        $users = $this->User_model->getAll();

        $this->api->respond(['data' => $users]);
    }
}
```

Route definition:

```php
$router->get('/api/users', 'Api::users');
```

---

## Philosophy

LavaLust is built on a single principle: **minimal core, maximum control.**

Modern frameworks often add layers of abstraction that benefit large enterprise teams but get in the way of developers who want to understand exactly what their code is doing. LavaLust provides structure and utilities without hiding the underlying logic — making it an excellent choice for:

- **Rapid prototyping** — Get an application running in minutes
- **Learning MVC** — Understand how each architectural layer works
- **Lightweight production apps** — Deploy without dragging in unused dependencies
- **Teaching PHP development** — Clear conventions, readable source code

---

## Documentation

Full documentation is available at **[https://lavalust.netlify.app](https://lavalust.netlify.app)**

Topics covered include:

- Installation and server configuration
- Routing: static, dynamic, and grouped routes
- Controllers and request handling
- Models and query builder
- Views, layouts, and partials
- Built-in libraries (sessions, form validation, file upload)
- Helper functions
- REST API development
- Security best practices

---

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "Add your feature description"`
4. Push to your branch: `git push origin feature/your-feature-name`
5. Open a pull request against `main`

Please ensure your code follows the existing style conventions and includes relevant documentation or comments where appropriate.

---

## Roadmap

- [ ] CLI tool for generating controllers, models, and migrations
- [ ] Middleware support
- [ ] Improved query builder with relationship support
- [ ] Enhanced error handling and debugging tools

---

## License

LavaLust Framework is open-source software licensed under the **[MIT License](https://opensource.org/licenses/MIT)**.

---

## Links

- **GitHub Repository:** [https://github.com/ronmarasigan/lavalust](https://github.com/ronmarasigan/lavalust)
- **Documentation:** [https://lavalust.netlify.app](https://lavalust.netlify.app)
- **Report an Issue:** [https://github.com/ronmarasigan/lavalust/issues](https://github.com/ronmarasigan/lavalust/issues)