# Hunder

Android-app for å slå opp hunderaser med bilder og fakta (på norsk).

## Installere
1. Åpne **Releases** for dette repoet på telefonen og last ned nyeste `Hunder-x.y.z.apk`.
2. Åpne filen og tillat installering fra nettleseren når Android spør.
3. Åpne **Hunder** fra app-skuffen.

## Oppdateringer
Appen sjekker siste GitHub Release hver gang den åpnes. Når det finnes en nyere versjon vises
**Oppdater nå** – trykk på den, og deretter *Oppdater* i Android-dialogen. (Første gang spør Android om
du vil tillate «Installer ukjente apper» for Hunder.)

## Lage en ny versjon
1. Endre koden.
2. Øk `VERSION` (f.eks. `1.0.0` → `1.0.1`) og legg til en `## [1.0.1]`-seksjon i `CHANGELOG.md`.
3. Push til standardgrenen. GitHub Actions bygger APK-en og publiserer Release `v1.0.1`.

## Funksjoner
- 151 raser, inkludert alle norske raser (elghund, buhund, lundehund, dunker, haldenstøver, hygenhund)
- Søk, filter på størrelse og FCI-gruppe, sortering
- Rasesider med bildegalleri, fakta, egenskaper (energi, pelsstell, barnevennlig, lærevillig, bjeffing, røyting),
  «passer for / passer mindre godt for» og lignende raser
- Dagens rase, favoritter
- Quiz: gjett rasen fra et tilfeldig bilde
- Finn din: svar på 7 spørsmål og få forslag til raser som passer deg
- Bilder fra Wikipedia og [dog.ceo](https://dog.ceo/dog-api/) (krever internett); fakta virker uten nett

## Prosjektstruktur
- `web/` – appens skjermer (HTML/CSS/JS), pakket inn i APK-en
  - `web/js/breeds.js` – rasedatabasen (legg til eller rett raser her)
- `app/` – Android-innpakningen (WebView, oppdatering)
- `VERSION`, `CHANGELOG.md` – versjon og endringsnotater
- `signing/` – nøkkelen alle versjoner signeres med (må være den samme for at oppdateringer skal installeres)

Forhåndsvis i nettleser: `cd web && python3 -m http.server 8000`.
