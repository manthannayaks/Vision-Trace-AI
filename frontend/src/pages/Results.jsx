import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnalysisResults, getFileUrl } from '../services/api';
import {
  ArrowLeft, Search, AlertTriangle, Users, ChevronRight,
  Play, Pause, RotateCcw, Download, Clock, ShieldAlert,
  Maximize2, Eye, CheckCircle2
} from 'lucide-react';

function ScoreBar({ label, value, color }) {
  const pct = Math.round((value ?? 0) * 100);
  const colorMap = {
    brand:  'bg-red-500',
    blue:   'bg-blue-500',
    purple: 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-white">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color] || colorMap.brand} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CandidateModal({ candidate, onClose, onSeek }) {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-lg font-semibold text-white">Track #{candidate.track_id} Details</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
        </div>

        {/* Image */}
        {candidate.representative_image_url && (
          <div className={`relative rounded-lg overflow-hidden border ${
            candidate.is_match || (candidate.combined_score ?? 0) >= 0.50
              ? 'border-red-500/40'
              : 'border-gray-700/50'
          }`}>
            <img
              src={getFileUrl(candidate.representative_image_url)}
              alt="Candidate"
              className="w-full h-56 object-cover"
            />
            <div className={`absolute top-2 left-2 px-2.5 py-1 rounded backdrop-blur-sm text-xs font-mono font-bold border ${
              candidate.is_match || (candidate.combined_score ?? 0) >= 0.50
                ? 'bg-black/70 text-red-400 border-red-500/40'
                : 'bg-black/70 text-gray-400 border-gray-700'
            }`}>
              {candidate.is_match || (candidate.combined_score ?? 0) >= 0.50
                ? `TARGET MATCH: ${((candidate.combined_score ?? 0) * 100).toFixed(1)}%`
                : `NON-TARGET PEDESTRIAN: ${((candidate.combined_score ?? 0) * 100).toFixed(1)}%`}
            </div>
          </div>
        )}

        {/* Scores */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-gray-800/40 border border-gray-800">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Match Score</p>
            <p className="text-lg font-mono font-bold text-red-400">
              {((candidate.combined_score ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Image Sim</p>
            <p className="text-lg font-mono text-blue-400">
              {candidate.image_similarity != null ? `${(candidate.image_similarity * 100).toFixed(0)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Text Sim</p>
            <p className="text-lg font-mono text-purple-400">
              {candidate.text_similarity != null ? `${(candidate.text_similarity * 100).toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Sightings */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center justify-between">
            <span>Sightings Timeline</span>
            <span className="text-[10px] text-gray-500">Click to jump in video</span>
          </h4>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {candidate.sightings?.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (onSeek) onSeek(s.start_timestamp);
                  onClose();
                }}
                className="w-full flex items-center justify-between text-xs p-2.5 rounded bg-gray-800/40 hover:bg-red-500/10 border border-gray-700/50 hover:border-red-500/30 text-gray-300 hover:text-red-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3 h-3 text-red-400" />
                  <span>{s.start_timestamp?.toFixed(1)}s – {s.end_timestamp?.toFixed(1)}s</span>
                </div>
                <span className="font-mono text-gray-500">{s.frame_count} frames ({s.duration}s)</span>
              </button>
            ))}
          </div>
        </div>

        {/* Attributes */}
        {candidate.detected_attributes && candidate.detected_attributes !== 'N/A' && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-1">Detected Appearance</h4>
            <p className="text-xs text-gray-300 bg-gray-800/30 p-2.5 rounded border border-gray-800">
              {candidate.detected_attributes}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {candidate.first_seen != null && (
            <button
              onClick={() => {
                if (onSeek) onSeek(candidate.first_seen);
                onClose();
              }}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Play in Video ({candidate.first_seen?.toFixed(1)}s)
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Results() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    getAnalysisResults(analysisId)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [analysisId]);

  const jumpToTimestamp = (timestamp) => {
    if (timestamp == null) return;
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, timestamp);
      videoRef.current.play().catch(() => {});
    }
    if (playerContainerRef.current) {
      playerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Analysis results not found.</p>
        <button
          onClick={() => navigate('/search')}
          className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg"
        >
          Start New Search
        </button>
      </div>
    );
  }

  // Filter candidates
  const candidates = (data.candidates || []).filter((c) => {
    if (c.combined_score < minScore) return false;
    if (tierFilter === 'all') return true;
    const tier = c.ranking_tier?.toLowerCase() || '';
    if (tierFilter === 'high') return tier.includes('high');
    if (tierFilter === 'medium') return tier.includes('moderate');
    if (tierFilter === 'low') return tier.includes('low');
    return true;
  });

  const videoUrl = getFileUrl(data.video?.annotated_video_url || data.video?.original_video_url);

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </button>
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-red-600/20"
        >
          <Search className="w-3.5 h-3.5" />
          New Search
        </button>
      </div>

      {/* Summary Banner */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">CCTV Video</p>
            <p className="text-sm text-white font-medium truncate">{data.video?.original_filename || 'Video'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">People Detected</p>
            <p className="text-sm text-white font-mono font-medium">{data.video?.total_detections ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Unique Tracks</p>
            <p className="text-sm text-white font-mono font-medium">{data.video?.unique_tracks_count ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Potential Matches</p>
            <p className={`text-sm font-mono font-bold ${
              (data.potential_matches ?? 0) > 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {data.potential_matches ?? 0}
            </p>
          </div>
        </div>

        {/* Query details */}
        {data.query?.description && (
          <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-start gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0 font-medium">Target Query:</span>
            <span className="text-xs text-red-300 font-medium bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
              "{data.query.description}"
            </span>
          </div>
        )}
      </div>

      {/* ── CCTV FULL VIDEO PLAYER SECTION ── */}
      {videoUrl && (
        <div ref={playerContainerRef} className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden shadow-2xl">
          {/* Player Header */}
          <div className="p-4 border-b border-gray-800/80 flex flex-wrap items-center justify-between gap-3 bg-gray-900">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                data.has_target_matches || (data.potential_matches ?? 0) > 0
                  ? 'bg-red-500/15 border-red-500/30'
                  : 'bg-gray-800/60 border-gray-700/50'
              }`}>
                <Play className={`w-4 h-4 ${
                  data.has_target_matches || (data.potential_matches ?? 0) > 0
                    ? 'text-red-400 fill-red-400'
                    : 'text-gray-400 fill-gray-400'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Full CCTV Surveillance Playback</h3>
                  {data.has_target_matches || (data.potential_matches ?? 0) > 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      TARGET DETECTED IN RED
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 font-semibold flex items-center gap-1">
                      NO TARGET MATCH DETECTED
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.has_target_matches || (data.potential_matches ?? 0) > 0
                    ? 'The person matching the description is highlighted with a clear red bounding box and track ID'
                    : 'No person in this footage met the appearance criteria. All detected pedestrians are shown with neutral tracking.'}
                </p>
              </div>
            </div>

            {/* Download Link */}
            <a
              href={videoUrl}
              download={`cctv_retrieval_${data.video?.original_filename || 'output.mp4'}`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-medium transition-colors border border-gray-700"
            >
              <Download className="w-3.5 h-3.5" />
              Download CCTV Video
            </a>
          </div>

          {/* Video Container */}
          <div className="relative bg-black aspect-video max-h-[540px] flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="auto"
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              className="w-full h-full object-contain"
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Sighting Jump Shortcuts Bar */}
          {candidates.length > 0 && (
            <div className="p-3 bg-gray-900/90 border-t border-gray-800 flex items-center gap-2 overflow-x-auto">
              <span className="text-gray-400 text-xs font-semibold flex-shrink-0 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-red-400" />
                Jump to Target Appearance:
              </span>
              <div className="flex items-center gap-2">
                {candidates.map((c) => (
                  <button
                    key={c.track_id}
                    onClick={() => jumpToTimestamp(c.first_seen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800/90 hover:bg-red-500/20 border border-gray-700 hover:border-red-500/40 text-gray-200 hover:text-red-300 text-xs font-mono transition-all flex-shrink-0 shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Track #{c.track_id}</span>
                    <span className="text-gray-400">({c.first_seen?.toFixed(1)}s)</span>
                    <span className="text-red-400 font-bold">
                      {((c.combined_score ?? 0) * 100).toFixed(0)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl border border-gray-800/50 bg-gray-900/30">
        {/* Tier filter tabs */}
        <div className="flex items-center gap-1">
          {['all', 'high', 'medium', 'low'].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                tierFilter === t
                  ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Min score slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Min Score:</span>
          <input
            type="range"
            min="0"
            max="0.8"
            step="0.05"
            value={minScore}
            onChange={(e) => setMinScore(parseFloat(e.target.value))}
            className="w-24 accent-red-500"
          />
          <span className="text-xs font-mono text-white">{(minScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Informational Callout when 0 matches found */}
      {data.query?.description && (data.potential_matches ?? 0) === 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">
              No Potential Target Matches Found for "{data.query.description}"
            </p>
            <p className="text-xs text-amber-200/70 mt-1">
              None of the {data.video?.unique_tracks_count ?? 0} pedestrians detected in this CCTV footage met the appearance threshold. 
              All detected pedestrians are listed below as non-targets for reference.
            </p>
          </div>
        </div>
      )}

      {/* Candidate Cards Grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center justify-between">
          <span>
            {(data.potential_matches ?? 0) > 0 ? 'Target Candidates & Detected Pedestrians' : 'Detected Pedestrians in Footage'} ({candidates.length})
          </span>
          <span className="text-xs text-gray-500">Click a card to play or view sightings</span>
        </h3>

        {candidates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((c, i) => {
              const score = (c.combined_score ?? 0) * 100;
              const isMatch = Boolean(c.is_match || (c.combined_score ?? 0) >= 0.50);
              const isHigh = score >= 65;
              const isMed = score >= 50 && score < 65;

              return (
                <div
                  key={c.track_db_id || i}
                  className={`group rounded-xl border overflow-hidden transition-all duration-200 shadow-md ${
                    isMatch
                      ? 'border-red-500/40 bg-gray-900/70 hover:border-red-500 hover:bg-gray-800/60 ring-1 ring-red-500/20'
                      : 'border-gray-800/80 bg-gray-900/40 hover:bg-gray-800/40 hover:border-gray-700'
                  }`}
                >
                  {/* Image Container */}
                  <div
                    onClick={() => setSelectedCandidate(c)}
                    className="relative aspect-[4/3] bg-black overflow-hidden cursor-pointer"
                  >
                    {c.representative_image_url ? (
                      <img
                        src={getFileUrl(c.representative_image_url)}
                        alt="Candidate"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        <Users className="w-10 h-10 text-gray-700" />
                      </div>
                    )}

                    {/* Rank Badge */}
                    <div className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-mono ${
                      isMatch ? 'bg-red-950/80 text-red-200 border border-red-500/40' : 'bg-black/70 text-gray-400 border border-gray-800'
                    }`}>
                      #{i + 1} {isMatch ? 'TARGET' : 'PEDESTRIAN'}
                    </div>

                    {/* Score Badge */}
                    <div className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold backdrop-blur-sm ${
                      isHigh ? 'bg-red-600/30 text-red-300 border border-red-500/50' :
                      isMed  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-gray-800/80 text-gray-400 border border-gray-700/50'
                    }`}>
                      {isMatch ? `MATCH ${score.toFixed(1)}%` : `NON-TARGET ${score.toFixed(1)}%`}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Track #{c.track_id}</p>
                        <p className="text-[11px] text-gray-400">
                          Seen {c.first_seen?.toFixed(1)}s – {c.last_seen?.toFixed(1)}s
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                        {c.detection_count} detections
                      </span>
                    </div>

                    {/* Score breakdown bars */}
                    <div className="space-y-1.5 pt-1">
                      {c.image_similarity != null && (
                        <ScoreBar label="Image Match" value={c.image_similarity} color="blue" />
                      )}
                      {c.text_similarity != null && (
                        <ScoreBar label="Text Match" value={c.text_similarity} color="purple" />
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => jumpToTimestamp(c.first_seen)}
                        className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        Play at {c.first_seen?.toFixed(1)}s
                      </button>
                      <button
                        onClick={() => setSelectedCandidate(c)}
                        className="py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl border border-dashed border-gray-800">
            <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No candidates match your current filters</p>
            <p className="text-xs text-gray-600 mt-1">Try lowering the minimum score or changing tiers</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <CandidateModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onSeek={jumpToTimestamp}
      />

      {/* Disclaimer */}
      <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-300/80 leading-relaxed">
          <strong className="text-amber-200">Surveillance Retrieval Notice:</strong> Results are potential visual appearance matches based on garment and silhouette similarity. Scores are mathematical similarities, not certainty of identity. Human operator verification is mandatory.
        </p>
      </div>
    </div>
  );
}
