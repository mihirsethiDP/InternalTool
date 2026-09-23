export type Role = 'viewer' | 'uploader' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_super?: boolean;
  technical_level?: 'non_technical' | 'technical';
  // The plant this person usually works at (migration 051). The header
  // switcher overrides it per device; see lib/plant.tsx.
  home_plant_id?: string | null;
  created_at: string;
}

// 'sensor' | 'electronics' — the only thing that separates a UPS from a pH
// probe in this tool is this column (migration 051).
export type DeviceDomain = 'sensor' | 'electronics';

export interface SensorCategory {
  id: string;
  name: string;
  group: string | null;
  aliases?: string[];
  domain?: DeviceDomain;
}

export interface SensorMake {
  id: string;
  name: string;
}

export interface SensorModel {
  id: string;
  make_id: string;
  category_id: string;
  model_no: string;
  name: string | null;
  specs: string | null;
  technical_details: string | null;
  suitability: string | null;
  vendor_url: string | null;
  datasheet_url: string | null;
  list_price: number | null;
  created_at: string;
}

export interface PLC {
  id: string;
  make: string;
  model_no: string;
  name: string | null;
  specs: string | null;
  technical_details: string | null;
  suitability: string | null;
  vendor_url: string | null;
  list_price: number | null;
  created_at: string;
}

export interface Plant {
  id: string;
  name: string;
  // Short site code from the tags (":GD", ":ADA"). Null until imported.
  code?: string | null;
  client?: string | null;
  status?: 'active' | 'discontinued';
  location: string | null;
  notes: string | null;
  created_at: string;
}

// One row of a plant’s device register (plant_sensors, flattened by
// lib/plant.tsx normalizeDevice). Grain: one row per (plant, make/model).
export interface PlantDevice {
  id: string;
  plant_id: string;
  sensor_model_id: string;
  category_id: string | null;
  quantity: number;
  tags: string[];
  notes: string | null;
  source: 'register' | 'rule' | 'manual';
  // "fleet-commonest make, not a nameplate reading" — say so, don’t assert.
  is_assumption: boolean;
  model_no: string;
  model_name: string | null;
  make_id: string | null;
  make_name: string;
  category_name: string;
  domain: DeviceDomain;
}

export type DocumentScope = 'general' | 'plant' | 'plant_sensor' | 'plant_with_sensor_refs';

export interface DocumentType {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  scope: DocumentScope;
}

export interface Equipment {
  id: string;
  plant_id: string;
  name: string;
  notes: string | null;
}

export interface DocumentRow {
  id: string;
  title: string;
  type_id: string;
  plant_id: string | null;
  sensor_model_id: string | null;
  plc_id: string | null;
  storage_path: string | null;
  vendor_url: string | null;
  uploaded_by: string;
  uploaded_at: string;
  page_count: number | null;
  size_bytes: number | null;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';
// Output activity-category sections of a consolidated reference (the 8 MECE
// activity categories + an 'other' catch-all). Distinct from a document's
// input form (document_types).
export type SubmissionSection =
  | 'install_commission' | 'configure' | 'inspect' | 'clean' | 'calibrate'
  | 'replace' | 'troubleshoot_repair' | 'maintenance_planning' | 'other'
  // Sections are DATA (document_types rows): an admin can add one in the UI,
  // and it must flow through the same code paths as the built-ins above.
  | (string & {});

export interface DocumentSubmission {
  id: string;
  title: string;
  type_id: string | null;
  sensor_model_id: string | null;
  storage_path: string | null;
  vendor_url: string | null;
  size_bytes: number | null;
  page_count: number | null;
  extracted_text: string | null;
  uploaded_by: string;
  uploaded_at: string;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  decision: 'replace_section' | 'append_section' | 'rejected' | null;
  target_section: SubmissionSection | null;
}

export interface SearchHit {
  document_id: string;
  document_title: string;
  type_label: string | null;
  plant_name: string | null;
  equipment_name: string | null;
  sensor_model_no: string | null;
  sensor_make: string | null;
  page_number: number | null;
  snippet: string;
  rank: number;
}
