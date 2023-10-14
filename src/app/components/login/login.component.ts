import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  username: string = '';
  password: string = '';

  constructor(private router: Router) {}

  // Metoda pro přihlášení uživatele
  login(): void {
    // Zde byste provedli autentizaci uživatele, například zaslaním údajů na server a ověřením.
    // Po úspěšném přihlášení můžete přesměrovat uživatele na hlavní dashboard:
    if (this.username === 'spravce' && this.password === 'heslo') {
      this.router.navigate(['/dashboard']);
    } else {
      // Zde byste měli zobrazit chybovou zprávu nebo jiný způsob informování uživatele o neúspěšném přihlášení.
    }
  }
}
