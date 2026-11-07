import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnalysisJobs, deleteAnalysisJob } from '../services/api';
import { Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight, Trash2, Video, RefreshCw } from 'lucide-react';

export default function History() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coldNotice, setColdNotice] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobs = () => {
    setLoading(true);
    setError(null);
    getAnalysisJobs()
      .then((res) => {
        setJobs(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Unable to connect to backend server');
        setLoading(false);
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => setColdNotice(true), 2500);
    fetchJobs();
    return () => clearTimeout(timer);
  }, []);

  const handleDelete = async (jobId, e) => {
    e.stopPropagation();
    try {
      await deleteAnalysisJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch {
      alert('Failed to delete job');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-4">
        <div className="w-9 h-9 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-300 font-medium">Loading search history...</p>
        {coldNotice && (
          <div className="max-w-md p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
            <p className="text-xs text-amber-300 font-semibold">Connecting to cloud server...</p>
            <p className="text-[11px] text-amber-400/80 leading-relaxed">
              Render free tier spins down idle instances after 15 minutes of inactivity. Initial connection takes ~30 seconds.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <div>
          <h3 className="text-base font-semibold text-white">Connection Error</h3>
          <p className="text-xs text-red-300 mt-1">{error}</p>
        </div>
        <button
          onClick={fetchJobs}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Search History</h2>
          <p className="text-sm text-gray-400 mt-0.5">Past CCTV surveillance analyses and retrieval jobs</p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {jobs.length > 0 ? (
        <div className="rounded-xl border border-gray-800/80 bg-gray-900/60 divide-y divide-gray-800/60 shadow-xl">
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => job.status === 'completed' ? navigate(`/results/${job.id}`) : null}
              className={`p-4 flex items-center justify-between transition-colors ${
                job.status === 'completed' ? 'hover:bg-gray-800/40 cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  job.status === 'completed' ? 'bg-emerald-400' :
                  job.status === 'processing' ? 'bg-amber-400 animate-ping' :
                  job.status === 'failed' ? 'bg-red-500' : 'bg-gray-600'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium">Job #{job.id}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize ${
                      job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      job.status === 'processing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      job.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(job.created_at).toLocaleString()} · Sample: every {job.sample_rate} frames
                    {job.error_message && (
                      <span className="text-red-400 ml-2">Error: {job.error_message}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(job.status === 'failed' || job.status === 'queued') && (
                  <button
                    onClick={(e) => handleDelete(job.id, e)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete job record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {job.status === 'completed' && (
                  <button
                    onClick={() => navigate(`/results/${job.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/15 hover:bg-red-600/25 text-red-400 text-xs font-semibold rounded-lg transition-colors border border-red-500/30"
                  >
                    View Results
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-xl border border-dashed border-gray-800 bg-gray-900/30">
          <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No search history yet</p>
          <p className="text-xs text-gray-600 mt-1">Upload CCTV footage and start your first search</p>
          <button
            onClick={() => navigate('/search')}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-red-600/20"
          >
            Start First Search
          </button>
        </div>
      )}
    </div>
  );
}
