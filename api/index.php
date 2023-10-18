<?php
if ($_SERVER['APPLICATION_ENV'] == 'development') {
  error_reporting(E_ALL);
  ini_set('display_errors', 'On');
}

require 'vendor/autoload.php';
require __DIR__ . "/inc/bootstrap.php";

run(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY));


function run($path, $query)
{
  $uri = explode('/', $path);
  $table = "$uri[1]";
  $action = key_exists(2, $uri) ? "$uri[2]Action" : "listAction";

  switch ($table) {
    case 'user':
      require PROJECT_ROOT_PATH . "/Controller/UserController.php";
      $controller = new UserController();
      break;

    case 'event':
      require PROJECT_ROOT_PATH . "/Controller/EventController.php";
      $controller = new EventController();
      break;

    case 'group':
      require PROJECT_ROOT_PATH . "/Controller/GroupController.php";
      $controller = new GroupController();
      break;

    default:
    echo "invalid";
    //header("HTTP/1.1 404 Not Found");
    return;
  }

  $controller->{$action}();
}

