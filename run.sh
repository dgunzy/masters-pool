#!/bin/bash

# Stop and remove existing container (ignore errors if it doesn't exist)
docker stop masters-pool || true
docker rm masters-pool || true

# Build fresh image
docker build -t masters-pool-app .

# Run new container
docker run -d -p 3000:3000 \
  -e RAPIDAPI_HOST=live-golf-data.p.rapidapi.com \
  -e RAPIDAPI_KEY=b9ca41b503msh4952fb8a9e13e33p1f3297jsn33143a93e223 \
  -v $(pwd)/masters-pool-2.csv:/usr/src/app/masters-pool-2.csv \
  --name masters-pool \
  masters-pool-app

echo "Container deployed successfully!"