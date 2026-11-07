import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Image, FileText, Play, X, CheckCircle2,
  Video, User, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  RotateCcw
} from 'lucide-react';
import { uploadVideo, createSearchQueryJSON, startAnalysis, getAnalysisProgress } from '../services/api';

const STEPS = ['Upload CCTV Footage', 'Describe Person & Retrieve'];

export default function NewSearch() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Step tracking (0: Upload Video, 1: Describe & Run Analysis)
  const [step, setStep] = useState(0);

  // Step 1: Video
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoData, setVideoData] = useState(null);
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

  // Analysis state
  const [sampleRate, setSampleRate] = useState(3);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analysisId, setAnalysisId] = useState(null);
  const [error, setError] = useState(null);

  // Auto-detect search mode
  useEffect(() => {
    const hasImage = !!referenceImage || !!referenceBase64;
    const hasText = description.trim().length > 0;
    if (hasImage && hasText) setSearchMode('both');
    else if (hasImage) setSearchMode('image_only');
    else if (hasText) setSearchMode('text_only');
    else setSearchMode('both');
  }, [referenceImage, referenceBase64, description]);

  // Video file selection
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
      setStep(1); // Advance to description & analysis step
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  // Start end-to-end analysis
  const handleStartAnalysis = async () => {
    if (searchMode === 'text_only' && !description.trim()) {
      setError('Please enter a description of the person.');
      return;
    }
    if (searchMode === 'image_only' && !referenceBase64) {
      setError('Please upload a reference photo.');
      return;
    }
    if (searchMode === 'both' && !referenceBase64 && !description.trim()) {
      setError('Please provide a reference photo or description.');
      return;
    }

    setAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisStep('Registering target query profile...');
    setError(null);

    try {
      // 1. Create search query profile via Base64 JSON
      const payload = {
        description: description.trim() || null,
        search_mode: searchMode,
        image_weight: imageWeight,
        text_weight: textWeight,
        reference_image_base64: referenceBase64 || null,
        reference_image_filename: referenceImage?.name || 'reference.jpg',
      };
      const qRes = await createSearchQueryJSON(payload);
      const qId = qRes.data.id;

      // 2. Launch background analysis
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
    let failCount = 0;
    const interval = setInterval(async () => {
      try {
        const res = await getAnalysisProgress(analysisId);
        failCount = 0;
        const { progress, current_step, status, error_message } = res.data;
        
        // Ensure progress looks responsive and never regresses below 10%
        setAnalysisProgress(Math.max(progress, status === 'processing' ? 15 : 8));
        setAnalysisStep(current_step || 'Processing CCTV video frames...');

        if (status === 'completed') {
          clearInterval(interval);
          setAnalysisProgress(100);
          setAnalysisStep('Analysis complete! Redirecting to surveillance player...');
          setAnalyzing(false);
          setTimeout(() => navigate(`/results/${analysisId}`), 600);
        } else if (status === 'failed') {
          clearInterval(interval);
          setAnalyzing(false);
          setError(error_message || 'Analysis failed. Please check video format or try again.');
        }
      } catch (pollErr) {
        failCount += 1;
        // Allow up to 15 retries (~22s) in case Render container is momentarily busy with CPU
        if (pollErr.response?.status === 404 || failCount >= 15) {
          clearInterval(interval);
          setAnalyzing(false);
          setAnalysisId(null);
          setError('Backend connection timed out or analysis was interrupted. Please retry.');
        }
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">New Person Search</h2>
        <p className="text-sm text-gray-400 mt-1">
          Upload CCTV surveillance footage, specify the person's appearance, and retrieve matching candidates
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              i < step ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
              i === step ? 'bg-red-600/20 text-red-400 border border-red-500/40 ring-1 ring-red-500/30' :
              'bg-gray-800/50 text-gray-500'
            }`}>
              {i < step ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">{i + 1}</span>
              )}
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px ${i < step ? 'bg-emerald-500/40' : 'bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── STEP 1: Upload Video ── */}
      {step === 0 && (
        <div>
          {!videoFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragOver
                  ? 'border-red-500 bg-red-500/5'
                  : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
              }`}
            >
              <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-white font-semibold">Drop CCTV surveillance video here or click to browse</p>
              <p className="text-xs text-gray-500 mt-2">MP4, AVI, MOV, MKV, WEBM — any CCTV camera resolution</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleVideoSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden shadow-2xl">
              {/* Video Preview */}
              <div className="relative bg-black aspect-video max-h-96 flex items-center justify-center">
                <video
                  src={videoPreviewUrl}
                  className="w-full h-full object-contain"
                  controls
                  muted
                />
                <button
                  onClick={removeVideo}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-900/80 hover:bg-red-600 text-gray-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* File Info & Action */}
              <div className="p-4 flex items-center justify-between border-t border-gray-800/80">
                <div>
                  <p className="text-sm text-white font-medium">{videoFile.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-red-600/20"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Next
                    </>
                  )}
                </button>
              </div>

              {uploading && (
                <div className="px-4 pb-4">
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Describe Person & Run Analysis ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Confirmed Video Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/80 border border-gray-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-white font-medium">
                  Video: {videoData?.original_filename}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {videoData?.duration?.toFixed(1)}s duration · {videoData?.width}×{videoData?.height} · {videoData?.fps?.toFixed(0)} FPS
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep(0)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded bg-gray-800"
            >
              <RotateCcw className="w-3 h-3" />
              Change Video
            </button>
          </div>

          {/* Person Criteria Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Reference Image */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">
                <Image className="w-4 h-4 text-red-400" />
                Reference Photograph
                <span className="text-gray-500 font-normal lowercase">(optional)</span>
              </label>

              {!referencePreview ? (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-8 text-center transition-colors bg-gray-900/40"
                >
                  <User className="w-9 h-9 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-300 font-medium">Upload photo of the person</p>
                  <p className="text-[10px] text-gray-500 mt-1">JPG, PNG, WEBP</p>
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
                <div className="relative rounded-xl overflow-hidden border border-gray-700 aspect-[4/3] bg-black">
                  <img
                    src={referencePreview}
                    alt="Reference"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-900/80 hover:bg-red-600 text-gray-300 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Appearance Text Description */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">
                <FileText className="w-4 h-4 text-purple-400" />
                Appearance Description
                <span className="text-gray-500 font-normal lowercase">(optional)</span>
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={"Example visible appearance:\n• Upper clothing: Black t-shirt\n• Lower clothing: Black shorts\n• Footwear: Running shoes\n• Build: Slim / Athletic"}
                className="w-full h-48 bg-gray-900/60 border border-gray-700 rounded-xl p-3.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 resize-none transition-all"
              />
            </div>
          </div>

          {/* Mode Indicator & Advanced Settings Toggle */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Mode:</span>
              <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${
                searchMode === 'both' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                searchMode === 'image_only' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                'bg-purple-500/15 text-purple-400 border border-purple-500/30'
              }`}>
                {searchMode === 'both' ? 'Photo + Text' : searchMode === 'image_only' ? 'Photo Only' : 'Text Only'}
              </span>
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Sampling & Weights
            </button>
          </div>

          {/* Advanced Sliders */}
          {showAdvanced && (
            <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between mb-1.5 text-gray-400">
                  <span>Frame Sampling Rate:</span>
                  <span className="font-mono text-white">Every {sampleRate} frames (~10 fps)</span>
                </div>
                <input
                  type="range" min="1" max="8" step="1"
                  value={sampleRate}
                  onChange={(e) => setSampleRate(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex justify-between mb-1 text-gray-400">
                    <span>Photo Weight:</span>
                    <span className="font-mono text-white">{(imageWeight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={imageWeight}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setImageWeight(v);
                      setTextWeight(Math.round((1 - v) * 100) / 100);
                    }}
                    className="w-full accent-red-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-gray-400">
                    <span>Text Weight:</span>
                    <span className="font-mono text-white">{(textWeight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={textWeight}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setTextWeight(v);
                      setImageWeight(Math.round((1 - v) * 100) / 100);
                    }}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYSIS PROGRESS PANEL ── */}
          {analyzing ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-red-400 animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-semibold">Analyzing CCTV Footage...</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{analysisStep}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xl font-mono font-bold text-red-400">
                    {analysisProgress.toFixed(0)}%
                  </span>
                  <button
                    onClick={() => {
                      setAnalyzing(false);
                      setAnalysisId(null);
                      setError('Analysis cancelled.');
                    }}
                    className="text-xs px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>

              <p className="text-[11px] text-gray-500 text-center">
                YOLO Pedestrian Detection → ByteTrack Association → CLIP Visual Embedding → Multimodal Ranking
              </p>
            </div>
          ) : (
            /* ── LAUNCH BUTTON ── */
            <div className="pt-2">
              <button
                onClick={handleStartAnalysis}
                disabled={!referenceBase64 && !description.trim()}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-35 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-red-600/25 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                START CCTV RETRIEVAL ANALYSIS
              </button>
            </div>
          )}

          {/* Ethical Notice */}
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-amber-400" />
              VisionTrack AI performs visual appearance retrieval only. Similarity scores represent mathematical visual alignment and require human operator verification.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
