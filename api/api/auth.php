<?php
require_once('vendor/autoload.php'); // Načtěte knihovnu pro JWT tokeny

use Firebase\JWT\JWT;

// Funkce pro ověření přihlašovacích údajů vůči databázi
function authenticateUser($email, $password) {
    $dbHost = 'localhost';
    $dbName = 'splk';
    $dbUsername = 'splk';
    $dbPassword = 'splk';

    // Vytvoření připojení k databázi
    try {
      $pdo = new PDO("mysql:host=$dbHost;dbname=$dbName", $dbUsername, $dbPassword);
    } catch (PDOException $e) {
      die("Chyba připojení k databázi: " . $e->getMessage());
    }

    // Dotaz na databázi pro ověření uživatele
    $sql = "SELECT * FROM user WHERE email = :email";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Kontrola, zda uživatel existuje a zda heslo odpovídá
    if ($user && password_verify($password, $user['password'])) {
      // Uživatel byl úspěšně ověřen
      return ['user_id' => $user['user_id'], 'username' => $user['username']];
    } else {
      // Přihlašovací údaje nebyly správné
      return false;
    }
  }

// Konfigurace JWT
$secretKey = 'mySecretKey'; // Toto by mělo být silné tajemství
$algorithm = 'HS256';

// Zpracování přihlašovacího požadavku
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $data = json_decode(file_get_contents('php://input'));
  if (isset($data->username) && isset($data->password)) {
    $email = $data->username;
    $password = $data->password;

    // Ověření přihlašovacích údajů
    $user = authenticateUser($email, $password);

    if ($user) {
      $tokenId    = base64_encode(random_bytes(32)); // Náhodný token ID
      $issuedAt   = time();
      $notBefore  = $issuedAt + 1;  // Token není platný před
      $expire     = $issuedAt + 3600; // Token vyprší po 1 hodině
      $serverName = 'your-server-name';

      // JWT token
      $token = [
        'iat'  => $issuedAt,    // Čas vytvoření tokenu
        'jti'  => $tokenId,     // ID tokenu
        'iss'  => $serverName,  // Vydavatel tokenu
        'nbf'  => $notBefore,   // Token není platný před
        'exp'  => $expire,      // Token vyprší
        'data' => [
          'user_id'   => $user['user_id'], // Například uživatelský ID
          'username'  => $user['username'] // Například uživatelské jméno
        ]
      ];

      // Vytvoření a vrácení JWT tokenu
      $jwt = JWT::encode($token, $secretKey, $algorithm);
      echo json_encode(['token' => $jwt]);
    } else {
      // Přihlašovací údaje nebyly správné
      http_response_code(401); // Neautorizováno
      echo json_encode(['message' => 'Neplatné přihlašovací údaje']);
    }
  } else {
    http_response_code(400); // Špatný požadavek
    echo json_encode(['message' => 'Neplatný požadavek']);
  }
}
