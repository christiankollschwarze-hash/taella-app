@echo off
title TAELLA - Mock-Up (http://localhost:5173)
cd /d "%~dp0"
start "" http://localhost:5173
npm run dev
