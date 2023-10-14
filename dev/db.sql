-- Vytvoření tabulky členů taneční skupiny
CREATE TABLE members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    -- Další sloupce podle potřeby
);

-- Vytvoření tabulky skupin
CREATE TABLE groups (
    group_id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    -- Další sloupce podle potřeby
);

-- Vytvoření tabulky událostí
CREATE TABLE events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    event_date DATE NOT NULL,
    event_type ENUM('nácvik', 'vystoupení') NOT NULL,
    event_frequency VARCHAR(100) NOT NULL,
    event_max_annual INT NOT NULL,
    -- Další sloupce podle potřeby
);

-- Vytvoření tabulky diskuze k událostem
CREATE TABLE event_discussions (
    discussion_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    member_id INT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Další sloupce podle potřeby
    
    FOREIGN KEY (event_id) REFERENCES events (event_id),
    FOREIGN KEY (member_id) REFERENCES members (member_id)
);

-- Vytvoření tabulky pro přiřazení členů do skupin
CREATE TABLE member_group_assignment (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    group_id INT NOT NULL,
    -- Další sloupce podle potřeby
    
    FOREIGN KEY (member_id) REFERENCES members (member_id),
    FOREIGN KEY (group_id) REFERENCES groups (group_id)
);



-- Vytvoření tabulky pro notifikace k událostem
CREATE TABLE event_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    notification_text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Další sloupce podle potřeby
    
    FOREIGN KEY (event_id) REFERENCES events (event_id)
);

-- Vytvoření tabulky pro správce aplikace
CREATE TABLE admins (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    admin_privileges VARCHAR(100) NOT NULL,
    -- Další sloupce podle potřeby
    
    FOREIGN KEY (user_id) REFERENCES members (member_id)
);