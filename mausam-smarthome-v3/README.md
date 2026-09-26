# MAUSAM SmartHome V5 – Live API build

This version uses Open-Meteo for live weather/forecast/air-quality data and keeps optional IMD and Google Maps integrations server-side.

## Quick start

```powershell
npm install
npm run dev
```

Open `http://localhost:5500`.

Copy `.env.example` to `.env` when adding optional credentials.

See `API_SETUP.md` for the exact provider mapping.


## Official API mode

The server is IMD-first when IMD credentials and station/city IDs are configured. See `API_SETUP.md` and `.env.example`. Open-Meteo remains the fallback/supplemental provider.

## Mobile UI note
On screens 560px wide or smaller, the dashboard uses a translucent glass treatment so the live weather scene remains visible behind the interface. Content cards use a light transparent surface with blur to keep text readable without hiding the weather background.

## Dynamic personalization recommendations

The homepage recommendation cards now use the live weather signals instead of fixed advice text. Rain, temperature, wind, humidity, AQI, UV, weather type, warnings, and the 7-day forecast can change the recommendation wording. Relevance scores remain internal and are used only for card prioritization; they are not shown in the UI.
