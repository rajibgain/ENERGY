import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Building2, Check, ChevronRight, Clock3, Edit3, FileImage, FileText, MapPin, Plus, UploadCloud, X, Zap } from 'lucide-react';
import { fetchSiteSchematic } from '../services/api';
import { roomEstimate } from '../utils/energyModel';

const emptyDraft = (state) => ({ name: '', address: '', city: '', state: state || 'West Bengal', latitude: '', longitude: '' });

function mapUrl(site) {
  const latitude = Number(site.latitude);
  const longitude = Number(site.longitude);
  const bounds = [longitude - 0.04, latitude - 0.03, longitude + 0.04, latitude + 0.03]
    .map((value) => value.toFixed(6)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export default function PortfolioMap({
  sites, rooms, role, isDemo, organization, onCreateSite, onUpdateSite,
  onUploadSchematic, onClearSchematic, onMoveRoom, onSelectRoom,
}) {
  const canManage = role !== 'staff';
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? null);
  const [siteModal, setSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [siteDraft, setSiteDraft] = useState(emptyDraft(organization.state));
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteError, setSiteError] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [schematicPreview, setSchematicPreview] = useState('');
  const [schematicError, setSchematicError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [movingRoomId, setMovingRoomId] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!sites.length) {
      setSelectedSiteId(null);
      return;
    }
    if (!sites.some((site) => site.id === selectedSiteId)) setSelectedSiteId(sites[0].id);
  }, [sites, selectedSiteId]);

  const selectedSite = sites.find((site) => site.id === selectedSiteId) || null;
  const siteRooms = useMemo(() => selectedSite
    ? rooms.filter((room) => Number(room.site_id) === Number(selectedSite.id))
    : [], [rooms, selectedSite]);
  const blocks = useMemo(() => {
    const grouped = new Map();
    for (const room of siteRooms) {
      const block = String(room.block || '').split('·')[0].trim() || 'Unassigned block';
      if (!grouped.has(block)) grouped.set(block, []);
      grouped.get(block).push(room);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [siteRooms]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSchematicPreview('');
    setSchematicError('');
    if (!selectedSite?.has_schematic) return () => { active = false; };
    if (selectedSite.schematic_data_url) {
      setSchematicPreview(selectedSite.schematic_data_url);
      return () => { active = false; };
    }
    fetchSiteSchematic(selectedSite.id).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSchematicPreview(objectUrl);
    }).catch(() => {
      if (active) setSchematicError('Could not load this saved schematic. Try refreshing the workspace.');
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedSite?.id, selectedSite?.has_schematic, selectedSite?.schematic_data_url]);

  const openSiteModal = (site = null) => {
    setEditingSite(site);
    setSiteDraft(site ? {
      name: site.name,
      address: site.address || '',
      city: site.city || '',
      state: site.state || organization.state || 'West Bengal',
      latitude: site.latitude ?? '',
      longitude: site.longitude ?? '',
    } : emptyDraft(organization.state));
    setSiteError('');
    setSiteModal(true);
  };

  const saveSite = async (event) => {
    event.preventDefault();
    setSiteError('');
    const hasLatitude = String(siteDraft.latitude).trim() !== '';
    const hasLongitude = String(siteDraft.longitude).trim() !== '';
    if (hasLatitude !== hasLongitude) {
      setSiteError('Enter both coordinates to place a map pin, or leave both blank.');
      return;
    }
    const payload = {
      name: siteDraft.name.trim(),
      address: siteDraft.address.trim(),
      city: siteDraft.city.trim(),
      state: siteDraft.state,
      latitude: hasLatitude ? Number(siteDraft.latitude) : null,
      longitude: hasLongitude ? Number(siteDraft.longitude) : null,
    };
    setSiteBusy(true);
    try {
      const saved = editingSite ? await onUpdateSite(editingSite.id, payload) : await onCreateSite(payload);
      setSelectedSiteId(saved.id);
      setSiteModal(false);
    } catch (error) {
      setSiteError(error?.response?.data?.detail || error.message || 'Could not save this location.');
    } finally {
      setSiteBusy(false);
    }
  };

  const uploadSchematic = async (file) => {
    if (!file || !selectedSite) return;
    const allowed = /\.(png|jpe?g|webp|pdf)$/i.test(file.name);
    if (!allowed) {
      setSchematicError('Choose a PNG, JPG, WEBP or PDF schematic.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSchematicError('Choose a schematic that is 10 MB or smaller.');
      return;
    }
    setSchematicError('');
    setUploadBusy(true);
    try {
      await onUploadSchematic(selectedSite.id, file);
    } catch (error) {
      setSchematicError(error?.response?.data?.detail || error.message || 'Could not upload this schematic.');
    } finally {
      setUploadBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const clearSchematic = async () => {
    if (!selectedSite) return;
    setUploadBusy(true);
    setSchematicError('');
    try {
      await onClearSchematic(selectedSite.id);
    } catch (error) {
      setSchematicError(error?.response?.data?.detail || 'Could not remove this schematic.');
    } finally {
      setUploadBusy(false);
    }
  };

  const changeRoomSite = async (room, value) => {
    setMovingRoomId(room.id);
    setLocationError('');
    try {
      await onMoveRoom(room.id, Number(value));
    } catch (error) {
      setLocationError(error?.response?.data?.detail || 'Could not move this room.');
    } finally {
      setMovingRoomId(null);
    }
  };

  const hasCoordinates = selectedSite && selectedSite.latitude != null && selectedSite.longitude != null;
  const isPdf = selectedSite?.schematic_filename?.toLowerCase().endsWith('.pdf');
  const mappedCount = sites.filter((site) => site.latitude != null && site.longitude != null).length;

  return (
    <>
      <section id="locations" data-section className="ss-locations-section">
        <div className="ss-section-caption"><span>YOUR ORGANIZATION · LOCATIONS</span><span>{String(sites.length).padStart(2, '0')} SITES</span></div>
        <div className="ss-locations-heading">
          <div>
            <div className="ss-kicker"><span className="ss-kicker-dot" /> SITES & BUILDING PLANS</div>
            <h2>Every place,<br /><em>on the map.</em></h2>
            <p>See locations in this organization, then explore blocks, rooms and their energy details.</p>
          </div>
          {canManage && <button className="ss-button ss-button-primary" onClick={() => openSiteModal()}><Plus size={15} /> Add location</button>}
        </div>

        <div className="ss-location-layout">
          <aside className="ss-location-list ss-card">
            <div className="ss-location-list-head"><span>ORGANIZATION LOCATIONS</span><small>{mappedCount} mapped</small></div>
            {sites.length ? sites.map((site) => {
              const count = rooms.filter((room) => Number(room.site_id) === Number(site.id)).length;
              const selected = selectedSite?.id === site.id;
              return <button className={'ss-location-item' + (selected ? ' is-selected' : '')} key={site.id} onClick={() => setSelectedSiteId(site.id)} aria-pressed={selected}>
                <span className="ss-location-pin"><MapPin size={15} /></span>
                <span className="ss-location-copy"><strong>{site.name}</strong><small>{[site.city, site.state].filter(Boolean).join(', ') || 'Location details needed'}</small></span>
                <span className="ss-location-count">{count}<small>rooms</small></span>
                <ChevronRight size={14} className="ss-location-chevron" />
              </button>;
            }) : <div className="ss-location-list-empty"><MapPin size={18} /><strong>No locations yet</strong><span>Add a site to start the map.</span></div>}
            {canManage && selectedSite && <button className="ss-location-edit" onClick={() => openSiteModal(selectedSite)}><Edit3 size={13} /> Edit selected location</button>}
            <div className="ss-location-privacy"><Building2 size={14} /><span>Visible to this organization’s team. Other organizations remain private.</span></div>
          </aside>

          <div className="ss-map-card ss-card">
            <div className="ss-map-card-head"><div><span>LOCATION MAP</span><strong>{selectedSite?.name || 'Add your first location'}</strong></div>{selectedSite && hasCoordinates && <a href={`https://www.openstreetmap.org/?mlat=${selectedSite.latitude}&mlon=${selectedSite.longitude}#map=15/${selectedSite.latitude}/${selectedSite.longitude}`} target="_blank" rel="noreferrer">Open map <ArrowUpRight size={13} /></a>}</div>
            {hasCoordinates ? <iframe className="ss-location-map" title={`Map showing ${selectedSite.name}`} src={mapUrl(selectedSite)} loading="lazy" referrerPolicy="no-referrer" /> : <div className="ss-map-empty"><span className="ss-map-orbit"><MapPin size={21} /></span><strong>{selectedSite ? 'Add coordinates to place this site' : 'Your organization map starts here'}</strong><span>{selectedSite ? 'Edit this location and enter its latitude and longitude.' : 'Add a location, then pin it by entering its coordinates.'}</span>{canManage && <button className="ss-text-action" onClick={() => openSiteModal(selectedSite)}>{selectedSite ? 'Add coordinates' : 'Add a location'} <ChevronRight size={14} /></button>}</div>}
            <div className="ss-map-attribution">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
          </div>
        </div>

        {selectedSite && <div className="ss-building-view">
          <div className="ss-building-view-head">
            <div><div className="ss-kicker"><span className="ss-kicker-dot" /> {selectedSite.name.toUpperCase()}</div><h3>Blocks & rooms</h3><p>{siteRooms.length} monitored spaces · Select a room to see equipment and schedules.</p></div>
            {canManage && <><input ref={fileInput} type="file" className="ss-hidden-input" accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => uploadSchematic(event.target.files?.[0])} /><button className="ss-button ss-button-quiet" disabled={uploadBusy} onClick={() => fileInput.current?.click()}>{uploadBusy ? <span className="ss-spin"><UploadCloud size={14} /></span> : <UploadCloud size={14} />}{selectedSite.has_schematic ? 'Replace schematic' : 'Upload schematic'}</button></>}
          </div>
          {locationError && <div className="ss-location-operation-error" role="status">{locationError}</div>}
          {schematicError && <div className="ss-schematic-error" role="status">{schematicError}</div>}
          <div className="ss-building-view-grid">
            <div className="ss-schematic-card ss-card">
              <div className="ss-schematic-card-head"><span><FileImage size={14} /> OPTIONAL BUILDING SCHEMATIC</span>{selectedSite.has_schematic && canManage && <button onClick={clearSchematic} disabled={uploadBusy} aria-label="Remove building schematic" title="Remove schematic"><X size={14} /></button>}</div>
              {selectedSite.has_schematic ? schematicError ? <div className="ss-schematic-empty"><FileText size={20} /><span>{schematicError}</span></div> : !schematicPreview ? <div className="ss-schematic-empty"><span className="ss-spin"><UploadCloud size={18} /></span><span>Loading saved plan…</span></div> : isPdf ? <iframe className="ss-schematic-pdf" src={schematicPreview} title={`${selectedSite.name} building schematic`} /> : <img className="ss-schematic-image" src={schematicPreview} alt={`${selectedSite.name} building schematic`} /> : <div className="ss-schematic-empty"><span className="ss-schematic-symbol"><Building2 size={21} /></span><strong>Room blocks work without a file.</strong><span>Upload a PNG, JPG, WEBP or PDF if you want the original building plan beside the room map.</span>{canManage && <button className="ss-text-action" onClick={() => fileInput.current?.click()}>Choose a schematic <UploadCloud size={13} /></button>}</div>}
              {selectedSite.has_schematic && <div className="ss-schematic-filename"><FileText size={12} />{selectedSite.schematic_filename || 'Building schematic'}<span>PRIVATE TO THIS ORGANIZATION</span></div>}
            </div>

            <div className="ss-blocks-panel">
              {blocks.length ? blocks.map(([block, blockRooms]) => <section className="ss-block-card ss-card" key={block}>
                <div className="ss-block-card-head"><span className="ss-block-icon"><Building2 size={14} /></span><div><span>BLOCK</span><strong>{block}</strong></div><small>{String(blockRooms.length).padStart(2, '0')} ROOMS</small></div>
                <div className="ss-room-map-grid">{blockRooms.map((room) => {
                  const estimate = roomEstimate(room, organization.tariffRate, organization.carbonFactor, organization.operatingHours);
                  return <article className="ss-room-map-tile" key={room.id}>
                    <button className="ss-room-map-open" onClick={() => onSelectRoom(room)}>
                      <span className="ss-room-tile-mark"><Building2 size={13} /></span><strong>{room.name}</strong>
                      <span className="ss-room-tile-meta"><span><Zap size={11} /> {numberForLoad(estimate.connectedKw)} kW</span><span><Clock3 size={11} /> {(room.schedules || []).length} schedules</span></span>
                    </button>
                    {canManage && sites.length > 1 && <label className="ss-room-move">Location<select value={room.site_id ?? ''} disabled={movingRoomId === room.id} onChange={(event) => changeRoomSite(room, event.target.value)} aria-label={`Location for ${room.name}`}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
                  </article>;
                })}</div>
              </section>) : <div className="ss-block-empty ss-card"><Building2 size={20} /><strong>No rooms are assigned here yet.</strong><span>Move a room from another location or add room records through the workspace API.</span></div>}
            </div>
          </div>
        </div>}
        {isDemo && <p className="ss-map-demo-note"><Check size={13} /> Demo map pins and site names are illustrative. Changes and schematic uploads stay in this browser session.</p>}
      </section>

      {siteModal && <div className="ss-modal-backdrop" role="presentation" onClick={() => !siteBusy && setSiteModal(false)}>
        <section className="ss-form-modal ss-location-modal" role="dialog" aria-modal="true" aria-labelledby="ss-location-modal-title" onClick={(event) => event.stopPropagation()}>
          <button className="ss-modal-close" onClick={() => setSiteModal(false)} aria-label="Close location form"><X size={16} /></button>
          <div className="ss-modal-copy"><div className="ss-kicker"><span className="ss-kicker-dot" /> ORGANIZATION LOCATIONS</div><h2 id="ss-location-modal-title">{editingSite ? <>Update this<br /><em>location.</em></> : <>Add a new<br /><em>location.</em></>}</h2><p>Locations are visible to members of this organization only. Coordinates place the site marker on the map.</p></div>
          <form className="ss-form-grid" onSubmit={saveSite}>
            <label className="ss-form-field ss-field-wide"><span>LOCATION NAME</span><input required minLength="2" maxLength="120" value={siteDraft.name} onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })} placeholder="North campus, office, plant…" /></label>
            <label className="ss-form-field ss-field-wide"><span>ADDRESS <small>OPTIONAL</small></span><input maxLength="240" value={siteDraft.address} onChange={(event) => setSiteDraft({ ...siteDraft, address: event.target.value })} placeholder="Street or area" /></label>
            <label className="ss-form-field"><span>CITY</span><input maxLength="100" value={siteDraft.city} onChange={(event) => setSiteDraft({ ...siteDraft, city: event.target.value })} placeholder="City" /></label>
            <label className="ss-form-field"><span>STATE / REGION</span><input required minLength="2" maxLength="80" value={siteDraft.state} onChange={(event) => setSiteDraft({ ...siteDraft, state: event.target.value })} placeholder="State or region" /></label>
            <label className="ss-form-field"><span>LATITUDE <small>OPTIONAL</small></span><input type="number" min="-90" max="90" step="any" value={siteDraft.latitude} onChange={(event) => setSiteDraft({ ...siteDraft, latitude: event.target.value })} placeholder="22.5726" /></label>
            <label className="ss-form-field"><span>LONGITUDE <small>OPTIONAL</small></span><input type="number" min="-180" max="180" step="any" value={siteDraft.longitude} onChange={(event) => setSiteDraft({ ...siteDraft, longitude: event.target.value })} placeholder="88.3639" /></label>
            {siteError && <div className="ss-auth-error ss-field-wide" role="alert">{siteError}</div>}
            <div className="ss-form-actions ss-field-wide"><span><MapPin size={13} /> Add coordinates together to show a map pin.</span><button className="ss-button ss-button-primary" type="submit" disabled={siteBusy}>{siteBusy ? 'Saving…' : editingSite ? 'Save location' : 'Add location'} <ChevronRight size={14} /></button></div>
          </form>
        </section>
      </div>}
    </>
  );
}

function numberForLoad(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
}
