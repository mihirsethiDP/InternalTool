export type Role = 'viewer' | 'uploader' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface SensorCategory {
  id: string;
  name: string;
  group: string | null;
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
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface DocumentType {
  id: string;
  key: string;
  label: string;
  sort_order: number;
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

export interface SearchHit {
  document_id: string;
  document_title: string;
  type_label: string | null;
  plant_name: string | null;
  sensor_model_no: string | null;
  sensor_make: string | null;
  page_number: number | null;
  snippet: string;
  rank: number;
}
