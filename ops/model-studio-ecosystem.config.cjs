const fs = require("node:fs");
const path = require("node:path");

const repository = path.resolve(process.env.MODEL_STUDIO_REPOSITORY || path.resolve(__dirname, ".."));
const installedService = path.join(__dirname, "run-model-studio-service.sh");
const service = fs.existsSync(installedService)
  ? installedService
  : path.join(repository, "scripts", "run-model-studio-service.sh");

module.exports = {
  apps: [
    {
      name: "civil-model-studio",
      cwd: repository,
      script: service,
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      env: {
        MODEL_STUDIO_HOST: "127.0.0.1",
        MODEL_STUDIO_PORT: "8777",
        MODEL_STUDIO_REPOSITORY: repository,
      },
    },
  ],
};
