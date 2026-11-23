import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  UploadCloud,
  FolderTree,
  Folder,
  FileImage,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  StorageSettings,
  UpdateStorageSettingsRequest,
  TestConnectionResponse,
  UploadResult,
} from '../../types/storage';
import {
  fetchStorageSettings,
  updateStorageSettings,
  testStorageConnection,
  resetStorageToLocal,
  uploadTestAsset,
} from '../../lib/storage-api';
import { apiErrorMessage } from '../../lib/api';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';

export const CloudflareR2Settings: React.FC = () => {
  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Form State
  const [provider, setProvider] = useState<'local' | 'cloudflare_r2'>('local');
  const [accountId, setAccountId] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [region, setRegion] = useState('auto');
  const [showSecret, setShowSecret] = useState(false);

  // Modal State for Disconnect / Reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchStorageSettings();
      setSettings(data);
      setProvider(data.provider);
      setAccountId(data.account_id || '');
      setBucketName(data.bucket_name || '');
      setAccessKeyId(data.access_key_id || '');
      setPublicUrl(data.public_url || '');
      setRegion(data.region || 'auto');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load storage configuration.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);
    setSuccessMessage(null);
    try {
      const res = await testStorageConnection({
        account_id: accountId,
        bucket_name: bucketName,
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey || undefined,
        region: region || 'auto',
      });
      setTestResult(res);
      setSuccessMessage(res.message);
    } catch (err) {
      setError(apiErrorMessage(err, 'Connection test failed. Verify your Cloudflare credentials.'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const req: UpdateStorageSettingsRequest = {
        provider,
        account_id: accountId,
        bucket_name: bucketName,
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey || undefined,
        public_url: publicUrl,
        region: region || 'auto',
      };
      const updated = await updateStorageSettings(req);
      setSettings(updated);
      setSecretAccessKey('');
      setSuccessMessage(
        provider === 'cloudflare_r2'
          ? 'Cloudflare R2 credentials verified and activated platform-wide!'
          : 'Storage switched to local disk fallback.'
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save storage settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      const updated = await resetStorageToLocal();
      setSettings(updated);
      setProvider('local');
      setShowResetModal(false);
      setSuccessMessage('Storage driver reset to local filesystem.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to reset storage provider.'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleFileTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const res = await uploadTestAsset(file);
      setUploadResult(res);
      setSuccessMessage(`Test file uploaded successfully to: ${res.key}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Test upload failed.'));
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        <RefreshCw className="h-5 w-5 animate-spin mr-2 text-teal-600" />
        Loading Cloudflare R2 storage settings...
      </div>
    );
  }

  const isR2Active = settings?.provider === 'cloudflare_r2';

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Storage Operation Failed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-bold">Configuration Updated</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {/* Storage Provider Status Overview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
              isR2Active ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-slate-100 text-slate-600'
            }`}>
              {isR2Active ? <Cloud className="h-6 w-6" /> : <HardDrive className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {isR2Active ? 'Cloudflare R2 Object Storage' : 'Local Disk Storage (Host Mode)'}
                </h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  isR2Active ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isR2Active ? 'ACTIVE LIVE' : 'DEVELOPMENT FALLBACK'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isR2Active
                  ? `Connected to bucket "${settings?.bucket_name}" via Cloudflare high-speed edge CDN.`
                  : 'Files stored directly on the local server filesystem.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isR2Active && (
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
              >
                Disconnect R2
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadSettings()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Status
            </button>
          </div>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Storage Engine Settings</span>
          </div>
          <a
            href="https://dash.cloudflare.com/?to=/:account/r2/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
          >
            Cloudflare R2 Console
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Target Storage Driver</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider('cloudflare_r2')}
                className={`flex items-start p-3.5 rounded-xl border text-left transition ${
                  provider === 'cloudflare_r2'
                    ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Cloud className={`h-5 w-5 mr-3 mt-0.5 ${provider === 'cloudflare_r2' ? 'text-teal-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Cloudflare R2 Object Storage</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">S3-compatible, zero egress fees, global edge caching.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('local')}
                className={`flex items-start p-3.5 rounded-xl border text-left transition ${
                  provider === 'local'
                    ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <HardDrive className={`h-5 w-5 mr-3 mt-0.5 ${provider === 'local' ? 'text-teal-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Local Filesystem Storage</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Development storage inside ./uploads on host server.</p>
                </div>
              </button>
            </div>
          </div>

          {/* R2 Specific Form Fields */}
          {provider === 'cloudflare_r2' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cloudflare Account ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="e.g. 5d78a9c412f9b8032e5412..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Found in Cloudflare Dashboard &gt; R2 Overview right sidebar.</p>
                </div>

                {/* Bucket Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    R2 Bucket Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    placeholder="e.g. ecom-ventures-media"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">The exact name of your Cloudflare R2 bucket.</p>
                </div>

                {/* Access Key ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    R2 Access Key ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    placeholder="e.g. 9b43d8a176e5f012c8..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Generated from Cloudflare &gt; R2 &gt; Manage R2 API Tokens.</p>
                </div>

                {/* Secret Access Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    R2 Secret Access Key{' '}
                    {settings?.has_secret_access_key && (
                      <span className="text-teal-600 font-normal">(Encrypted at rest • leave blank to keep current)</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={secretAccessKey}
                      onChange={(e) => setSecretAccessKey(e.target.value)}
                      placeholder={settings?.has_secret_access_key ? '••••••••••••••••••••••••••••••••' : 'Enter Secret Access Key'}
                      className="w-full px-3 py-2 pr-9 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Stored using AES-256-GCM authenticated encryption in Platform DB.</p>
                </div>

                {/* Public CDN URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Public CDN URL or Custom Domain
                  </label>
                  <input
                    type="url"
                    value={publicUrl}
                    onChange={(e) => setPublicUrl(e.target.value)}
                    placeholder="e.g. https://media.dropiobd.com or https://pub-xxx.r2.dev"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Your Cloudflare Custom Domain or R2 Public Bucket dev URL.</p>
                </div>

                {/* Region */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Storage Region
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="auto"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave as &quot;auto&quot; for automatic geolocation routing.</p>
                </div>
              </div>

              {/* Ping Test Result Banner */}
              {testResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>{testResult.message}</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-emerald-100 rounded text-emerald-700">
                    {testResult.latency_ms}ms ping
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {provider === 'cloudflare_r2' && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !accountId || !bucketName || !accessKeyId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition"
                >
                  <Zap className={`h-3.5 w-3.5 text-amber-500 ${isTesting ? 'animate-pulse' : ''}`} />
                  {isTesting ? 'Probing R2 Bucket...' : 'Test Connection'}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 shadow-sm transition"
            >
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              {isSaving ? 'Encrypting & Saving...' : 'Save & Activate Storage'}
            </button>
          </div>
        </form>
      </div>

      {/* Interactive Folder Structure Visualizer */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-2.5">
          <FolderTree className="h-5 w-5 text-teal-600" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">Partitioned Object Hierarchy Map</h4>
            <p className="text-xs text-slate-500">
              Guaranteed tenant isolation: Master Admin and Brand files are partitioned automatically into isolated folders.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Master Admin Folder */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
              <Folder className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span>platform/ (Master Admin Assets)</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 pl-6 border-l-2 border-slate-200">
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">admin-avatars/</span>
                <span className="text-[11px] text-slate-400">- Platform superadmin profiles</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">branding/</span>
                <span className="text-[11px] text-slate-400">- DropioBD platform logo &amp; favicons</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">themes/</span>
                <span className="text-[11px] text-slate-400">- Theme marketplace screenshots</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">attachments/</span>
                <span className="text-[11px] text-slate-400">- Security &amp; compliance reports</span>
              </li>
            </ul>
          </div>

          {/* Tenant Store Folders */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
              <Folder className="h-4 w-4 text-teal-500 fill-teal-500" />
              <span>stores/{'{store_slug}'}/ (Tenant Isolated Data)</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 pl-6 border-l-2 border-slate-200">
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">products/</span>
                <span className="text-[11px] text-slate-400">- Catalog gallery &amp; variants</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">reviews/</span>
                <span className="text-[11px] text-slate-400">- Customer unboxing &amp; fit photos</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">categories/</span>
                <span className="text-[11px] text-slate-400">- Category banners &amp; icons</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">brand/</span>
                <span className="text-[11px] text-slate-400">- Store logo, favicon &amp; hero banners</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">blog/</span>
                <span className="text-[11px] text-slate-400">- Blog posts &amp; editorial media</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">music/</span>
                <span className="text-[11px] text-slate-400">- Brand audio tracks &amp; playlists</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-teal-700">orders/</span>
                <span className="text-[11px] text-slate-400">- Invoices &amp; return proofs</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Live Upload Test Sandbox */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <UploadCloud className="h-5 w-5 text-teal-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900">Live Upload Verification Sandbox</h4>
              <p className="text-xs text-slate-500">
                Upload a test image to verify active driver streaming and inspect the generated Cloudflare R2 path.
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-sm transition">
            {isUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileImage className="h-3.5 w-3.5" />}
            {isUploading ? 'Uploading to R2...' : 'Select Test Image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileTestUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>

        {uploadResult && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <img
                src={uploadResult.url}
                alt="Upload Probe"
                className="h-12 w-12 rounded-lg object-cover border border-slate-200 bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="font-mono">{uploadResult.key}</span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">VERIFIED</span>
                </p>
                <a
                  href={uploadResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-teal-600 hover:underline font-mono inline-flex items-center gap-1 mt-0.5"
                >
                  {uploadResult.url}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 font-mono">
              {(uploadResult.size / 1024).toFixed(1)} KB • {uploadResult.content_type}
            </div>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Modal (Universal UI Mandate: No silent deletes!) */}
      <ConfirmDeleteModal
        isOpen={showResetModal}
        title="Disconnect Cloudflare R2 Storage?"
        itemName="Cloudflare R2 Object Storage Credentials"
        itemType="Storage Driver"
        warningMessage="Are you sure you want to revert to local host filesystem storage? Files stored on Cloudflare R2 will remain in your bucket, but new uploads will be directed to the local server disk."
        confirmButtonText="Confirm & Revert to Local"
        busyButtonText="Reverting Driver..."
        isDeleting={isResetting}
        onConfirm={handleConfirmReset}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
};
