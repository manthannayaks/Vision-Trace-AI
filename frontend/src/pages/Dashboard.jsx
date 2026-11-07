import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getHealth } from '../services/api';
import {
  Video, Users, Fingerprint, Eye, Search, ArrowRight,
  Cpu, Activity, CheckCircle2, AlertCircle
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.blue}`}>
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

  useEffect(() => {
    Promise.all([
      getDashboardStats().catch(() => null),
      getHealth().catch(() => null),
    ]).then(([statsRes, healthRes]) => {
      if (statsRes) setStats(statsRes.data);
      if (healthRes) setHealth(healthRes.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">System overview and recent activity</p>
        </div>
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          New Search
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Video}       label="Videos Processed"   value={stats?.total_videos_processed ?? 0} color="blue" />
        <StatCard icon={Users}       label="People Detected"    value={stats?.total_people_detected ?? 0}  color="green" />
        <StatCard icon={Fingerprint} label="Unique Tracks"      value={stats?.unique_candidate_tracks ?? 0} color="purple" />
        <StatCard icon={Eye}         label="Match Sightings"    value={stats?.total_matching_sightings ?? 0} color="amber" />
      </div>

      {/* System Status */}
      {health && (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-400" />
            System Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm text-white font-medium capitalize">{health.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-brand-400" />
              <div>
                <p className="text-xs text-gray-500">Device</p>
                <p className="text-sm text-white font-medium">{health.device_description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-xs text-gray-500">Models</p>
                <p className="text-sm text-white font-medium">{health.yolo_model} + CLIP</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Recent Analysis Jobs</h3>
          {stats?.recent_jobs?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => job.status === 'completed' ? navigate(`/results/${job.id}`) : null}
                  className={`flex items-center justify-between p-3 rounded-lg border border-gray-800/30 bg-gray-800/20 ${
                    job.status === 'completed' ? 'cursor-pointer hover:bg-gray-800/40' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      job.status === 'completed' ? 'bg-emerald-400' :
                      job.status === 'processing' ? 'bg-amber-400 animate-pulse' :
                      job.status === 'failed' ? 'bg-red-400' : 'bg-gray-500'
                    }`} />
                    <div>
                      <p className="text-sm text-white">Job #{job.id}</p>
                      <p className="text-xs text-gray-500">{new Date(job.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                    job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    job.status === 'processing' ? 'bg-amber-500/10 text-amber-400' :
                    job.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {job.status}
                  </span>
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
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Recent Matches</h3>
          {stats?.recent_matches?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_matches.slice(0, 5).map((match) => (
                <div key={match.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-800/30 bg-gray-800/20">
                  <div className="flex items-center gap-3">
                    {match.representative_image_url ? (
                      <img
                        src={match.representative_image_url}
                        alt="Candidate"
                        className="w-10 h-10 rounded-lg object-cover border border-gray-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                        <Users className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-white">Track #{match.track_number ?? '—'}</p>
                      <p className="text-xs text-gray-500">{match.detection_count ?? 0} detections</p>
                    </div>
                  </div>
                  <span className="text-sm font-mono font-semibold text-brand-400">
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
    </div>
  );
}

