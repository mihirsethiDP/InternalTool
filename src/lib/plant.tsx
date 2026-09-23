import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { Plant, PlantDevice } from './types';

// The plant the person is standing at. Everything downstream — the chat's
// "which make & model?" question, the Home chips, the register page — reads
// this instead of asking. Order of truth: what they picked this session
// (localStorage) → their home plant (profile) → nothing.
//
// Deliberately NOT a permission boundary: an internal tool, and field
// engineers move between sites. Anyone can switch to any plant.

const LS_KEY = 'dp:plant';

export interface PlantContextValue {
  plants: Plant[];
  loading: boolean;
  plant: Plant | null;
  setPlant: (id: string | null) => void;
}

const PlantContext = createContext<PlantContextValue>({ plants: [], loading: true, plant: null, setPlant: () => {} });

function readStored(): string | null {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}

export function PlantProvider({ children }: { children: ReactNode }) {
  const { profile, userId } = useAuth();
  const [picked, setPicked] = useState<string | null>(() => readStored());

  const list = useQuery({
    queryKey: ['plants-active'],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('plants').select('id, name, code, client, status, location, notes, created_at').eq('status', 'active').order('name');
      if (error) throw error;
      return (data ?? []) as Plant[];
    },
  });

  // First sign-in on this device: adopt the home plant.
  useEffect(() => {
    if (picked === null && profile?.home_plant_id) setPicked(profile.home_plant_id);
  }, [profile?.home_plant_id, picked]);

  const value = useMemo<PlantContextValue>(() => {
    const plants = list.data ?? [];
    const plant = plants.find((p) => p.id === picked) ?? null;
    return {
      plants,
      loading: list.isLoading,
      plant,
      setPlant: (id) => {
        setPicked(id);
        try { if (id) localStorage.setItem(LS_KEY, id); else localStorage.removeItem(LS_KEY); } catch { /* private mode */ }
      },
    };
  }, [list.data, list.isLoading, picked]);

  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>;
}

export function usePlant() { return useContext(PlantContext); }

// The device register of one plant, joined to make / model / category.
export function usePlantDevices(plantId: string | null | undefined) {
  return useQuery({
    queryKey: ['plant-devices', plantId],
    enabled: Boolean(plantId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plant_sensors')
        .select('id, plant_id, sensor_model_id, category_id, quantity, tags, notes, source, is_assumption, sensor_models(id, model_no, name, is_general, category_id, sensor_makes(id, name)), sensor_categories(id, name, domain)')
        .eq('plant_id', plantId!)
        .order('quantity', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizeDevice);
    },
  });
}

// PostgREST returns embeds as object-or-array depending on the FK shape;
// flatten once here so no page has to care.
function one<T>(v: T | T[] | null | undefined): T | null { return Array.isArray(v) ? (v[0] ?? null) : (v ?? null); }
export function normalizeDevice(row: any): PlantDevice {
  const model = one<any>(row.sensor_models);
  const make = one<any>(model?.sensor_makes);
  const cat = one<any>(row.sensor_categories);
  return {
    id: row.id,
    plant_id: row.plant_id,
    sensor_model_id: row.sensor_model_id,
    category_id: row.category_id ?? model?.category_id ?? null,
    quantity: row.quantity ?? 1,
    tags: row.tags ?? [],
    notes: row.notes ?? null,
    source: row.source ?? 'manual',
    is_assumption: Boolean(row.is_assumption),
    model_no: model?.model_no ?? '',
    model_name: model?.name ?? null,
    make_id: make?.id ?? null,
    make_name: make?.name ?? '',
    category_name: cat?.name ?? '',
    domain: (cat?.domain === 'electronics' ? 'electronics' : 'sensor'),
  };
}

export function deviceLabel(d: Pick<PlantDevice, 'make_name' | 'model_no' | 'model_name'>): string {
  return `${d.make_name} ${d.model_no || d.model_name || ''}`.trim();
}

// Devices at a plant in one category — what the chat consults before asking
// "which make & model?". Returns [] when the plant has nothing on record.
export async function devicesInCategory(plantId: string, categoryId: string): Promise<PlantDevice[]> {
  const { data, error } = await supabase
    .from('plant_sensors')
    .select('id, plant_id, sensor_model_id, category_id, quantity, tags, notes, source, is_assumption, sensor_models(id, model_no, name, is_general, category_id, sensor_makes(id, name)), sensor_categories(id, name, domain)')
    .eq('plant_id', plantId)
    .eq('category_id', categoryId)
    .order('quantity', { ascending: false });
  if (error) return [];
  return (data ?? []).map(normalizeDevice);
}

// The master list names categories tersely ("Flow", "Level"); an operator says
// "flow meter" and "level transmitter". Used for suggestions and plant notes.
const NOUNS: Record<string, string> = {
  'Flow': 'flow meter', 'Level': 'level transmitter', 'Pressure': 'pressure transmitter', 'pH': 'pH sensor',
  'Turbidity': 'turbidity sensor', 'Energy Meter': 'energy meter', 'Temperature': 'temperature sensor',
  'Dissolved Oxygen (DO)': 'DO sensor', 'TSS / MLSS': 'MLSS sensor', 'BOD': 'BOD analyser', 'COD': 'COD analyser',
  'Biomass Health': 'biomass health tracker', 'Bar Screen Level': 'bar screen sensor',
  'Switches (Float / Level / Pressure / Flow)': 'level switch', 'Chlorine': 'chlorine analyser', 'ORP': 'ORP sensor',
  'TDS': 'TDS sensor', 'Conductivity / EC': 'EC sensor', 'Proximity': 'proximity sensor', 'Air Flow': 'air flow meter',
  'UPS': 'UPS', 'Camera': 'camera', 'Datalogger': 'datalogger', 'PLC': 'PLC', 'VFD': 'VFD', 'HMI': 'HMI',
};
export function deviceNoun(categoryName: string | null | undefined): string {
  const n = (categoryName ?? '').trim();
  if (!n) return 'device';
  if (NOUNS[n]) return NOUNS[n];
  const bare = n.replace(/s*(.*)$/, '');
  return /sensor|meter|transmitter|analy|switch|camera|logger|ups/i.test(bare) ? bare.toLowerCase() : bare.toLowerCase() + ' sensor';
}

