# reIS

Browser extension and mobile app that make MENDELU's student information system fast and usable. Used by ~2,600 students.

[Chrome](https://chromewebstore.google.com/detail/feildjaginpppijbpplcghalabdeibdb) · [iOS](https://apps.apple.com/app/id6804832714) · [Android](https://play.google.com/store/apps/details?id=cz.reis.app) · [Privacy](PRIVACY.md)

## Development

```bash
npm install
npm run dev        # dev server
npm run build      # build the extension
npm run test:run   # unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
```

## License

Code is [Apache-2.0](LICENSE). The reIS name and logo are not covered; forks must use their own name and icon.

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL). 3D model of building Q modified from the 3D building model (LOD2) © Statutární město Brno, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — storeys sliced, facades and the north front added — with terrain from ČÚZK DMR 5G; built in [reis-data](https://github.com/reis-mendelu/reis-data).

---

Built by Dominik Holek and Antonín Dědeček · independent student project at MENDELU
