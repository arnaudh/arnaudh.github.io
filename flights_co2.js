airports = {
"KEF":[63.985000610352,-22.605600357056]
,"DJE":[33.875,10.775500297546387]
,"BRU":[50.901401519800004,4.48443984985]
,"SXF":[52.380001,13.5225]
,"CGN":[50.8658981323,7.1427397728]
,"TXL":[52.5597,13.2877]
,"HEL":[60.317199707031,24.963300704956]
,"MAN":[53.35369873046875,-2.2749500274658203]
,"LTN":[51.874698638916016,-0.36833301186561584]
,"LGW":[51.148102,-0.190278]
,"EDI":[55.95000076293945,-3.372499942779541]
,"STN":[51.8849983215,0.234999999404]
,"AMS":[52.308601,4.76389]
,"DUB":[53.421299,-6.27007]
,"OSL":[60.121,11.0502]
,"WAW":[52.1656990051,20.967100143399996]
,"PUY":[44.89350128173828,13.922200202941895]
,"ALC":[38.28219985961914,-0.5581560134887695]
,"LYS":[45.725556,5.081111]
,"MRS":[43.439271922,5.22142410278]
,"CDG":[49.012798,2.55]
,"ORY":[48.7233333,2.3794444]
,"BGY":[45.673901,9.70417]
,"FCO":[41.8002778,12.2388889]
,"PLS":[21.77359962463379,-72.26589965820312]
,"BRC":[-41.151199,-71.157501]
,"LED":[59.80030059814453,30.262500762939453]
,"SIN":[1.35019,103.994003]
,"BOS":[42.36429977,-71.00520325]
,"SFO":[37.61899948120117,-122.375]
,"LAX":[33.94250107,-118.4079971]
,"ATL":[33.6367,-84.428101]
,"BNA":[36.1245002746582,-86.6781997680664]
,"LGA":[40.77719879,-73.87259674]
,"JFK":[40.63980103,-73.77890015]
,"CLT":[35.2140007019043,-80.94309997558594]
,"LAS":[36.08010101,-115.1520004]
,"EZE":[-34.8222,-58.5358]
,"FTE":[-50.2803,-72.053101]
,"WMI":[52.451099,20.6518]
,"LUZ":[51.240278,22.713611]
};

function distance(latlon1, latlon2) {
    [lat1,lon1] = latlon1;
    [lat2,lon2] = latlon2;
    var R = 6371; /* km (change this constant to get miles) */
    var dLat = (lat2-lat1) * Math.PI / 180;
    var dLon = (lon2-lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180 ) * Math.cos(lat2 * Math.PI / 180 ) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return Math.round(d);
}

function chunk (arr, len) {
  var chunks = [],
      i = 0,
      n = arr.length;
  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }
  return chunks;
}
alert('in the script');
console.log('HA', jQuery('.vk_bk.ThaHId'));
console.log('HA2', jQuery('.vk_bk.ThaHId').map((i, el) => $(el).innerHTML));
total_CO2 = chunk($('.vk_bk.ThaHId').map(x => x.innerHTML), 2).map(pair => {
    return distance(airports[pair[0]], airports[pair[1]])
}).reduce((a,b) => a + b, 0) * 0.275 / 1000;

alert(`total CO2 emitted: ${total_CO2} tons`);


