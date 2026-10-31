<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: E_RegistrationModel
 */
class E_RegistrationModel extends Model
{
    protected $table = 'event_registrations';
    protected $primary_key = 'event_reg_id';

    protected $fillable = [
        'event_id',
        'user_id',
        'qr_token'
    ];

    protected $guarded = [
        'event_reg_id',
        'registered_at'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
