# Image to run the AWS Robot scripts in a container: python, aws CLI, robot venv ready at /work/.venv.
# Build context = code/tests/robot (only requirements.txt is needed), see run_robot_in_docker.sh.
FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir awscli boto3

# The scripts activate $PROJECT_ROOT/.venv: a venv built here is copied into the anonymous volume at run time.
COPY requirements.txt /tmp/requirements.txt
RUN python3 -m venv /work/.venv \
    && /work/.venv/bin/pip install --no-cache-dir --upgrade pip \
    && /work/.venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt boto3 \
    && chmod -R a+rwX /work/.venv \
    && mkdir -p /home/runner && chmod 777 /home/runner

ENV HOME=/home/runner
WORKDIR /work
