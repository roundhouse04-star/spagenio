module.exports = {
  apps: [
    {
      name: 'spagenio',
      script: 'server.js',
      cwd: '/Users/roundhouse04/프로젝트/spagenio/ai-router-dashboard',
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
      interpreter: 'python3',
      cwd: '/Users/roundhouse04/프로젝트/spagenio/ai-router-dashboard',
      watch: false,
      restart_delay: 3000,
      max_restarts: 5
    },
    {
      name: 'spagenio-quant',
      script: 'quant_engine.py',
      interpreter: 'python3',
      cwd: '/Users/roundhouse04/프로젝트/spagenio/ai-router-dashboard',
      watch: false,
      restart_delay: 3000,
      max_restarts: 5
    }
  ]
};
