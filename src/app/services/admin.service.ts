import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private apiUrl = 'https://api.example.com'; // Nahraďte skutečnou URL vašeho backendu

  constructor(private http: HttpClient) {}

  // Metoda pro přidání nového člena
  addMember(memberData: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.apiUrl}/members`; // Nahraďte za skutečnou URL pro členy

    return this.http.post(url, memberData, { headers }).pipe(
      catchError((error) => {
        // Zpracování chyby při přidávání člena
        throw error;
      })
    );
  }

  // Další metody pro administrativní operace by se zde přidaly podle potřeby
}
