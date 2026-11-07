import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnalysisJobs, deleteVideo } from '../services/api';
import { Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight, Trash2, Video } from 'lucide-react';

export default function History() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalysisJobs()
      .then((res) => {
        setJobs(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Search History</h2>
        <p className="text-sm text-gray-500 mt-1">Past analysis jobs and retrieved candidate records</p>
      </div>

      {jobs.length > 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 divide-y divide-gray-800/50">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${
                  job.status === 'completed' ? 'bg-emerald-400' :
                  job.status === 'processing' ? 'bg-amber-400 animate-pulse' :
                  job.status === 'failed' ? 'bg-red-400' : 'bg-gray-600'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium">Job #{job.id}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                      job.status === 'processing' ? 'bg-amber-500/10 text-amber-400' :
                      job.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-800 text-gray-400'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(job.created_at).toLocaleString()} · Sample: every {job.sample_rate} frames
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {job.status === 'completed' && (
                  <button
                    onClick={() => navigate(`/results/${job.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600/15 hover:bg-brand-600/25 text-brand-400 text-xs font-medium rounded-lg transition-colors"
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
        <div className="text-center py-16 rounded-xl border border-dashed border-gray-800">
          <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No search history yet</p>
          <p className="text-xs text-gray-600 mt-1">Run an analysis from the New Search page</p>
          <button
            onClick={() => navigate('/search')}
            className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Start First Search
          </button>
        </div>
      )}
    </div>
  );
}

