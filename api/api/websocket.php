<?php
use Ratchet\WebSocket\WsServer;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

require 'vendor/autoload.php';

class SimpleWebSocketServer implements MessageComponentInterface {
    public function onOpen(ConnectionInterface $conn) {
        echo "Nový klient připojen.\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        echo "Zpráva od klienta: " . $msg . "\n";
        // Odeslání zprávy zpět klientovi
        $from->send("Obdržel jsem vaši zprávu: " . $msg);
    }

    public function onClose(ConnectionInterface $conn) {
        echo "Klient odpojen.\n";
    }

    public function onError(ConnectionInterface $conn, Exception $e) {
        echo "Chyba: " . $e->getMessage() . "\n";
        $conn->close();
    }
}

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new SimpleWebSocketServer()
        )
    ),
    8080
);

echo "WebSocket server naslouchá na portu 8080.\n";
$server->run();
