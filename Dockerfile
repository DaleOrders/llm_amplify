# Dockerfile for Python Flask Web Application

# Use the official Python image from Docker Hub
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file to install dependencies
COPY requirements.txt /requirements.txt

# Install the dependencies specified in the requirements file
ARG ENVIRONMENT=$ENVIRONMENT

RUN pip install --no-cache-dir -r /requirements.txt

# Copy the entire project directory to the container
COPY . .

# Expose the port that Flask will run on (typically 5000)
EXPOSE 5000

# Set environment variables for Flask
ENV FLASK_APP=/app/server/app.py
ENV FLASK_ENV=$ENVIRONMENT
ENV FLASK_DEBUG=0


# Run the Flask application
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]

