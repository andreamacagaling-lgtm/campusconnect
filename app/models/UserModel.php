<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: UserModel
 */
class UserModel extends Model
{
    protected $table = 'users';
    protected $primary_key = 'user_id';

    protected $fillable = [
        'student_no',
        'full_name',
        'email',
        'password_hash',
        'role',
        'status',
        'section_id',
        'yr_id'
    ];

    protected $guarded = [
        'user_id',
        'created_at'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
