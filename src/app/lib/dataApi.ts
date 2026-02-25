// ─────────────────────────────────────────────
// Data Import (adapted to real backend endpoints)
// ─────────────────────────────────────────────

export interface ImportLogEntry {
  id: string;
  file_type: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'success' | 'partial' | 'failed';
  row_count: number;
  success_count: number;
  error_count: number;
  error_details: Array<{ row?: number; error: string }>;
  started_at: string;
  completed_at?: string | null;
  // Ajoute d'autres champs si besoin (company_name, imported_by_username, etc.)
}

export interface ImportResult {
  message: string;
  import_log: ImportLogEntry;
  result: {
    file_type: string;
    total_rows: number;
    created: number;
    updated: number;
    errors: string[];
  };
}

export interface DetectResult {
  filename: string;
  detected_file_type: string;
  headers: string[];
  preview_rows: Record<string, string>[];
  total_rows_estimate?: number | null;
}

export const dataImportApi = {
  /**
   * Upload Excel file + process import
   * POST /api/import/upload/
   */
  uploadFile: async (
    file: File,
    options: {
      file_type?: string;           // optional override
      snapshot_date?: string;       // YYYY-MM-DD
      report_date?: string;         // YYYY-MM-DD
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.file_type) formData.append('file_type', options.file_type);
    if (options.snapshot_date) formData.append('snapshot_date', options.snapshot_date);
    if (options.report_date) formData.append('report_date', options.report_date);

    const token = localStorage.getItem('fasi_access_token'); // ou ton nom de clé token

    const response = await fetch('/api/import/upload/', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      // Important : NE PAS mettre Content-Type manuellement → le navigateur le gère pour FormData
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Network or server error' };
      }
      throw new Error(errorData.message || errorData.error || `Upload failed (${response.status})`);
    }

    return response.json();
  },

  /**
   * Detect file type + get preview (first rows)
   * POST /api/import/detect/
   */
  detectFile: async (file: File): Promise<DetectResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('fasi_access_token');

    const response = await fetch('/api/import/detect/', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Detection failed');
    }

    return response.json();
  },

  /**
   * Get list of previous imports (logs)
   * GET /api/import/logs/
   */
  getImportLogs: async (params?: { file_type?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const url = `/api/import/logs/${query ? `?${query}` : ''}`;

    const token = localStorage.getItem('fasi_access_token');
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json(); // { count: number, logs: ImportLogEntry[] }
  },

  // Optionnel : Download template (si tu implémentes cet endpoint côté backend plus tard)
  downloadTemplate: async (type: string) => {
    // Exemple si tu ajoutes un endpoint /api/import/template/<type>/
    const token = localStorage.getItem('fasi_access_token');
    const response = await fetch(`/api/import/template/${type}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Template download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-import-template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};