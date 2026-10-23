<?php

declare(strict_types=1);

namespace Splk\Api\Auth;

use PDO;
use Splk\Api\Domain\Identity\AccountRepository;
use Splk\Api\Infrastructure\Mail\Mailer;

/**
 * Password reset by an e-mailed link (D-49). The link also sets the first password of an invited account.
 * Tokens are single-use, short-lived and stored as hashes; the request never reveals whether an account exists.
 */
final class PasswordResets
{
    public const LIFETIME_MINUTES = 60;
    public const MAX_REQUESTS_PER_HOUR = 3;

    public function __construct(
        private readonly PDO $db,
        private readonly AccountRepository $accounts,
        private readonly Mailer $mailer,
        private readonly string $appUrl,
    ) {
    }

    public function request(string $email): void
    {
        $account = $this->accounts->findByEmail($email);
        if ($account === null || $account['status'] === 'disabled' || $this->recentRequests($account['id']) >= self::MAX_REQUESTS_PER_HOUR) {
            return;
        }

        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $this->db->prepare(
            'INSERT INTO password_reset_tokens (account_id, token_hash, expires_at)
             VALUES (:account, :hash, now() + make_interval(mins => :lifetime))'
        )->execute(['account' => $account['id'], 'hash' => hash('sha256', $token), 'lifetime' => self::LIFETIME_MINUTES]);

        $link = rtrim($this->appUrl, '/') . '/obnova-hesla?token=' . $token;
        try {
            $this->mailer->send($email, 'Krojařka – nastavení hesla', self::body($email, $link));
        } catch (\Throwable $e) {
            // the response must stay the same, so a failure only goes to the log
            error_log('Password reset e-mail failed: ' . $e->getMessage());
        }
    }

    /** @return int|null account id whose password was set, null for an invalid, used or expired token */
    public function confirm(string $token, string $password): ?int
    {
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $accountId = $this->consume($token, $password);
            if ($ownTransaction) {
                $this->db->commit();
            }
        } catch (\Throwable $e) {
            if ($ownTransaction) {
                $this->db->rollBack();
            }
            throw $e;
        }

        return $accountId;
    }

    private function consume(string $token, string $password): ?int
    {
        $statement = $this->db->prepare(
            "SELECT t.account_id FROM password_reset_tokens t
               JOIN user_accounts a ON a.id = t.account_id
              WHERE t.token_hash = :hash AND t.used_at IS NULL AND t.expires_at > now() AND a.status <> 'disabled'
              FOR UPDATE OF t"
        );
        $statement->execute(['hash' => hash('sha256', $token)]);
        $accountId = $statement->fetchColumn();
        if ($accountId === false) {
            return null;
        }

        $accountId = (int) $accountId;
        $this->accounts->setPassword($accountId, Passwords::hash($password));
        $this->db->prepare('UPDATE password_reset_tokens SET used_at = now() WHERE account_id = :account AND used_at IS NULL')
            ->execute(['account' => $accountId]);

        return $accountId;
    }

    private function recentRequests(int $accountId): int
    {
        $statement = $this->db->prepare(
            "SELECT count(*) FROM password_reset_tokens WHERE account_id = :account AND created_at > now() - interval '1 hour'"
        );
        $statement->execute(['account' => $accountId]);

        return (int) $statement->fetchColumn();
    }

    private static function body(string $email, string $link): string
    {
        $minutes = self::LIFETIME_MINUTES;

        return <<<TEXT
            Dobrý den,

            někdo požádal o nastavení hesla k účtu $email v aplikaci Krojařka.
            Nové heslo nastavíte na této adrese (platí $minutes minut):

            $link

            Pokud jste o nastavení hesla nežádali, zprávu ignorujte. Heslo zůstane beze změny.

            Krojařka · Vonica
            TEXT;
    }
}
