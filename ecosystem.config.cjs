/**
 * pm2 Ecosystem Config — Gig Lead Responder Automation
 *
 * Start:   pm2 start ecosystem.config.cjs
 * Save:    pm2 save
 * Boot:    pm2 startup (then paste the command it outputs)
 * Logs:    pm2 logs gig-lead-responder
 * Status:  pm2 status
 * Restart: pm2 restart gig-lead-responder
 */
module.exports = {
  apps: [
    {
      name: "gig-lead-responder",

      // Use tsx to run TypeScript directly (no build step)
      script: "node_modules/.bin/tsx",
      args: "src/automation/main.ts",

      // Working directory — where .env and credentials.json live
      cwd: __dirname,

      // Environment
      env: {
        NODE_ENV: "production",
        // DRY_RUN defaults to true in config.ts — set to "false" when ready
      },

      // Restart behavior
      autorestart: true,
      max_memory_restart: "200M",
      restart_delay: 5000,       // 5s between restarts
      max_restarts: 10,          // Stop after 10 crashes in min_uptime window
      min_uptime: "60s",         // Must run 60s to count as "stable"

      // Don't watch files (manual restart after code changes)
      watch: false,

      // Logging
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Single instance (no cluster mode needed)
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
