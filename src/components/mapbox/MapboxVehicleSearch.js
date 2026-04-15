import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { toast } from 'react-toastify';
import '../../App.css';

// Modified version of VehicleSearch that works with Mapbox GL instead of Leaflet
const MapboxVehicleSearch = ({ vehicles = [], onVehicleSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const wrapperRef = useRef(null);
  const fuseRef = useRef(null);

  // Initialize Fuse with the vehicles array directly
  useEffect(() => {
    // Process the vehicles data structure
    let searchableVehicles = [];
    
    // Case 1: Legacy format - vehicles is an object with police, fire, all arrays
    if (vehicles && typeof vehicles === 'object' && !Array.isArray(vehicles) && (vehicles.police || vehicles.fire || vehicles.all)) {
      const allVehicles = vehicles.all || [...(vehicles.police || []), ...(vehicles.fire || [])];
      searchableVehicles = allVehicles.map(vehicle => ({
        displayName: vehicle.displayName || (vehicle.properties ? vehicle.properties.displayName : ''),
        latitude: vehicle.latitude || (vehicle.geometry ? vehicle.geometry.coordinates[1] : 0),
        longitude: vehicle.longitude || (vehicle.geometry ? vehicle.geometry.coordinates[0] : 0),
        heading: vehicle.heading || (vehicle.properties ? vehicle.properties.heading : 0),
        type: 'vehicle'
      }));
    }
    // Case 2: GeoJSON features array
    else if (Array.isArray(vehicles) && vehicles.length > 0 && vehicles[0] && 
             (vehicles[0].type === 'Feature' || (vehicles[0].properties && vehicles[0].geometry))) {
      searchableVehicles = vehicles.map(vehicle => ({
        displayName: vehicle.properties.displayName || '',
        latitude: vehicle.geometry.coordinates[1] || 0,
        longitude: vehicle.geometry.coordinates[0] || 0,
        heading: vehicle.properties.heading || 0,
        type: 'vehicle',
        // Include the original vehicle for reference
        original: vehicle
      }));
    }
    // Case 3: Plain vehicle objects array
    else if (Array.isArray(vehicles)) {
      searchableVehicles = vehicles.map(vehicle => ({
        displayName: vehicle.displayName || '',
        latitude: vehicle.latitude || 0,
        longitude: vehicle.longitude || 0,
        heading: vehicle.heading || 0,
        type: 'vehicle',
        original: vehicle
      }));
    }
    
    // Filter out any items without a displayName
    searchableVehicles = searchableVehicles.filter(vehicle => vehicle.displayName);
    
    const fuseOptions = {
      keys: ['displayName'], // ensure this matches the property name in API response
      threshold: 0.5,
      distance: 100,
      findAllMatches: true,
      shouldSort: true,
      minMatchCharLength: 2,
      tokenize: true,
      matchAllTokens: false,
      location: 0,
      maxPatternLength: 32
    };
    
    fuseRef.current = new Fuse(searchableVehicles, fuseOptions);
  }, [vehicles]);

  // Log search to audit trail if needed
  const logSearch = async (searchType, searchTerm) => {
    try {
        await fetch('/api/audit-trail', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                action: 'SEARCH',
                additional_info: `${searchType} search for: ${searchTerm}`
            })
        });
    } catch (error) {
        console.warn('Failed to log search:', error);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    setShowDropdown(true);

    if (query.length < 2) {
        setResults([]);
        return;
    }

    setIsLoading(true);
    try {
        // Check vehicles
        let vehicleResults = [];
        if (fuseRef.current) {
            const searchResults = fuseRef.current.search(query);
            
            vehicleResults = searchResults
                .slice(0, 5)
                .map(result => {
                    // Handle both Fuse.js v6 and v5 result formats
                    const item = result.item || result;
                    return {
                        displayName: item.displayName,
                        latitude: item.latitude,
                        longitude: item.longitude,
                        heading: item.heading,
                        type: 'vehicle',
                        original: item.original
                    };
                });
        }

        setResults(vehicleResults);
    } catch (error) {
        console.error('Error in handleSearch:', error);
        setResults([{
            displayName: 'Error searching for vehicles',
            type: 'error',
            query: query
        }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSelect = async (result) => {
    if (result.type === 'vehicle') {
        await logSearch('VEHICLE', result.displayName);
        onVehicleSelect(result);
        toast.info(`Following ${result.displayName}`, {
            position: "top-center", 
            autoClose: 2000
        });
    }
    setShowDropdown(false);
    setSearchTerm('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="search-container" ref={wrapperRef}>
      <input
        type="text"
        value={searchTerm}
        onChange={handleSearch}
        placeholder="Search for a vehicle..."
        className="search-input"
        autoComplete="off"
      />
      {showDropdown && (results.length > 0 || isLoading) && (
        <div className="search-results">
          {isLoading && <div className="search-loading">Loading...</div>}
          {results.map((result, index) => (
            <div
              key={index}
              className={`search-result-item ${
                result.type === 'error' ? 'error' : ''
              }`}
              onClick={() => result.type !== 'error' && handleSelect(result)}
            >
              <div className="result-icon">
                {result.type === 'vehicle' ? '🚗' : '❌'}
              </div>
              <div className="result-details">
                <div className="result-name">{result.displayName}</div>
                <div className="result-type">
                  {result.type === 'vehicle' ? 'Vehicle' : 'Error'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapboxVehicleSearch; 