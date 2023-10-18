<?php
require_once PROJECT_ROOT_PATH . "/Model/Database.php";
class GroupModel extends Database
{
  public function getGroups(int $limit = 10, int $offset = 0)
  {
    return $this->select("SELECT * FROM `group` ORDER BY `id` ASC LIMIT ?",  ["i", $limit]);
  }
}
