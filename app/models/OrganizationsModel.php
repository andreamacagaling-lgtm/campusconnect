<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: OrganizationsModel
 */
class OrganizationsModel extends Model
{
    protected $table = 'organizations';
    protected $primary_key = 'org_id';

    protected $fillable = [
        'org_name',
        'category',
        'description',
        'eligibility',
        'status',
        'dept_id'
    ];

    protected $guarded = [
        'org_id',
        'created_at'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
