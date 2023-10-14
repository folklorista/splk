export class Event {
  id: number;
  name: string;
  date: string; // Předpokládáme, že datum je reprezentováno jako textový řetězec (formát YYYY-MM-DD)
  // Další vlastnosti události podle potřeby
  isRegistered: boolean;

  constructor(id: number, name: string, date: string, isRegistered?: boolean) {
    this.id = id;
    this.name = name;
    this.date = date;
    // Inicializace dalších vlastností
    this.isRegistered = !!isRegistered;
  }
}
