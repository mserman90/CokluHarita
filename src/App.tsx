import React, { useState, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Layers, Globe, Sun, Moon, Activity, 
  Plane, Rocket, Ship, Anchor, Train, 
  Wind, RadioTower, TriangleAlert, Flame,
  ChevronRight, Map as MapIcon, Car, GripHorizontal
} from 'lucide-react';

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

const IFRAME_SOURCES: Record<string, { name: string; icon: React.ElementType; getSrc: (lat: string | number, lng: string | number, z: number) => string }> = {
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
function IframeOverlay({ id, map }: { id: string, map?: any }) {
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

// --- KONTROL ARAYÜZÜ BİLEŞENLERİ ---
function ControlDashboard() {
  const store = useLayerStore();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setPos({ x: window.innerWidth > 360 ? window.innerWidth - 60 : window.innerWidth - 50, y: window.innerHeight / 2 - 200 });
    setHasMounted(true);
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button.nodrag') || target.tagName.toLowerCase() === 'input') return;

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

  if (!hasMounted) return null;

  return (
    <div 
      className="absolute z-[2000] flex flex-col gap-1 items-end pointer-events-none pb-10"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag Handle */}
      <div 
        onPointerDown={startDrag}
        className="w-10 h-6 bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-[#0f3c5b] hover:bg-slate-100 transition-colors border border-slate-200 rounded-sm mb-1 cursor-move pointer-events-auto"
        title="Sürükle"
      >
        <GripHorizontal size={16} className="pointer-events-none" />
      </div>

      {/* Theme Toggle */}
      <div className="relative group pointer-events-auto mb-2">
        <button 
          onClick={() => store.setBasemapMode(store.basemapMode === 'dark' ? 'light' : 'dark')}
          className="nodrag w-10 h-10 bg-white shadow-sm flex items-center justify-center text-[#0f3c5b] hover:bg-slate-100 transition-colors border border-slate-200 rounded-sm"
        >
          {store.basemapMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="absolute right-full top-0 pr-2 h-full flex items-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          <div className="bg-slate-800 text-white px-2.5 py-1.5 text-[11px] rounded shadow-md whitespace-nowrap font-sans font-medium">
            Harita Teması
          </div>
        </div>
      </div>

      {/* Base Map */}
      <div className="relative flex items-center justify-end pointer-events-auto group mb-2">
        <button 
          onClick={() => store.toggleBasemap()}
          className={`w-10 h-10 flex items-center justify-center shadow-sm transition-colors border border-slate-200 rounded-sm ${store.basemapEnabled ? 'bg-[#0f3c5b] text-white border-transparent' : 'bg-white text-[#0f3c5b] hover:bg-slate-100'}`}
        >
          <MapIcon size={20} />
        </button>
        <div className="absolute right-full top-0 pr-2 h-full flex items-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          <div className="bg-slate-800 text-white px-2.5 py-1.5 text-[11px] rounded shadow-md whitespace-nowrap font-sans font-medium hover:invisible">
            Temel Harita Katmanı
          </div>
        </div>
      </div>

      {/* Layer Toggles */}
      <div className="w-10 flex flex-col gap-0.5 bg-white shadow-md border border-slate-200 rounded-sm pointer-events-auto overflow-visible">
        {Object.keys(IFRAME_SOURCES).map((id) => {
          const state = store.iframeLayers[id] || { enabled: false, opacity: 0.75, interactive: false };
          const source = IFRAME_SOURCES[id];
          const Icon = source.icon;
          
          return (
            <div key={id} className="relative flex items-center justify-center group w-full h-10">
              
              {/* Settings Popover (When Enabled) */}
              {state?.enabled ? (
                <div className="absolute right-full top-1/2 -translate-y-1/2 pr-3 flex items-start opacity-0 group-hover:opacity-100 hover:opacity-100 transition-[opacity,transform] duration-200 z-[3000] pointer-events-none group-hover:pointer-events-auto origin-right scale-95 group-hover:scale-100">
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
                </div>
              ) : (
                /* Tooltip (When Disabled) */
                <div className="absolute right-full top-0 pr-2 h-full flex items-center opacity-0 group-hover:opacity-100 hover:opacity-100 pointer-events-none transition-opacity z-[3000]">
                  <div className="bg-slate-800 text-white px-2.5 py-1.5 text-[11px] rounded shadow-xl whitespace-nowrap font-sans font-medium">
                    {source.name}
                  </div>
                </div>
              )}

              <button 
                onClick={() => store.toggleIframeLayer(id)}
                className={`w-full h-full flex items-center justify-center transition-colors ${state?.enabled ? 'bg-[#0f3c5b] text-white' : 'bg-transparent text-[#0f3c5b] hover:bg-slate-100'}`}
              >
                <Icon size={20} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- ANA GİRİŞ NOKTASI ---
export default function App() {
  return (
    <main className="w-screen h-screen relative overflow-hidden bg-slate-950">
      
      {/* Taktik Harita Bölümü */}
      <MapComponent>
        {Object.keys(IFRAME_SOURCES).map((id) => (
          <IframeOverlay key={id} id={id} />
        ))}
      </MapComponent>

      {/* Kontrol Dashboard'u */}
      <ControlDashboard />
    </main>
  );
}

