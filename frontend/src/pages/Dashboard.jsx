import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getHealth, getFileUrl, deleteAnalysisJob } from '../services/api';
import {
  Video, Users, Fingerprint, Eye, Search, ArrowRight,
  Cpu, Activity, CheckCircle2, AlertCircle, RefreshCw, Trash2,
  Play, Clock, X, Loader2
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.blue} transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 opacity-80" />
      </div>
      <p className="text-2xl font-bold font-mono text-white">{value}</p>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coldStartNotice, setColdStartNotice] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const fetchData = async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        getDashboardStats().catch(() => null),
        getHealth().catch(() => null),
      ]);
      if (statsRes) setStats(statsRes.data);
      if (healthRes) setHealth(healthRes.data);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setColdStartNotice(true);
    }, 2500);

    fetchData().finally(() => clearTimeout(timer));
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleDeleteJob = async (jobId, e) => {
    e.stopPropagation();
    try {
      await deleteAnalysisJob(jobId);
      // Remove from state immediately
      setStats((prev) => ({
        ...prev,
        recent_jobs: prev.recent_jobs.filter((j) => j.id !== jobId),
      }));
      if (selectedJob?.id === jobId) setSelectedJob(null);
    } catch {
      alert('Failed to delete job');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-4">
        <div className="w-9 h-9 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-300 font-medium">Connecting to VisionTrack AI...</p>
        {coldStartNotice && (
          <div className="max-w-md p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
            <p className="text-xs text-amber-300 font-semibold">Waking up cloud backend...</p>
            <p className="text-[11px] text-amber-400/80 leading-relaxed">
              Render free tier spins down idle instances after 15 minutes of inactivity. Initial startup takes ~30 seconds.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Surveillance Dashboard</h2>
          <p className="text-sm text-gray-400 mt-0.5">Real-time surveillance metrics and candidate retrieval logs</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-gray-700"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-red-600/20"
          >
            <Search className="w-4 h-4" />
            New Search
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Video}       label="CCTV Videos Processed" value={stats?.total_videos_processed ?? 0} color="blue" />
        <StatCard icon={Users}       label="Total Persons Detected" value={stats?.total_people_detected ?? 0}  color="green" />
        <StatCard icon={Fingerprint} label="Unique Track IDs"       value={stats?.unique_candidate_tracks ?? 0} color="purple" />
        <StatCard icon={Eye}         label="Matching Sightings"     value={stats?.total_matching_sightings ?? 0} color="amber" />
      </div>

      {/* System Hardware Status */}
      {health && (
        <div className="rounded-xl border border-gray-800/70 bg-gray-900/60 p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-red-400" />
            Engine Telemetry
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-[11px] text-gray-500">Service Status</p>
                <p className="text-sm text-white font-medium capitalize">{health.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-[11px] text-gray-500">Compute Hardware</p>
                <p className="text-sm text-white font-medium">{health.device_description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-[11px] text-gray-500">ML Pipeline</p>
                <p className="text-sm text-white font-medium">{health.yolo_model} + CLIP ViT-B/32</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="rounded-xl border border-gray-800/70 bg-gray-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Analysis Jobs</h3>
            <span className="text-xs text-gray-500">{stats?.recent_jobs?.length ?? 0} jobs</span>
          </div>

          {stats?.recent_jobs?.length > 0 ? (
            <div className="space-y-2.5">
              {stats.recent_jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => {
                    if (job.status === 'completed') navigate(`/results/${job.id}`);
                    else setSelectedJob(job);
                  }}
                  className={`group flex items-center justify-between p-3 rounded-lg border border-gray-800/60 bg-gray-800/30 hover:bg-gray-800/60 transition-all ${
                    job.status === 'completed' ? 'cursor-pointer hover:border-red-500/40' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      job.status === 'completed' ? 'bg-emerald-400' :
                      job.status === 'processing' ? 'bg-amber-400 animate-ping' :
                      job.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium">Job #{job.id}</p>
                        {job.status === 'processing' && (
                          <span className="text-[10px] text-amber-400 font-mono">
                            ({job.progress?.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(job.created_at).toLocaleString()}
                        {job.error_message && (
                          <span className="text-red-400/90 ml-1.5 truncate block max-w-xs">
                            Error: {job.error_message}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium capitalize ${
                      job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      job.status === 'processing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                      job.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      {job.status}
                    </span>

                    {/* Delete icon for failed or queued jobs */}
                    {(job.status === 'failed' || job.status === 'queued') && (
                      <button
                        onClick={(e) => handleDeleteJob(job.id, e)}
                        title="Delete / Clear job"
                        className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {job.status === 'completed' && (
                      <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-red-400 transition-colors" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No analysis jobs yet</p>
              <p className="text-xs text-gray-600 mt-1">Start a new search to begin</p>
            </div>
          )}
        </div>

        {/* Recent Matches */}
        <div className="rounded-xl border border-gray-800/70 bg-gray-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Candidate Sightings</h3>
            <span className="text-xs text-gray-500">{stats?.recent_matches?.length ?? 0} matches</span>
          </div>

          {stats?.recent_matches?.length > 0 ? (
            <div className="space-y-2.5">
              {stats.recent_matches.slice(0, 5).map((match) => (
                <div key={match.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-800/60 bg-gray-800/30">
                  <div className="flex items-center gap-3">
                    {match.representative_image_url ? (
                      <img
                        src={getFileUrl(match.representative_image_url)}
                        alt="Candidate"
                        className="w-11 h-11 rounded-lg object-cover border border-gray-700"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-gray-800 flex items-center justify-center">
                        <Users className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-white font-semibold">Track #{match.track_number ?? '—'}</p>
                      <p className="text-xs text-gray-400">{match.detection_count ?? 0} frame detections</p>
                    </div>
                  </div>
                  <span className="text-sm font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20">
                    {((match.combined_score ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No matches found yet</p>
              <p className="text-xs text-gray-600 mt-1">Run an analysis to find candidates</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Queued / Failed Job inspection */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedJob(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Job #{selectedJob.id} Details</h3>
              <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded bg-gray-800/40">
                <span className="text-gray-400">Status:</span>
                <span className="font-semibold text-white capitalize">{selectedJob.status}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-gray-800/40">
                <span className="text-gray-400">Progress:</span>
                <span className="font-mono text-white">{selectedJob.progress ?? 0}%</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-gray-800/40">
                <span className="text-gray-400">Current Step:</span>
                <span className="text-white">{selectedJob.current_step || '—'}</span>
              </div>
              {selectedJob.error_message && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-300">
                  <p className="font-semibold mb-0.5">Error details:</p>
                  <p className="text-[11px] leading-relaxed">{selectedJob.error_message}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={(e) => handleDeleteJob(selectedJob.id, e)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Job
              </button>
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
