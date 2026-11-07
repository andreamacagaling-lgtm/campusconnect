<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: RegistrationModel
 */
class RegistrationModel extends Model
{
    protected $table = 'org_registrations';
    protected $primary_key = 'reg_id';

    protected $fillable = [
        'org_id',
        'user_id',
        'status',
        'applicant_full_name',
        'applicant_department',
        'applicant_section',
        'applicant_year_level'
    ];

    protected $guarded = [
        'reg_id',
        'registered_at'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
