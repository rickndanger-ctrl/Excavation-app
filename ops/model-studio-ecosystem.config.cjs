const path = require("node:path");

const repository = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "civil-model-studio",
      cwd: repository,
      script: path.join(repository, "scripts", "run-model-studio-service.sh"),
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
