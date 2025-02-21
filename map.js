// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibWF0dHRva3VuYWdhIiwiYSI6ImNtN2M5OGo0djBtaWwybHBtY3czZW5tenQifQ.feL9U_fCIkmFbmlqZr3s0w';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/matttokunaga/cm7ccg5oe004a01ri0pjwcgii', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => {
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });
    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#32D400',
            'line-width': 3,
            'line-opacity': 0.4
        }
    });
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'cambridge_bike_paths.geojson'
    });
    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',
            'line-width': 3,
            'line-opacity': 0.4
        }
    });
});

let stations = [];
let trips;
let data_glob;

let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];
let departuresByMinute = Array.from({ length: 1440}, () => []);
let arrivalsByMinute = Array.from({length: 1440}, () => []);

let maxRad;

let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);


map.on('load', () => {
    // Load the nested JSON file
    const jsonurl = "bluebikes-stations.json"
    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);  // Log to verify structure
        stations = jsonData.data.stations;
        const svg = d3.select('#map').select('svg');

    function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
        const { x, y } = map.project(point);  // Project to pixel coordinates
        return { cx: x, cy: y };  // Return as object for use in SVG attributes
    }

    

    const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', 5)               // Radius of the circle
        .attr('fill', 'steelblue')  // Circle fill color
        .attr('stroke', 'white')    // Circle border color
        .attr('stroke-width', 1)    // Circle border thickness
        .attr('opacity', 0.8)      // Circle opacity
        

    // Function to update circle positions when the map moves/zooms
    function updatePositions() {
        circles
        .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
        .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
    }


    // Initial position update when map loads
    updatePositions();

    // Reposition markers on map interactions
    map.on('move', updatePositions);     // Update during map movement
    map.on('zoom', updatePositions);     // Update during zooming
    map.on('resize', updatePositions);   // Update on window resize
    map.on('moveend', updatePositions);  // Final adjustment after movement ends
    
    trips =  d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv");

    trips.then(data => {
        data_glob = data;
        departures = d3.rollup(
            data,
            (v) => v.length,
            (d) => d.start_station_id,
        );
        
        let arrivals = d3.rollup(
            data,
            (v) => v.length,
            (d) => d.end_station_id,
        );
        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        })

        maxRad = d3.max(stations, (d) => d.totalTraffic)
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, maxRad])
            .range([0, 25]);

    
        circles.attr('r', d => radiusScale(d.totalTraffic));
        circles.each(function (d) {
            d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`)
        })
;
        for (let trip of data) {
            trip.started_at = new Date(trip.started_at);
            trip.ended_at = new Date(trip.ended_at);
            let startedMinutes = minutesSinceMidnight(trip.started_at);
            departuresByMinute[startedMinutes].push(trip);
            let endedMinutes = minutesSinceMidnight(trip.ended_at);
            arrivalsByMinute[endedMinutes].push(trip);
        }

    
    }).catch(error => {
        console.error('Error loading CSV:', error);  // Handle errors if CSV loading fails
    });
    }).catch(error => {
        console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    });
});

let timeFilter = -1;

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);  // Get slider value

    if (timeFilter === -1) {
        selectedTime.style.opacity = 0;  // Clear time display
        anyTimeLabel.style.opacity = 1;  // Show "(any time)"
    } else {
        selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
        selectedTime.style.opacity = 1;
        anyTimeLabel.style.opacity = 0;  // Hide "(any time)"
    }

    // Trigger filtering logic which will be implemented in the next step
    filterTripsbyTime();
}

timeSlider.addEventListener('input', updateTimeDisplay);
updateTimeDisplay();



function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime() {

    // we need to update the station data here explained in the next couple paragraphs
    filteredDepartures = d3.rollup(
        timeFilter === -1 ? departuresByMinute.flat() : filterByMinute(departuresByMinute, timeFilter),
        (v) => v.length,
        (d) => d.start_station_id,
    );
    
    filteredArrivals = d3.rollup(
        timeFilter === -1 ? arrivalsByMinute.flat(): filterByMinute(arrivalsByMinute, timeFilter),
        (v) => v.length,
        (d) => d.end_station_id,
    );

    filteredStations = stations.map((station) => {
        let id = station.short_name;
        station = {... station };
        station.arrivals = filteredArrivals.get(id) ?? 0;
        station.departures = filteredDepartures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    })

    const svg = d3.select('#map').select('svg');

    let radiusScale;
    if (timeFilter === -1) {
        radiusScale = d3
            .scaleSqrt()
            .domain([0, maxRad])
            .range([0, 25]);        
    } else {
        radiusScale = d3
            .scaleSqrt()
            .domain([0, maxRad])
            .range([3, 50]);
    }

    const circles = svg.selectAll('circle')
        .data(filteredStations);
    circles.attr('r', d => radiusScale(d.totalTraffic));
    circles.style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));
}

function filterByMinute(tripsByMinute, minute) {
    // Normalize both to the [0, 1439] range
    let minMinute = (minute - 60 + 1440) % 1440;
    let maxMinute = (minute + 60) % 1440;

    if (minMinute > maxMinute) {
        let beforeMidnight = tripsByMinute.slice(minMinute);
        let afterMidnight = tripsByMinute.slice(0, maxMinute);
        return beforeMidnight.concat(afterMidnight).flat();
    } else {
        return tripsByMinute.slice(minMinute, maxMinute).flat();
    }
}

