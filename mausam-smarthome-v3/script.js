const P={
fitness:{name:"Fitness",title:"Fitness weather",rt:"Good time for a morning run",r:"Lower heat and UV make early morning more comfortable.",w:"Fitness is selected, so running time, UV, wind and rain are prioritized.",c:[["☁","Best running time","6:00–7:30 AM","Lower heat and UV",1],["☀","UV index","6 / High","Sun protection recommended",1],["≋","Wind","12 km/h","Moderate for running",0],["☂","Rain probability","35%","Higher chance later",1]]},
health:{name:"Health",title:"Health weather",rt:"Take care during midday outdoors",r:"UV is high and air quality is moderate. Limit long outdoor exposure around midday.",w:"Health is selected, so AQI, UV, humidity and heat are prioritized.",c:[["AQ","Air quality","82 · Moderate","Check air conditions outdoors",1],["☀","UV index","6 / High","Sun protection recommended",1],["💧","Humidity","68%","Moderately humid",1],["","Temperature","29°C","Feels like 31°C",0]]},
commuter:{name:"Commuter",title:"Commute weather",rt:"Morning commute looks manageable",r:"Visibility is good now. Check rain conditions before your return journey.",w:"Commuter is selected, so visibility, rain, wind and travel conditions are prioritized.",c:[["◉","Visibility","7.5 km","Currently good",1],["☂","Rain probability","35%","Check before travel",1],["≋","Wind","12 km/h","Moderate",0],["","Temperature","29°C","Feels like 31°C",0]]},
traveler:{name:"Traveler",title:"Travel weather",rt:"Plan outdoor travel before afternoon",r:"Rain probability can increase later. Keep a light rain layer with you.",w:"Traveler is selected, so rain, temperature, visibility and planning information are prioritized.",c:[["☂","Rain probability","35%","Carry a light rain layer",1],["","Temperature","29°C","Warm afternoon expected",1],["☼","Sunset","6:02 PM","Useful for evening plans",0],["◉","Visibility","7.5 km","Good right now",0]]},
beach:{name:"Beach & Surf",title:"Beach & surf conditions",rt:"Check tide and wave conditions",r:"Demo ocean data is shown here. Real implementation can connect authorized marine data.",w:"Beach & Surf is selected, so wave height, tide, sea temperature and wind are prioritized.",c:[["≈","Wave height","1.2 m","Moderate wave conditions",1],["↕","Next tide","8:40 AM","Check tide timing",1],["","Sea temperature","28°C","Comfortable water temperature",1],["≋","Wind","12 km/h","Watch wind direction",0]]},
agriculture:{name:"Agriculture",title:"Agriculture & garden weather",rt:"Rain planning is important today",r:"Rain probability is moderate. Check rainfall forecasts before irrigation or field work.",w:"Agriculture is selected, so rainfall, soil moisture, frost and seasonal planning are prioritized.",c:[["☂","Rain probability","35%","Check before irrigation",1],["≈","Soil moisture","Good","Demo value for prototype",1],["","Frost risk","Low","No immediate frost concern",0],["☀","Seasonal outlook","Monsoon period","Plan field work around rain",0]]},
family:{name:"Family",title:"Family weather",rt:"Keep the evening commute in mind",r:"Rain may affect school or family travel later. Check the latest warning before leaving.",w:"Family is selected, so rain, severe alerts, visibility and commute conditions are prioritized.",c:[["☂","Rain probability","35%","Watch evening conditions",1],["◉","Visibility","7.5 km","Currently good",1],["⚠","Weather alert","None","No demo severe alert",1],["","Temperature","29°C","Feels like 31°C",0]]},
events:{name:"Events",title:"Event planning weather",rt:"Outdoor plans look possible with a backup",r:"Rain probability is moderate. Keep a covered backup area ready.",w:"Events is selected, so rain probability, comfort and extended planning are prioritized.",c:[["☂","Rain probability","35%","Keep a backup plan",1],["","Comfort index","Good","Suitable for outdoor plans",1],["≋","Wind","12 km/h","Moderate",0],["","Temperature","29°C","Warm conditions",0]]}
};
const plans={fitness:[["6:30 AM","Good for running","Lower temperature and moderate wind."],["12:30 PM","Avoid long outdoor activity","UV and heat are higher."],["6:00 PM","Outdoor activity possible","Temperature begins to fall."]],health:[["7:00 AM","More comfortable outdoors","UV is lower in the morning."],["12:30 PM","Limit prolonged exposure","UV and heat are higher."],["7:00 PM","More comfortable","Heat and UV decrease."]],commuter:[["8:00 AM","Good travel window","Visibility is currently good."],["2:00 PM","Watch for rain","Rain probability may increase."],["6:00 PM","Allow extra travel time","Weather may become less comfortable."]],traveler:[["9:00 AM","Good for sightseeing","Comfortable conditions."],["1:00 PM","Warm outdoor period","Stay hydrated and watch rain."],["5:30 PM","Good for evening plans","Sunset is around 6:02 PM."]],beach:[["8:00 AM","Check tide before activity","Tide timing is important."],["12:00 PM","Watch wind and waves","Marine conditions can change."],["5:30 PM","Recheck marine conditions","Use the latest official marine forecast."]],agriculture:[["7:00 AM","Good time for field work","Check the latest rain forecast."],["1:00 PM","Review irrigation need","Rain probability may affect watering."],["5:00 PM","Plan tomorrow's work","Use updated rainfall advice."]],family:[["7:30 AM","School commute looks good","Visibility is currently good."],["3:00 PM","Check rain before pickup","Conditions can change later."],["6:00 PM","Watch evening travel","Keep a rain backup ready."]],events:[["10:00 AM","Good for setup","Conditions are currently comfortable."],["2:00 PM","Check rain probability","Keep a covered backup ready."],["6:00 PM","Good for evening event","Temperature starts to ease."]]};

let selected=new Set(["fitness"]);
const $=id=>document.getElementById(id);
const modal=$("modal");
let lastFocus=null;

function render(){
 const keys=[...selected];
 const first=P[keys[0]||"fitness"];
 $("count").textContent=`${keys.length} selected`;
 $("summary").textContent=keys.map(k=>P[k].name).join(", ")||"None";
 $("title").textContent=keys.map(k=>P[k].name).join(" + ")+" weather";
 $("recTitle").textContent=first.rt;
 $("rec").textContent=keys.length>1?first.r+" Other selected profiles are also included.":first.r;
 $("whyText").textContent=keys.length>1?`You selected ${keys.map(k=>P[k].name).join(", ")}. The prototype combines these needs and places higher-relevance information first.`:first.w;
 const m=new Map();
 keys.forEach(k=>P[k].c.forEach(c=>{if(!m.has(c[1])||c[4])m.set(c[1],c)}));
 $("cards").innerHTML=[...m.values()].sort((a,b)=>b[4]-a[4]).slice(0,8).map(c=>`<article class="card ${c[4]?"priority":""}"><div class="icon">${c[0]}</div><label>${c[1]}</label><strong>${c[2]}</strong><small>${c[3]}</small></article>`).join("");
 $("plan").innerHTML=plans[keys[0]||"fitness"].map(p=>`<div class="row"><b>${p[0]}</b><div><strong>${p[1]}</strong><small>${p[2]}</small></div></div>`).join("");
 document.querySelectorAll(".persona").forEach(b=>b.classList.toggle("active",selected.has(b.dataset.p)));
}

function openModal(){
 lastFocus=document.activeElement;
 modal.classList.remove("hidden");
 document.body.classList.add("modal-open");
 setTimeout(()=>$("close").focus(),0);
}
function closeModal(){
 modal.classList.add("hidden");
 document.body.classList.remove("modal-open");
 if(lastFocus && typeof lastFocus.focus==="function") lastFocus.focus();
}

// Multiple personalization selection
 document.querySelectorAll(".persona").forEach(b=>b.addEventListener("click",()=>{
   const key=b.dataset.p;
   if(selected.has(key)){
     if(selected.size===1){showToast("Keep at least one interest selected.");return;}
     selected.delete(key);
   }else selected.add(key);
   render();
 }));

// Main navigation
 document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>{
   document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
   b.classList.add("active");
   document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
   $(b.dataset.page).classList.remove("hidden");
   window.scrollTo({top:0,behavior:"smooth"});
 }));

$("why").addEventListener("click",openModal);
$("close").addEventListener("click",closeModal);
$("done").addEventListener("click",closeModal);
// Click on the dimmed background closes the modal.
modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
// Escape key closes it.
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.classList.contains("hidden"))closeModal();});

$("locationBtn").addEventListener("click",()=>showToast("Demo location: Kanpur. Live location can be connected later."));
$("planBtn").addEventListener("click",()=>showToast("Your personalized day plan is ready."));

function showToast(message){
 const t=$("toast");t.textContent=message;t.classList.add("show");
 clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
}

const forecastData=[["Today","☁","29° / 24°","Partly cloudy","35% rain"],["Fri","☂","28° / 23°","Intermittent rain","55% rain"],["Sat","☁","30° / 24°","Cloudy","30% rain"],["Sun","☀","31° / 24°","Mostly sunny","15% rain"],["Mon","☁","30° / 24°","Generally cloudy","25% rain"]];
$("forecastList").innerHTML=forecastData.map(a=>`<article class="forecast-card"><b>${a[0]}</b><span class="ico">${a[1]}</span><div><b>${a[2]}</b><small>${a[3]}</small></div><small>${a[4]}</small></article>`).join("");

render();
