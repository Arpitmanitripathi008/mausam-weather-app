const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5500);
const CACHE_TTL = Number(process.env.APP_CACHE_TTL_SECONDS || 600) * 1000;
const ROOT = __dirname, PUBLIC = path.join(ROOT,"public"), DATA_DIR = path.join(ROOT,"data");
const CACHE_FILE = path.join(DATA_DIR,"cache.json"), PREF_FILE = path.join(DATA_DIR,"preferences.json");
app.use(cors()); app.use(express.json({limit:"100kb"})); app.use(express.static(PUBLIC));
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
function readJson(file,fallback){try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):fallback}catch{return fallback}}
function writeJson(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2),"utf8")}
let cache=readJson(CACHE_FILE,{}), preferences=readJson(PREF_FILE,{});
function cacheGet(key){const x=cache[key];if(!x)return null;if(Date.now()-x.savedAt>CACHE_TTL)return null;return x.value}
function cacheSet(key,value){cache[key]={savedAt:Date.now(),value};writeJson(CACHE_FILE,cache);return value}
function num(v,f=null){const n=Number(v);return Number.isFinite(n)?n:f}
async function fetchJson(url,options={}){const r=await fetch(url,options);if(!r.ok)throw new Error(`Upstream ${r.status}: ${r.statusText}`);return r.json()}
function addDays(ds,n){const d=new Date(ds+"T00:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function weatherType(code){code=Number(code);if(code===0||code===1)return "sunny";if([2,3].includes(code))return "cloudy";if([45,48].includes(code))return "fog";if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return "rain";if([71,73,75,77,85,86].includes(code))return "snow";if([95,96,99].includes(code))return "storm";return "cloudy"}
function weatherIcon(t){return ({sunny:"☀️",cloudy:"☁️",rain:"🌧️",storm:"⛈️",fog:"🌫️",snow:"❄️"})[t]||"☁️"}
function weatherLabel(t){return ({sunny:"Clear",cloudy:"Partly cloudy",rain:"Rain / showers",storm:"Thunderstorm",fog:"Foggy",snow:"Snow"})[t]||"Cloudy"}

async function openMeteoWeather(lat,lon){
 const key=`om:weather:${Number(lat).toFixed(3)}:${Number(lon).toFixed(3)}`; const c=cacheGet(key); if(c)return {...c,source:"cache"};
 const params=new URLSearchParams({latitude:lat,longitude:lon,timezone:"auto",forecast_days:"7",current:"temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max",forecast_days:"7"});
 const raw=await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
 const cur=raw.current||{}, d=raw.daily||{};
 const days=(d.time||[]).slice(0,7).map((date,i)=>{const type=weatherType(d.weather_code?.[i]);return {date,min:d.temperature_2m_min?.[i],max:d.temperature_2m_max?.[i],forecast:weatherLabel(type),type,icon:weatherIcon(type),rainChance:d.precipitation_probability_max?.[i]??0,rainMm:d.precipitation_sum?.[i]??0,uv:d.uv_index_max?.[i]??null,sunrise:d.sunrise?.[i]??null,sunset:d.sunset?.[i]??null}});
 const out={current:{station:"Open-Meteo",temperature:cur.temperature_2m,feelsLike:cur.apparent_temperature,humidity:cur.relative_humidity_2m,wind:cur.wind_speed_10m,windDirection:cur.wind_direction_10m,pressure:cur.surface_pressure,rain24h:cur.rain,precipitation:cur.precipitation,weatherCode:cur.weather_code,type:weatherType(cur.weather_code),label:weatherLabel(weatherType(cur.weather_code)),icon:weatherIcon(weatherType(cur.weather_code)),observedAt:cur.time},forecast:{date:days[0]?.date,days,today:days[0]},sun:{sunrise:days[0]?.sunrise?.slice(11,16)||null,sunset:days[0]?.sunset?.slice(11,16)||null},timezone:raw.timezone,source:"open-meteo"}; cacheSet(key,out); return out;
}
async function openMeteoAir(lat,lon){
 const key=`om:air:${Number(lat).toFixed(3)}:${Number(lon).toFixed(3)}`; const c=cacheGet(key);if(c)return {...c,source:"cache"};
 const p=new URLSearchParams({latitude:lat,longitude:lon,timezone:"auto",forecast_days:"2",current:"us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,uv_index",hourly:"us_aqi,pm2_5,pm10,uv_index"});
 const raw=await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${p}`); const cur=raw.current||{}; const value=num(cur.us_aqi);
 const category=value==null?"Unavailable":value<=50?"Good":value<=100?"Moderate":value<=150?"Unhealthy for sensitive groups":value<=200?"Unhealthy":value<=300?"Very unhealthy":"Hazardous";
 const out={available:value!=null,value,category,pm25:num(cur.pm2_5),pm10:num(cur.pm10),no2:num(cur.nitrogen_dioxide),ozone:num(cur.ozone),uv:num(cur.uv_index),source:"open-meteo"};cacheSet(key,out);return out;
}
async function geocode(q){
  const query=String(q||"").trim();
  if(query.length<2) return [];
  const p=new URLSearchParams({
    name:query,
    count:"8",
    language:"en",
    format:"json",
    countryCode:"IN"
  });
  const raw=await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${p}`);
  return (raw.results||[]).map(x=>({
    id:x.id,
    name:x.name,
    country:x.country,
    admin1:x.admin1,
    admin2:x.admin2,
    latitude:x.latitude,
    longitude:x.longitude,
    timezone:x.timezone
  }));
}

function imdHeaders(){
  const headers={Accept:"application/json"};
  const key=String(process.env.IMD_API_KEY||"").trim();
  if(key){
    const headerName=String(process.env.IMD_API_KEY_HEADER||"Authorization").trim();
    const scheme=String(process.env.IMD_AUTH_SCHEME||"Bearer").trim();
    headers[headerName]=headerName.toLowerCase()==="authorization" && scheme ? `${scheme} ${key}` : key;
  }
  return headers;
}
function imdConfigured(){return !!String(process.env.IMD_API_KEY||"").trim()}
async function imdFetch(pathname, params={}){
  if(!imdConfigured()) throw new Error("IMD_API_KEY is not configured");
  const base=(process.env.IMD_BASE_URL||"https://api.imd.gov.in").replace(/\/$/,"");
  const p=new URLSearchParams();
  for(const [k,v] of Object.entries(params)) if(v!==undefined && v!==null && v!=="") p.set(k,String(v));
  const url=`${base}${pathname}${p.toString()?`?${p}`:""}`;
  return fetchJson(url,{headers:imdHeaders()});
}
function unwrapImd(raw){
  if(raw&&Array.isArray(raw.data)) return raw.data;
  if(raw&&raw.data&&typeof raw.data==="object") return raw.data;
  return raw;
}
function normalizeForecastText(text){
  const t=String(text||"").toLowerCase();
  if(t.includes("thunder")||t.includes("lightning")) return "storm";
  if(t.includes("snow")) return "snow";
  if(t.includes("fog")||t.includes("mist")) return "fog";
  if(t.includes("rain")||t.includes("shower")||t.includes("drizzle")) return "rain";
  if(t.includes("cloud")||t.includes("overcast")) return "cloudy";
  if(t.includes("clear")||t.includes("sunny")) return "sunny";
  return "cloudy";
}
function normalizeCurrentWeatherCode(code){
  const c=Number(code);
  if(!Number.isFinite(c)) return "cloudy";
  if(c>=95) return "storm";
  if(c>=20 && c<=27) return "rain";
  if(c>=50 && c<=69) return "rain";
  if(c>=80 && c<=94) return "rain";
  if(c>=40 && c<=49) return "fog";
  if(c>=70 && c<=79) return "snow";
  if(c<=3) return c===0?"sunny":"cloudy";
  return "cloudy";
}
function pickImdRecord(raw){
  const x=unwrapImd(raw);
  if(Array.isArray(x)) return x[0]||{};
  return x||{};
}
async function imdCityForecast(cityId){
  const key=`imd:cityforecast:${cityId}`; const c=cacheGet(key); if(c) return {...c,source:"cache"};
  const raw=await imdFetch("/api/v1/cityforecast",{id:cityId});
  const record=pickImdRecord(raw);
  if(!record || !Object.keys(record).length) throw new Error("IMD city forecast returned no data");
  cacheSet(key,record);
  return {...record,source:"imd"};
}
async function imdCurrentWeather(stationId){
  const key=`imd:current:${stationId}`; const c=cacheGet(key); if(c) return {...c,source:"cache"};
  const raw=await imdFetch("/api/v1/current_wx",{id:stationId});
  const record=pickImdRecord(raw);
  if(!record || !Object.keys(record).length) throw new Error("IMD current weather returned no data");
  cacheSet(key,record);
  return {...record,source:"imd"};
}
async function imdSunMoon(lat,lon){
  const key=`imd:sunmoon:${Number(lat).toFixed(4)}:${Number(lon).toFixed(4)}`; const c=cacheGet(key); if(c) return {...c,source:"cache"};
  const raw=await imdFetch("/api/v1/sunmoon",{lat,lon});
  const data=unwrapImd(raw);
  const first=Array.isArray(data)?(data[0]||{}):{};
  const out={sunrise:first.sunrise||null,sunset:first.sunset||null,raw};
  cacheSet(key,out);return {...out,source:"imd"};
}
function buildImdForecast(record,baseDate){
  const days=[];
  for(let i=1;i<=7;i++){
    const prefix=i===1?"Todays":`Day_${i}`;
    const max=record[`${prefix}_Forecast_Max_Temp`];
    const min=record[`${prefix}_Forecast_Min_temp`];
    const text=record[`${prefix}_Forecast`];
    if(max==null && min==null && !text) continue;
    const type=normalizeForecastText(text);
    days.push({date:addDays(baseDate,i-1),min:num(min),max:num(max),forecast:text||weatherLabel(type),type,icon:weatherIcon(type),rainChance:null,rainMm:null,uv:null});
  }
  while(days.length<7){
    const last=days[days.length-1]||{date:baseDate,min:null,max:null,forecast:"Forecast unavailable",type:"cloudy",icon:"☁️"};
    days.push({...last,date:addDays(baseDate,days.length)});
  }
  return days.slice(0,7);
}
async function imdWeather(lat,lon){
  const cityId=String(process.env.IMD_CITY_ID||"").trim();
  const stationId=String(process.env.IMD_CURRENT_STATION_ID||"").trim();
  if(!cityId && !stationId) throw new Error("Set IMD_CITY_ID and/or IMD_CURRENT_STATION_ID");
  const today=new Date().toISOString().slice(0,10);
  const [city,station,sun]=await Promise.all([
    cityId?imdCityForecast(cityId):Promise.resolve(null),
    stationId?imdCurrentWeather(stationId):Promise.resolve(null),
    imdSunMoon(lat,lon).catch(()=>null)
  ]);
  const c=station||{};
  const r=city||{};
  const baseDate=r.Date||today;
  const days=buildImdForecast(r,baseDate);
  const type=normalizeCurrentWeatherCode(c["Weather Code"]||c.WEATHER_CODE||r.Weather_Code||r.WeatherCode);
  const out={
    current:{
      station:c.Station||c.STATION||r.Station_Name||"IMD",
      temperature:num(c.Temperature??c.CURR_TEMP,days[0]?.max),
      feelsLike:num(c["Feel Like"]??c.FEEL_LIKE,null),
      humidity:num(c.Humidity??c.RH,r.Relative_Humidity_at_1730),
      wind:num(c["Wind Speed"]??c.WIND_SPEED,null),
      windDirection:c["Wind Direction Description"]??c.WIND_DIRECTION??c.WIND_DIRECTION_DESCRIPTION??null,
      pressure:num(c["M.S.L.P"]??c.MSLP??c.MSLP_HPA,null),
      rain24h:num(c["Last 24 hrs Rainfall"]??c.LAST_24_HRS_RAINFALL??r.Past_24_hrs_Rainfall,null),
      precipitation:num(c["Last 24 hrs Rainfall"]??r.Past_24_hrs_Rainfall,null),
      weatherCode:c["Weather Code"]??c.WEATHER_CODE??null,
      type,label:weatherLabel(type),icon:weatherIcon(type),observedAt:`${c["Date of Observation"]||r.Date||today} ${c["Time of Observation"]||""}`.trim()
    },
    forecast:{date:baseDate,days,today:days[0]},
    sun:{sunrise:sun?.sunrise||r.Sunrise_time||null,sunset:sun?.sunset||r.Sunset_time||null},
    timezone:"Asia/Kolkata",
    source:"imd",
    provider:{name:"India Meteorological Department",weather:true}
  };
  return out;
}
async function imdWarnings(id){
  if(!imdConfigured() || !id)return {available:false,warnings:[],source:!imdConfigured()?"not-configured":"id-not-configured"};
  try{const key=`imd:warning:${id}`,c=cacheGet(key);if(c)return {...c,source:"cache"};const raw=await imdFetch("/api/v1/districtwarning",{id});const warnings=unwrapImd(raw);const list=Array.isArray(warnings)?warnings:(warnings?[warnings]:[]);const out={available:true,warnings:list};cacheSet(key,out);return {...out,source:"imd"}}catch(e){return {available:false,warnings:[],error:e.message,source:"imd-error"}}
}
async function imdNowcast(id){
  if(!imdConfigured() || !id)return {available:false,items:[],source:"not-configured"};
  try{const raw=await imdFetch("/api/v1/districtnowcast",{id});const data=unwrapImd(raw);return {available:true,items:Array.isArray(data)?data:(data?[data]:[]),source:"imd"}}catch(e){return {available:false,items:[],error:e.message,source:"imd-error"}}
}
async function imdRainfall(id){
  if(!imdConfigured() || !id)return {available:false,items:[],source:"not-configured"};
  try{const raw=await imdFetch("/api/v1/districtrainfall",{id});const data=unwrapImd(raw);return {available:true,items:Array.isArray(data)?data:(data?[data]:[]),source:"imd"}}catch(e){return {available:false,items:[],error:e.message,source:"imd-error"}}
}
async function googlePlaces(textQuery,lat,lon){if(!process.env.GOOGLE_MAPS_API_KEY)return {available:false,places:[],message:"GOOGLE_MAPS_API_KEY not configured"};const body={textQuery,languageCode:"en",maxResultCount:8,locationBias:{circle:{center:{latitude:Number(lat),longitude:Number(lon)},radius:5000}}};const r=await fetch("https://places.googleapis.com/v1/places:searchText",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":process.env.GOOGLE_MAPS_API_KEY,"X-Goog-FieldMask":"places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours,places.primaryType"},body:JSON.stringify(body)});if(!r.ok)throw new Error(`Google Places ${r.status}: ${await r.text()}`);const raw=await r.json();return {available:true,places:(raw.places||[]).map(p=>({name:p.displayName?.text,address:p.formattedAddress,lat:p.location?.latitude,lon:p.location?.longitude,rating:p.rating,openNow:p.currentOpeningHours?.openNow,type:p.primaryType}))}}
async function googleRoute(origin,destination,mode="DRIVE"){if(!process.env.GOOGLE_MAPS_API_KEY)return {available:false,message:"GOOGLE_MAPS_API_KEY not configured"};const body={origin:{address:origin},destination:{address:destination},travelMode:mode,routingPreference:"TRAFFIC_AWARE"};const r=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":process.env.GOOGLE_MAPS_API_KEY,"X-Goog-FieldMask":"routes.duration,routes.distanceMeters,routes.staticDuration,routes.polyline.encodedPolyline"},body:JSON.stringify(body)});if(!r.ok)throw new Error(`Google Routes ${r.status}: ${await r.text()}`);const raw=await r.json();const x=raw.routes?.[0];return {available:!!x,route:x?{duration:x.duration,distanceMeters:x.distanceMeters,staticDuration:x.staticDuration,polyline:x.polyline?.encodedPolyline}:null}}

function demo(lat,lon){const date=new Date().toISOString().slice(0,10);const specs=[["Partly cloudy",24,31,"cloudy",35],["Rain",23,29,"rain",70],["Showers",23,30,"rain",55],["Sunny",24,33,"sunny",10],["Partly cloudy",25,32,"cloudy",25],["Thunderstorm",24,30,"storm",65],["Clear",24,32,"sunny",5]];const days=specs.map((s,i)=>({date:addDays(date,i),min:s[1],max:s[2],forecast:s[0],type:s[3],icon:weatherIcon(s[3]),rainChance:s[4],rainMm:s[4]/10,uv:6}));return {current:{station:"Demo",temperature:29,feelsLike:31,humidity:68,wind:12,windDirection:270,pressure:1006,rain24h:1.2,weatherCode:2,type:"cloudy",label:"Partly cloudy",icon:"☁️"},forecast:{date,days,today:days[0]},sun:{sunrise:"05:58",sunset:"18:03"},timezone:"Asia/Kolkata",aqi:{available:false,value:null,category:"Not connected"},warnings:{available:false,warnings:[]},source:"demo"}}

app.get("/api/health",(req,res)=>res.json({ok:true,weatherProvider:imdConfigured()&&(process.env.IMD_CITY_ID||process.env.IMD_CURRENT_STATION_ID)?"IMD (primary), Open-Meteo (supplemental)":"Open-Meteo",imdConfigured,imdCityConfigured:!!process.env.IMD_CITY_ID,imdStationConfigured:!!process.env.IMD_CURRENT_STATION_ID,imdDistrictConfigured:!!(process.env.IMD_DISTRICT_ID||process.env.IMD_DISTRICT_WARNING_ID),googleConfigured:!!process.env.GOOGLE_MAPS_API_KEY,time:new Date().toISOString()}));
app.get("/api/geocode",async(req,res)=>{try{res.json({ok:true,results:await geocode(String(req.query.q||""))})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.get("/api/dashboard",async(req,res)=>{
  const city=req.query.city||process.env.DEFAULT_CITY||"Kanpur";
  const lat=num(req.query.lat,Number(process.env.DEFAULT_LAT||26.4499));
  const lon=num(req.query.lon,Number(process.env.DEFAULT_LON||80.3319));
  let data; let weatherSource="open-meteo";
  if(imdConfigured()&&(process.env.IMD_CITY_ID||process.env.IMD_CURRENT_STATION_ID)){
    try{ data=await imdWeather(lat,lon); weatherSource="imd"; }
    catch(e){ data=await openMeteoWeather(lat,lon); data.provider={name:"Open-Meteo",weather:true}; data.imdError=e.message; }
  }else{
    try{ data=await openMeteoWeather(lat,lon); }catch(e){ data=demo(lat,lon); data.error=e.message; }
  }
  try{
    const air=await openMeteoAir(lat,lon);
    data.aqi=air;
    data.supplemental={...(data.supplemental||{}),airQualityProvider:"Open-Meteo / CAMS"};
  }catch(e){ data.aqi={available:false,value:null,category:"Unavailable",error:e.message}; }
  if(imdConfigured()){
    const districtId=process.env.IMD_DISTRICT_ID||process.env.IMD_DISTRICT_WARNING_ID;
    data.warnings=await imdWarnings(process.env.IMD_DISTRICT_WARNING_ID||districtId);
    data.nowcast=await imdNowcast(districtId);
    data.rainfall=await imdRainfall(districtId);
    if(!data.sun?.sunrise||!data.sun?.sunset){ try{ const sun=await imdSunMoon(lat,lon); data.sun={sunrise:sun.sunrise||data.sun?.sunrise||null,sunset:sun.sunset||data.sun?.sunset||null}; }catch{} }
  } else {
    data.warnings={available:false,warnings:[],source:"not-configured"};
    data.nowcast={available:false,items:[],source:"not-configured"};
    data.rainfall={available:false,items:[],source:"not-configured"};
  }
  data.provider={name:weatherSource==="imd"?"India Meteorological Department":"Open-Meteo",weather:weatherSource==="imd",supplementalAir:"Open-Meteo / CAMS"};
  res.json({ok:true,city,lat,lon,...data,generatedAt:new Date().toISOString()});
});
app.post("/api/places/search",async(req,res)=>{try{res.json({ok:true,...await googlePlaces(String(req.body.query||"weather-friendly places"),req.body.lat,req.body.lon)})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.post("/api/routes",async(req,res)=>{try{res.json({ok:true,...await googleRoute(req.body.origin,req.body.destination,req.body.mode||"DRIVE")})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.get("/api/marine",(req,res)=>res.json({ok:true,available:false,message:"Marine/tide feed is not configured. Add a licensed marine provider before showing real wave/tide data."}));
app.get("/api/preferences/:userId",(req,res)=>res.json(preferences[req.params.userId]||{profiles:["fitness"],details:["temperature","rain","wind","humidity","sunrise"],learning:true}));
app.post("/api/preferences/:userId",(req,res)=>{const profilesAllowed=["fitness","health","commuter","traveler","beach","agriculture","family","events"],detailsAllowed=["temperature","feelsLike","rain","wind","humidity","pressure","visibility","uv","aqi","sunrise","sunset","pollen","wave","tide","seaTemp"];const profiles=(req.body.profiles||[]).filter(x=>profilesAllowed.includes(x));const details=(req.body.details||[]).filter(x=>detailsAllowed.includes(x));const value={profiles:profiles.length?profiles:["fitness"],details:details.length?details:["temperature","rain","wind"],learning:req.body.learning!==false};preferences[req.params.userId]=value;writeJson(PREF_FILE,preferences);res.json({ok:true,...value})});
app.post("/api/events",(req,res)=>{const file=path.join(DATA_DIR,"events.json"),events=readJson(file,[]);events.push({userId:String(req.body.userId||"demo"),type:String(req.body.type||"view"),item:String(req.body.item||""),at:new Date().toISOString()});writeJson(file,events.slice(-2000));res.json({ok:true})});
app.get("*",(req,res)=>res.sendFile(path.join(PUBLIC,"index.html")));
app.listen(PORT,()=>console.log(`Mausam SmartHome running at http://localhost:${PORT}`));
