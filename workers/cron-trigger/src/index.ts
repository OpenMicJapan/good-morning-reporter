export default {
  // workers.dev への HTTP アクセスは 404 を返す
  // （ハンドラ未定義だと scanner のアクセスが scriptThrewException として
  //   analytics に記録され、cron 障害調査のノイズになるため）
  async fetch(): Promise<Response> {
    return new Response('not found', { status: 404 });
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // wrangler.toml の cron 以外（変更の伝播遅延で残った古い trigger 等）では本番を起動しない
    if (event.cron !== '0 14 * * *') {
      console.log(`Ignored unexpected cron: ${event.cron}`);
      return;
    }

    const res = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'gm-cron-trigger',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            dry_run: 'false',
            readonly: 'false',
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error: ${res.status} ${body}`);
    }

    console.log('Dispatched workflow successfully');
  },
};

interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  WORKFLOW_FILE: string;
}
