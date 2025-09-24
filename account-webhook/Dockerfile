# Dockerfile
FROM public.ecr.aws/lambda/nodejs:18

# Copy package files
COPY package*.json ${LAMBDA_TASK_ROOT}/

 
# Install production dependencies
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Copy the rest of the application
COPY . ${LAMBDA_TASK_ROOT}/

# Lambda handler (not Express server)
CMD ["index.handler"]
