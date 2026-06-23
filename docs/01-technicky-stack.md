# Technický stack a architektonický směr

## Aktuální plánovaný stack

První verze bude postavená na dostupné infrastruktuře:

- Angular frontend,
- PHP REST API,
- MySQL databáze,
- běžný placený PHP hosting,
- bez WebSocketu,
- realtime chování zatím přes polling.

Angular aplikace bude buildovaná jako statický frontend a nahraná na hosting jako zkompilované soubory.

PHP backend bude poskytovat REST API nad MySQL databází.

## Proč zatím bez WebSocketu

Běžný PHP hosting typicky neumožňuje pohodlně provozovat vlastní WebSocket server, protože WebSocket potřebuje dlouho běžící proces, správu portů a často i reverse proxy.

Proto první verze nebude stavět na WebSocketu. Pro aktualizace dat se použije polling:

- periodické načítání novinek,
- ruční refresh,
- později případně push notifikace nebo externí realtime služba.

## Budoucí cílový stack

Do budoucna se počítá s možností migrace na robustnější infrastrukturu:

- Node.js / TypeScript backend,
- PostgreSQL,
- WebSocket nebo Socket.IO,
- Docker / Docker Compose,
- VPS nebo jiný server, kde lze provozovat vlastní služby,
- reverse proxy přes Nginx nebo Caddy.

Možná budoucí architektura:

```text
Angular frontend
Node.js / TypeScript API
PostgreSQL
WebSocket / Socket.IO
Docker Compose
VPS
```

## Zásady pro frontend

Angular frontend má být připravený tak, aby budoucí změna backendu nebyla bolestivá.

Komponenty nemají volat HTTP API přímo. Mají používat aplikační services.

Doporučená struktura volání:

```text
Angular komponenta
↓
feature service
↓
API service / mock service
↓
PHP REST API nebo mock data
```

Příklad:

```ts
this.eventsService.getEvents();
```

Místo přímého volání:

```ts
this.http.get('/api/events');
```

Díky tomu půjde později vyměnit PHP REST API za Node.js backend bez zásadních zásahů do komponent.

## Mock data v první fázi

První fáze může fungovat bez reálného backendu:

- modely budou v TypeScriptu,
- services budou vracet mock data,
- UI bude možné testovat a připomínkovat,
- později se mock implementace nahradí HTTP voláním.

Příklad:

```ts
getEvents(): Observable<AppEvent[]> {
  return of(MOCK_EVENTS).pipe(delay(300));
}
```

Později:

```ts
getEvents(): Observable<AppEvent[]> {
  return this.http.get<AppEvent[]>('/api/events');
}
```

## Doporučená struktura Angular aplikace

```text
src/app/core/
  auth/
  api/
  layout/
  models/
  services/

src/app/shared/
  components/
  pipes/
  utils/

src/app/features/
  dashboard/
  posts/
  events/
  attendance/
  members/
  costumes/
  documents/
  settings/
```

## Doporučený přístup k databázi

Databáze má mít pevnou strukturu pro jádro a hlavní moduly.

Nedoporučuje se:

- generovat API automaticky nad libovolnou tabulkou,
- stavět celý frontend jako univerzální renderer databázových tabulek,
- snažit se pokrýt všechny budoucí scénáře přes plně dynamický model.

Doporučuje se:

- pevné tabulky pro jádro aplikace,
- pevné tabulky pro hlavní moduly,
- konfigurovatelnost přes skupiny, moduly a nastavení,
- rozšiřující atributy pouze tam, kde dávají smysl.

Příklad oblasti, kde může dávat smysl flexibilita:

- doplňkové atributy krojových dílů,
- nastavení modulu,
- volitelná metadata.

Příklad oblasti, kde má být model pevný:

- uživatelé,
- členství v souboru,
- skupiny,
- akce,
- docházka,
- příspěvky,
- základní oprávnění.
