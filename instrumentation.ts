export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startJobPoller } = await import('@/lib/job-queue')
    startJobPoller(30_000) // poll every 30 seconds
  }
}
