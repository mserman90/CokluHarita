import React, { useState, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Layers, Globe, Sun, Moon, Activity, 
  Plane, Rocket, Ship, Anchor, Train, 
  Wind, RadioTower, TriangleAlert, Flame,
  ChevronRight, Map as MapIcon, Car, GripHorizontal, Radio, Tv, Columns, Rows
} from 'lucide-react';

declare global {
  interface Window {
    L: any;
  }
}

// --- LEAFLET CSS & JS DİNAMİK ENJEKSİYONU ---
const useLeaflet = () => {
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    if (window.L) { 
      setLoaded(true); 
      return; 
    }
    
    let cssLoaded = false, jsLoaded = false;
    const checkReady = () => { 
      if (cssLoaded && jsLoaded && window.L) setLoaded(true); 
    };
    
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; 
      link.rel = 'stylesheet'; 
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.onload = () => { cssLoaded = true; checkReady(); };
      document.head.appendChild(link);
    } else { 
      cssLoaded = true; 
    }
    
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js'; 
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => { jsLoaded = true; checkReady(); };
      document.head.appendChild(script);
    } else { 
      jsLoaded = true; 
      checkReady(); 
    }
  }, []);
  return loaded;
};

// --- COĞRAFİ SABİTLER VE IFRAME (ZERO-API) KAYNAKLARI ---
const TURKEY_COORDS: [number, number] = [38.9637, 35.2433];

const IFRAME_SOURCES: Record<string, { name: string; icon: React.ElementType; type?: 'iframe'|'native'; getSrc?: (lat: string | number, lng: string | number, z: number) => string }> = {
  roadTraffic: { 
    name: 'Yandex (Canlı Trafik)', 
    icon: Car,
    getSrc: (lat, lng, z) => `https://yandex.com/map-widget/v1/?ll=${lng},${lat}&z=${z}&theme=dark&l=map,trf,trj` 
  },
  flightradar: { 
    name: 'ADSB.lol (Uçak Trafiği)', 
    icon: Plane,
    getSrc: (lat, lng, z) => `https://globe.adsb.lol/?lat=${lat}&lon=${lng}&zoom=${z}` 
  },
  airplaneslive: { 
    name: 'Airplanes.live (Askeri/Sivil Uçuş)', 
    icon: Rocket,
    getSrc: (lat, lng, z) => `https://globe.airplanes.live/?lat=${lat}&lon=${lng}&zoom=${z}` 
  },
  marinetraffic: { 
    name: 'MarineTraffic (Gemi Trafiği)', 
    icon: Ship,
    getSrc: (lat, lng, z) => `https://www.marinetraffic.com/en/ais/embed/zoom:${z}/centery:${lat}/centerx:${lng}/maptype:1/shownames:false/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:false/remember:false` 
  },
  vesselfinder: { 
    name: 'VesselFinder (Alternatif Deniz)', 
    icon: Anchor,
    getSrc: (lat, lng, z) => `https://www.vesselfinder.com/aismap?zoom=${z}&lat=${lat}&lon=${lng}` 
  },
  railway: { 
    name: 'OpenRailwayMap (Lojistik/Tren)', 
    icon: Train,
    getSrc: (lat, lng, z) => `https://www.openrailwaymap.org/?lat=${lat}&lon=${lng}&zoom=${z}` 
  },
  windy: { 
    name: 'Windy (Meteorolojik Akış)', 
    icon: Wind,
    getSrc: (lat, lng, z) => `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=${z}&level=surface&overlay=wind` 
  },
  gpsjam: { 
    name: 'GPSJam (GNSS Karıştırma Analizi)', 
    icon: RadioTower,
    getSrc: (lat, lng, z) => `https://gpsjam.org/#loc=${z}/${lat}/${lng}` 
  },
  safecast: { 
    name: 'Safecast (Nükleer/Radyasyon)', 
    icon: TriangleAlert,
    getSrc: (lat, lng, z) => `https://map.safecast.org/?y=${lat}&x=${lng}&z=${z}&m=0` 
  },
  firemap: {
    name: 'Firemap.live (Küresel Orman Yangınları)',
    icon: Flame,
    getSrc: () => `https://www.firemap.live/`
  },
  copernicus: {
    name: 'Copernicus Sentinel-2 (Uydu/Tarım)',
    icon: Globe,
    getSrc: (lat, lng, z) => `https://browser.dataspace.copernicus.eu/?zoom=${z}&lat=${lat}&lng=${lng}&themeId=AGRICULTURE&visualizationUrl=U2FsdGVkX19ly3Dw%2BPcccrlY5h4vGD0s%2BJ8Sl5Bzh%2FAFLhYEebT3y3awvLtOVcPvtrzTj1hvGD3e6yciPgtcZKWI1zMSnxYnNNZsK9RskNDF8B2Tquz5U9AK64%2FvWPCl&datasetId=S2_L2A_CDAS&demSource3D=%22MAPZEN%22&cloudCoverage=30&dateMode=SINGLE`
  },
  radio: {
    name: 'Radio Browser (Canlı İstasyonlar)',
    icon: Radio,
    type: 'native'
  },
  trt: {
    name: 'TRT (TV & Radyo)',
    icon: Tv,
    type: 'native'
  },
  liveatc: {
    name: 'LiveATC (Hava Trafik Telsizi)',
    icon: RadioTower,
    type: 'native'
  }
};

// --- DURUM YÖNETİMİ (ZUSTAND STORE) ---
interface IframeLayerState {
  enabled: boolean;
  opacity: number;
  interactive: boolean;
}

interface LayerStore {
  basemapMode: 'dark' | 'light';
  basemapEnabled: boolean;
  iframeLayers: Record<string, IframeLayerState>;
  setBasemapMode: (mode: 'dark' | 'light') => void;
  toggleBasemap: () => void;
  toggleIframeLayer: (id: string) => void;
  setIframeOpacity: (id: string, opacity: string | number) => void;
  toggleIframeInteractivity: (id: string) => void;
}

const useLayerStore = create<LayerStore>()(persist((set) => ({
  basemapMode: 'dark', // 'dark' | 'light'
  basemapEnabled: false,
  
  // Iframe sarmalayıcıların bağımsız durumları
  iframeLayers: Object.keys(IFRAME_SOURCES).reduce((acc, id) => ({
    ...acc,
    [id]: { enabled: false, opacity: 0.75, interactive: false }
  }), {} as Record<string, IframeLayerState>),

  setBasemapMode: (mode) => set({ basemapMode: mode }),
  toggleBasemap: () => set((state) => ({ basemapEnabled: !state.basemapEnabled })),
  
  toggleIframeLayer: (id) => set((state) => {
    const layer = state.iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
    return {
      iframeLayers: {
        ...state.iframeLayers,
        [id]: { ...layer, enabled: !layer.enabled }
      }
    };
  }),
  setIframeOpacity: (id, opacity) => set((state) => {
    const layer = state.iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
    return {
      iframeLayers: {
        ...state.iframeLayers,
        [id]: { ...layer, opacity: typeof opacity === 'string' ? parseFloat(opacity) : opacity }
      }
    };
  }),
  toggleIframeInteractivity: (id) => set((state) => {
    const layer = state.iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
    return {
      iframeLayers: {
        ...state.iframeLayers,
        [id]: { ...layer, interactive: !layer.interactive }
      }
    };
  }),
}), { name: 'pure-keyless-osint-v6' }));

// --- HARİTA ÇERÇEVESİ BİLEŞENİ ---
function MapComponent({ children }: { children: React.ReactNode }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const loaded = useLeaflet();
  const { basemapMode, basemapEnabled } = useLayerStore();
  const tileLayerRef = useRef<any>(null);
  
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    
    let instance = map;
    // @ts-ignore
    if (!instance && window.L) {
      // @ts-ignore
      instance = window.L.map(mapRef.current, { zoomControl: false }).setView(TURKEY_COORDS, 5);
      setMap(instance);
    }
    
    if (instance) {
      if (tileLayerRef.current) {
        instance.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      
      if (basemapEnabled) {
        const url = basemapMode === 'dark' 
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
          
        // @ts-ignore
        tileLayerRef.current = window.L.tileLayer(url, { 
          attribution: '&copy; CARTO' 
        }).addTo(instance);
      }
    }
  }, [loaded, map, basemapMode, basemapEnabled]);

  return (
    <div className="w-full h-full relative bg-slate-900 flex items-center justify-center">
      {!loaded && (
        <div className="flex flex-col items-center gap-3 z-10 text-emerald-500 font-mono text-xs">
          <Activity className="w-8 h-8 animate-pulse text-emerald-400" />
          <span>HARİTA MODÜLLERİ YÜKLENİYOR...</span>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full absolute inset-0 z-0" />
      {map && React.Children.toArray(children).map(c => 
        React.isValidElement(c) ? React.cloneElement(c as React.ReactElement, { map }) : c
      )}
    </div>
  );
}

// --- HARİTA ÜSTÜNE BİNDİRİLEN IFRAME KATMANI ---
const IframeOverlay: React.FC<{ id: string, map?: any }> = ({ id, map }) => {
  const { iframeLayers } = useLayerStore();
  const state = iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
  
  if (!state.enabled || !map) return null;
  
  const src = IFRAME_SOURCES[id].getSrc(
    map.getCenter().lat.toFixed(2), 
    map.getCenter().lng.toFixed(2), 
    map.getZoom()
  );
  
  return (
    <div 
      className="absolute inset-0 z-[400] transition-opacity duration-300" 
      style={{ 
        opacity: state.opacity, 
        pointerEvents: state.interactive ? 'auto' : 'none' 
      }}
    >
      <iframe src={src} className="w-full h-full border-none" title={IFRAME_SOURCES[id].name} />
    </div>
  );
}

// --- RADYO HARİTASI (NATIVE) ---
const RadioLayer: React.FC<{ id: string, map?: any }> = ({ id, map }) => {
  const { iframeLayers } = useLayerStore();
  const state = iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
  const [stations, setStations] = useState<any[]>([]);
  const layerGroupRef = useRef<any>(null);

  useEffect(() => {
    if (!state.enabled) return;
    
    // Yalnızca konum bilgisi olan istasyonları getir ('votes' ile sıralı, en popüler olanlar)
    fetch('https://de1.api.radio-browser.info/json/stations/search?has_geo_info=true&order=votes&reverse=true&limit=250')
      .then(res => res.json())
      .then(data => {
        const valid = data.filter((s:any) => s.geo_lat && s.geo_long);
        setStations(valid);
      })
      .catch(err => console.error("Radyo istasyonları çekilemedi:", err));
  }, [state.enabled]);

  useEffect(() => {
    if (!window.L || !map) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    if (state.enabled && stations.length > 0) {
      const markers = stations.map(s => {
        // @ts-ignore
        const marker = window.L.marker([s.geo_lat, s.geo_long], {
          // @ts-ignore
          icon: window.L.divIcon({
            className: 'custom-radio-icon shadow-lg',
            html: `<div style="background-color: #dcc914; border-radius: 50%; width: 14px; height: 14px; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        });

        // Tıklanınca açılacak HTML balonu
        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 200px; padding: 4px;">
            <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #0f3c5b;">${s.name || 'Bilinmeyen İstasyon'}</h3>
            <p style="margin: 0 0 10px 0; font-size: 11px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${s.tags || 'General'}</p>
            <audio controls src="${s.url_resolved}" style="width: 100%; height: 32px;" autoplay title="${s.name}"></audio>
            <div style="font-size: 9px; color: #999; margin-top: 6px; text-align: right;">${s.country || 'Bilinmiyor'}</div>
          </div>
        `, { maxWidth: 300 });

        return marker;
      });

      // @ts-ignore
      layerGroupRef.current = window.L.featureGroup(markers);
      layerGroupRef.current.addTo(map);
    }

    return () => {
      if (layerGroupRef.current && map) {
        map.removeLayer(layerGroupRef.current);
      }
    };
  }, [stations, state.enabled, map]);

  return null;
}

// --- TRT KATMANI (NATIVE TV & RADYO) ---
const TrtLayer: React.FC<{ id: string, map?: any }> = ({ id, map }) => {
  const { iframeLayers } = useLayerStore();
  const state = iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
  const [radios, setRadios] = useState<any[]>([]);
  const layerGroupRef = useRef<any>(null);

  const TRT_TV = [
    { name: 'TRT Haber (Canlı TV)', lat: 39.8465, lng: 32.8306, url: 'https://www.youtube.com/embed/live_stream?channel=UCkQZzH7qA2x21Jm5-eONwAw&autoplay=1&mute=1', desc: 'Ankara TRT Genel Müdürlüğü' },
    { name: 'TRT World (Canlı TV)', lat: 41.0664, lng: 29.0305, url: 'https://www.youtube.com/embed/live_stream?channel=UC7fWeaHhqgM4Ry-RMpM2YYw&autoplay=1&mute=1', desc: 'İstanbul TRT Ulus Stüdyoları' },
    { name: 'TRT Arabi (Canlı TV)', lat: 41.0456, lng: 28.9877, url: 'https://www.youtube.com/embed/live_stream?channel=UCrL1k1xUSrPte-6I06fH7xw&autoplay=1&mute=1', desc: 'İstanbul Harbiye' },
  ];

  useEffect(() => {
    if (!state.enabled) return;
    
    fetch('https://de1.api.radio-browser.info/json/stations/search?name=TRT&countrycode=TR')
      .then(res => res.json())
      .then(data => {
        let trtRadios = data.filter((s:any) => s.name.toUpperCase().includes('TRT'));
        trtRadios = trtRadios.map((r:any) => {
          // Geo bilgisi olmayan TRT radyolarını rastgele koordinatlara dağıt
          if (!r.geo_lat) {
             r.geo_lat = 39.9208 + (Math.random() - 0.5) * 4;
             r.geo_long = 32.8541 + (Math.random() - 0.5) * 8;
          }
          return r;
        });
        setRadios(trtRadios);
      })
      .catch(err => console.error("TRT Radyoları çekilemedi:", err));
  }, [state.enabled]);

  useEffect(() => {
    if (!window.L || !map) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    if (state.enabled) {
      const markers: any[] = [];

      // TRT TV Marker
      TRT_TV.forEach(tv => {
        // @ts-ignore
        const marker = window.L.marker([tv.lat, tv.lng], {
          // @ts-ignore
          icon: window.L.divIcon({
            className: 'custom-trt-tv-icon',
            html: `<div style="background-color: #e30a17; border-radius: 4px; width: 22px; height: 16px; border: 1px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 8px; font-weight: bold; box-shadow: 0 0 8px rgba(227,10,23,0.8);">TV</div>`,
            iconSize: [22, 16],
            iconAnchor: [11, 8]
          })
        });

        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 260px; padding: 4px;">
            <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #e30a17;">${tv.name}</h3>
            <p style="margin: 0 0 10px 0; font-size: 11px; color: #666;">${tv.desc}</p>
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 4px; background: #000;">
              <iframe src="${tv.url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          </div>
        `, { maxWidth: 320 });

        markers.push(marker);
      });

      // TRT Radyo Marker
      radios.forEach(s => {
        // @ts-ignore
        const marker = window.L.marker([s.geo_lat, s.geo_long], {
          // @ts-ignore
          icon: window.L.divIcon({
            className: 'custom-trt-radio-icon',
            html: `<div style="background-color: #1e3a8a; border-radius: 50%; width: 14px; height: 14px; border: 2px solid white; box-shadow: 0 0 6px rgba(30,58,138,0.6);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        });

        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 200px; padding: 4px;">
            <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #1e3a8a;">${s.name}</h3>
            <p style="margin: 0 0 10px 0; font-size: 11px; color: #666;">TRT Radyo İstasyonu</p>
            <audio controls src="${s.url_resolved}" style="width: 100%; height: 32px;" autoplay title="${s.name}"></audio>
            ${s.country ? `<div style="font-size: 9px; color: #999; margin-top: 6px; text-align: right;">${s.country}</div>` : ''}
          </div>
        `, { maxWidth: 300 });

        markers.push(marker);
      });

      // @ts-ignore
      layerGroupRef.current = window.L.featureGroup(markers);
      layerGroupRef.current.addTo(map);
    }

    return () => {
      if (layerGroupRef.current && map) {
        map.removeLayer(layerGroupRef.current);
      }
    };
  }, [radios, state.enabled, map]);

  return null;
}

// --- LIVEATC KATMANI (NATIVE) ---
const LiveAtcLayer: React.FC<{ id: string, map?: any }> = ({ id, map }) => {
  const { iframeLayers } = useLayerStore();
  const state = iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
  const layerGroupRef = useRef<any>(null);

  const LIVEATC_STATIONS = [
    { name: 'LTBA (Atatürk)', url: 'https://s1-fmt2.liveatc.net/ltba_s', lat: 40.9769, lng: 28.8146 },
    { name: 'LTFM TWR (İstanbul)', url: 'https://s1-fmt2.liveatc.net/ltfm1_twr', lat: 41.2594, lng: 28.7431 },
    { name: 'LTFM APP (İstanbul)', url: 'https://s1-bos.liveatc.net/ltfm1_app', lat: 41.2694, lng: 28.7531 },
    { name: 'LTAF (Adana)', url: 'https://s1-bos.liveatc.net/ltaf3', lat: 36.9822, lng: 35.2803 },
    { name: 'LTFJ (Sabiha Gökçen)', url: 'https://s1-fmt2.liveatc.net/ltfj2', lat: 40.8986, lng: 29.3092 },
    { name: 'LGAV (Atina)', url: 'https://s1-fmt2.liveatc.net/lgav2', lat: 37.9364, lng: 23.9445 },
    { name: 'LROP (Bükreş)', url: 'https://s1-fmt2.liveatc.net/lrop2', lat: 44.5711, lng: 26.0850 },
    { name: 'LRBV (Braşov)', url: 'https://s1-bos.liveatc.net/lrbv2', lat: 45.7062, lng: 25.5186 },
    { name: 'LRSB (Sibiu)', url: 'https://s1-bos.liveatc.net/lrsb2', lat: 45.7856, lng: 24.0914 },
    { name: 'LBSF (Sofya)', url: 'https://s1-bos.liveatc.net/lbsf1', lat: 42.6953, lng: 23.4078 },
    { name: 'LBSF TWR (Sofya)', url: 'https://s1-bos.liveatc.net/lbsf2_lbpd_twr', lat: 42.7053, lng: 23.4178 },
    { name: 'LBBG (Burgaz)', url: 'https://s1-bos.liveatc.net/lbbg2', lat: 42.5696, lng: 27.5152 },
    { name: 'LYNI (Niş)', url: 'https://s1-bos.liveatc.net/lyni2', lat: 43.3373, lng: 21.8538 },
    { name: 'LWSK (Üsküp)', url: 'https://s1-fmt2.liveatc.net/lwsk2_2', lat: 41.9575, lng: 21.6214 },
    { name: 'EYVI (Vilnius)', url: 'https://d.liveatc.net/redir.php/eyvi', lat: 54.6341, lng: 25.2858 },
    { name: 'EYVI APP', url: 'https://d.liveatc.net/redir.php/eyvi2_app', lat: 54.6441, lng: 25.2958 },
    { name: 'EYVI TWR', url: 'https://d.liveatc.net/redir.php/eyvi3_twr', lat: 54.6541, lng: 25.3058 },
    { name: 'EYVI ATIS', url: 'https://d.liveatc.net/redir.php/eyvi3_atis', lat: 54.6641, lng: 25.3158 },
    { name: 'EYVI FIS', url: 'https://d.liveatc.net/redir.php/eyvi3_fis', lat: 54.6741, lng: 25.3258 },
    { name: 'URSS (Soçi)', url: 'https://s1-fmt2.liveatc.net/urss', lat: 43.4499, lng: 39.9566 },
    { name: 'USTR (Tümen)', url: 'https://s1-bos.liveatc.net/ustr', lat: 57.1728, lng: 65.3183 },
    { name: 'UNNT (Novosibirsk)', url: 'https://s1-fmt2.liveatc.net/unnt', lat: 55.0125, lng: 82.6506 },
    { name: 'USDD (Salehard)', url: 'https://d.liveatc.net/redir.php/usdd1', lat: 66.5898, lng: 66.6023 },
    { name: 'LLHZ TWR (Herzliya)', url: 'https://s1-bos.liveatc.net/llhz2_twr', lat: 32.1802, lng: 34.8344 },
    { name: 'LLHZ GND', url: 'https://s1-bos.liveatc.net/llhz2_gnd', lat: 32.1902, lng: 34.8444 },
    { name: 'OKBK (Kuveyt)', url: 'https://s1-bos.liveatc.net/okbk2', lat: 29.2266, lng: 47.9689 },
    { name: 'OMDB TWR (Dubai)', url: 'https://d.liveatc.net/omdb_twr', lat: 25.2528, lng: 55.3644 },
    { name: 'EGLL TWR (Heathrow)', url: 'https://d.liveatc.net/egll_twr', lat: 51.4700, lng: -0.4543 },
    { name: 'EHAM TWR (Amsterdam)', url: 'https://d.liveatc.net/eham_twr', lat: 52.3081, lng: 4.7642 },
    { name: 'LPMA (Madeira)', url: 'https://d.liveatc.net/redir.php/lpma2', lat: 32.6970, lng: -16.7744 },
    { name: 'LPPC (Lizbon FIR)', url: 'https://d.liveatc.net/redir.php/lppc2', lat: 38.7256, lng: -9.3553 },
    { name: 'KJFK TWR (JFK)', url: 'https://d.liveatc.net/kjfk_twr', lat: 40.6413, lng: -73.7781 },
    { name: 'KJFK DEP', url: 'https://d.liveatc.net/kjfk_dep', lat: 40.6513, lng: -73.7881 },
    { name: 'KLAX TWR (LAX)', url: 'https://d.liveatc.net/klax_twr', lat: 33.9416, lng: -118.4085 },
    { name: 'KSFO TWR (SFO)', url: 'https://d.liveatc.net/ksfo_twr', lat: 37.6213, lng: -122.3790 },
    { name: 'KBOS TWR (Boston)', url: 'https://d.liveatc.net/kbos_twr', lat: 42.3656, lng: -71.0096 },
    { name: 'CYYZ TWR (Toronto)', url: 'https://d.liveatc.net/cyyz_twr', lat: 43.6777, lng: -79.6248 },
    { name: 'OPKC (Karaçi)', url: 'https://s1-bos.liveatc.net/opkc', lat: 24.9065, lng: 67.1608 },
    { name: 'OPLA ATIS (Lahor)', url: 'https://s1-bos.liveatc.net/opla_atis', lat: 31.5216, lng: 74.4036 },
    { name: 'RJTT TWR (Haneda)', url: 'https://d.liveatc.net/rjtt_twr', lat: 35.5494, lng: 139.7798 },
    { name: 'RJTT APP', url: 'https://d.liveatc.net/rjtt_app', lat: 35.5594, lng: 139.7898 },
    { name: 'RJTT DEP', url: 'https://d.liveatc.net/rjtt_dep', lat: 35.5694, lng: 139.7998 },
    { name: 'RJOO TWR (Osaka)', url: 'https://d.liveatc.net/rjoo_twr', lat: 34.7855, lng: 135.4382 },
    { name: 'YSSY TWR (Sidney)', url: 'https://d.liveatc.net/yssy_twr', lat: -33.9399, lng: 151.1753 },
    { name: 'HAAB TWR (Addis Ababa)', url: 'https://s1-bos.liveatc.net/haab2_twr', lat: 8.9778, lng: 38.7993 },
    { name: 'FIMP (Mauritius)', url: 'https://d.liveatc.net/redir.php/fimp2', lat: -20.4300, lng: 57.6830 },
    { name: 'FMMI (Antananarivo)', url: 'https://d.liveatc.net/redir.php/fmmi', lat: -18.7969, lng: 47.4788 },
    { name: 'FLKK (Lusaka)', url: 'https://d.liveatc.net/redir.php/flkk2', lat: -15.3300, lng: 28.3228 },
    { name: 'HF PAC (Pasifik Okyanusu)', url: 'https://d.liveatc.net/hf_pac', lat: 20.0000, lng: -160.0000 },
    { name: 'HF ATL (Atlantik Okyanusu)', url: 'https://d.liveatc.net/hf_atl', lat: 30.0000, lng: -40.0000 },
  ];

  useEffect(() => {
    if (!window.L || !map) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    if (state.enabled) {
      const markers = LIVEATC_STATIONS.map(s => {
        // @ts-ignore
        const marker = window.L.marker([s.lat, s.lng], {
          // @ts-ignore
          icon: window.L.divIcon({
            className: 'custom-liveatc-icon',
            html: `<div style="background-color: #059669; border-radius: 50%; width: 14px; height: 14px; border: 2px solid white; box-shadow: 0 0 6px rgba(5,150,105,0.6); display: flex; align-items: center; justify-content: center;"><span style="color:white; font-size:8px;">ATC</span></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        });

        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 220px; padding: 4px;">
            <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #059669;">${s.name}</h3>
            <p style="margin: 0 0 10px 0; font-size: 11px; color: #666;">LiveATC Telsiz Frekansı</p>
            <audio controls prestretch="none" src="${s.url}" style="width: 100%; height: 32px;" autoplay title="${s.name}"></audio>
          </div>
        `, { maxWidth: 300 });

        return marker;
      });

      // @ts-ignore
      layerGroupRef.current = window.L.featureGroup(markers);
      layerGroupRef.current.addTo(map);
    }

    return () => {
      if (layerGroupRef.current && map) {
        map.removeLayer(layerGroupRef.current);
      }
    };
  }, [state.enabled, map]);

  return null;
}

// --- KONTROL ARAYÜZÜ BİLEŞENLERİ ---
function ControlDashboard() {
  const store = useLayerStore();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hasMounted, setHasMounted] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [activePopover, setActivePopover] = useState<{ id: string, rect: DOMRect } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPos({ x: window.innerWidth > 360 ? window.innerWidth - 60 : window.innerWidth - 50, y: window.innerHeight / 2 - 200 });
    setHasMounted(true);
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button.nodrag') || target.tagName.toLowerCase() === 'input' || target.closest('.no-drag-area')) return;

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = pos.x;
    const startPosY = pos.y;

    const onMove = (moveEvent: PointerEvent) => {
      setPos({
        x: Math.min(Math.max(0, startPosX + (moveEvent.clientX - startX)), window.innerWidth - 40),
        y: Math.min(Math.max(0, startPosY + (moveEvent.clientY - startY)), window.innerHeight - 40)
      });
      setActivePopover(null);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    const handleResize = () => {
      setPos(p => ({
        x: Math.min(p.x, window.innerWidth - 40),
        y: Math.min(p.y, window.innerHeight - 40)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isHorizontal) {
        el.scrollLeft += e.deltaY;
      } else {
        el.scrollTop += e.deltaY;
      }
      setActivePopover(null);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isHorizontal]);

  if (!hasMounted) return null;

  const handleMouseEnter = (id: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActivePopover({ id, rect });
  };

  return (
    <>
      <div 
        className={`absolute z-[2000] flex ${isHorizontal ? 'flex-row items-center' : 'flex-col items-center'} gap-1 pointer-events-none`}
        style={{ left: pos.x, top: pos.y }}
      >
        {/* Core Controls */}
        <div className={`flex ${isHorizontal ? 'flex-row items-center' : 'flex-col items-center'} gap-1 pointer-events-auto shadow-sm bg-white border border-slate-200 rounded-sm p-0.5`}>
          {/* Drag Handle */}
          <div 
            onPointerDown={startDrag}
            className={`flex items-center justify-center text-slate-400 hover:text-[#0f3c5b] hover:bg-slate-100 transition-colors cursor-move ${isHorizontal ? 'w-4 h-10' : 'w-10 h-4'}`}
            title="Sürükle"
          >
            <GripHorizontal size={16} className={`pointer-events-none ${isHorizontal ? 'rotate-90' : ''}`} />
          </div>

          <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} gap-0.5`}>
            {/* Layout Toggle */}
            <button 
              onClick={() => { setIsHorizontal(!isHorizontal); setActivePopover(null); }}
              className="nodrag w-9 h-9 flex items-center justify-center text-[#0f3c5b] hover:bg-slate-100 transition-colors rounded-sm"
              title="Yatay/Dikey Düzen"
            >
              {isHorizontal ? <Columns size={16} /> : <Rows size={16} />}
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => store.setBasemapMode(store.basemapMode === 'dark' ? 'light' : 'dark')}
              className="nodrag w-9 h-9 flex items-center justify-center text-[#0f3c5b] hover:bg-slate-100 transition-colors rounded-sm"
              title="Harita Teması"
            >
              {store.basemapMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Base Map Toggle */}
            <button 
              onClick={() => store.toggleBasemap()}
              className={`nodrag w-9 h-9 flex items-center justify-center transition-colors rounded-sm ${store.basemapEnabled ? 'bg-[#0f3c5b] text-white' : 'text-[#0f3c5b] hover:bg-slate-100'}`}
              title="Temel Harita Katmanı"
            >
              <MapIcon size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Layer Toggles */}
        <div 
          ref={scrollRef}
          className={`bg-white shadow-md border border-slate-200 rounded-sm pointer-events-auto flex ${isHorizontal ? 'flex-row w-[50vw] max-w-[400px] overflow-x-auto overflow-y-hidden' : 'flex-col h-[50vh] max-h-[400px] overflow-y-auto overflow-x-hidden'} gap-0.5 scrollbar-hide no-drag-area`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {Object.keys(IFRAME_SOURCES).map((id) => {
            const state = store.iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
            const source = IFRAME_SOURCES[id];
            const Icon = source.icon;
            
            return (
              <div 
                key={id} 
                className={`relative flex items-center justify-center group flex-shrink-0 ${isHorizontal ? 'w-10 h-10' : 'w-10 h-10'}`}
                onMouseEnter={(e) => handleMouseEnter(id, e)}
                onMouseLeave={(e) => {
                   // if we leave directly to the popover window, we don't clear (handled via fixed container)
                   // But realistically, the mouse leaves the box.
                }}
              >
                <button 
                  onClick={() => store.toggleIframeLayer(id)}
                  className={`w-full h-full flex items-center justify-center transition-colors rounded-sm ${state?.enabled ? 'bg-[#0f3c5b] text-white' : 'bg-transparent text-[#0f3c5b] hover:bg-slate-100'}`}
                >
                  <Icon size={18} strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portal-like Fixed Tooltip/Settings Popover */}
      {activePopover && (() => {
        const id = activePopover.id;
        const rect = activePopover.rect;
        const source = IFRAME_SOURCES[id];
        const state = store.iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
        const hasSettings = state.enabled && source.type !== 'native';

        let popoverStyle: React.CSSProperties = {
          position: 'fixed' as const,
          zIndex: 3000,
        };

        if (isHorizontal) {
           popoverStyle.bottom = window.innerHeight - rect.top + 8; // display above
           popoverStyle.left = rect.left + rect.width / 2;
           popoverStyle.transform = 'translateX(-50%)';
        } else {
           popoverStyle.top = rect.top + rect.height / 2;    // display on the left
           popoverStyle.right = window.innerWidth - rect.left + 8;
           popoverStyle.transform = 'translateY(-50%)';
        }

        return (
          <div 
            className="fixed inset-0 pointer-events-none z-[3000]"
            onMouseMove={(e) => {
               // detect if we moved too far from rect and popover
               if (e.clientX < rect.left - 250 || e.clientX > rect.right + 250 || e.clientY < rect.top - 250 || e.clientY > rect.bottom + 250) {
                 setActivePopover(null);
               }
            }}
          >
            <div 
               style={popoverStyle} 
               className="pointer-events-auto"
               onMouseLeave={() => setActivePopover(null)}
            >
              {hasSettings ? (
                <div className="bg-white/95 backdrop-blur shadow-2xl border border-slate-200 rounded p-4 flex flex-col gap-4 w-56 font-sans">
                   <div className="text-xs font-bold text-[#0f3c5b] border-b border-slate-200 pb-2 truncate">{source.name}</div>
                   <div className="space-y-2">
                     <div className="flex justify-between text-[10px] font-bold text-slate-500">
                       <span>OPAKLIK</span>
                       <span>%{Math.round(state.opacity * 100)}</span>
                     </div>
                     <input 
                       type="range" 
                       min="0.1" 
                       max="1.0" 
                       step="0.05"
                       value={state.opacity}
                       onChange={(e) => store.setIframeOpacity(id, e.target.value)}
                       className="w-full accent-[#0f3c5b] bg-slate-200 h-1.5 rounded appearance-none cursor-pointer"
                     />
                   </div>
                   <button 
                     onClick={() => store.toggleIframeInteractivity(id)}
                     className={`w-full text-[10px] font-bold px-3 py-2 rounded transition-colors ${
                       state.interactive 
                         ? 'bg-[#0f3c5b] text-white shadow-sm' 
                         : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                     }`}
                   >
                     {state.interactive ? 'ETKİLEŞİM AKTİF' : 'ETKİLEŞİM PASİF'}
                   </button>
                </div>
              ) : (
                <div className="bg-slate-800 text-white px-2.5 py-1.5 text-[11px] rounded shadow-xl whitespace-nowrap font-sans font-medium">
                  {source.name}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

// --- ANA GİRİŞ NOKTASI ---
export default function App() {
  return (
    <main className="w-screen h-screen relative overflow-hidden bg-slate-950">
      
      {/* Taktik Harita Bölümü */}
      <MapComponent>
        {Object.keys(IFRAME_SOURCES).map((id) => {
          if (IFRAME_SOURCES[id].type === 'native') return null;
          return <IframeOverlay key={id} id={id} />;
        })}
        <RadioLayer id="radio" />
        <TrtLayer id="trt" />
        <LiveAtcLayer id="liveatc" />
      </MapComponent>

      {/* Kontrol Dashboard'u */}
      <ControlDashboard />
    </main>
  );
}

