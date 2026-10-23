<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

/**
 * The first account with organization.admin (D-48), from ADMIN_EMAIL, ADMIN_FIRST_NAME, ADMIN_LAST_NAME.
 * The account is created as invited without a password; the first password is set via "Zapomenuté heslo".
 * Runs only while no organization.admin mandate exists, so repeating it is harmless. Phinx wraps it in a transaction.
 */
final class FirstAdministrator extends AbstractSeed
{
    public function run(): void
    {
        $pdo = $this->getAdapter()->getConnection();
        if ($pdo->query("SELECT 1 FROM mandates WHERE kind = 'organization.admin'")->fetchColumn() !== false) {
            $this->getOutput()->writeln('organization.admin already exists – nothing to do');

            return;
        }

        $email = trim((string) getenv('ADMIN_EMAIL'));
        $firstName = trim((string) getenv('ADMIN_FIRST_NAME'));
        $lastName = trim((string) getenv('ADMIN_LAST_NAME'));
        if ($email === '' || $firstName === '' || $lastName === '') {
            throw new RuntimeException('Set ADMIN_EMAIL, ADMIN_FIRST_NAME and ADMIN_LAST_NAME.');
        }

        $person = $pdo->prepare('INSERT INTO persons (first_name, last_name) VALUES (:first, :last) RETURNING id');
        $person->execute(['first' => $firstName, 'last' => $lastName]);
        $personId = (int) $person->fetchColumn();

        $pdo->prepare("INSERT INTO user_accounts (person_id, login_email, status) VALUES (:person, :email, 'invited')")
            ->execute(['person' => $personId, 'email' => $email]);
        $pdo->prepare("INSERT INTO mandates (person_id, kind, scope_type) VALUES (:person, 'organization.admin', 'organization')")
            ->execute(['person' => $personId]);

        $this->getOutput()->writeln("Created invited account $email with organization.admin");
    }
}
