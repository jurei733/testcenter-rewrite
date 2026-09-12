# Testcenter lokal ausprobieren

Voraussetzung: Node.js 22 und die installierten Projektabhängigkeiten.
Im Verzeichnis `rewrite-app` starten:

```bash
npm ci
npm run start:local
```

Bei bereits installierten Abhängigkeiten genügt `npm run start:local`.
Der Befehl baut die Anwendung, migriert `.data/local.sqlite` und startet
die geschützte API mit Demo-Daten. Sobald der Server bereit ist:

- Startseite: <http://127.0.0.1:4310/app>
- Administration: <http://127.0.0.1:4310/app/workspace>
- Benutzername: `demo-admin`
- Passwort: `demo-admin-password`
- Mandant / Arbeitsbereich: `demo-tenant` / `demo-workspace`
- [Demo-Teilnehmer öffnen](http://127.0.0.1:4310/participant?tenantKey=demo-tenant&workspaceKey=demo-workspace&loginKey=student-demo&groupKey=group%3Astudent-demo&bookletKey=booklet%3Ademo)

## Kurzer Rundgang

1. Als Administrator anmelden und den Demo-Arbeitsbereich öffnen.
2. Den Teilnehmerlink in einem zweiten Tab öffnen. Falls die Starterseite
   erscheint, das Demo-Booklet wählen und „Weiter“ drücken.
3. Im eingebetteten Player eine Antwort eingeben und das Eingabefeld verlassen.
   Den gespeicherten Fortschritt abwarten, dann die Seite neu laden: Die Antwort
   muss erhalten bleiben.
4. Zwischen den drei Aufgaben navigieren. In der Administration unter Runtime
   den Testlauf, Antworten und Monitor-Funktionen ansehen.
5. Zum Abschluss den Test beenden. Für einen bereits begonnenen Test kann
   der Teilnehmerlink wieder die Starterseite mit der Fortsetzen-Aktion öffnen.

Die Demo verwendet einen eingebetteten Verona-6-Player. Sie zeigt Anmeldung,
Antwortspeicherung und Wiederaufnahme; die Parität zusätzlicher Originalpakete
wird separat in [PARITY.md](./PARITY.md) bewertet.

## Frische Demo neben einer vorhandenen Installation

Ältere lokale Datenbanken können noch ein Demo-Booklet ohne Player enthalten.
Der Bootstrap ersetzt vorhandene aktive Releases nicht. Für eine aktuelle,
separate Demo mit eigener Datenbank und eigenem Port:

```bash
FIRST_SLICE_SQLITE_FILE=./.data/tryout-20260908.sqlite PORT=4311 npm run start:local
```

Dann <http://127.0.0.1:4311/app> öffnen und dieselben initialen Demo-Zugangsdaten
verwenden. Im Teilnehmerlink oben ebenfalls `4310` durch `4311` ersetzen.
Auch diese Datenbank bleibt bei Neustarts erhalten. Für eine weitere frische
Demo einen neuen Dateinamen und einen freien Port wählen.

## Neustart und Diagnose

Den Server im Terminal mit `Ctrl+C` beenden und mit `npm run start:local`
erneut starten. Vorhandene Konten, Antworten und Roster-Änderungen bleiben
erhalten. Die bekannten Demo-Zugangsdaten gelten für die initial erzeugten
Konten; ein später geändertes Passwort wird beim Neustart nicht zurückgesetzt.

```bash
curl --fail http://127.0.0.1:4310/readyz
curl --fail http://127.0.0.1:4310/manifest
```

`readyz` muss `ready` und den SQLite-Store melden. `manifest` zeigt den
laufenden Build. Wenn Port 4310 belegt ist, den vorhandenen Prozess zuerst
identifizieren; eine zweite Instanz nicht gegen dieselbe lokale Datenbank starten.

Der vorhandene automatisierte Demo-Test verwendet seine eigene Testdatenbank:

```bash
npm run smoke:local-demo
```

Nur wenn alle lokalen Demo-Daten ausdrücklich verworfen werden sollen:
Server beenden, `npm run reset:local` ausführen und erneut starten. Das löscht
die lokale Demo-Datenbank einschließlich ihrer Antworten und Änderungen.
