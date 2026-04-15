// MapBox Access Token - Replace with your token from mapbox.com
export const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || '';

// Map Styles
export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  navigation: 'mapbox://styles/mapbox/navigation-day-v1',
  navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
  // Fallback styles if token is invalid - these will use MapBox's free tiles
  fallbackLight: {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  },
  fallbackDark: {
    version: 8,
    sources: {
      'cartodb-tiles': {
        type: 'raster',
        tiles: ['https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors, © CARTO'
      }
    },
    layers: [
      {
        id: 'cartodb-tiles',
        type: 'raster',
        source: 'cartodb-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  }
}; 