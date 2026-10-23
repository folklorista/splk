<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

/**
 * Units of the Vonica installation (D-06, D-21): three with their own costume fund, the band without one
 * (it borrows from the adult unit). Runs only while there are no units. Phinx wraps it in a transaction.
 */
final class VonicaUnits extends AbstractSeed
{
    private const UNITS = [
        ['Vonica', 'Vonica', true],
        ['Malá Vonica', 'Malá Vonica', true],
        ['Děvčice z Vonice', 'Děvčice', true],
        ['Muzika', 'Muzika', false],
    ];

    public function run(): void
    {
        $pdo = $this->getAdapter()->getConnection();
        if ($pdo->query('SELECT 1 FROM units')->fetchColumn() !== false) {
            $this->getOutput()->writeln('units already exist – nothing to do');

            return;
        }

        $insert = $pdo->prepare('INSERT INTO units (name, short_name, has_costume_fund) VALUES (:name, :short, :fund)');
        foreach (self::UNITS as [$name, $short, $fund]) {
            $insert->execute(['name' => $name, 'short' => $short, 'fund' => $fund ? 'true' : 'false']);
        }
        $this->getOutput()->writeln('Created ' . count(self::UNITS) . ' units');
    }
}
