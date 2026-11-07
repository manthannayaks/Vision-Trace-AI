import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnalysisResults } from '../services/api';
import {
  ArrowLeft, Search, Filter, AlertTriangle, Eye, Clock,
  CheckCircle2, Users, SlidersHorizontal, ChevronRight, ExternalLink
} from 'lucide-react';

function ScoreBar({ label, value, color }) {
  const pct = Math.round((value ?? 0) * 100);
  const colorMap = {
    brand:  'bg-brand-500',
    blue:   'bg-blue-500',
    purple: 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-white">{pct}%</span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color] || colorMap.brand} rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CandidateModal({ candidate, onClose }) {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Track #{candidate.track_id} Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
        </div>

        {/* Image */}
        {candidate.representative_image_url && (
          <img
            src={candidate.representative_image_url}
            alt="Candidate"
            className="w-full h-56 object-cover rounded-lg border border-gray-800"
          />
        )}

        {/* Scores */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-gray-800/40">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Match Score</p>
            <p className="text-lg font-mono font-bold text-brand-400">
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
          <h4 className="text-xs font-semibold text-gray-400 mb-2">Sightings Timeline</h4>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {candidate.sightings?.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-gray-800/30 text-gray-300">
                <span>{s.start_timestamp?.toFixed(1)}s – {s.end_timestamp?.toFixed(1)}s</span>
                <span className="font-mono text-gray-500">{s.frame_count} frames ({s.duration}s)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attributes */}
        {candidate.detected_attributes && candidate.detected_attributes !== 'N/A' && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-1">Detected Appearance</h4>
            <p className="text-xs text-gray-300">{candidate.detected_attributes}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function Results() {
  const { analysisId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  useEffect(() => {
    getAnalysisResults(analysisId)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [analysisId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Analysis results not found.</p>
        <button
          onClick={() => navigate('/search')}
          className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg"
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

  return (
    <div className="space-y-6">
      {/* Top Bar */}
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
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          New Search
        </button>
      </div>

      {/* Summary Banner */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Video</p>
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
            <p className="text-xs text-gray-500">Matches Found</p>
            <p className="text-sm text-brand-400 font-mono font-bold">{data.total_candidates ?? 0}</p>
          </div>
        </div>

        {/* Query details if present */}
        {data.query?.description && (
          <div className="mt-4 pt-3 border-t border-gray-800/50 flex items-start gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">Query:</span>
            <span className="text-xs text-gray-300 line-clamp-1">{data.query.description}</span>
          </div>
        )}
      </div>

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
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
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
            className="w-24 accent-brand-500"
          />
          <span className="text-xs font-mono text-white">{(minScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Candidate Cards Grid */}
      {candidates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((c, i) => {
            const score = (c.combined_score ?? 0) * 100;
            const isHigh = score >= 55;
            const isMed = score >= 40 && score < 55;

            return (
              <div
                key={c.track_db_id || i}
                onClick={() => setSelectedCandidate(c)}
                className="group rounded-xl border border-gray-800/60 bg-gray-900/40 hover:bg-gray-800/40 hover:border-gray-700 cursor-pointer overflow-hidden transition-all duration-200"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-black overflow-hidden">
                  {c.representative_image_url ? (
                    <img
                      src={c.representative_image_url}
                      alt="Candidate"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <Users className="w-10 h-10 text-gray-700" />
                    </div>
                  )}

                  {/* Rank Badge */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[11px] font-mono text-white">
                    #{i + 1}
                  </div>

                  {/* Score Badge */}
                  <div className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold backdrop-blur-sm ${
                    isHigh ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    isMed  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-gray-800/80 text-gray-400'
                  }`}>
                    {score.toFixed(1)}%
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Track #{c.track_id}</p>
                      <p className="text-[11px] text-gray-500">
                        Seen {c.first_seen?.toFixed(1)}s – {c.last_seen?.toFixed(1)}s
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
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

                  {/* View Details button */}
                  <div className="pt-2 flex items-center justify-between text-xs text-brand-400 group-hover:text-brand-300">
                    <span>View Sightings</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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

      {/* Modal */}
      <CandidateModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
        <p className="text-[11px] text-amber-400/80 leading-relaxed">
          <AlertTriangle className="w-3 h-3 inline mr-1.5 -mt-0.5" />
          These are potential visual matches based on appearance similarity only. Scores reflect visual similarity
          and are not proof of identity. Human verification is required.
        </p>
      </div>
    </div>
  );
}

