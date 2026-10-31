<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: YrLevelModel
 */
class YrLevelModel extends Model
{
    protected $table = 'yr_levels';
    protected $primary_key = 'yr_id';

    protected $fillable = [
        'yr_name'
    ];

    protected $guarded = [
        'yr_id'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
