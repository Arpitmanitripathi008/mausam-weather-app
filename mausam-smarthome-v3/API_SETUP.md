# MAUSAM SmartHome – official API setup

This version keeps the existing FINAL-CORRECTED landing page and changes the **data layer only**.

## 1. Official IMD APIs — primary India weather source

The India Meteorological Department (IMD), Ministry of Earth Sciences, provides an official API Management Platform for real-time observations, forecasts, warnings and specialized bulletins.

Portal:
https://api.imd.gov.in/public/

API reference:
https://api.imd.gov.in/public/api_reference.html

The public IMD reference currently lists, among others:
- City Weather Forecast (7 days)
- City Weather Forecast with latitude/longitude
- Current Weather
- District-wise Nowcast
- District-wise Warnings
- District-wise Rainfall
- Sun/Moon rise and set
- Marine bulletins and port/coastal/fishermen warnings
- Cyclone track / wind warning / cone
- Highway warnings
- Radar imagery and lightning
- Agromet advisories

### What MAUSAM uses from IMD

When IMD credentials + IDs are configured, the backend tries IMD first for:
- current temperature, humidity, wind, pressure, weather code, rainfall
- 7-day city forecast
- sunrise/sunset
- district warnings
- district nowcast
- district rainfall

If the IMD call fails, the app falls back to Open-Meteo so the dashboard does not break.

### Register / obtain access

1. Open https://api.imd.gov.in/public/
2. Create an account or sign in.
3. Read the current access instructions and obtain the credential/token allowed for your account.
4. Use the IMD API reference to identify the IDs for the city/current station/district you want to display.

The public reference documents the endpoint shapes and fields, but the authentication header is not fully specified on that page. For that reason the project makes the header configurable instead of assuming one undocumented format:

```env
IMD_API_KEY=YOUR_TOKEN_OR_KEY
IMD_AUTH_SCHEME=Bearer
IMD_API_KEY_HEADER=Authorization
```

If IMD supplies a different header, change only `IMD_API_KEY_HEADER` and, if applicable, `IMD_AUTH_SCHEME`.

### IDs

```env
IMD_CITY_ID=YOUR_CITY_FORECAST_ID
IMD_CURRENT_STATION_ID=YOUR_CURRENT_WEATHER_STATION_ID
IMD_DISTRICT_ID=YOUR_DISTRICT_ID
IMD_DISTRICT_WARNING_ID=YOUR_DISTRICT_WARNING_ID
```

You do not have to configure every ID on day one. For example, current weather + 7-day forecast can work with the city/station IDs; warnings/nowcast/rainfall additionally need the district ID.

## 2. Open-Meteo — supplemental/fallback source

The existing Open-Meteo integration remains because its public forecast API exposes fields that make the MAUSAM UI richer, including precipitation probability, UV and other hourly/daily model variables. It also provides the Air Quality API.

Weather docs:
https://open-meteo.com/en/docs

Air-quality docs:
https://open-meteo.com/en/docs/air-quality-api

No API key is required for the normal public use case.

In this project Open-Meteo is used for:
- precipitation probability used by personalization
- UV value used by personalization
- air-quality supplemental values
- fallback if an official IMD request is unavailable

## 3. India official air quality — CPCB

CPCB publishes national air-quality information through its Air Quality / CCR platform. The project currently does **not** call an undocumented CPCB browser endpoint because that would be brittle and hard to explain or support.

For now, the AQI card remains on the documented Open-Meteo/CAMS feed. When we obtain a supported CPCB integration method or approved API credentials, we can replace that adapter without changing the dashboard UI.

## 4. Google Maps Platform — later for Commuter / Traveler

Optional APIs:
- Places API (New)
- Routes API

The existing backend adapters are already present, but they are not required for the weather homepage.

## 5. Environment file

Create `.env` in the project root by copying `.env.example`:

```powershell
copy .env.example .env
```

Then add your real IMD values.

**Never put the IMD token/API key in `public/app.js` or HTML.**

## 6. Run

```powershell
npm install
npm run dev
```

Open:

http://localhost:5500

## 7. Check the API connection

Open:

http://localhost:5500/api/health

The response tells you whether the IMD credential, city/station IDs, district ID, and Google key are configured.

Then open:

http://localhost:5500/api/dashboard?city=Kanpur&lat=26.4499&lon=80.3319

If IMD is configured and responds successfully, `source` / `provider` will identify IMD as the weather source. If not, the app will safely fall back to Open-Meteo.
