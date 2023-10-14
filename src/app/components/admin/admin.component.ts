import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent {
  // Formulář pro přidání nového člena
  public memberForm: FormGroup;

  constructor(private fb: FormBuilder, private adminService: AdminService) {
    // Inicializace formuláře
    this.memberForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      // Další pole podle potřeby
    });
  }

  // Metoda pro odeslání formuláře pro přidání nového člena
  addMember(): void {
    if (this.memberForm.valid) {
      const memberData = this.memberForm.value;
      // Zavolání služby pro přidání člena
      this.adminService.addMember(memberData).subscribe(
        (response) => {
          // Člen byl úspěšně přidán, můžete provést další akce nebo zobrazit potvrzení
          console.log('Člen byl přidán:', response);
          this.memberForm.reset(); // Vymaže formulář
        },
        (error) => {
          // Zpracování chyby při přidávání člena
          console.error('Chyba při přidávání člena:', error);
        }
      );
    }
  }
}
