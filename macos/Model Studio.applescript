property disclaimer : "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"

on run
  set launcherPath to (POSIX path of (path to home folder)) & "Library/Application Support/Model Studio/repository/scripts/launch-model-studio.sh"
  try
    do shell script "MODEL_STUDIO_APP_HANDLES_ERRORS=1 /bin/bash " & quoted form of launcherPath
  on error errorMessage number errorNumber
    display alert "Model Studio could not open" message errorMessage & return & return & disclaimer as critical
  end try
end run
