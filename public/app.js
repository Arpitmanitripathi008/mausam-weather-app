const state = {
  userId: "demo-user",
  city: "Kanpur",
  lat: 26.4499,
  lon: 80.3319,
  data: null,
  profiles: ["fitness"],
  details: ["temperature","rain","wind","humidity","sunrise"],
  learning: true,
  detailTab: "current"
};

const PROFILES = {
  fitness:{name:"Fitness",sub:"Running & outdoor",icon:"🏃",weights:{temperature:18,rain:28,wind:20,uv:15,aqi:10,humidity:9}},
  health:{name:"Health",sub:"AQI, UV & comfort",icon:"♥",weights:{aqi:35,uv:20,temperature:15,humidity:15,rain:5,wind:10}},
  commuter:{name:"Commuter",sub:"Travel & visibility",icon:"🚗",weights:{rain:25,wind:15,visibility:25,warnings:25,fog:10}},
  traveler:{name:"Traveler",sub:"Trips & destinations",icon:"✈️",weights:{rain:20,warnings:30,temperature:15,visibility:20,wind:15}},
  beach:{name:"Beach & Surf",sub:"Waves & tides",icon:"≈",weights:{wave:35,tide:20,wind:20,rain:10,seaTemp:15}},
  agriculture:{name:"Agriculture",sub:"Rain & soil",icon:"🌱",weights:{rain:35,temperature:20,humidity:10,frost:20,warnings:15}},
  family:{name:"Family",sub:"School & safety",icon:"⌂",weights:{rain:25,warnings:35,visibility:20,temperature:10,wind:10}},
  events:{name:"Events",sub:"Outdoor gatherings",icon:"▦",weights:{rain:35,temperature:20,wind:25,humidity:10,warnings:10}}
};

const DETAIL_LABELS = {
  temperature:"Temperature", feelsLike:"Feels like", rain:"Rain", wind:"Wind", humidity:"Humidity",
  pressure:"Pressure", visibility:"Visibility", uv:"UV Index", aqi:"Air Quality", sunrise:"Sunrise",
  sunset:"Sunset", pollen:"Pollen", wave:"Wave height", tide:"Next tide", seaTemp:"Sea temperature"
};

const $ = id => document.getElementById(id);

async function api(url, options){
  const r=await fetch(url, options);
  if(!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r.json();
}

function escapeHtml(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function saveLocation(){
  localStorage.setItem("mausam-location", JSON.stringify({city:state.city,lat:state.lat,lon:state.lon}));
}
function loadSavedLocation(){
  try{
    const saved=JSON.parse(localStorage.getItem("mausam-location")||"null");
    if(saved && saved.city && Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lon))){
      state.city=String(saved.city); state.lat=Number(saved.lat); state.lon=Number(saved.lon);
    }
  }catch{}
}
function syncLocationUI(){
  const input=$("locationSearchInput");
  if(input && document.activeElement!==input) input.value=state.city;
  const clear=$("locationSearchClear");
  if(clear && input) clear.hidden=input.value.trim().length===0;
}

function toast(message){
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),2200);
}

function setView(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(`${view}View`).classList.add("active");
  $("menuPanel").classList.remove("open");
  $("menuBtn").setAttribute("aria-expanded","false");
  window.scrollTo({top:0,behavior:"smooth"});
  if(view==="details") renderDetails();
  if(view==="profile") renderProfile();
  if(view==="personalization") renderSettings();
}

function weatherFacts(){
  const c=state.data?.current||{};
  const a=state.data?.aqi||{};
  const today = state.data?.forecast?.today || {};
  return {
    temperature:c.temperature ?? 29,
    feelsLike:c.feelsLike ?? ((c.temperature??29)+2),
    rain:Number.isFinite(Number(today.rainChance)) ? Number(today.rainChance) : (c.type==="rain" ? 65 : 35),
    wind:c.wind??12, humidity:c.humidity??68, pressure:c.pressure??1006,
    visibility:c.visibility ?? (c.type==="fog" ? 2 : (c.type==="dust" ? 4 : null)),
    uv:a.uv ?? today.uv ?? null,
    aqi:a.value??null,
    warnings:(state.data?.warnings?.warnings?.length||0), fog:c.type==="fog"?80:5,
    type:c.type||today.type||"cloudy",
    wave:state.data?.marine?.waveHeight ?? null,
    tide:state.data?.marine?.nextTide ?? null,
    seaTemp:state.data?.marine?.seaTemp ?? null,
    frost:c.temperature!=null ? Math.max(0, 18-c.temperature) : 0,
    forecastMin:Array.isArray(state.data?.forecast?.days)&&state.data.forecast.days.length ? Math.min(...state.data.forecast.days.map(d=>Number(d.min)).filter(Number.isFinite)) : null,
    forecastMax:Array.isArray(state.data?.forecast?.days)&&state.data.forecast.days.length ? Math.max(...state.data.forecast.days.map(d=>Number(d.max)).filter(Number.isFinite)) : null,
    forecastRange:Array.isArray(state.data?.forecast?.days)&&state.data.forecast.days.length ? (()=>{const mins=state.data.forecast.days.map(d=>Number(d.min)).filter(Number.isFinite);const maxs=state.data.forecast.days.map(d=>Number(d.max)).filter(Number.isFinite);return mins.length&&maxs.length?`${Math.round(Math.min(...mins))}–${Math.round(Math.max(...maxs))}°C`:null})() : null
  };
}

function scoreProfile(id){
  const facts=weatherFacts(), weights=PROFILES[id].weights;
  let total=0, max=0;
  Object.entries(weights).forEach(([k,w])=>{ max+=w; const v=facts[k]; let s=0;
    if(k==="rain") s=v>70?95:v>40?75:v<20?65:45;
    else if(k==="wind") s=v>30?85:v>15?70:55;
    else if(k==="temperature") s=Math.max(0,100-Math.abs(v-25)*7);
    else if(k==="aqi") s=v<=50?95:v<=100?75:v<=200?45:20;
    else if(k==="uv") s=v<=3?90:v<=6?70:v<=8?45:25;
    else if(k==="humidity") s=v>=40&&v<=65?90:60;
    else if(k==="visibility") s=v>=8?90:v>=5?65:30;
    else if(k==="warnings") s=v?90:40;
    else if(k==="fog") s=v>50?80:40;
    else if(k==="wave") s=v>=0.5&&v<=2?85:55;
    else if(k==="tide") s=70;
    else if(k==="seaTemp") s=v>=24?85:55;
    else if(k==="frost") s=v<20?80:30;
    total+=w*s;
  });
  return Math.round(total/max);
}

function weatherIcon(type){
  if(type==="rain") return `<svg class="weather-rain-icon" viewBox="0 0 64 56" aria-label="Rainy"><path class="weather-cloud" d="M15 38c-7 0-11-5-11-10s4-10 10-10c2-8 8-13 16-13 9 0 16 5 18 13 7 0 12 4 12 10s-5 10-12 10H15z"/><path class="weather-drop" d="M22 43c0 4-4 8-4 8s-4-4-4-8a4 4 0 0 1 8 0zm15 0c0 4-4 8-4 8s-4-4-4-8a4 4 0 0 1 8 0zm15 0c0 4-4 8-4 8s-4-4-4-8a4 4 0 0 1 8 0z"/></svg>`;
  if(type==="storm") return `<svg class="weather-rain-icon" viewBox="0 0 64 56" aria-label="Thunderstorm"><path class="weather-cloud" d="M15 38c-7 0-11-5-11-10s4-10 10-10c2-8 8-13 16-13 9 0 16 5 18 13 7 0 12 4 12 10s-5 10-12 10H15z"/><path class="weather-lightning" d="M35 36l-8 11h6l-4 9 11-14h-6z"/></svg>`;
  return ({sunny:"☀️",cloudy:"⛅",fog:"🌫️",dust:"🌫️"}[type]||"⛅");
}

function forecastFallback(){
  const base=new Date();
  const specs=[
    ["Partly cloudy",24,31,"cloudy"],["Rain",23,29,"rain"],["Scattered showers",23,30,"rain"],
    ["Sunny",24,33,"sunny"],["Partly cloudy",25,32,"cloudy"],["Thunderstorm",24,30,"storm"],["Clear sky",24,32,"sunny"]
  ];
  return specs.map((s,i)=>({date:new Date(base.getFullYear(),base.getMonth(),base.getDate()+i).toISOString().slice(0,10),min:s[1],max:s[2],forecast:s[0],type:s[3],icon:weatherIcon(s[3])}));
}

function renderForecast(){
  let days=Array.isArray(state.data?.forecast?.days)?state.data.forecast.days:[];
  if(days.length<7) days=forecastFallback();
  days=days.slice(0,7);
  while(days.length<7){ const fb=forecastFallback(); days.push(fb[days.length]); }
  $("forecastStrip").innerHTML=days.map((d,i)=>{
    const date=d.date?new Date(d.date+"T00:00:00"):new Date();
    const label=i===0?"Today":date.toLocaleDateString("en-IN",{weekday:"short"});
    const icon=d.type?weatherIcon(d.type):(d.icon||weatherIcon("cloudy"));
    const max=Number.isFinite(Number(d.max))?Math.round(Number(d.max)):"—";
    const min=Number.isFinite(Number(d.min))?Math.round(Number(d.min)):"—";
    return `<div class="forecast-day"><b>${label}</b><div class="ficon">${icon}</div><strong>${max}°</strong><span>${min}° / ${d.forecast||"Partly cloudy"}</span></div>`;
  }).join("");
}

const PERSONALIZED_CARDS={
  fitness:[
    ["🏃","Outdoor comfort","temperature","Comfort"],
    ["🌧️","Rain check","rain","Chance"],
    ["💨","Wind","wind","Wind"]
  ],
  health:[
    ["🍃","Air quality","aqi","AQI"],
    ["☀️","UV index","uv","UV"],
    ["💧","Humidity","humidity","Humidity"]
  ],
  commuter:[
    ["🌧️","Rain risk","rain","Chance"],
    ["💨","Wind","wind","Wind"],
    ["👁️","Visibility","visibility","Visibility"]
  ],
  traveler:[
    ["🗓️","7-day planning","forecastRange","Range"],
    ["🌧️","Rain risk","rain","Chance"],
    ["⚠️","Warnings","warnings","Alerts"]
  ],
  beach:[
    ["🌊","Wave height","wave","Wave"],
    ["🌬️","Wind","wind","Wind"],
    ["🌡️","Sea temperature","seaTemp","Sea temp"]
  ],
  agriculture:[
    ["🌧️","Rain risk","rain","Chance"],
    ["🌡️","Temperature","temperature","Temp"],
    ["⚠️","Warnings","warnings","Alerts"]
  ],
  family:[
    ["🌧️","Rain risk","rain","Chance"],
    ["👁️","Visibility","visibility","Visibility"],
    ["⚠️","Warnings","warnings","Alerts"]
  ],
  events:[
    ["🌧️","Rain risk","rain","Chance"],
    ["💨","Wind","wind","Wind"],
    ["🌡️","Temperature","temperature","Temp"]
  ]
};

function rainBand(rain){
  if(rain>=80) return "very-high";
  if(rain>=50) return "high";
  if(rain>=25) return "medium";
  return "low";
}

function tempComfort(temp){
  if(temp<=12) return "cold";
  if(temp>=38) return "very-hot";
  if(temp>=33) return "hot";
  if(temp>=21) return "comfortable";
  return "cool";
}

function aqiBand(aqi){
  if(aqi==null) return "unknown";
  if(aqi<=50) return "good";
  if(aqi<=100) return "moderate";
  if(aqi<=150) return "sensitive";
  if(aqi<=200) return "unhealthy";
  return "very-unhealthy";
}

function uvBand(uv){
  if(uv==null) return "unknown";
  if(uv<3) return "low";
  if(uv<6) return "moderate";
  if(uv<8) return "high";
  if(uv<11) return "very-high";
  return "extreme";
}

function recommendationFor(profileId,key,f){
  const rain=rainBand(f.rain), temp=tempComfort(f.temperature), wind=Number(f.wind)||0;
  const warnings=f.warnings||0, aqi=aqiBand(f.aqi), uv=uvBand(f.uv), humidity=Number(f.humidity)||0;
  const fog=f.fog||0;

  if(key==='forecastRange'){
    if(f.forecastRange && f.forecastMin!=null && f.forecastMax!=null){
      if(f.forecastMax>=38) return `The next 7 days reach about ${Math.round(f.forecastMax)}°C; plan hotter activities for cooler hours.`;
      if(f.rain==='very-high' || f.rain==='high') return `Temperatures range around ${f.forecastRange}, with a high rain risk to plan around.`;
      return `The next 7 days range about ${f.forecastRange}; use the forecast to time outdoor plans.`;
    }
    return 'A 7-day forecast is not available from the connected source yet.';
  }

  if(key==='temperature'){
    if(profileId==='fitness'){
      if(temp==='very-hot') return 'Too hot for a comfortable workout; choose a cooler time.';
      if(temp==='hot') return 'Warm conditions; reduce intensity and take water.';
      if(temp==='cold') return 'Cool conditions; warm up well before exercising.';
      if(temp==='cool') return 'Cool conditions; a light layer may help outdoors.';
      if(rain==='very-high' || rain==='high') return 'Temperature is comfortable, but rain may disrupt outdoor activity.';
      return 'Temperature is in a comfortable range for outdoor activity.';
    }
    if(profileId==='traveler'){
      if(temp==='very-hot') return 'Very hot conditions; plan outdoor sightseeing around cooler hours.';
      if(temp==='hot') return 'Warm weather; plan shade and hydration during travel.';
      if(temp==='cold') return 'Cool weather; pack an extra layer for outdoor plans.';
      return 'Temperature looks manageable for most outdoor plans.';
    }
    if(profileId==='agriculture'){
      if(temp==='very-hot') return 'High heat may stress crops and increase water demand.';
      if(temp==='cold') return 'Cool conditions; monitor temperature-sensitive crops.';
      return 'Temperature is within a moderate range for routine field planning.';
    }
    if(profileId==='family' || profileId==='events'){
      if(temp==='very-hot') return 'High heat may make prolonged outdoor plans uncomfortable.';
      if(temp==='hot') return 'Warm conditions; plan shade, water and lighter clothing.';
      if(temp==='cold') return 'Cool conditions; add a warm layer for outdoor plans.';
      return 'Temperature is generally comfortable for outdoor plans.';
    }
    return `Current temperature is ${f.temperature}°C.`;
  }

  if(key==='rain'){
    if(rain==='very-high') return profileId==='events' ? 'Very high rain chance; consider moving the event indoors.' : 'Very high rain chance; keep an indoor backup plan.';
    if(rain==='high') return 'High rain chance; carry rain protection and watch the forecast.';
    if(rain==='medium') return 'Some rain risk; outdoor plans are possible with a backup plan.';
    if(rain==='low') return 'Low rain chance; weather is less likely to disrupt outdoor plans.';
    return `Rain chance is ${f.rain}%.`;
  }

  if(key==='wind'){
    if(wind>=40) return 'Very strong winds may make outdoor activity or travel unsafe.';
    if(wind>=30) return 'Strong winds may affect outdoor activity and road travel.';
    if(wind>=20) return 'Breezy conditions; take extra care with exposed outdoor activities.';
    if(wind>=10) return 'Light to moderate wind should be manageable for most plans.';
    return 'Light winds are unlikely to be a major issue for outdoor plans.';
  }

  if(key==='humidity'){
    if(humidity>=85) return 'Very humid conditions may feel uncomfortable during exercise.';
    if(humidity>=70) return 'High humidity may make activity feel warmer than the temperature suggests.';
    if(humidity<35) return 'Low humidity can feel dry; keep hydrated outdoors.';
    return 'Humidity is in a generally comfortable range.';
  }

  if(key==='aqi'){
    if(aqi==='unknown') return 'Live AQI is not available from the connected source yet.';
    if(aqi==='good') return 'Air quality is good for most people.';
    if(aqi==='moderate') return 'Air quality is acceptable; sensitive people may want shorter outdoor exposure.';
    if(aqi==='sensitive') return 'Sensitive people may want to reduce prolonged outdoor exertion.';
    if(aqi==='unhealthy') return 'Consider limiting prolonged outdoor exertion and taking cleaner-air breaks.';
    return 'Air quality is very poor; avoid prolonged outdoor exposure when possible.';
  }

  if(key==='uv'){
    if(uv==='unknown') return 'Live UV data is not available from the connected source yet.';
    if(uv==='low') return 'UV is low; routine sun protection is usually sufficient.';
    if(uv==='moderate') return 'UV is moderate; consider sunscreen and shade for longer outdoor time.';
    if(uv==='high' || uv==='very-high' || uv==='extreme') return 'UV is elevated; use sunscreen, shade and protective clothing outdoors.';
    return 'Check the UV level before spending long periods outside.';
  }

  if(key==='visibility'){
    if(fog>=50 || ['fog','dust'].includes(f.type)) return 'Visibility may be reduced; allow extra time while travelling.';
    if(rain==='very-high') return 'Heavy rain can reduce visibility; drive carefully and allow extra time.';
    if(rain==='high') return 'Rain may reduce visibility; take care on the road.';
    return 'No strong visibility concern is indicated by the current weather type.';
  }

  if(key==='warnings'){
    if(warnings>0) return `${warnings} active warning${warnings===1?'':'s'} ${warnings===1?'needs':'need'} your attention.`;
    return 'No active warning is currently available for this location.';
  }

  if(key==='wave' || key==='seaTemp'){
    return 'Marine data is not connected yet, so this value is not being guessed.';
  }

  return 'Live conditions are being used for this recommendation.';
}

function personalizedValue(key,f){
  if(key==="temperature") return `${f.temperature}°C`;
  if(key==="forecastRange") return f.forecastRange || "—";
  if(key==="rain") return `${f.rain}%`;
  if(key==="wind") return `${f.wind} km/h`;
  if(key==="humidity") return `${f.humidity}%`;
  if(key==="aqi") return f.aqi===null?"—":f.aqi;
  if(key==="uv") return f.uv;
  if(key==="visibility") return `${f.visibility} km`;
  if(key==="warnings") return f.warnings?`${f.warnings} alert${f.warnings===1?"":"s"}`:"None";
  if(key==="wave") return f.wave==null ? "—" : `${f.wave} m`;
  if(key==="seaTemp") return f.seaTemp==null ? "—" : `${f.seaTemp}°C`;
  return "—";
}

function renderPersonalized(){
  const profiles=(Array.isArray(state.profiles)?state.profiles:[]).filter(id=>PROFILES[id]);
  if(!profiles.length) profiles.push("fitness");
  const f=weatherFacts();
  const selected=profiles.map(id=>PROFILES[id]?.name).filter(Boolean);
  $("personalizedTitle").textContent=selected.length===1?`${selected[0]} weather`:"Your weather priorities";
  $("personalizedSubtitle").textContent=`Personalized using: ${selected.join(" • ")}. Your 7-day forecast remains available below.`;
  const cards=[]; const seen=new Set();
  profiles.forEach(id=>{
    (PERSONALIZED_CARDS[id]||[]).forEach(([icon,title,key,label])=>{
      if(seen.has(title)) return; seen.add(title);
      cards.push({icon,title,key,label,sub:recommendationFor(id,key,f),score:scoreProfile(id)});
    });
  });
  if(!cards.length) cards.push({icon:"🌤️",title:"Current conditions",key:"temperature",label:"Temp",sub:recommendationFor("traveler","temperature",f),score:50});
  // Keep relevance internal: use it only to prioritize which cards appear first.
  cards.sort((a,b)=>b.score-a.score);
  $("personalizedCards").innerHTML=cards.map(c=>`<article class="weather-card priority"><div class="card-icon">${c.icon}</div><h3>${c.title}</h3><div class="value">${personalizedValue(c.key,f)}</div><p>${c.label} • ${c.sub}</p></article>`).join("");
}

function renderSun(){
  const s=state.data?.sun||{};
  $("sunrise").textContent=s.sunrise||"—";
  $("sunset").textContent=s.sunset||"—";
  const [srH,srM]=(s.sunrise||"06:00").split(":").map(Number), [ssH,ssM]=(s.sunset||"18:00").split(":").map(Number);
  const start=srH*60+srM,end=ssH*60+ssM,cur=getLocationClock().total;
  const p=Math.min(1,Math.max(0,(cur-start)/(end-start)));
  const angle=Math.PI-p*Math.PI;
  const cx=300+230*Math.cos(angle),cy=175-165*Math.sin(angle);
  $("sunMarker").setAttribute("cx",cx);$("sunMarker").setAttribute("cy",cy);
  $("sunArc").style.strokeDasharray=`${Math.max(0,p*720)} 1000`;
}

function parseLocalMinutes(hhmm){
  if(!hhmm || typeof hhmm !== "string") return null;
  const m=hhmm.match(/^(\d{1,2}):(\d{2})/);
  if(!m) return null;
  const h=Number(m[1]), min=Number(m[2]);
  if(!Number.isFinite(h)||!Number.isFinite(min)||h>23||min>59) return null;
  return h*60+min;
}

function getLocationClock(){
  const timeZone=state.data?.timezone||"Asia/Kolkata";
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone,hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const hour=Number(parts.find(p=>p.type==="hour")?.value);
  const minute=Number(parts.find(p=>p.type==="minute")?.value);
  return {hour:Number.isFinite(hour)?hour:0,minute:Number.isFinite(minute)?minute:0,total:(Number.isFinite(hour)?hour:0)*60+(Number.isFinite(minute)?minute:0)};
}

function isNightTime(){
  const sunrise=state.data?.sun?.sunrise || state.data?.forecast?.sunrise;
  const sunset=state.data?.sun?.sunset || state.data?.forecast?.sunset;
  const sr=parseLocalMinutes(sunrise), ss=parseLocalMinutes(sunset);
  const cur=getLocationClock().total;
  if(sr == null || ss == null) return cur < 6*60 || cur >= 18*60;
  return cur < sr || cur >= ss;
}

function applyTheme(){
  const saved=localStorage.getItem("mausam-theme");
  const dark=saved==="dark";
  document.body.classList.toggle("dark-mode",dark);
  const button=$("themeToggle");
  if(button){
    button.setAttribute("aria-pressed",dark?"true":"false");
    button.innerHTML=dark?'☀ <span class="theme-label">Light</span>':'☾ <span class="theme-label">Dark</span>';
    button.title=dark?"Switch to light mode":"Switch to dark mode";
  }
}

function toggleTheme(){
  const dark=!document.body.classList.contains("dark-mode");
  localStorage.setItem("mausam-theme",dark?"dark":"light");
  applyTheme();
}

function applyScene(){
  const type=state.data?.current?.type||state.data?.forecast?.today?.type||"cloudy";
  const night=isNightTime();
  const scene=$("weatherScene");
  const sun=$("weatherScene")?.querySelector(".scene-sun");
  const moon=$("weatherScene")?.querySelector(".scene-moon");
  const stars=$("weatherScene")?.querySelector(".scene-stars");
  scene.className=`weather-scene ${type} ${night?"night":"day"}`;
  scene.setAttribute("data-period", night?"night":"day");
  // Inline display guarantees the time-of-day scene wins over any stale CSS cache.
  if(sun) sun.style.display=night?"none":"block";
  if(moon) moon.style.display=night?"block":"none";
  if(stars) stars.style.display=night?"block":"none";
}

function updateHero(){
  const c=state.data?.current||{}, f=state.data?.forecast?.today||{};
  $("temp").textContent=Math.round(c.temperature??f.max??29);
  $("tempStat").textContent=`${Math.round(c.temperature??f.max??29)}°C`;
  $("feelsLike").textContent=Math.round(c.feelsLike ?? ((c.temperature??29)+2));
  $("humidity").textContent=`${c.humidity??68}%`;
  $("wind").textContent=`${c.wind??12} km/h`;
  $("rainChance").textContent=`${weatherFacts().rain}%`;
  $("condition").textContent=c.label||f.forecast||"Partly cloudy";
  $("heroIcon").innerHTML=c.type?weatherIcon(c.type):(c.icon||f.icon||"☁️");
  const locationTimeZone=state.data?.timezone||"Asia/Kolkata";
  $("todayLabel").textContent=`Today • ${new Intl.DateTimeFormat("en-IN",{timeZone:locationTimeZone,day:"numeric",month:"long"}).format(new Date())}`;
  const clock=getLocationClock();
  const night=isNightTime();
  $("greeting").textContent=night?"Good night":clock.hour<12?"Good morning":clock.hour<17?"Good afternoon":"Good evening";
  syncLocationUI();
}

function renderDetails(){
  const f=weatherFacts(), c=state.data?.current||{}, forecast=state.data?.forecast?.days||[], a=state.data?.aqi||{};
  const tab=state.detailTab;
  if(tab==="current"){
    $("detailsContent").innerHTML=`<div class="detail-panel">
      ${info("🌡️","Temperature",`${f.temperature}°C`,"Current temperature")}
      ${info("🌡️","Feels like",`${f.feelsLike}°C`,"Comfort estimate")}
      ${info("💧","Humidity",`${f.humidity}%`,"Relative humidity")}
      ${info("💨","Wind",`${f.wind} km/h`,c.windDirection||"Current wind")}
      ${info("☁️","Condition",c.label||"Cloudy","Current weather")}
      ${info("🧭","Pressure",`${f.pressure} hPa`,"Mean sea-level pressure")}
      <div class="info-card aqi-card"><div><h3>Air quality</h3><div class="big">${a.value??"—"}</div><small>${a.category||"Not connected"}</small></div><div class="aqi-ring" style="--aqi:${Math.min(100,Number(a.value)||41)}"><b>${a.value??"—"}</b></div></div>
      ${info("🌅","Sunrise",state.data?.sun?.sunrise||"—","IST")}
      ${info("🌇","Sunset",state.data?.sun?.sunset||"—","IST")}
    </div>`;
  }else if(tab==="forecast"){
    $("detailsContent").innerHTML=`<div class="detail-panel">${forecast.map(d=>info(d.icon,new Date(d.date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long"}),`${d.max}° / ${d.min}°`,d.forecast)).join("")}</div>`;
  }else if(tab==="environment"){
    $("detailsContent").innerHTML=`<div class="detail-panel">${["AQI","UV Index","Pollen","Visibility","Humidity","Pressure"].map((x,i)=>info(["🍃","☀️","🌼","👁️","💧","🧭"][i],x,[a.value??"—","6 / Moderate","Not connected",`${f.visibility} km`,`${f.humidity}%`,`${f.pressure} hPa`][i],"Data availability depends on the connected source.")).join("")}</div>`;
  }else if(tab==="warnings"){
    const ws=state.data?.warnings?.warnings||[];
    $("detailsContent").innerHTML=ws.length?`<div class="detail-panel">${ws.slice(0,10).map(w=>info("⚠️",w.District||"District warning",w.Day_1||w.message||"Warning issued","Official IMD warning feed")).join("")}</div>`:`<div class="info-card"><h3>No warning feed connected</h3><p>Set IMD_DISTRICT_WARNING_ID in .env after obtaining the appropriate access.</p></div>`;
  }else{
    $("detailsContent").innerHTML=`<div class="detail-panel">${info("🌊","Marine","Wave / tide / sea data","Connect an authorized IMD marine/sea-area feed.")}${info("🌱","Agriculture","Agromet advisory","Connect IMD Agromet Advisory API.")}${info("🛣️","Highway","Road-weather warnings","Connect IMD Highway Warning API.")}${info("⚡","Lightning","Lightning data","Connect IMD Lightning API.")}${info("🛰️","Radar","Radar imagery","Connect IMD Radar API.")}${info("🌾","Rainfall","District rainfall","Connect IMD rainfall APIs.")}</div>`;
  }
}
function info(icon,title,value,sub){return `<article class="info-card"><div class="card-icon">${icon}</div><h3>${title}</h3><div class="big">${value}</div><small>${sub}</small></article>`}

function renderProfile(){
  $("profileSummary").innerHTML=`<h2>Selected interests</h2><div>${state.profiles.map(x=>`<span class="tag">${PROFILES[x].icon} ${PROFILES[x].name}</span>`).join("")}</div><h2 style="margin-top:22px">Available weather details</h2><div>${state.details.map(x=>`<span class="tag">${DETAIL_LABELS[x]}</span>`).join("")}</div><p class="muted" style="margin-top:20px">Personalization scores are calculated from your interests and current weather signals. Usage learning is ${state.learning?"on":"off"}.</p>`;
}

function renderSettings(){
  $("settingsProfiles").innerHTML=Object.entries(PROFILES).map(([id,p])=>`<button class="setting-option ${state.profiles.includes(id)?"selected":""}" data-setting-profile="${id}"><b>${p.icon} ${p.name}</b><small>${p.sub}</small></button>`).join("");
  $("settingsDetails").innerHTML=Object.entries(DETAIL_LABELS).map(([id,label])=>`<button class="setting-option ${state.details.includes(id)?"selected":""}" data-setting-detail="${id}"><b>${label}</b><small>${state.details.includes(id)?"Enabled":"Optional"}</small></button>`).join("");
  document.querySelectorAll("[data-setting-profile]").forEach(b=>b.onclick=()=>{const id=b.dataset.settingProfile;if(state.profiles.includes(id)){if(state.profiles.length===1)return toast("Keep one interest.");state.profiles=state.profiles.filter(x=>x!==id)}else state.profiles.push(id);renderSettings()});
  document.querySelectorAll("[data-setting-detail]").forEach(b=>b.onclick=()=>{const id=b.dataset.settingDetail;if(state.details.includes(id))state.details=state.details.filter(x=>x!==id);else state.details.push(id);renderSettings()});
  $("learningToggle").checked=state.learning;
}

async function savePrefs(show=true){
  try{
    const result=await api(`/api/preferences/${state.userId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profiles:state.profiles,details:state.details,learning:state.learning})});
    state.profiles=result.profiles;state.details=result.details;state.learning=result.learning;
    if(show){toast("Personalization saved.");renderProfile();renderPersonalized();setView("home");}
  }catch(e){if(show){toast("Saved locally for this demo.");renderProfile();renderPersonalized();setView("home");}}
}

async function loadPrefs(){
  try{const p=await api(`/api/preferences/${state.userId}`);state.profiles=p.profiles;state.details=p.details;state.learning=p.learning}catch{}
}

async function loadDashboard(){
  try{
    state.data=await api(`/api/dashboard?city=${encodeURIComponent(state.city)}&lat=${state.lat}&lon=${state.lon}`);
  }catch(e){
    toast("Using offline demo data.");
    const days=forecastFallback();
    state.data={
      current:{station:state.city,temperature:29,humidity:68,wind:12,windDirection:"Westerly",pressure:1006,type:"cloudy",label:"Partly cloudy",icon:"☁️"},
      forecast:{city:state.city,today:days[0],days,sunrise:"05:58",sunset:"18:03"},
      sun:{sunrise:"05:58",sunset:"18:03"},warnings:{warnings:[]},aqi:{value:null,category:"Not connected"}
    };
  }
  updateHero();applyScene();renderPersonalized();renderForecast();renderSun();
  window.clearTimeout(window.__sceneTimer);
  window.__sceneTimer=window.setInterval(()=>{ applyScene(); updateHero(); }, 30*1000);
}

document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-view]");
  if(nav)setView(nav.dataset.view);
});
$("menuBtn").onclick=()=>{
  const open=$("menuPanel").classList.toggle("open");
  $("menuBtn").setAttribute("aria-expanded",open);
  if(open && $("locationSearchResults")) $("locationSearchResults").innerHTML="";
};
const themeToggleButton=$("themeToggle");
if(themeToggleButton) themeToggleButton.addEventListener("click",toggleTheme);
if($("moreWeather")) $("moreWeather").onclick=()=>setView("details");
$("savePreferences").onclick=()=>{state.learning=$("learningToggle").checked;savePrefs(true);};
document.querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>{state.detailTab=b.dataset.detail;document.querySelectorAll("[data-detail]").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderDetails()});
document.querySelectorAll(".saved-card").forEach(b=>b.onclick=async()=>{state.city=b.dataset.city;state.lat=Number(b.dataset.lat);state.lon=Number(b.dataset.lon);saveLocation();setView("home");await loadDashboard();toast(`${state.city} selected.`)});

const locationInput=$("locationSearchInput"), locationResults=$("locationSearchResults"), locationClear=$("locationSearchClear");
let locationSearchTimer=null;
function renderLocationStatus(message){if(locationResults) locationResults.innerHTML=`<div class="location-search-status">${escapeHtml(message)}</div>`;}
function renderLocationResults(results){
  if(!locationResults)return;
  if(!results.length){renderLocationStatus("No matching Indian locations found.");return;}
  locationResults.innerHTML=results.map(place=>`<button type="button" class="location-result" data-name="${escapeHtml(place.name??"")}" data-lat="${Number(place.latitude)}" data-lon="${Number(place.longitude)}"><span class="location-result-pin">📍</span><span class="location-result-copy"><strong>${escapeHtml(place.name??"")}</strong><small>${escapeHtml(place.admin1||"")}${place.admin1?", ":""}${escapeHtml(place.country||"India")}</small></span></button>`).join("");
}
async function searchLocations(query){
  if(!locationResults)return;
  renderLocationStatus("Searching...");
  try{const response=await api(`/api/geocode?q=${encodeURIComponent(query)}`);renderLocationResults(response.results||[]);}catch(error){console.error(error);renderLocationStatus("Location search is temporarily unavailable.");}
}
if(locationInput){
  locationInput.addEventListener("focus",()=>locationInput.select());
  locationInput.addEventListener("input",()=>{
    const query=locationInput.value.trim();
    if(locationClear)locationClear.hidden=query.length===0;
    clearTimeout(locationSearchTimer);
    if(query.length<2){if(locationResults)locationResults.innerHTML="";return;}
    locationSearchTimer=setTimeout(()=>searchLocations(query),280);
  });
  locationInput.addEventListener("keydown",e=>{
    if(e.key==="Escape"){if(locationResults)locationResults.innerHTML="";locationInput.value=state.city;syncLocationUI();locationInput.blur();}
    if(e.key==="Enter"){const first=locationResults?.querySelector(".location-result");if(first)first.click();}
  });
}
if(locationClear){locationClear.addEventListener("click",()=>{if(locationInput){locationInput.value="";locationInput.focus();}if(locationResults)locationResults.innerHTML="";});}
if(locationResults){
  locationResults.addEventListener("click",async e=>{
    const result=e.target.closest(".location-result");if(!result)return;
    const lat=Number(result.dataset.lat),lon=Number(result.dataset.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
    state.city=result.dataset.name||"Selected location";state.lat=lat;state.lon=lon;saveLocation();locationInput.value=state.city;locationResults.innerHTML="";locationInput.blur();
    setView("home");await loadDashboard();toast(`${state.city} selected.`);
  });
}
if($("locationBtn"))$("locationBtn").onclick=()=>{
  if(!navigator.geolocation){toast("Location services are not supported.");return;}
  navigator.geolocation.getCurrentPosition(async pos=>{state.city="Current location";state.lat=pos.coords.latitude;state.lon=pos.coords.longitude;saveLocation();syncLocationUI();if(locationResults)locationResults.innerHTML="";await loadDashboard();toast("Current location selected.");},()=>toast("Location permission not available."));
};
document.addEventListener("click",e=>{if(!e.target.closest("#headerLocationSearch")&&locationResults)locationResults.innerHTML="";});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){applyScene();updateHero();}});
window.addEventListener("focus",()=>{applyScene();updateHero();});

(async function init(){
  loadSavedLocation();
  applyTheme();
  syncLocationUI();
  await loadPrefs();
  await loadDashboard();
  applyTheme();
  syncLocationUI();
})();
