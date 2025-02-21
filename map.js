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
    
    let trips = d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv");

    trips.then(data => {
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
        const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);

    
        circles.attr('r', d => radiusScale(d.totalTraffic));
        circles.each(function (d) {
            d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        })

    }).catch(error => {
        console.error('Error loading CSV:', error);  // Handle errors if CSV loading fails
    });

    

    }).catch(error => {
        console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    });
});


