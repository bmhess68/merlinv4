# MERLIN - Westchester/Putnam Real Time Crime System

## Overview
MERLIN is a real-time crime tracking and incident management system designed for law enforcement agencies. It provides GPS tracking, incident management, CAD integration, and real-time communication features.

## Core Features
- Real-time vehicle GPS tracking
- Incident management and reporting
- CAD (Computer Aided Dispatch) integration
- Weather data integration
- Address search functionality
- Slack notifications for incidents
- User session management

## System Architecture

### Backend Services
1. **Main Server** (Node.js/Express)
   - Handles API requests
   - Manages WebSocket connections
   - Processes vehicle tracking data
   - Reference: `src/server.js`

2. **CAD Monitor Service** (Python)
   - Monitors email for CAD alerts
   - Processes and stores alerts in database
   - Runs as systemd service
   - Configuration: `/etc/systemd/system/cad-monitor.service`

### Database
- PostgreSQL database
- Tables:
  - incidents
  - cad_alerts
  - users
  - user_sessions

## Installation & Setup

### Prerequisites
- Node.js 18+
- Python 3.8+
- PostgreSQL 12+
- Redis

### Environment Variables
Create a `.env` file in the root directory: