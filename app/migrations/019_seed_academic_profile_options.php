<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Seed_academic_profile_options
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->dbforge();
    }

    public function up()
    {
        $db = $this->_lava->db;
        $yearNames = [
            '1st Year',
            '2nd Year',
            '3rd Year',
            '4th Year'
        ];
        $departmentSections = [
            1 => [['F', 1, 6]],
            2 => [['E', 1, 4]],
            3 => [['C', 1, 5], ['D', 1, 5]],
            4 => [['G', 1, 4], ['H', 1, 4]],
            5 => [['B', 1, 10]],
            6 => [['A', 1, 4]]
        ];

        foreach ($yearNames as $yearName) {
            $db->raw(
                'INSERT IGNORE INTO yr_levels (yr_name) VALUES (?)',
                [$yearName]
            );
        }

        foreach ($departmentSections as $departmentId => $sectionGroups) {
            foreach ($yearNames as $yearName) {
                $year = $db->raw(
                    'SELECT yr_id
                     FROM yr_levels
                     WHERE yr_name = ?
                     LIMIT 1',
                    [$yearName]
                )->fetch(PDO::FETCH_ASSOC);

                if (!$year) {
                    throw new RuntimeException(
                        'Unable to load year level: ' . $yearName
                    );
                }

                foreach ($sectionGroups as [$prefix, $first, $last]) {
                    for ($number = $first; $number <= $last; $number++) {
                        $db->raw(
                            'INSERT IGNORE INTO sections
                                (dept_id, yr_id, section_name)
                             VALUES (?, ?, ?)',
                            [
                                $departmentId,
                                (int) $year['yr_id'],
                                $prefix . $number
                            ]
                        );
                    }
                }
            }
        }
    }

    public function down()
    {
        
    }
}
