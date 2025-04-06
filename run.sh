#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found"
  exit 1
fi

# Verify that required environment variables are set
if [ -z "$RAPIDAPI_KEY" ] || [ -z "$RAPIDAPI_HOST" ]; then
  echo "Error: RAPIDAPI_KEY and RAPIDAPI_HOST must be set in .env file"
  exit 1
fi

# Stop and remove existing container (ignore errors if it doesn't exist)
docker stop masters-pool || true
docker rm masters-pool || true

# Build fresh image
docker build -t masters-pool-app .

# Run new container with environment variables from .env
docker run -d -p 3000:3000 \
  -e RAPIDAPI_HOST=$RAPIDAPI_HOST \
  -e RAPIDAPI_KEY=$RAPIDAPI_KEY \
  -v $(pwd)/masters-pool-2.csv:/usr/src/app/masters-pool-2.csv \
  -v $(pwd)/masters-pool-2025.csv:/usr/src/app/masters-pool-2025.csv \
  --name masters-pool \
  masters-pool-app

echo "Container deployed successfully! Tailing logs now (press Ctrl+C to stop viewing logs)..."
echo "------------------------"

# Tail the logs with -f (follow) option
docker logs -f masters-pool