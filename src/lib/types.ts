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
// Output WORK-TYPE sections of a consolidated reference (the 14-category
// maintenance/diagnostic taxonomy + 'other'). Distinct from a document's
// input form (document_types).
export type SubmissionSection =
  | 'troubleshooting' | 'cleaning' | 'calibration' | 'verification' | 'inspection'
  | 'electrical' | 'configuration' | 'consumable' | 'component' | 'preventive'
  | 'corrective' | 'data_quality' | 'install_improve' | 'software' | 'other';

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
