// Types for the Takeoffs application

export interface Equipment {
  type: string;
  tag_prefix: string;
  is_typical: boolean;
  tags: string[];
  page?: number;
  bbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
}

export interface Location {
  type: string;
  tag: string;
  page: number;
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
  confidence: number;
}

export interface PageInfo {
  width: number;
  height: number;
}

export interface ScheduleUploadResult {
  filename: string;
  equipment: Equipment[] | string;
  scheduleId: string;
  imageCount: number;
  text: string;
  images?: string[];
}

export interface PlansUploadResult {
  filename: string;
  locations: Location[] | string;
  pdfId: string;
  pageInfo: PageInfo[];
  pageCount: number;
  modelUsed: string;
}

export interface ExportRequest {
  pdfId: string;
  locations: Location[] | string;
  reviewStatus?: Record<string, 'correct' | 'incorrect' | 'duplicate' | 'manual'>;
  equipmentList?: Equipment[];
}

export interface VisualExamples {
  image: string; // Base64 encoded image
  examples: Array<{
    name: string;
    bbox: [number, number, number, number];
  }>;
}

export interface SSEEvent {
  status: 'connected' | 'processing' | 'complete' | 'error';
  message?: string;
  step?: string;
  result?: ScheduleUploadResult | PlansUploadResult;
}
