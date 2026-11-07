<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Model: AnnouncementModel
 */
class AnnouncementModel extends Model
{
    protected $table = 'announcements';
    protected $primary_key = 'announcement_id';

    protected $fillable = [
        'title',
        'body',
        'posted_by',
        'event_id'
    ];

    protected $guarded = [
        'announcement_id',
        'created_at'
    ];

    public function __construct()
    {
        parent::__construct();
    }
}
