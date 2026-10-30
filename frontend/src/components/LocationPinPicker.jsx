import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapPinPicker({ position, onPick }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng]);
    },
  });
  return position ? <CircleMarker center={position} radius={8} pathOptions={{ color: '#405b38', fillColor: '#a9cf77', fillOpacity: 1, weight: 3 }} /> : null;
}

export default function LocationPinPicker({ latitude, longitude, onPick }) {
  const hasPosition = latitude !== '' && longitude !== '';
  const position = hasPosition ? [Number(latitude), Number(longitude)] : null;

  return (
    <>
      <p className="ss-map-picker-help">Click the map where this site is. Zoom and drag to find the right spot.</p>
      <MapContainer className="ss-map-picker" center={position || [22.9734, 78.6569]} zoom={position ? 13 : 4} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapPinPicker position={position} onPick={onPick} />
      </MapContainer>
    </>
  );
}
