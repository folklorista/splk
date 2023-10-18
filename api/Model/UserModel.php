<?php
require_once PROJECT_ROOT_PATH . "/Model/Database.php";
class UserModel extends Database
{
  public function getUsers(int $limit = 10, int $offset = 0)
  {
    return $this->select("SELECT * FROM `user` ORDER BY `id` ASC LIMIT ?",  ["i", $limit]);
  }
}
