FROM public.ecr.aws/lambda/nodejs:16
 
# Copy package files
COPY package*.json ${LAMBDA_TASK_ROOT}/
 
# Install production dependencies
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force
 
# Copy flow service files
COPY index.js secrets.js redis.js ${LAMBDA_TASK_ROOT}/
COPY helper/ ${LAMBDA_TASK_ROOT}/helper/
COPY routes/ ${LAMBDA_TASK_ROOT}/routes/
 
# Lambda handler
CMD ["index.handler"]