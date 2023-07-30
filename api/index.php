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
  $table = "$uri[1].$uri[2]";
  $action = "$uri[3]Action";

  switch ($table) {
    case 'auth.user':
      require PROJECT_ROOT_PATH . "/Controller/UserController.php";
      $controller = new UserController();
      break;

    case 'auth.role':
      require PROJECT_ROOT_PATH . "/Controller/UserController.php";
      $controller = new UserController();
      break;

    default:
    echo "invalid";
    //header("HTTP/1.1 404 Not Found");
    return;
  }

  $controller->{$action}();
}

