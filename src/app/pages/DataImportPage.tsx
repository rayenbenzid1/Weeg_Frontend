import { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { dataImportApi, ImportResult, DetectResult } from '../lib/dataApi'; // adjust path if needed
import axios from 'axios';

const templates = [
  {
    id: 'sales',
    title: 'Sales Template',
    description: 'Import sales transactions and invoices',
    icon: '📄',
    role: ['agent', 'manager'],
  },
  {
    id: 'purchases',
    title: 'Purchases Template',
    description: 'Import purchase orders and supplier invoices',
    icon: '📄',
    role: ['manager'],
  },
  {
    id: 'stock',
    title: 'Stock Movements Template',
    description: 'Import inventory movements and transfers',
    icon: '📄',
    role: ['agent', 'manager'],
  },
  {
    id: 'customers',
    title: 'Customer Balances Template',
    description: 'Import customer account balances',
    icon: '📄',
    role: ['manager'],
  },
  {
    id: 'exchange',
    title: 'Exchange Rates Template',
    description: 'Import currency exchange rates',
    icon: '📄',
    role: ['manager'],
  },
];

export function DataImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<DetectResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userRole = 'manager'; // Replace with real role from auth context

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      setErrorMsg('Only .xlsx and .xls files are accepted');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
    setPreviewData(null);
    setUploadResult(null);
    setUploadProgress(0);

    try {
      const detect = await dataImportApi.detectFile(file);
      setPreviewData(detect);
    } catch (err: any) {
      setErrorMsg(err.message || 'File detection failed');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMsg(null);
    setUploadResult(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Optional: force file type or add metadata
      // formData.append('file_type', 'movements');
      // formData.append('snapshot_date', '2025-12-31');

      const token = localStorage.getItem('fasi_access_token');

      const response = await axios.post<ImportResult>(
        '/api/import/upload/',
        formData,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percent);
            }
          },
        }
      );

      setUploadResult(response.data);
      setUploadProgress(100);
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Import failed';
      setErrorMsg(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const hasPreview = previewData && previewData.preview_rows.length > 0;

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Import Center</h1>
        <p className="text-muted-foreground mt-2">
          Upload Excel files to bring your business data into the system
        </p>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>
            Drag and drop your Excel file or click to browse (.xlsx / .xls)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
              ${isUploading ? 'opacity-60 pointer-events-none border-gray-300' : 'hover:border-indigo-500 hover:bg-indigo-50/30'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChange(e.dataTransfer.files[0] || null);
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="flex flex-col items-center gap-5">
              <Upload className="h-14 w-14 text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="text-xl font-semibold">Drop your Excel file here</p>
                <p className="text-sm text-muted-foreground mt-2">
                  or click to browse (recommended max 10 MB)
                </p>
              </div>
              <Button disabled={isUploading} size="lg">
                Browse Files
              </Button>
            </div>

            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
          </div>

          {selectedFile && (
            <div className="mt-5 text-center text-sm">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}

          {errorMsg && (
            <Alert variant="destructive" className="mt-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {isUploading && (
            <div className="mt-8 space-y-3">
              <Progress value={uploadProgress} className="h-2.5" />
              <p className="text-center text-sm text-muted-foreground font-medium">
                {uploadProgress}% — Processing...
              </p>
            </div>
          )}

          {uploadResult && (
            <Alert className="mt-6 border-green-600 bg-green-50 dark:bg-green-950/40">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <p className="font-semibold">{uploadResult.message}</p>
                <p className="mt-1">
                  Imported rows: {uploadResult.result.created + uploadResult.result.updated}
                  {uploadResult.result.errors.length > 0 && (
                    <> • Errors: {uploadResult.result.errors.length}</>
                  )}
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-8 flex justify-center gap-4">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              size="lg"
              className="min-w-[160px]"
            >
              {isUploading ? 'Importing...' : 'Start Import'}
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setSelectedFile(null);
                setPreviewData(null);
                setErrorMsg(null);
                setUploadResult(null);
                setUploadProgress(0);
              }}
              disabled={isUploading}
            >
              Cancel / Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File Preview */}
      {hasPreview && (
        <Card>
          <CardHeader>
            <CardTitle>File Preview</CardTitle>
            <CardDescription>
              Detected type: <strong>{previewData.detected_file_type}</strong> •{' '}
              {previewData.preview_rows.length} preview rows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    {previewData.headers.map((header, i) => (
                      <TableHead key={i} className="whitespace-nowrap">
                        {header || `Column ${i + 1}`}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.preview_rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {previewData.headers.map((header, colIndex) => (
                        <TableCell key={colIndex}>
                          {row[header] ?? row[`Column ${colIndex + 1}`] ?? '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Download Templates</CardTitle>
          <CardDescription>Ready-to-use Excel import templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => {
              const canDownload = template.role.includes(userRole);
              return (
                <Card
                  key={template.id}
                  className={`transition-all ${!canDownload ? 'opacity-55' : 'hover:shadow-md'}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="text-4xl">{template.icon}</div>
                      <h4 className="font-semibold">{template.title}</h4>
                      <p className="text-sm text-muted-foreground min-h-[40px]">
                        {template.description}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full sm:w-auto"
                        disabled={!canDownload}
                        // onClick={() => dataImportApi.downloadTemplate(template.id)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Optional: Data Processing Pipeline visual */}
      {/* You can keep it or remove it – it's purely decorative */}
      {/* ... */}
    </div>
  );
}