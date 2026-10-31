<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: StudProfileModel
 */
class StudProfileModel extends Model
{
    protected $table = 'student_profiles';
    protected $primary_key = 'profile_id';

    protected $fillable = [
        'user_id',
        'contact_number',
        'avatar'
    ];

    protected $guarded = [
        'profile_id'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
