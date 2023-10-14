import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'splk';

  isAdmin: boolean = true; // Předpokládáme, že máte informaci o administrátorských právech
}
