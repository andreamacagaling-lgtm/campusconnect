<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: EventsModel
 */
class EventsModel extends Model
{
    protected $table = 'events';
    protected $primary_key = 'event_id';

    protected $fillable = [
        'category_id',
        'dept_id',
        'org_id',
        'title',
        'description',
        'venue',
        'image',
        'start_datetime',
        'end_datetime',
        'status',
        'created_by',
        'approval_status',
        'approval_note',
        'reviewed_by',
        'reviewed_at'
    ];

    protected $guarded = [
        'event_id',
        'created_at'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
