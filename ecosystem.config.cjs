module.exports = {
  apps: [
    {
      name: 'evesite-joint-review',
      cwd: __dirname,
      script: 'npm',
      args: ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '4175', '--strictPort'],
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
