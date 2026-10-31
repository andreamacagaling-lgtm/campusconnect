<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: SectionModel
 */
class SectionModel extends Model
{
    protected $table = 'sections';
    protected $primary_key = 'section_id';

    protected $fillable = [
        'dept_id',
        'yr_id',
        'section_name'
    ];

    protected $guarded = [
        'section_id'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
