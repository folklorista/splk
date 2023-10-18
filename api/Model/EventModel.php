<?php
require_once PROJECT_ROOT_PATH . "/Model/Database.php";
class EventModel extends Database
{
  public function getEvents(int $limit = 10, int $offset = 0)
  {
    return $this->select("SELECT * FROM `event` ORDER BY `id` ASC LIMIT ?",  ["i", $limit]);
  }
}
