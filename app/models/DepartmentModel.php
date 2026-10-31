<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: DepartmentModel
 */
class DepartmentModel extends Model
{
    protected $table = 'departments';
    protected $primary_key = 'dept_id';

    protected $fillable = [
        'dept_code',
        'dept_name'
    ];

    protected $guarded = [
        'dept_id'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
