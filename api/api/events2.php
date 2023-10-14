<?php
class EventService {
  private $db;

  public function __construct($db) {
    $this->db = $db;
  }

  public function getEvents() {
    $query = "SELECT * FROM events";
    $stmt = $this->db->prepare($query);
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
  }

  public function createEvent($event) {
    $query = "INSERT INTO events (event_type, event_name, event_date, event_frequency, event_max_annual) VALUES (:event_type, :event_name, :event_date, :event_frequency, :event_max_annual)";
    $stmt = $this->db->prepare($query);
    $stmt->bindParam(':event_type', $event['event_type']);
    $stmt->bindParam(':event_name', $event['event_name']);
    $stmt->bindParam(':event_date', $event['event_date']);
    $stmt->bindParam(':event_frequency', $event['event_frequency']);
    $stmt->bindParam(':event_max_annual', $event['event_max_annual']);
    $stmt->execute();
    return $this->db->lastInsertId();
  }

  public function updateEvent($event_id, $event) {
    $query = "UPDATE events SET event_type = :event_type, event_name = :event_name, event_date = :event_date, event_frequency = :event_frequency, event_max_annual = :event_max_annual WHERE event_id = :event_id";
    $stmt = $this->db->prepare($query);
    $stmt->bindParam(':event_id', $event_id);
    $stmt->bindParam(':event_type', $event['event_type']);
    $stmt->bindParam(':event_name', $event['event_name']);
    $stmt->bindParam(':event_date', $event['event_date']);
    $stmt->bindParam(':event_frequency', $event['event_frequency']);
    $stmt->bindParam(':event_max_annual', $event['event_max_annual']);
    return $stmt->execute();
  }

  public function deleteEvent($event_id) {
    $query = "DELETE FROM events WHERE event_id = :event_id";
    $stmt = $this->db->prepare($query);
    $stmt->bindParam(':event_id', $event_id);
    return $stmt->execute();
  }
}
