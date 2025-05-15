// PlacesAutocomplete.js - Extracted component for autocomplete functionality
import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { getGeocode, getLatLng } from 'use-places-autocomplete';

/**
 * Component for input with Google Places autocomplete
 * @param {Object} props - Component props
 * @param {string} props.placeholder - Input placeholder
 * @param {Function} props.onSelect - Callback when location is selected
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Input change handler
 * @param {Object} props.style - Custom styles
 */
const PlacesAutocomplete = ({ placeholder, onSelect, value, onChange, style }) => {
  // State for component
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteService = useRef(null);
  
  // Initialize Places API when Google Maps API is loaded
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      try {
        autocompleteService.current = {
          type: 'suggestion',
          api: window.google.maps.places
        };
        
        console.log('Successfully initialized Google Maps Places API');
      } catch (error) {
        console.error('Error initializing Google Maps Places API:', error);
        autocompleteService.current = null;
      }
    }
  }, []);

  // Sync value from props with internal state
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value, inputValue]);

  // Styles for dropdown elements
  const styles = {
    dropdown: {
      position: 'absolute',
      backgroundColor: '#1f2937',
      width: '100%',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
      zIndex: 1000,
      marginTop: '4px',
      maxHeight: '200px',
      overflowY: 'auto'
    },
    suggestionItem: {
      padding: '10px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid #374151',
      fontSize: '14px',
      color: '#e5e7eb'
    },
    suggestionItemHover: {
      backgroundColor: '#374151'
    },
    loadingIndicator: {
      position: 'absolute',
      right: inputValue ? '36px' : '12px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      border: '2px solid #9ca3af',
      borderTopColor: '#3b82f6',
      animation: 'spin 1s linear infinite'
    }
  };

  /**
   * Handle input text changes
   * @param {Object} e - Input change event
   */
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange && onChange(e);
    
    if (newValue.length > 0) {
      // Start search
      setShowSuggestions(true);
      setIsLoading(true);
      
      // Use AutocompleteSuggestion API to get suggestions
      if (autocompleteService.current) {
        // Options for API
        const searchOptions = {
          input: newValue,
          locationRestriction: {
            // Restrict to Indonesia
            rectangle: {
              low: { latitude: -11.0, longitude: 95.0 },
              high: { latitude: 6.0, longitude: 141.0 }
            }
          },
          componentRestrictions: { country: 'id' } // Restrict to Indonesia
        };
        
        // Use timeout to avoid too many requests
        const timeoutId = setTimeout(() => {
          // Using the new AutocompleteSuggestion API
          const autocompleteService = new window.google.maps.places.AutocompleteService();
            autocompleteService.getPlacePredictions(searchOptions)
              .then(response => {
                setIsLoading(false);
                if (response && response.predictions) {
                  console.log('Suggestions received:', response.predictions);
                  setSuggestions(response.predictions);
                } else {
                  setSuggestions([]);
                }
              })
              .catch(error => {
                setIsLoading(false);
                console.error('Error getting location suggestions:', error);
                setSuggestions([]);
              
                // Try fallback if main API fails
                try {
                  if (window.google && window.google.maps && window.google.maps.places && window.google.maps.places.AutocompleteService) {
                    const fallbackService = new window.google.maps.places.AutocompleteService();
                    const fallbackOptions = {
                      input: newValue,
                      componentRestrictions: { country: 'id' }
                    };
                    
                    fallbackService.getPlacePredictions(fallbackOptions, (predictions, status) => {
                      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                        console.log('Fallback suggestions received:', predictions);
                        setSuggestions(predictions);
                      }
                    });
                  }
                } catch (fallbackError) {
                  console.error('Fallback autocomplete also failed:', fallbackError);
                }
              });
          }, 300); // 300ms delay to reduce request volume
        
        return () => clearTimeout(timeoutId);
      }
    } else {
      setIsLoading(false);
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  /**
   * Handle suggestion selection
   * @param {Object} suggestion - Selected suggestion from API
   */
  const handleSelectSuggestion = async (suggestion) => {
    // Extract address from suggestion based on API format
    let address = '';
    let placeId = '';
    
    // Prioritize format from AutocompleteSuggestion API
    if (suggestion.formattedText) {
      // Main format from AutocompleteSuggestion API
      address = suggestion.formattedText;
      placeId = suggestion.placeId;
    } else if (suggestion.primaryText && suggestion.secondaryText) {
      // Split format from AutocompleteSuggestion API
      address = `${suggestion.primaryText}, ${suggestion.secondaryText}`;
      placeId = suggestion.placeId;
    } else if (suggestion.description) {
      // Old format from AutocompleteService (for compatibility)
      address = suggestion.description;
      placeId = suggestion.place_id;
    } else if (suggestion.structured_formatting) {
      // Alternative format from AutocompleteService (for compatibility)
      const { main_text, secondary_text } = suggestion.structured_formatting;
      address = secondary_text ? `${main_text}, ${secondary_text}` : main_text;
      placeId = suggestion.place_id;
    }
    
    // Update input and reset state
    setInputValue(address);
    setShowSuggestions(false);
    setSuggestions([]);
    setIsLoading(true);
    
    try {
      // If we have placeId, use Place API to get location details
      if (placeId && autocompleteService.current) {
        try {
          console.log('Trying to get location with new Place API');
          // Use fetchPlace from new API to get location details
          const placeResult = await autocompleteService.current.api.Place.fetchPlace({
            id: placeId,
            fields: ['location']
          });
          
          if (placeResult && placeResult.place && placeResult.place.location) {
            const location = placeResult.place.location;
            console.log('Successfully got location with new Place API:', location);
            
            // Call onSelect callback with address and position
            onSelect && onSelect({
              address,
              position: [location.latitude, location.longitude]
            });
            setIsLoading(false);
            return;
          }
        } catch (placeError) {
          console.warn('Error getting place details with new Place API:', placeError);
          // Continue with fallback method if failed
        }
        
        // Try with PlacesService if fetchPlace fails
        try {
          console.log('Trying to get location with PlacesService');
          // Create PlacesService with dummy element
          const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
          
          // Use getDetails to get location details
          placesService.getDetails(
            { placeId: placeId, fields: ['geometry'] },
            (place, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                const location = place.geometry.location;
                console.log('Successfully got location with PlacesService:', location);
                
                // Call onSelect callback with address and position
                onSelect && onSelect({
                  address,
                  position: [location.lat(), location.lng()]
                });
                setIsLoading(false);
                return;
              } else {
                console.warn('PlacesService failed to get location details, status:', status);
                // Continue with fallback method
                fallbackGeocoding();
              }
            }
          );
          return;
        } catch (placesServiceError) {
          console.warn('Error using PlacesService:', placesServiceError);
          // Continue with fallback method
        }
      }
      
      // Fallback geocoding function
      const fallbackGeocoding = async () => {
        try {
          console.log('Using fallback geocoding with getGeocode');
          const results = await getGeocode({ address });
          const { lat, lng } = await getLatLng(results[0]);
          console.log('Successfully got location with getGeocode:', lat, lng);
          
          // Call onSelect callback with address and position
          onSelect && onSelect({
            address,
            position: [lat, lng]
          });
        } catch (geocodeError) {
          console.error('Error during geocoding:', geocodeError);
        } finally {
          setIsLoading(false);
        }
      };
      
      // Run fallback geocoding
      await fallbackGeocoding();
    } catch (error) {
      console.error('Error selecting location:', error);
      setIsLoading(false);
    }
  };

  /**
   * Clear input field
   */
  const handleClearInput = () => {
    setInputValue('');
    onChange && onChange({ target: { value: '' } });
    setSuggestions([]);
    setShowSuggestions(false);
    setIsLoading(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Add spin animation for loading indicator */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', color: '#9ca3af' }} />
        <input
          value={inputValue}
          onChange={handleInputChange}
          disabled={!window.google}
          placeholder={placeholder}
          style={{
            ...style,
            paddingLeft: '36px',
            paddingRight: isLoading ? '56px' : (inputValue ? '36px' : '12px')
          }}
          onFocus={() => inputValue && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {isLoading && <div style={styles.loadingIndicator} />}
        {inputValue && (
          <X 
            size={16} 
            style={{ 
              position: 'absolute', 
              right: '12px', 
              color: '#9ca3af', 
              cursor: 'pointer',
              zIndex: 2
            }} 
            onClick={handleClearInput}
          />
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <ul style={styles.dropdown} className="custom-scrollbar">
          {suggestions.map((suggestion) => {
            // Extract ID from suggestion based on API format
            const id = suggestion.placeId || suggestion.place_id || `suggestion-${Math.random()}`;
            
            // Extract main and secondary text from various API formats
            let mainText = '';
            let secondaryText = '';
            
            // Format from AutocompleteSuggestion API (new)
            if (suggestion.formattedText) {
              // If formattedText exists, use as main text
              mainText = suggestion.formattedText;
              // If primaryText and secondaryText are separate, use for better display
              if (suggestion.primaryText) {
                mainText = suggestion.primaryText;
                secondaryText = suggestion.secondaryText || '';
              }
            } 
            // Format from AutocompleteService API (old)
            else if (suggestion.structured_formatting) {
              mainText = suggestion.structured_formatting.main_text;
              secondaryText = suggestion.structured_formatting.secondary_text || '';
            } 
            // Fallback to description if no other format
            else if (suggestion.description) {
              mainText = suggestion.description;
            }
            // Last fallback if no recognized format
            else {
              mainText = suggestion.text || 'Unknown location';
            }
            
            return (
              <li
                key={id}
                style={styles.suggestionItem}
                onMouseDown={() => handleSelectSuggestion(suggestion)}
                onMouseOver={(e) => {
                  Object.assign(e.target.style, styles.suggestionItemHover);
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '';
                }}
              >
                <strong>{mainText}</strong> {secondaryText && <small style={{ color: '#9ca3af' }}>{secondaryText}</small>}
              </li>
            );
          })}
        </ul>
      )}
      
      {showSuggestions && suggestions.length === 0 && isLoading && (
        <div style={{...styles.dropdown, padding: '10px', textAlign: 'center', color: '#9ca3af'}}>
          Searching locations...
        </div>
      )}
    </div>
  );
};

export default PlacesAutocomplete;