import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import Fuse from 'fuse.js';
import L from 'leaflet';
import '../App.css';

const VehicleSearch = ({ vehicles = [], onVehicleSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tempMarker, setTempMarker] = useState(null);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const map = useMap();
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

  // Clean up temporary marker when component unmounts
  useEffect(() => {
    return () => {
      if (tempMarker) {
        map.removeLayer(tempMarker);
      }
    };
  }, [map, tempMarker]);

  const searchAddress = async (query) => {
    try {
        const mapCenter = map.getCenter();
        const url = `/api/address-search?${new URLSearchParams({
            query: query,
            lat: mapCenter.lat,
            lng: mapCenter.lng,
            zoom: map.getZoom()
        })}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error in address search:', error);
        return [];
    }
  };

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
    setIsSearchingAddress(false);

    if (query.length < 2) {
        setResults([]);
        return;
    }

    setIsLoading(true);
    try {
        // First check vehicles
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

        if (isSearchingAddress) {
            // Only search addresses if user clicked the prompt
            const addressResults = await searchAddress(query);
            
            // If no address results found, show a message
            if (addressResults.length === 0) {
                setResults([{
                    displayName: `No addresses found for "${query}"`,
                    type: 'no-results',
                    query: query
                }]);
            } else {
                setResults(addressResults.map(addr => ({
                    ...addr,
                    type: 'address'
                })));
            }
        } else {
            // Always add the address search option at the end of vehicle results
            const combinedResults = [
                ...vehicleResults,
            ];
            
            // Only add the address prompt if we have a search term
            if (query.trim().length > 0) {
                combinedResults.push({
                    displayName: `Search "${query}" as an address?`,
                    type: 'address-prompt',
                    query: query
                });
            }
            
            setResults(combinedResults);
        }
    } catch (error) {
        console.error('Error in handleSearch:', error);
        setResults([{
            displayName: 'Error searching for address',
            type: 'error',
            query: query
        }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSelect = async (result) => {
    if (result.type === 'address-prompt') {
        await logSearch('ADDRESS', result.query);
        setIsSearchingAddress(true);
        setIsLoading(true);
        try {
            const addressResults = await searchAddress(result.query);
            if (addressResults.length === 0) {
                // Show no results message
                setResults([{
                    displayName: `No addresses found for "${result.query}"`,
                    type: 'no-results',
                    query: result.query
                }]);
            } else {
                setResults(addressResults.map(addr => ({
                    ...addr,
                    type: 'address'
                })));
            }
        } catch (error) {
            console.error('Error searching address:', error);
            setResults([{
                displayName: 'Error searching for address',
                type: 'error',
                query: result.query
            }]);
        } finally {
            setIsLoading(false);
        }
        return;
    }

    if (result.type === 'vehicle') {
        await logSearch('VEHICLE', result.displayName);
        onVehicleSelect(result);
        map.setView([result.latitude, result.longitude], 17);
    } else if (result.type === 'address') {
        await logSearch('ADDRESS', result.displayName);
        if (tempMarker) {
            map.removeLayer(tempMarker);
        }

        const marker = L.marker([result.latitude, result.longitude], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: '📍',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map);

        marker.bindPopup(result.displayName).openPopup();
        setTempMarker(marker);

        setTimeout(() => {
            map.removeLayer(marker);
            setTempMarker(null);
        }, 10000);

        map.setView([result.latitude, result.longitude], 17);
    }
    setShowDropdown(false);
    setSearchTerm('');
    setIsSearchingAddress(false);
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
        placeholder="Search vehicles or addresses..."
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
                result.type === 'address-prompt' ? 'address-prompt' : 
                result.type === 'no-results' ? 'no-results' :
                result.type === 'error' ? 'error' : ''
              }`}
              onClick={() => result.type !== 'no-results' && result.type !== 'error' && handleSelect(result)}
            >
              <div className="result-icon">
                {result.type === 'vehicle' ? '🚗' : 
                 result.type === 'address-prompt' ? '🔍' : 
                 result.type === 'no-results' ? '⚠️' :
                 result.type === 'error' ? '❌' : '📍'}
              </div>
              <div className="result-details">
                <div className="result-name">{result.displayName}</div>
                <div className="result-type">
                  {result.type === 'vehicle' ? 'Vehicle' : 
                   result.type === 'address-prompt' ? 'Try Address Search' :
                   result.type === 'no-results' ? 'Try a different search' :
                   result.type === 'error' ? 'Error' : 'Address'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VehicleSearch;
