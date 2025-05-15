import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Komponen pencarian alamat dengan autocomplete menggunakan Google Maps Places API
 * Mendukung AutocompleteService dan AutocompleteSuggestion (ketika tersedia)
 */
const PlacesAutocomplete = ({
  placeholder = "Cari lokasi",
  value = "",
  onChange,
  onSelect,
  style = {}
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const autocompleteServiceRef = useRef(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const placesServiceRef = useRef(null);

  // Inisialisasi Autocomplete Service ketika Google Maps API dimuat
  useEffect(() => {
    const checkGoogleMapsLoaded = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        try {
          // Gunakan AutocompleteService karena API yang baru mungkin belum tersedia
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
          
          // Buat PlacesService untuk mendapatkan detail tempat
          placesServiceRef.current = new window.google.maps.places.PlacesService(
            document.createElement('div')
          );
          
          setIsLoaded(true);
          console.log('Google Maps Autocomplete Service loaded successfully');
        } catch (error) {
          console.error('Error initializing Autocomplete Service:', error);
        }
      } else {
        // Jika belum dimuat, coba lagi dalam 1 detik
        setTimeout(checkGoogleMapsLoaded, 1000);
      }
    };

    checkGoogleMapsLoaded();

    // Event listener untuk menutup daftar saran ketika klik di luar
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Mendapatkan saran alamat ketika input berubah
  useEffect(() => {
    if (!isLoaded || !autocompleteServiceRef.current || !value.trim()) {
      setSuggestions([]);
      return;
    }

    // Beri delay untuk mengurangi jumlah request
    const delayDebounce = setTimeout(() => {
      try {
        autocompleteServiceRef.current.getPlacePredictions({
          input: value,
          componentRestrictions: { country: 'id' }, // Batasi ke Indonesia
          types: ['geocode', 'establishment']
        }, (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
            if (predictions.length > 0 && inputFocused) {
              setShowSuggestions(true);
            }
          } else {
            setSuggestions([]);
          }
        });
      } catch (error) {
        console.error('Error in autocomplete request:', error);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [value, isLoaded, inputFocused]);

  // Handler ketika item saran dipilih
  const handleSuggestionSelect = (suggestion) => {
    setShowSuggestions(false);
    
    try {
      if (!placesServiceRef.current) {
        console.error('Places Service is not initialized');
        return;
      }
      
      // Get place details
      placesServiceRef.current.getDetails(
        {
          placeId: suggestion.place_id,
          fields: ['geometry', 'formatted_address', 'name']
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            const location = {
              position: [
                place.geometry.location.lat(),
                place.geometry.location.lng()
              ],
              address: place.formatted_address || suggestion.description,
              name: place.name
            };
            
            // Call the onSelect callback with the location data
            if (onSelect) {
              onSelect(location);
            }
          } else {
            console.error('Error getting place details:', status);
          }
        }
      );
    } catch (error) {
      console.error('Error selecting place:', error);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e)}
        onFocus={() => {
          setInputFocused(true);
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        onBlur={() => {
          // Beri delay sebelum menutup saran agar klik masih bisa diproses
          setTimeout(() => setInputFocused(false), 200);
        }}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          outline: 'none',
          fontSize: '14px',
          ...style
        }}
        disabled={!isLoaded}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'white',
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            zIndex: 1000
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onMouseDown={() => handleSuggestionSelect(suggestion)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              {suggestion.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

PlacesAutocomplete.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  style: PropTypes.object
};

export default PlacesAutocomplete;