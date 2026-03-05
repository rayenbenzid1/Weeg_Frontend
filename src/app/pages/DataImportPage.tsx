import { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Download, Users, GitBranch, Clock, Package, ArrowLeftRight } from 'lucide-react';
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
import { Badge } from '../components/ui/badge';
import { dataImportApi, ImportResult, DetectResult } from '../lib/dataApi';
import axios from 'axios';
import * as XLSX from 'xlsx';

// ─── Template definitions mapped to your actual Excel files ───────────────────
// exactHeaders = the real Arabic column headers as they appear in the source files
const templates = [
  {
    id: 'customers',
    title: 'العملاء',
    titleEn: 'Customers',
    description: 'Import customer data and their detailed information',
    fileName: 'العملاء.xlsx',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    columns: ['Customer Name', 'Account Code', 'Detailed Address', 'Region Code', 'Phone Number', 'Email'],
    exactHeaders: ['اسم العميل', 'رمز الحساب', 'العنوان التفصيلي', 'رمز المنطقة', 'رقم الهاتف1', 'بريد الكتروني'],
    role: ['agent', 'manager'],
  },
  {
    id: 'branches',
    title: 'الفروع',
    titleEn: 'Branches',
    description: 'Import branch data and their locations',
    fileName: 'فروع.xlsx',
    icon: GitBranch,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    columns: ['Branch', 'Address / Location', 'Phone Number'],
    exactHeaders: ['الفرع', 'العنوان / الموقع', 'رقم الهاتف'],
    role: ['agent', 'manager'],
  },
  {
    id: 'aging',
    title: 'أعمار الذمم',
    titleEn: 'Aging of Receivables',
    description: 'Import aging receivables report with time-based distribution',
    fileName: 'أعمار_الذمم.xlsx',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    columns: ['#', 'Account', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '…', 'Over 330 Days', 'Total'],
    exactHeaders: ['#', 'الحساب', 'الحالي', '1-30 يوم', '31-60 يوم', '61-90 يوم', '91-120 يوم', '121-150 يوم', '151-180 يوم', '181-210 يوم', '211-240 يوم', '241-270 يوم', '271-300 يوم', '301-330 يوم', 'أكثر من 330 يوم', 'المجموع'],
    role: ['agent', 'manager'],
  },
  {
    id: 'inventory',
    title: 'الجرد الأفقي',
    titleEn: 'Year-End Inventory',
    description: 'Import year-end inventory with quantities and values per branch',
    fileName: 'جرد_افقي_نهاية_السنة.xlsx',
    icon: Package,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    columns: ['Index', 'Item Code', 'Item Name', 'Quantities (per branch)', 'Values (per branch)', 'Total Quantity', 'Price', 'Total Value'],
    exactHeaders: ['الفهرس', 'رمز المادة', 'اسم المادة', 'فرع الكريمية', 'مخزن بنغازي', 'مخزن المزرعة', 'قيمة   مخزن   المزرعة  ', 'مخزن صالة عرض الدهماني', 'قيمة   فرع  الدهماني  ', 'مخزن صالة عرض جنزور', 'قيمة   فرع  جنزور ', 'مخزن صالة عرض مصراتة', 'قيمة   جرد   فرع  الكريمية  ', 'قيمة   فرع   مصراتة ', 'إجمالي كمية (الوحدة الافتراضية)', 'السعر (كلفة الشركة)', 'إجمالي قيمة'],
    role: ['agent', 'manager'],
  },
  {
    id: 'movements',
    title: 'حركة المادة',
    titleEn: 'Stock Movements',
    description: 'Import item movements including inputs, outputs and balances',
    fileName: 'حركة_المادة.xlsx',
    icon: ArrowLeftRight,
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800',
    columns: ['Index', 'Item Code', 'Item Name', 'Date', 'Input Qty', 'Input Price', 'Output Qty', 'Output Price', 'Balance Price', 'Branch', 'Customer'],
    exactHeaders: ['الفهرس', 'رمز  المادة', 'رمز المعمل', 'اسم   المادة', 'تاريخ', 'حركة.1', 'كمية  الادخلات', 'سعر  الادخلات', 'اجمالي  الادخلات', 'كمية  الاخراجات', 'سعر  الاخراجات', 'اجمالي   الاخراجات', 'سعر  الرصيد', 'الفرع', 'العميل'],
    role: ['agent', 'manager'],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function DataImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<DetectResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const userRole = 'manager'; // Replace with real role from auth context

  const handleDownloadTemplate = (e: React.MouseEvent, template: typeof templates[0]) => {
    e.stopPropagation();
    setDownloadingId(template.id);

    try {
      // Build worksheet with exact Arabic headers + 3 empty example rows
      const ws = XLSX.utils.aoa_to_sheet([template.exactHeaders]);

      // Style: freeze top row so headers stay visible while scrolling
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      // Set column widths based on header length
      ws['!cols'] = template.exactHeaders.map((h) => ({
        wch: Math.max(h.length + 4, 14),
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');

      // Trigger browser download
      XLSX.writeFile(wb, template.fileName);
    } catch (err) {
      console.error('Template generation failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

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
    <div className="space-y-8 p-6" >
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
              ${isUploading
                ? 'opacity-60 pointer-events-none border-gray-300'
                : 'hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20'
              }`}
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
                        <TableCell key={colIndex} className="">
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
          <CardDescription>
            Ready-to-use Excel import templates — click any template to view required columns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const canDownload = template.role.includes(userRole);
              const IconComponent = template.icon;
              const isExpanded = expandedTemplate === template.id;

              return (
                <Card
                  key={template.id}
                  className={`transition-all overflow-hidden border ${template.border}
                    ${!canDownload ? 'opacity-55' : 'hover:shadow-md cursor-pointer'}
                    ${isExpanded ? 'ring-2 ring-indigo-500' : ''}
                  `}
                  onClick={() =>
                    canDownload &&
                    setExpandedTemplate(isExpanded ? null : template.id)
                  }
                >
                  <CardContent className="pt-6 pb-4">
                    <div className="flex flex-col items-center text-center gap-3">
                      {/* Icon */}
                      <div className={`p-3 rounded-full ${template.bg}`}>
                        <IconComponent className={`h-6 w-6 ${template.color}`} />
                      </div>

                      {/* Titles */}
                      <div>
                        <h4 className="font-bold text-base">{template.title}</h4>
                        <p className="text-xs text-muted-foreground">{template.titleEn}</p>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground min-h-[40px]">
                        {template.description}
                      </p>

                      {/* File name badge */}
                      <Badge variant="secondary" className="text-xs font-mono truncate max-w-full">
                        {template.fileName}
                      </Badge>

                      {/* Columns (expandable) */}
                      {isExpanded && (
                        <div className="w-full mt-2 border-t pt-3 space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            Required columns:
                          </p>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {template.columns.map((col, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {col}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Download button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className={`mt-2 w-full ${template.color} border-current`}
                        disabled={!canDownload || downloadingId === template.id}
                        onClick={(e) => handleDownloadTemplate(e, template)}
                      >
                        {downloadingId === template.id ? (
                          <>
                            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}