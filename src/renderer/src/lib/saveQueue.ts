export interface SaveJob {
  projectId: string
  run: () => Promise<void>
  overlay?: (state: any) => any
}

// Preserve operation order, including after a network failure. Later edits must
// never overtake a failed edit and then be overwritten when it is retried.
export function createSaveQueue(onChange: (pending: number, error: string | null) => void) {
  const jobs: SaveJob[] = []
  let running = false
  let error: string | null = null
  const notify = () => onChange(jobs.length, error)
  async function drain() {
    if (running || error) return
    running = true
    notify()
    try {
      while (jobs.length) {
        try {
          await jobs[0].run()
          jobs.shift()
          notify()
        } catch (cause) {
          error = cause instanceof Error ? cause.message : 'Could not reach the server.'
          notify()
          break
        }
      }
    } finally { running = false }
  }
  return {
    enqueue(job: SaveJob) { jobs.push(job); notify(); return drain() },
    retry() { error = null; return drain() },
    overlay<T>(projectId: string, state: T): T {
      return jobs.filter(j => j.projectId === projectId).reduce((s, j) => j.overlay ? j.overlay(s) : s, state)
    }
  }
}
