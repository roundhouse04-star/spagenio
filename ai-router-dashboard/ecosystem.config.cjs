module.exports = {
  apps: [
    {
      name: 'spagenio',
      script: 'server.js',
      interpreter: '/Users/roundhouse04/.nvm/versions/node/v22.22.2/bin/node',
      cwd: '/Users/roundhouse04/projects/spagenio/ai-router-dashboard',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: 'spagenio-stock',
      script: 'stock_server.py',
      interpreter: '/Users/roundhouse04/projects/spagenio/ai-router-dashboard/stock_venv/bin/python3',
      cwd: '/Users/roundhouse04/projects/spagenio/ai-router-dashboard',
      watch: false,
      restart_delay: 3000,
      max_restarts: 5
    },
    {
      name: 'spagenio-quant',
      script: 'quant_engine.py',
      interpreter: '/Users/roundhouse04/projects/spagenio/ai-router-dashboard/stock_venv/bin/python3',
      cwd: '/Users/roundhouse04/projects/spagenio/ai-router-dashboard',
      watch: false,
      restart_delay: 3000,
      max_restarts: 5
    }
  ,
    {
      name: 'cloudflared',
      script: '/opt/homebrew/bin/cloudflared',
      args: 'tunnel run spagenio',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      restart_delay: 3000
    }
  ]
};
