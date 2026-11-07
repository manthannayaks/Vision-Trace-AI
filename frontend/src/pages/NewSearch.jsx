import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Image, FileText, Play, X, CheckCircle2,
  Video, User, Loader2, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { uploadVideo, createSearchQuery, createSearchQueryJSON, startAnalysis, getAnalysisProgress } from '../services/api';

const STEPS = ['Upload Video', 'Describe Person', 'Analyze'];

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            i < current ? 'bg-emerald-500/15 text-emerald-400' :
            i === current ? 'bg-brand-600/15 text-brand-400 ring-1 ring-brand-500/30' :
            'bg-gray-800/50 text-gray-500'
          }`}>
            {i < current ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">{i + 1}</span>
            )}
            {label}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-emerald-500/30' : 'bg-gray-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function NewSearch() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Step tracking
  const [step, setStep] = useState(0);

  // Step 1: Video
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoData, setVideoData] = useState(null); // server response
  const [dragOver, setDragOver] = useState(false);

  // Step 2: Person description
  const [referenceImage, setReferenceImage] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [referenceBase64, setReferenceBase64] = useState(null);
  const [description, setDescription] = useState('');
  const [searchMode, setSearchMode] = useState('both');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageWeight, setImageWeight] = useState(0.5);
  const [textWeight, setTextWeight] = useState(0.5);
  const [queryData, setQueryData] = useState(null);

  // Step 3: Analysis
  const [sampleRate, setSampleRate] = useState(3);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analysisId, setAnalysisId] = useState(null);
  const [error, setError] = useState(null);

  // Auto-detect search mode
  useEffect(() => {
    const hasImage = !!referenceImage;
    const hasText = description.trim().length > 0;
    if (hasImage && hasText) setSearchMode('both');
    else if (hasImage) setSearchMode('image_only');
    else if (hasText) setSearchMode('text_only');
    else setSearchMode('both');
  }, [referenceImage, description]);

  // Handle video file selection
  const handleVideoSelect = (file) => {
    if (!file) return;
    const valid = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!valid.includes(ext)) {
      setError('Invalid video format. Use MP4, AVI, MOV, MKV, or WEBM.');
      return;
    }
    setError(null);
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleVideoSelect(file);
  };

  // Upload video
  const handleUpload = async () => {
    if (!videoFile) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', videoFile);
      const res = await uploadVideo(formData, setUploadProgress);
      setVideoData(res.data);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  // Validate and proceed to review (instant transition with 0 network lag)
  const handleProceedToReview = () => {
    if (searchMode === 'text_only' && !description.trim()) {
      setError('Please enter a description of the person.');
      return;
    }
    if (searchMode === 'image_only' && !referenceImage) {
      setError('Please upload a reference photo.');
      return;
    }
    if (searchMode === 'both' && !referenceImage && !description.trim()) {
      setError('Please provide a reference photo or description.');
      return;
    }

    setError(null);
    setStep(2); // Instantly advances to Step 3!
  };

  // Start analysis: creates search query (if needed) and queues analysis
  const handleStartAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisStep('Registering target query profile...');
    setError(null);
    try {
      let qId = queryData?.id || null;

      // 1. Create search query profile via pure JSON (immune to HTTP/2 multipart issues)
      if (!qId && (referenceBase64 || description.trim())) {
        const payload = {
          description: description.trim() || null,
          search_mode: searchMode,
          image_weight: imageWeight,
          text_weight: textWeight,
          reference_image_base64: referenceBase64 || null,
          reference_image_filename: referenceImage?.name || 'reference.jpg',
        };
        const qRes = await createSearchQueryJSON(payload);
        qId = qRes.data.id;
        setQueryData(qRes.data);
      }

      // 2. Start analysis
      setAnalysisProgress(12);
      setAnalysisStep('Launching background CCTV analysis...');
      const res = await startAnalysis({
        video_id: videoData.id,
        query_id: qId,
        sample_rate: sampleRate,
        image_weight: imageWeight,
        text_weight: textWeight,
        auto_delete_raw: false,
        skip_annotated_video: false,
      });
      setAnalysisId(res.data.id);
    } catch (err) {
      setAnalyzing(false);
      setError(err.response?.data?.detail || err.message || 'Failed to start analysis');
    }
  };

  // Poll analysis progress
  useEffect(() => {
    if (!analysisId) return;
    const interval = setInterval(async () => {
      try {
        const res = await getAnalysisProgress(analysisId);
        const { progress, current_step, status, error_message } = res.data;
        setAnalysisProgress(progress);
        setAnalysisStep(current_step);

        if (status === 'completed') {
          clearInterval(interval);
          setAnalyzing(false);
          // Navigate to results after a brief moment
          setTimeout(() => navigate(`/results/${analysisId}`), 500);
        } else if (status === 'failed') {
          clearInterval(interval);
          setAnalyzing(false);
          setError(error_message || 'Analysis failed');
        }
      } catch {
        // Silently retry
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [analysisId, navigate]);

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoData(null);
    setStep(0);
  };

  const removeImage = () => {
    setReferenceImage(null);
    setReferencePreview(null);
    setReferenceBase64(null);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">New Person Search</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload CCTV footage, describe the person, and find potential visual matches
        </p>
      </div>

      <StepIndicator current={step} steps={STEPS} />

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── STEP 0: Upload Video ── */}
      {step === 0 && (
        <div className="space-y-6">
          {!videoFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragOver
                  ? 'border-brand-400 bg-brand-500/5'
                  : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
              }`}
            >
              <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-white font-medium">Drop CCTV video here or click to browse</p>
              <p className="text-sm text-gray-500 mt-2">MP4, AVI, MOV, MKV, WEBM — any resolution</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleVideoSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
              {/* Video Preview */}
              <div className="relative bg-black aspect-video">
                <video
                  src={videoPreviewUrl}
                  className="w-full h-full object-contain"
                  controls
                  muted
                />
                <button
                  onClick={removeVideo}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-900/80 hover:bg-red-500/80 text-gray-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* File Info */}
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{videoFile.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Continue
                    </>
                  )}
                </button>
              </div>
              {/* Upload Progress */}
              {uploading && (
                <div className="px-4 pb-4">
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 1: Describe Person ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Uploaded video confirmation */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              Video uploaded: <span className="text-white font-medium">{videoData?.original_filename}</span>
              <span className="text-gray-500 ml-2">
                ({videoData?.duration?.toFixed(1)}s · {videoData?.width}×{videoData?.height} · {videoData?.fps?.toFixed(0)} fps)
              </span>
            </p>
          </div>

          {/* Two-column: Image + Text */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reference Image */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Image className="w-4 h-4" />
                Reference Photo
                <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              {!referencePreview ? (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl p-8 text-center transition-colors"
                >
                  <User className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Upload a photo of the person</p>
                  <p className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP</p>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) {
                        setReferenceImage(f);
                        setReferencePreview(URL.createObjectURL(f));
                        const reader = new FileReader();
                        reader.onload = (ev) => setReferenceBase64(ev.target.result);
                        reader.readAsDataURL(f);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-gray-700">
                  <img
                    src={referencePreview}
                    alt="Reference"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-gray-900/80 hover:bg-red-500/80 text-gray-300 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Text Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <FileText className="w-4 h-4" />
                Appearance Description
                <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={"Describe visible appearance:\n• Upper clothing: Black hoodie\n• Lower clothing: Blue jeans\n• Footwear: White sneakers\n• Bag: Black backpack\n• Build: Slim"}
                className="w-full h-48 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 resize-none transition-all"
              />
            </div>
          </div>

          {/* Detected Mode */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Search mode:</span>
            <span className={`px-2 py-0.5 rounded-md font-medium ${
              searchMode === 'both' ? 'bg-brand-500/10 text-brand-400' :
              searchMode === 'image_only' ? 'bg-blue-500/10 text-blue-400' :
              'bg-purple-500/10 text-purple-400'
            }`}>
              {searchMode === 'both' ? 'Image + Text' :
               searchMode === 'image_only' ? 'Image Only' : 'Text Only'}
            </span>
          </div>

          {/* Advanced Settings */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="p-4 rounded-lg border border-gray-800/50 bg-gray-900/30 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Image Weight: <span className="font-mono text-white">{imageWeight.toFixed(2)}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={imageWeight}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setImageWeight(v);
                    setTextWeight(Math.round((1 - v) * 100) / 100);
                  }}
                  className="w-full accent-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Text Weight: <span className="font-mono text-white">{textWeight.toFixed(2)}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={textWeight}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setTextWeight(v);
                    setImageWeight(Math.round((1 - v) * 100) / 100);
                  }}
                  className="w-full accent-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Frame Sample Rate: <span className="font-mono text-white">every {sampleRate} frame{sampleRate > 1 ? 's' : ''}</span>
                </label>
                <input
                  type="range" min="1" max="10" step="1"
                  value={sampleRate}
                  onChange={(e) => setSampleRate(parseInt(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <p className="text-[10px] text-gray-600 mt-1">Lower = more accurate, slower. Higher = faster, may miss frames.</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(0)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleProceedToReview}
              disabled={!referenceImage && !description.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-red-600/20"
            >
              Continue
              <Play className="w-4 h-4 fill-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Run Analysis ── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary of inputs */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 divide-y divide-gray-800/50">
            {/* Video */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Video className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Video</p>
                <p className="text-sm text-white">{videoData?.original_filename}</p>
              </div>
              <span className="ml-auto text-xs text-gray-500 font-mono">{videoData?.duration?.toFixed(1)}s</span>
            </div>

            {/* Person Query */}
            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Person Description</p>
                {referencePreview && (
                  <img src={referencePreview} alt="ref" className="w-12 h-12 rounded-lg object-cover mt-1 border border-gray-700" />
                )}
                {description.trim() && (
                  <p className="text-sm text-gray-300 mt-1 line-clamp-3">{description}</p>
                )}
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-md font-medium ${
                  searchMode === 'both' ? 'bg-brand-500/10 text-brand-400' :
                  searchMode === 'image_only' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-purple-500/10 text-purple-400'
                }`}>
                  {searchMode === 'both' ? 'Image + Text' : searchMode === 'image_only' ? 'Image Only' : 'Text Only'}
                </span>
              </div>
            </div>
          </div>

          {/* Analysis Progress */}
          {analyzing ? (
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                <div>
                  <p className="text-sm text-white font-medium">Analyzing footage...</p>
                  <p className="text-xs text-gray-400 mt-0.5">{analysisStep}</p>
                </div>
                <span className="ml-auto text-lg font-mono font-bold text-brand-400">
                  {analysisProgress.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500 animate-progress"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-600 text-center">
                Running YOLO detection → ByteTrack → CLIP matching → Ranking
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleStartAnalysis}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Analysis
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <p className="text-[11px] text-amber-400/80 leading-relaxed">
              <AlertTriangle className="w-3 h-3 inline mr-1.5 -mt-0.5" />
              Results are potential visual matches based on appearance similarity only. They are not proof of identity
              and require human verification. This system does not perform facial recognition.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

