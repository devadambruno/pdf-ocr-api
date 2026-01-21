const jobs = new Map();

const MAX_JOBS = 100;
const TTL = 10 * 60 * 1000; // 10 min

function createJob() {
  if (jobs.size >= MAX_JOBS) {
    const oldestKey = jobs.keys().next().value;
    jobs.delete(oldestKey);
  }

  const id = Math.random().toString(36).slice(2);

  jobs.set(id, {
    status: "processing",
    createdAt: Date.now()
  });

  return id;
}

function setJobResult(id, text) {
  jobs.set(id, {
    status: "done",
    text,
    createdAt: Date.now()
  });
}

function setJobError(id, error) {
  jobs.set(id, {
    status: "error",
    error,
    createdAt: Date.now()
  });
}

function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;

  if (Date.now() - job.createdAt > TTL) {
    jobs.delete(id);
    return null;
  }

  return job;
}

module.exports = {
  createJob,
  setJobResult,
  setJobError,
  getJob
};
