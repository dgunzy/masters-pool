FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Create a .env file at build time if you want to include default values
# Otherwise, you'll need to provide these at runtime or mount a volume
# RUN echo "RAPIDAPI_HOST=your-host\nRAPIDAPI_KEY=your-key" > .env

# Make sure your CSV file is included
# If the CSV file comes from elsewhere, you might need to adjust this
# or set up a volume mount

# Your app binds to port 3000 so you'll use the EXPOSE instruction
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "server.js" ]
