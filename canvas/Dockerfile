FROM public.ecr.aws/lambda/nodejs:18

RUN yum -y update && yum -y install \
    gcc-c++ \
    cairo-devel \
    pango-devel \
    libjpeg-turbo-devel \
    giflib-devel \
    librsvg2-devel \
    make \
    tar \
    gzip \
    && yum clean all

RUN curl -sSLO https://zlib.net/zlib-1.2.11.tar.gz && \
    tar -xzf zlib-1.2.11.tar.gz && \
    cd zlib-1.2.11 && \
    ./configure && make && make install && \
    cd .. && rm -rf zlib-1.2.11*

# Ensure Node uses the new zlib
ENV LD_LIBRARY_PATH=/usr/local/lib:${LD_LIBRARY_PATH}

COPY package*.json ${LAMBDA_TASK_ROOT}/

RUN npm install --ignore-scripts && \
    npm rebuild canvas --build-from-source && \
    npm cache clean --force

COPY . ${LAMBDA_TASK_ROOT}/

CMD ["index.handler"]
