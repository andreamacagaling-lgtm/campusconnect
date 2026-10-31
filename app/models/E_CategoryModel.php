<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: E_CategoryModel
 */
class E_CategoryModel extends Model
{
    protected $table = 'event_categories';
    protected $primary_key = 'category_id';

    protected $fillable = [
        'category_name'
    ];

    protected $guarded = [
        'category_id'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
