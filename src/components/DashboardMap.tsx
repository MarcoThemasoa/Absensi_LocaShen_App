import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { OfficeLocation } from '../types';

// Fix default marker icon for leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DashboardMapProps {
  locations: OfficeLocation[];
}

export default function DashboardMap({ locations }: DashboardMapProps) {
  const center =
    locations.length > 0
      ? [locations[0].lat, locations[0].lng]
      : ([-7.250445, 112.768845] as [number, number]);

  return (
    <MapContainer
      center={center as [number, number]}
      zoom={10}
      style={{ height: '100%', width: '100%', zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {locations
        .filter((loc) => loc.lat && loc.lng)
        .map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]}>
            <Popup>
              <div className="font-bold text-sm">{loc.name}</div>
              {loc.address && (
                <div className="text-xs text-gray-500">{loc.address}</div>
              )}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
